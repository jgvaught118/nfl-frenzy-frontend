// nfl-frenzy-frontend/src/components/Leaderboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import LeaderboardTabs from "./LeaderboardTabs"; // same folder

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/leaderboard/overall`
        );
        setRows(res.data?.standings || []);
      } catch (e) {
        console.error("Overall leaderboard fetch failed:", e);
        setErr(e.response?.data?.error || "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) return <p>Loading overall leaderboard…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Tabs: Overall + W1…W18 */}
      <LeaderboardTabs active="overall" />

      <h2 className="text-2xl font-bold mb-3">🏆 Overall Leaderboard</h2>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Weeks Scored</th>
              <th className="px-3 py-2">Fav ✓</th>
              <th className="px-3 py-2">Dog ✓</th>
              <th className="px-3 py-2">GOTW 1st</th>
              <th className="px-3 py-2">POTW Exact</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td className="px-3 py-4 text-center" colSpan={8}>
                  No results yet. Come back after games are scored.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.user_id} className={idx % 2 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.display_name}</td>
                  <td className="px-3 py-2">{r.total_points}</td>
                  <td className="px-3 py-2">{r.weeks_scored}</td>
                  <td className="px-3 py-2">{r.correct_favorites}</td>
                  <td className="px-3 py-2">{r.correct_underdogs}</td>
                  <td className="px-3 py-2">{r.gotw_firsts}</td>
                  <td className="px-3 py-2">{r.potw_exact}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Fav ✓ = correct favorite picks; Dog ✓ = correct underdog picks; GOTW 1st
        = times ranked #1 on Game of the Week; POTW Exact = exact yardage picks.
      </p>
    </div>
  );
}
