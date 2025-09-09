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

/** Find earliest Sunday kickoff (UTC day 0) for a given array of games */
function earliestSundayISO(games = []) {
  const sundays = games
    .map(parseKickoff)
    .filter(Boolean)
    .filter((d) => d.getUTCDay() === 0) // Sunday
    .sort((a, b) => a - b);
  return sundays[0]?.toISOString() || null;
}

/** Safer name helper so locked view never shows “Player 1/2…” unless truly unknown */
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

/** Normalize one leaderboard row from any backend shape to a unified shape the UI expects */
function normalizeRow(r = {}) {
  // team (several possible keys)
  const team =
    r.team ??
    r.pick_team ??
    r.selected_team ??
    r.selection ??
    r.team_pick ??
    null;

  // favorite/underdog flags
  const is_favorite =
    r.is_favorite ??
    (typeof r.favorite === "boolean" ? r.favorite : null);

  // correctness of the pick
  const is_correct_pick =
    r.is_correct_pick ??
    (typeof r.correct === "boolean" ? r.correct : null);

  // GOTW & POTW predictions (allow strings, coerce to number where appropriate)
  const gotw_prediction =
    r.gotw_prediction ??
    r.gotw_guess ??
    r.gotw_pick ??
    r.gotw ??
    null;

  const potw_prediction =
    r.potw_prediction ??
    r.potw_guess ??
    r.potw_pick ??
    r.potw ??
    null;

  // ranks/badges/exact flags
  const gotw_rank =
    r.gotw_rank ??
    r.gotw_place ??
    (Number.isFinite(Number(r.gotw_points_rank))
      ? Number(r.gotw_points_rank)
      : null);

  const potw_exact =
    r.potw_exact ??
    (typeof r.is_potw_exact === "boolean" ? r.is_potw_exact : false);

  // points
  const base_points =
    r.base_points ??
    r.pick_points ??
    (Number.isFinite(Number(r.points_base)) ? Number(r.points_base) : null);

  const bonus_points =
    r.bonus_points ??
    r.extra_points ??
    (Number.isFinite(Number(r.points_bonus)) ? Number(r.points_bonus) : null);

  const total_points =
    r.total_points ??
    (Number.isFinite(Number(r.points_total)) ? Number(r.points_total) : null);

  // winner flag
  const is_weekly_winner =
    r.is_weekly_winner ??
    r.winner ??
    r.award === 3 /* from podium */ ??
    false;

  return {
    ...r,
    team,
    is_favorite,
    is_correct_pick,
    gotw_prediction:
      gotw_prediction === "" || gotw_prediction == null
        ? null
        : gotw_prediction,
    potw_prediction:
      potw_prediction === "" || potw_prediction == null
        ? null
        : potw_prediction,
    gotw_rank: Number.isFinite(Number(gotw_rank)) ? Number(gotw_rank) : null,
    potw_exact: !!potw_exact,
    base_points:
      Number.isFinite(Number(base_points)) ? Number(base_points) : null,
    bonus_points:
      Number.isFinite(Number(bonus_points)) ? Number(bonus_points) : null,
    total_points:
      Number.isFinite(Number(total_points)) ? Number(total_points) : null,
    is_weekly_winner: !!is_weekly_winner,
  };
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

  // 2) Load weekly scores (new endpoint, fallback to legacy)
  useEffect(() => {
    if (week == null) return;

    const load = async () => {
      setLoading(true);
      setErr("");
      setComputedUnlockISO(null);

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
        // Fallback: legacy public feed
        try {
          const res2 = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
              window.location.search || ""
            }`
          );
          const p = res2.data || { picks: [] };
          const rows = (p.picks || [])
            .map((x) =>
              normalizeRow({
                ...x,
                // help older payloads
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

  // 3) If unlock_at_iso is missing, compute earliest Sunday kickoff for THIS week
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
        const unlock = earliestSundayISO(Array.isArray(res.data) ? res.data : []);
        setComputedUnlockISO(unlock); // null if no Sunday games
      } catch {
        setComputedUnlockISO(null);
      }
    })();
  }, [week, weekly.unlock_at_iso]);

  // 4) Locked detection — only consider whether picks are hidden
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

  // Unlock time string
  const unlockISO = weekly.unlock_at_iso || computedUnlockISO || null;
  const unlockText = unlockISO
    ? new Date(unlockISO).toLocaleString()
    : "Sunday 11:00 AM (Arizona)";

  // Sort rows
  const rows = useMemo(() => {
    const arr = [...(weekly.rows || [])];
    if (lockedUI) {
      // Names only; alphabetical by derived display name
      arr.sort((a, b) =>
        displayNameOf(a).localeCompare(displayNameOf(b))
      );
      return arr;
    }
    // Full unlocked sort
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

  if (loading) return <div className="p-6">Loading weekly leaderboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <LeaderboardTabs active={Number(week)} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold">Week {week} Leaderboard</h2>

        {/* Always show double-points badge if factor > 1 (even when locked) */}
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
            You can see who’s participating below. Team/GOTW/POTW selections and points will appear at unlock.
          </div>
        </div>
      )}

      {/* Locked view: names only */}
      {lockedUI ? (
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
          {weekly.qa_mode && (
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
                <th className="text-left px-3 py-2 border-b">Bonus</th>
                <th className="text-left px-3 py-2 border-b">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, idx) => {
                const classes =
                  rowClasses(p, false) +
                  (p.is_weekly_winner ? " font-semibold" : "");
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
                        <span>{p.team || "—"}</span>
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
                        <span>{p.gotw_prediction ?? "—"}</span>
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
                        <span>{p.potw_prediction ?? "—"}</span>
                        {p.potw_exact && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.potwExact}`}
                          >
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

          {weekly.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      )}
    </div>
  );
}
