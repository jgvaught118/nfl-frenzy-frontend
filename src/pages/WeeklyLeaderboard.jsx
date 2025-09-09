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

/** Name helper */
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

function emailKey(v) {
  return (v || "").trim().toLowerCase();
}

/** Robust field normalization for rows (leaderboard or public picks) */
function normalizeRow(r = {}) {
  // team
  const team =
    r.team ??
    r.team_pick ??
    r.pick_team ??
    r.selected_team ??
    r.selection ??
    r.team_name ??
    r.team_abbr ??
    null;

  // GOTW
  const gotw_prediction =
    r.gotw_prediction ??
    r.gotw_pick ??
    r.gotw_guess ??
    r.gotw ??
    r.game_of_the_week ??
    null;

  // POTW
  const potw_prediction =
    r.potw_prediction ??
    r.potw_pick ??
    r.potw_guess ??
    r.potw ??
    r.player_of_the_week ??
    null;

  const is_favorite =
    typeof r.is_favorite === "boolean"
      ? r.is_favorite
      : typeof r.favorite === "boolean"
      ? r.favorite
      : null;

  const is_correct_pick =
    typeof r.is_correct_pick === "boolean"
      ? r.is_correct_pick
      : typeof r.correct === "boolean"
      ? r.correct
      : null;

  const gotw_rankRaw =
    r.gotw_rank ??
    r.gotw_place ??
    r.gotw_points_rank ??
    r.gotw_position ??
    null;
  const gotw_rank =
    Number.isFinite(Number(gotw_rankRaw)) ? Number(gotw_rankRaw) : null;

  const potw_exact =
    typeof r.potw_exact === "boolean"
      ? r.potw_exact
      : typeof r.is_potw_exact === "boolean"
      ? r.is_potw_exact
      : false;

  const base_points = Number.isFinite(Number(r.base_points))
    ? Number(r.base_points)
    : r.base_points ?? null;

  const bonus_points = Number.isFinite(Number(r.bonus_points))
    ? Number(r.bonus_points)
    : r.bonus_points ?? null;

  const total_points = Number.isFinite(Number(r.total_points))
    ? Number(r.total_points)
    : r.total_points ?? null;

  const is_weekly_winner = !!(r.is_weekly_winner || r.winner || r.award === 3);

  return {
    ...r,
    team,
    gotw_prediction: gotw_prediction ?? null,
    potw_prediction: potw_prediction ?? null,
    is_favorite,
    is_correct_pick,
    gotw_rank,
    potw_exact,
    base_points: base_points ?? null,
    bonus_points: bonus_points ?? null,
    total_points: total_points ?? null,
    is_weekly_winner,
  };
}

/** Kickoff helpers for fallback unlock time */
function parseKickoff(g) {
  const raw = g.kickoff ?? g.start_time ?? g.kickoff_time ?? g.game_time;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function earliestSundayUTC(games = []) {
  const sundays = games
    .map(parseKickoff)
    .filter(Boolean)
    .filter((d) => d.getUTCDay() === 0)
    .sort((a, b) => a - b);
  return sundays[0] || null;
}
function fallbackUnlockISOFromGames(games = []) {
  const firstSunday = earliestSundayUTC(games);
  if (!firstSunday) return null;
  const y = firstSunday.getUTCFullYear();
  const m = firstSunday.getUTCMonth();
  const d = firstSunday.getUTCDate();
  // 17:00 UTC ≈ 10:00 AM Arizona
  const unlockUTC = new Date(Date.UTC(y, m, d, 17, 0, 0));
  return unlockUTC.toISOString();
}
function isDebugUnlocked() {
  const sp = new URLSearchParams(window.location.search);
  return sp.get("debug_unlocked") === "1";
}

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

  // picks maps for merge (when unlocked)
  const [picksByUserId, setPicksByUserId] = useState(null);
  const [picksByEmail, setPicksByEmail] = useState(null);

  // Validate/normalize week param
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

  // Load weekly leaderboard
  useEffect(() => {
    if (week == null) return;

    const load = async () => {
      setLoading(true);
      setErr("");
      setComputedUnlockISO(null);
      setPicksByUserId(null);
      setPicksByEmail(null);

      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/leaderboard/week/${week}${
            window.location.search || ""
          }`
        );
        const d = res.data || {};
        const rows = Array.isArray(d.rows) ? d.rows.map(normalizeRow) : [];
        setWeekly({
          week: Number(d.week ?? week),
          factor: Number(d.factor ?? 1) || 1,
          locked: !!d.locked,
          unlock_at_iso: d.unlock_at_iso || null,
          qa_mode: !!d.qa_mode,
          gotw: d.gotw || { actual_total: null },
          potw: d.potw || { actual_yards: null },
          rows,
        });
      } catch (e1) {
        // Fallback: legacy public picks (names + selections, no points)
        try {
          const res2 = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
              window.location.search || ""
            }`
          );
          const p = res2.data || { picks: [] };
          const rows = (p.picks || []).map((x) =>
            normalizeRow({
              ...x,
              team: x.team ?? x.pick_team ?? null,
              gotw_prediction:
                x.gotw_prediction ?? x.gotw_guess ?? x.gotw ?? null,
              potw_prediction:
                x.potw_prediction ?? x.potw_guess ?? x.potw ?? null,
            })
          );
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

  // Fallback unlock time if backend didn't send one
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
        const unlock = fallbackUnlockISOFromGames(
          Array.isArray(res.data) ? res.data : []
        );
        setComputedUnlockISO(unlock);
      } catch {
        setComputedUnlockISO(null);
      }
    })();
  }, [week, weekly.unlock_at_iso]);

  // Lock logic
  const unlockISO = weekly.unlock_at_iso || computedUnlockISO || null;
  const now = new Date();
  const shouldBeLocked =
    !isDebugUnlocked() &&
    (weekly.locked || (unlockISO ? now < new Date(unlockISO) : true));

  // When UNLOCKED, fetch public picks and build both maps (by user_id and by email)
  useEffect(() => {
    if (week == null) return;
    if (shouldBeLocked) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
            window.location.search || ""
          }`
        );
        const p = res.data || { picks: [] };
        const byId = new Map();
        const byEmail = new Map();

        (p.picks || []).forEach((x) => {
          const n = normalizeRow({
            ...x,
            team: x.team ?? x.team_pick ?? x.pick_team ?? null,
            gotw_prediction:
              x.gotw_prediction ?? x.gotw_pick ?? x.gotw_guess ?? x.gotw ?? null,
            potw_prediction:
              x.potw_prediction ?? x.potw_pick ?? x.potw_guess ?? x.potw ?? null,
          });

          const uid = Number(x.user_id ?? x.userId ?? -1);
          if (Number.isFinite(uid) && uid > 0) byId.set(uid, n);

          const ek = emailKey(x.email || n.email);
          if (ek) byEmail.set(ek, n);
        });

        if (!cancelled) {
          setPicksByUserId(byId);
          setPicksByEmail(byEmail);
        }
      } catch {
        if (!cancelled) {
          setPicksByUserId(new Map());
          setPicksByEmail(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [week, shouldBeLocked]);

  // Merge picks into weekly rows (only when unlocked)
  const mergedRows = useMemo(() => {
    if (shouldBeLocked) return weekly.rows || [];
    const rows = [...(weekly.rows || [])].map((r) => ({ ...r }));

    const mapId = picksByUserId || new Map();
    const mapEmail = picksByEmail || new Map();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // 1) try user_id
      let pick =
        mapId.get(Number(r.user_id ?? r.userId ?? -1)) ||
        null;

      // 2) fallback by email
      if (!pick) {
        const ek =
          emailKey(r.email) ||
          emailKey(r.user_email) ||
          emailKey(r.contact) ||
          "";
        if (ek) pick = mapEmail.get(ek) || null;
      }

      if (!pick) continue;

      // fill only if missing
      if (r.team == null && pick.team != null) r.team = pick.team;
      if (r.gotw_prediction == null && pick.gotw_prediction != null)
        r.gotw_prediction = pick.gotw_prediction;
      if (r.potw_prediction == null && pick.potw_prediction != null)
        r.potw_prediction = pick.potw_prediction;

      if (typeof r.is_favorite !== "boolean" && typeof pick.is_favorite === "boolean")
        r.is_favorite = pick.is_favorite;
      if (typeof r.is_correct_pick !== "boolean" && typeof pick.is_correct_pick === "boolean")
        r.is_correct_pick = pick.is_correct_pick;
    }

    return rows;
  }, [weekly.rows, picksByUserId, picksByEmail, shouldBeLocked]);

  // Sort rows for display
  const rows = useMemo(() => {
    const arr = [...mergedRows];
    if (shouldBeLocked) {
      arr.sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
      return arr;
    }
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
  }, [mergedRows, shouldBeLocked]);

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

      {shouldBeLocked && (
        <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
          Public picks are hidden to prevent spoilers.{" "}
          <strong>
            Picks unlock at{" "}
            {unlockISO ? new Date(unlockISO).toLocaleString() : "Sunday 10:00 AM (Arizona)"}.
          </strong>
          <div className="text-sm text-yellow-800 mt-1">
            You can see who’s participating below. Team/GOTW/POTW selections and points will appear at unlock.
          </div>
        </div>
      )}

      {shouldBeLocked ? (
        // Locked: names only
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
                    <td className="px-3 py-2 border-b align-top">{displayNameOf(p, idx)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {weekly.qa_mode && <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>}
        </div>
      ) : (
        // Unlocked: full details
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
                <th className="text-left px-3 py-2 border-b">Bonus</th>
                <th className="text-left px-3 py-2 border-b">Total</th>
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
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${badgeClass.winner}`}>
                          ⭐ Winner
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 border-b align-top">{displayNameOf(p, idx)}</td>

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
                      {showBonus ? Number(p.bonus_points) : "—"}
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
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No public picks to show yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {weekly.qa_mode && <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>}
        </div>
      )}
    </div>
  );
}
