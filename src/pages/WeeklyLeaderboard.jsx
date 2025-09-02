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

export default function WeeklyLeaderboard() {
  const { week: weekParam } = useParams();
  const navigate = useNavigate();

  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Unified weekly payload shape
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
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/leaderboard/week/${week}${
            window.location.search || ""
          }`
        );
        const d = res.data || {};
        setWeekly({
          week: Number(d.week ?? week),
          factor: Number(d.factor ?? 1) || 1,
          locked: !!d.locked,
          unlock_at_iso: d.unlock_at_iso || null,
          qa_mode: !!d.qa_mode,
          gotw: d.gotw || { actual_total: null },
          potw: d.potw || { actual_yards: null },
          rows: Array.isArray(d.rows) ? d.rows : [],
        });
      } catch (e1) {
        try {
          const res2 = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${
              window.location.search || ""
            }`
          );
          const p = res2.data || { picks: [] };
          const rows = (p.picks || []).map((x) => ({
            display_name: x.first_name || x.name || `User ${x.user_id ?? ""}`,
            team: x.team,
            gotw_prediction: x.gotw_prediction ?? null,
            potw_prediction: x.potw_prediction ?? null,
            gotw_rank: x.gotw_rank ?? null,
            potw_exact: !!x.potw_exact,
            base_points: null,
            bonus_points: null,
            total_points: x.total_points ?? 0,
            is_favorite: x.is_favorite ?? null,
            is_correct_pick: x.is_correct_pick ?? null,
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

  const isLocked = !!weekly.locked;

  // Friendly unlock time text (fallback to static message if none provided)
  const unlockText = weekly.unlock_at_iso
    ? new Date(weekly.unlock_at_iso).toLocaleString()
    : "Sunday 11:00 AM (Arizona)";

  // 3) Sort rows:
  // - Locked: alphabetical by name (no spoilers)
  // - Unlocked: winner first, then by total points desc, then name
  const rows = useMemo(() => {
    const arr = [...(weekly.rows || [])];
    if (isLocked) {
      arr.sort((a, b) =>
        (a.display_name || "").localeCompare(b.display_name || "")
      );
      return arr;
    }
    arr.sort((a, b) => {
      const aWin = !!a.is_weekly_winner;
      const bWin = !!b.is_weekly_winner;
      if (aWin !== bWin) return bWin - aWin;
      const tpA = Number(a.total_points ?? 0);
      const tpB = Number(b.total_points ?? 0);
      if (tpB !== tpA) return tpB - tpA;
      return (a.display_name || "").localeCompare(b.display_name || "");
    });
    return arr;
  }, [weekly.rows, isLocked]);

  if (loading) return <div className="p-6">Loading weekly leaderboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <LeaderboardTabs active={Number(week)} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold">Week {week} Leaderboard</h2>

        {weekly.factor > 1 && !isLocked && (
          <span className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200">
            🔥 Double Points (×{weekly.factor})
          </span>
        )}
      </div>

      {isLocked && (
        <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
          Public picks are hidden to prevent spoilers.
          {" "}
          <strong>Picks unlock at {unlockText}.</strong>
          <div className="text-sm text-yellow-800 mt-1">
            You can see who’s participating below. Team/GOTW/POTW selections and points will appear at unlock.
          </div>
        </div>
      )}

      {/* Locked view: show ONLY names (no dashes/blank cells) */}
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
                  <tr key={`${p.display_name}-${idx}`} className="bg-white">
                    <td className="px-3 py-2 border-b align-top">{idx + 1}</td>
                    <td className="px-3 py-2 border-b align-top">
                      {p.display_name || "—"}
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
                  <tr key={`${p.display_name}-${idx}`} className={classes}>
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
                      {p.display_name || "—"}
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
