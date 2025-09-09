// src/pages/WeeklyLeaderboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import LeaderboardTabs from "../components/LeaderboardTabs";

const badgeClass = {
  winner: "bg-amber-500 text-white",
  gotw1: "bg-green-600 text-white",
  gotw2: "bg-yellow-500 text-black",
  gotw3: "bg-orange-600 text-white",
  potwExact: "bg-sky-500 text-white",
};

function rowClasses(p, isLocked) {
  if (isLocked) return "bg-white";
  if (p.is_correct_pick === true) {
    return p.is_favorite === true
      ? "bg-yellow-100 ring-1 ring-yellow-300"
      : "bg-green-100 ring-1 ring-green-300";
  }
  if (p.is_correct_pick === false) {
    return "bg-red-100 ring-1 ring-red-300";
  }
  return "bg-white";
}

/** Parse a kickoff datetime from various backend shapes */
function parseKickoff(g) {
  const raw = g.kickoff ?? g.start_time ?? g.kickoff_time ?? g.game_time;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Find earliest Sunday kickoff (UTC Sunday) for a given array of games */
function earliestSundayISO(games = []) {
  const sundays = games
    .map(parseKickoff)
    .filter(Boolean)
    .filter((d) => d.getUTCDay() === 0) // Sunday in UTC
    .sort((a, b) => a - b);
  return sundays[0]?.toISOString() || null;
}

/** Safe display name */
function displayNameOf(p, fallbackIndex = 0) {
  return (
    p.display_name ||
    p.first_name ||
    p.name ||
    (p.email ? p.email.split("@")[0] : "") ||
    (p.user_id ? `User ${p.user_id}` : "") ||
    `Player ${fallbackIndex + 1}`
  );
}

/** Merge leaderboard score rows with public picks by user_id */
function mergeRows(scoreRows = [], picks = [], podium = [], potwExactList = []) {
  const picksByUser = new Map();
  picks.forEach((p) => {
    if (p && p.user_id != null) picksByUser.set(Number(p.user_id), p);
  });

  const podiumByUser = new Map();
  podium.forEach(({ user_id, award }) => {
    // backend uses 3=1st, 2=2nd, 1=3rd
    const rank = award === 3 ? 1 : award === 2 ? 2 : award === 1 ? 3 : null;
    podiumByUser.set(Number(user_id), rank);
  });

  const potwExactSet = new Set(
    (potwExactList || []).map((u) => Number(u?.user_id ?? u))
  );

  return (scoreRows || []).map((s) => {
    const uid = Number(s.user_id);
    const p = picksByUser.get(uid);

    return {
      user_id: uid,
      display_name: s.name || p?.first_name || p?.name || "—",

      // Picks (only present after unlock)
      team: p?.team ?? null,
      gotw_prediction: p?.gotw_prediction ?? null,
      potw_prediction: p?.potw_prediction ?? null,

      // Favorite/underdog & correctness (if backend provides on public endpoint)
      is_favorite: p?.is_favorite ?? null,
      is_correct_pick: p?.is_correct_pick ?? null,

      // From scoring endpoint
      base_points: Number.isFinite(Number(s.base_points)) ? Number(s.base_points) : null,
      gotw_points: Number(s.gotw_points ?? 0),
      potw_points: Number(s.potw_points ?? 0),
      total_points: Number(s.total_points ?? 0),

      // Badges
      gotw_rank: podiumByUser.get(uid) ?? null,
      potw_exact: potwExactSet.has(uid),

      // Winner highlight if backend ever flags it
      is_weekly_winner: false,
    };
  });
}

export default function WeeklyLeaderboard() {
  const { week: weekParam } = useParams();
  const navigate = useNavigate();

  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [state, setState] = useState({
    week: null,
    factor: 1,
    lockedFromAPI: false,
    unlock_at_iso: null, // authoritative if provided by backend
    qa_mode: false,
    gotw_actual: null,
    potw_actual: null,
    rows: [],
  });

  const [fallbackUnlockISO, setFallbackUnlockISO] = useState(null);

  // 1) Normalize week param (redirect to current if invalid)
  useEffect(() => {
    if (weekParam === "overall") {
      navigate("/leaderboard/overall", { replace: true });
      return;
    }
    const n = Number(weekParam);
    if (Number.isFinite(n) && n >= 1 && n <= 18) {
      setWeek(n);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );
        const payload = res.data || {};
        const cw = payload.current_week ?? payload;
        const wk = (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
        const n2 = Number(wk) || 1;
        setWeek(n2);
        const qs = window.location.search || "";
        navigate(`/leaderboard/week/${n2}${qs}`, { replace: true });
      } catch {
        setWeek(1);
        const qs = window.location.search || "";
        navigate(`/leaderboard/week/1${qs}`, { replace: true });
      }
    })();
  }, [weekParam, navigate]);

  // 2) Load leaderboard + public picks, then merge
  useEffect(() => {
    if (week == null) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setFallbackUnlockISO(null);

        const qs = window.location.search || "";

        // Scores endpoint
        const scoreRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/leaderboard/week/${week}${qs}`
        );
        const scores = scoreRes.data || {};

        // Public picks endpoint (drives lock/unlock + provides pick fields)
        const picksRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${qs}`
        );
        const picksPayload = picksRes.data || { locked: true, picks: [] };

        // Merge rows by user_id
        const mergedRows = mergeRows(
          scores.rows || scores.data || [],
          picksPayload.picks || [],
          scores.podium || [],
          scores.potw_exact || []
        );

        if (!alive) return;
        setState({
          week: Number(scores.week ?? week),
          factor: Number(scores.factor ?? 1) || 1,
          lockedFromAPI: !!picksPayload.locked,
          unlock_at_iso: picksPayload.unlock_at_iso || scores.unlock_at_iso || null,
          qa_mode: !!picksPayload.qa_mode,
          gotw_actual: scores.gotw_actual ?? null,
          potw_actual: scores.potw_actual ?? null,
          rows: mergedRows,
        });

        // Fallback unlock time if backend didn't send one:
        if (!picksPayload.unlock_at_iso && !scores.unlock_at_iso) {
          // Compute earliest Sunday kickoff as a proxy for 10:00 a.m. Arizona
          try {
            const gamesRes = await axios.get(
              `${import.meta.env.VITE_BACKEND_URL}/games/week/${week}`
            );
            const unlock = earliestSundayISO(Array.isArray(gamesRes.data) ? gamesRes.data : []);
            if (alive) setFallbackUnlockISO(unlock); // may remain null
          } catch {
            if (alive) setFallbackUnlockISO(null);
          }
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e.response?.data?.error || "Failed to load weekly leaderboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [week]);

  // 3) Lock logic (10:00 a.m. AZ) with QA override
  const { isLocked, unlockISO, unlockText } = useMemo(() => {
    const params = new URLSearchParams(window.location.search || "");
    const debugUnlocked = params.get("debug_unlocked") === "1";

    // If QA override present => never lock
    if (debugUnlocked) {
      return { isLocked: false, unlockISO: null, unlockText: "" };
    }

    // Choose unlock instant (backend first, else fallback to earliest Sunday kickoff)
    const unlockISO_ = state.unlock_at_iso || fallbackUnlockISO || null;

    // If API explicitly says "locked", respect it until unlock instant passes (if we have one)
    if (state.lockedFromAPI) {
      if (!unlockISO_) {
        return {
          isLocked: true,
          unlockISO: null,
          unlockText: "Sunday 10:00 AM (Arizona)",
        };
      }
      const now = Date.now();
      const ts = new Date(unlockISO_).getTime();
      const stillLocked = isFinite(ts) ? now < ts : true;
      return {
        isLocked: stillLocked,
        unlockISO: unlockISO_,
        unlockText: new Date(unlockISO_).toLocaleString(),
      };
    }

    // If API says not locked, we still gate by unlock time when present
    if (state.lockedFromAPI === false && unlockISO_) {
      const now = Date.now();
      const ts = new Date(unlockISO_).getTime();
      const stillLocked = isFinite(ts) ? now < ts : false;
      return {
        isLocked: stillLocked,
        unlockISO: unlockISO_,
        unlockText: new Date(unlockISO_).toLocaleString(),
      };
    }

    // No lock indicated and no unlock time => unlocked
    return { isLocked: false, unlockISO: null, unlockText: "" };
  }, [state.lockedFromAPI, state.unlock_at_iso, fallbackUnlockISO]);

  // Sort rows
  const rows = useMemo(() => {
    const arr = [...(state.rows || [])];
    if (isLocked) {
      // Names only; sort alphabetically for locked view
      arr.sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
      return arr;
    }
    // Unlocked sort: total desc, then podium/Exact, then name
    arr.sort((a, b) => {
      const tpA = Number(a.total_points ?? 0);
      const tpB = Number(b.total_points ?? 0);
      if (tpB !== tpA) return tpB - tpA;

      const rA = Number(a.gotw_rank ?? 99);
      const rB = Number(b.gotw_rank ?? 99);
      if (rA !== rB) return rA - rB;

      if (!!b.potw_exact !== !!a.potw_exact) {
        return (b.potw_exact ? 1 : 0) - (a.potw_exact ? 1 : 0);
      }

      return displayNameOf(a).localeCompare(displayNameOf(b));
    });
    return arr;
  }, [state.rows, isLocked]);

  if (loading) return <div className="p-6">Loading weekly leaderboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <LeaderboardTabs active={Number(week)} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold">Week {week} Leaderboard</h2>
        {state.factor > 1 && (
          <span className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200">
            🔥 Double Points (×{state.factor})
          </span>
        )}
      </div>

      {isLocked && (
        <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
          Public picks are hidden to prevent spoilers.{" "}
          <strong>
            Picks unlock at{" "}
            {unlockISO ? unlockText : "Sunday 10:00 AM (Arizona)"}.
          </strong>
          <div className="text-sm text-yellow-800 mt-1">
            You can see who’s participating below. Team/GOTW/POTW selections and points will appear at unlock.
          </div>
        </div>
      )}

      {/* Locked view: names only */}
      {isLocked ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2 border-b">#</th>
                <th className="text-left px-3 py-2 border-b">Name</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-gray-500">
                    No public names to show yet.
                  </td>
                </tr>
              ) : (
                rows.map((p, idx) => (
                  <tr key={`${displayNameOf(p, idx)}-${idx}`} className="bg-white">
                    <td className="px-3 py-2 border-b align-top">{idx + 1}</td>
                    <td className="px-3 py-2 border-b align-top">
                      {displayNameOf(p, idx)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {state.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      ) : (
        // Unlocked view: full details
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2 border-b">#</th>
                <th className="text-left px-3 py-2 border-b">Name</th>
                <th className="text-left px-3 py-2 border-b">Team Pick</th>
                <th className="text-left px-3 py-2 border-b">GOTW Pick</th>
                <th className="text-left px-3 py-2 border-b">POTW Pick</th>
                <th className="text-left px-3 py-2 border-b">Base</th>
                <th className="text-left px-3 py-2 border-b">GOTW</th>
                <th className="text-left px-3 py-2 border-b">POTW</th>
                <th className="text-left px-3 py-2 border-b">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, idx) => {
                const classes =
                  rowClasses(p, false) +
                  (p.is_weekly_winner ? " font-semibold" : "");
                const showBase = Number.isFinite(Number(p.base_points));
                return (
                  <tr key={`${displayNameOf(p, idx)}-${idx}`} className={classes}>
                    <td className="px-3 py-2 border-b align-top">
                      {idx + 1}
                      {p.is_weekly_winner && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${badgeClass.winner}`}>
                          ⭐ Winner
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      {displayNameOf(p, idx)}
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.team || "—"}</span>
                        {p.is_favorite === true && (
                          <span className="text-xs rounded bg-yellow-200 px-1">Favorite</span>
                        )}
                        {p.is_favorite === false && (
                          <span className="text-xs rounded bg-green-200 px-1">Underdog</span>
                        )}
                        {p.is_correct_pick === true && <span className="text-xs">✔️</span>}
                        {p.is_correct_pick === false && <span className="text-xs">❌</span>}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.gotw_prediction ?? "—"}</span>
                        {p.gotw_rank === 1 && (
                          <span className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw1}`}>
                            GOTW 1st
                          </span>
                        )}
                        {p.gotw_rank === 2 && (
                          <span className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw2}`}>
                            GOTW 2nd
                          </span>
                        )}
                        {p.gotw_rank === 3 && (
                          <span className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw3}`}>
                            GOTW 3rd
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.potw_prediction ?? "—"}</span>
                        {p.potw_exact && (
                          <span className={`text-xs px-2 py-0.5 rounded ${badgeClass.potwExact}`}>
                            Exact
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      {showBase ? Number(p.base_points) : "—"}
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      {Number(p.gotw_points ?? 0)}
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      {Number(p.potw_points ?? 0)}
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      <span className="inline-block min-w-8 text-center font-bold">
                        {Number(p.total_points ?? 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    No public picks to show yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {state.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      )}
    </div>
  );
}
