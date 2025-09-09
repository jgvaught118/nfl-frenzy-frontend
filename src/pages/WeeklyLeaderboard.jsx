// src/pages/WeeklyLeaderboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import LeaderboardTabs from "../components/LeaderboardTabs";

/* -------------------- styling helpers -------------------- */
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
      ? "bg-yellow-50 ring-1 ring-yellow-200"
      : "bg-green-50 ring-1 ring-green-200";
  }
  if (p.is_correct_pick === false) return "bg-red-50 ring-1 ring-red-200";
  return "bg-white";
}

/* -------------------- time helpers -------------------- */
function parseKickoff(g) {
  const raw = g?.kickoff ?? g?.start_time ?? g?.kickoff_time ?? g?.game_time;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function earliestSundayISO(games = []) {
  const sundays = games
    .map(parseKickoff)
    .filter(Boolean)
    .filter((d) => d.getUTCDay() === 0) // Sunday
    .sort((a, b) => a - b);
  return sundays[0]?.toISOString() || null;
}

/* -------------------- data normalization helpers -------------------- */
const safeKey = (s) => (s ? String(s).trim().toLowerCase() : null);

function displayNameOf(p, idx = 0) {
  return (
    p.display_name ||
    p.first_name ||
    p.name ||
    (p.email ? p.email.split("@")[0] : "") ||
    (p.user_id ? `User ${p.user_id}` : "") ||
    `Player ${idx + 1}`
  );
}

const firstDefined = (...vals) =>
  vals.find((v) => v !== null && v !== undefined && v !== "") ?? null;

/** Normalize a public-picks row (from /picks/week/:n/public) */
function normalizePublicPick(x = {}) {
  const first_name = firstDefined(x.first_name, x.display_name, x.name);
  return {
    keyName: safeKey(first_name),
    user_id: x.user_id ?? null, // your current payload may not include this; future-proof
    display_name: first_name,
    email: x.email ?? null,

    team: firstDefined(
      x.team,
      x.team_pick,
      x.pick_team,
      x.selected_team,
      x.selection,
      x.team_name,
      x.team_abbr
    ),
    gotw_prediction: firstDefined(
      x.gotw_prediction,
      x.gotw_pick,
      x.gotw_guess,
      x.gotw,
      x.game_of_the_week
    ),
    potw_prediction: firstDefined(
      x.potw_prediction,
      x.potw_pick,
      x.potw_guess,
      x.potw,
      x.player_of_the_week
    ),
    is_favorite: firstDefined(x.is_favorite, x.favorite, null),
    is_correct_pick: firstDefined(
      x.is_correct_pick,
      x.correct,
      x.correct_pick,
      null
    ),
    gotw_rank: x.gotw_rank ?? null,
    potw_exact: !!x.potw_exact,
  };
}

/** Normalize a leaderboard row (from /leaderboard/week/:n) */
function normalizeLeaderboardRow(r = {}) {
  const nm = firstDefined(r.display_name, r.first_name, r.name);
  return {
    keyName: safeKey(nm),
    user_id: r.user_id ?? r.id ?? null,
    display_name: nm,
    email: r.email ?? null,

    // picks-related (may be missing here)
    team: firstDefined(
      r.team,
      r.team_pick,
      r.pick_team,
      r.selected_team,
      r.selection,
      r.team_name,
      r.team_abbr
    ),
    gotw_prediction: firstDefined(
      r.gotw_prediction,
      r.gotw_pick,
      r.gotw_guess,
      r.gotw,
      r.game_of_the_week
    ),
    potw_prediction: firstDefined(
      r.potw_prediction,
      r.potw_pick,
      r.potw_guess,
      r.potw,
      r.player_of_the_week
    ),
    is_favorite: firstDefined(r.is_favorite, r.favorite, null),
    is_correct_pick: firstDefined(
      r.is_correct_pick,
      r.correct,
      r.correct_pick,
      null
    ),
    gotw_rank: r.gotw_rank ?? null,
    potw_exact: !!r.potw_exact,

    // scoring
    base_points: Number.isFinite(Number(r.base_points))
      ? Number(r.base_points)
      : null,
    bonus_points: Number.isFinite(Number(r.bonus_points))
      ? Number(r.bonus_points)
      : null,
    total_points: Number.isFinite(Number(r.total_points))
      ? Number(r.total_points)
      : null,
    is_weekly_winner: !!r.is_weekly_winner,
  };
}

/** Merge public selections into leaderboard rows.
 *  Priority: match by user_id if both present; otherwise by keyName (first_name).
 */
function mergeSelections(rows = [], publicPicks = []) {
  const byId = new Map(
    publicPicks.filter((p) => p.user_id != null).map((p) => [p.user_id, p])
  );
  const byName = new Map(
    publicPicks.filter((p) => p.keyName).map((p) => [p.keyName, p])
  );

  return rows.map((r) => {
    const pub =
      (r.user_id != null ? byId.get(r.user_id) : undefined) ||
      (r.keyName ? byName.get(r.keyName) : undefined);
    if (!pub) return r;

    return {
      ...r,
      team: r.team ?? pub.team,
      gotw_prediction: r.gotw_prediction ?? pub.gotw_prediction,
      potw_prediction: r.potw_prediction ?? pub.potw_prediction,
      is_favorite: r.is_favorite ?? pub.is_favorite,
      is_correct_pick: r.is_correct_pick ?? pub.is_correct_pick,
      gotw_rank: r.gotw_rank ?? pub.gotw_rank,
      potw_exact: r.potw_exact ?? pub.potw_exact,
    };
  });
}

/* ========================================================= */

export default function WeeklyLeaderboard() {
  const { week: weekParam } = useParams();
  const navigate = useNavigate();

  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [weekly, setWeekly] = useState({
    week: null,
    factor: 1,
    locked: false,
    unlock_at_iso: null,
    qa_mode: false,
    gotw: { actual_total: null },
    potw: { actual_yards: null },
    rows: [],
  });

  const [computedUnlockISO, setComputedUnlockISO] = useState(null);

  /* 1) normalize week param (redirect to current if invalid) */
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
        const cw =
          payload.current_week !== undefined ? payload.current_week : payload;
        const wk =
          (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
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

  /* 2) load leaderboard + (if unlocked) merge public picks */
  useEffect(() => {
    if (week == null) return;

    const load = async () => {
      setLoading(true);
      setErr("");
      setComputedUnlockISO(null);

      try {
        // primary leaderboard
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/leaderboard/week/${week}${
            window.location.search || ""
          }`
        );
        const d = res.data || {};
        let rows = Array.isArray(d.rows)
          ? d.rows.map(normalizeLeaderboardRow)
          : [];

        const backendLocked = !!d.locked;
        const anyPickVisible = rows.some(
          (r) =>
            r.team != null ||
            r.gotw_prediction != null ||
            r.potw_prediction != null
        );

        // overlay public picks when unlocked
        if (!backendLocked) {
          try {
            const resPub = await axios.get(
              `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
                window.location.search || ""
              }`
            );
            const p = resPub.data || { picks: [] };
            const publicPicks = (p.picks || []).map(normalizePublicPick);
            rows = mergeSelections(rows, publicPicks);

            // inherit lock/qa metadata if primary omitted it
            d.locked = d.locked ?? p.locked;
            d.unlock_at_iso = d.unlock_at_iso ?? p.unlock_at_iso;
            d.qa_mode = d.qa_mode ?? p.qa_mode;
          } catch (e2) {
            console.warn("Public picks fetch failed:", e2?.message);
          }
        }

        setWeekly({
          week: Number(d.week ?? week),
          factor: Number(d.factor ?? 1) || 1,
          // if any picks visible, force unlocked in UI even if d.locked happened to be true
          locked: !!d.locked && !anyPickVisible,
          unlock_at_iso: d.unlock_at_iso || null,
          qa_mode: !!d.qa_mode,
          gotw: d.gotw || { actual_total: null },
          potw: d.potw || { actual_yards: null },
          rows,
        });
      } catch (e1) {
        // fallback: public-only view
        try {
          const res2 = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
              window.location.search || ""
            }`
          );
          const p = res2.data || { picks: [] };
          const rows = (p.picks || []).map((x) => ({
            ...normalizePublicPick(x),
            base_points: null,
            bonus_points: null,
            total_points: null,
            is_weekly_winner: false,
          }));
          setWeekly({
            week,
            factor: 1,
            locked: !!p.locked,
            unlock_at_iso: p.unlock_at_iso || null,
            qa_mode: !!p.qa_mode,
            gotw: { actual_total: null },
            potw: { actual_yards: null },
            rows,
          });
        } catch (e2) {
          console.error(e2);
          setErr(
            e2.response?.data?.error ||
              e1.response?.data?.error ||
              "Failed to load weekly leaderboard"
          );
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [week]);

  /* 3) compute unlock time if backend didn't send one */
  useEffect(() => {
    if (week == null) return;
    if (weekly.unlock_at_iso) {
      setComputedUnlockISO(null);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/games/week/${week}`
        );
        const unlock = earliestSundayISO(
          Array.isArray(res.data) ? res.data : []
        );
        setComputedUnlockISO(unlock);
      } catch {
        setComputedUnlockISO(null);
      }
    })();
  }, [week, weekly.unlock_at_iso]);

  /* 4) lock detection for UI (names-only vs full table) */
  const lockedUI = useMemo(() => {
    if (weekly.locked) return true;
    const rows = weekly.rows || [];
    if (!rows.length) return true;
    const anyPickVisible = rows.some(
      (r) =>
        r.team != null ||
        r.gotw_prediction != null ||
        r.potw_prediction != null
    );
    return !anyPickVisible;
  }, [weekly.locked, weekly.rows]);

  /* unlock text for banner */
  const unlockISO = weekly.unlock_at_iso || computedUnlockISO || null;
  const unlockText = unlockISO
    ? new Date(unlockISO).toLocaleString()
    : "Sunday 11:00 AM (Arizona)";

  /* sorting */
  const rows = useMemo(() => {
    const arr = [...(weekly.rows || [])];
    if (lockedUI) {
      arr.sort((a, b) =>
        displayNameOf(a).localeCompare(displayNameOf(b))
      );
      return arr;
    }
    // unlocked: winners first, then by total points desc, then by name
    arr.sort((a, b) => {
      const aWin = !!a.is_weekly_winner;
      const bWin = !!b.is_weekly_winner;
      if (aWin !== bWin) return bWin - aWin;
      const tpA = Number(a.total_points ?? 0);
      const tpB = Number(b.total_points ?? 0);
      if (tpB !== tpA) return tpB - tpA;
      return displayNameOf(a).localeCompare(displayNameOf(b));
    });
    return arr;
  }, [weekly.rows, lockedUI]);

  /* -------------------- render -------------------- */
  if (loading) return <div className="p-6">Loading weekly leaderboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <LeaderboardTabs active={Number(week)} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold">Week {week} Leaderboard</h2>
        {weekly.factor > 1 && (
          <span className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200">
            🔥 Double Points (×{weekly.factor})
          </span>
        )}
      </div>

      {lockedUI && (
        <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
          Public picks are hidden to prevent spoilers.{" "}
          <strong>Picks unlock at {unlockText}.</strong>
          <div className="text-sm text-yellow-800 mt-1">
            You can see who’s participating below. Team/GOTW/POTW selections and
            points will appear at unlock.
          </div>
        </div>
      )}

      {lockedUI ? (
        /* -------------------- LOCKED: names only -------------------- */
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2 border-b w-14">#</th>
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
          {weekly.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      ) : (
        /* -------------------- UNLOCKED: full details -------------------- */
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2 border-b w-14">#</th>
                <th className="text-left px-3 py-2 border-b min-w-[10rem]">Name</th>
                <th className="text-left px-3 py-2 border-b min-w-[12rem]">
                  Team Pick
                </th>
                <th className="text-left px-3 py-2 border-b min-w-[10rem]">
                  GOTW Pick
                </th>
                <th className="text-left px-3 py-2 border-b min-w-[10rem]">
                  POTW Pick
                </th>
                <th className="text-right px-3 py-2 border-b w-16">Base</th>
                <th className="text-right px-3 py-2 border-b w-16">Bonus</th>
                <th className="text-right px-3 py-2 border-b w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, idx) => {
                const classes =
                  rowClasses(p, false) + (p.is_weekly_winner ? " font-semibold" : "");
                const showBase = Number.isFinite(Number(p.base_points));
                const showBonus = Number.isFinite(Number(p.bonus_points));
                return (
                  <tr key={`${displayNameOf(p, idx)}-${idx}`} className={classes}>
                    <td className="px-3 py-2 border-b align-top">
                      {idx + 1}
                      {p.is_weekly_winner && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded ${badgeClass.winner}`}
                        >
                          ⭐ Winner
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      {displayNameOf(p, idx)}
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span className="inline-block min-w-[8rem]">
                          {p.team ?? "—"}
                        </span>
                        {p.is_favorite === true && (
                          <span className="text-xs rounded bg-yellow-200 px-1">
                            Favorite
                          </span>
                        )}
                        {p.is_favorite === false && (
                          <span className="text-xs rounded bg-green-200 px-1">
                            Underdog
                          </span>
                        )}
                        {p.is_correct_pick === true && (
                          <span className="text-xs">✔️</span>
                        )}
                        {p.is_correct_pick === false && (
                          <span className="text-xs">❌</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span className="inline-block min-w-[3rem]">
                          {p.gotw_prediction ?? "—"}
                        </span>
                        {p.gotw_rank === 1 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw1}`}
                          >
                            GOTW 1st
                          </span>
                        )}
                        {p.gotw_rank === 2 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw2}`}
                          >
                            GOTW 2nd
                          </span>
                        )}
                        {p.gotw_rank === 3 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw3}`}
                          >
                            GOTW 3rd
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span className="inline-block min-w-[3rem]">
                          {p.potw_prediction ?? "—"}
                        </span>
                        {p.potw_exact && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.potwExact}`}
                          >
                            Exact
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 border-b align-top text-right">
                      {showBase ? Number(p.base_points) : "—"}
                    </td>
                    <td className="px-3 py-2 border-b align-top text-right">
                      {showBonus ? Number(p.bonus_points) : "—"}
                    </td>
                    <td className="px-3 py-2 border-b align-top text-right font-bold">
                      {Number(p.total_points ?? 0)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No public picks to show yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {weekly.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      )}
    </div>
  );
}
