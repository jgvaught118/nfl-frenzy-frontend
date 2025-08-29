// nfl-frenzy-frontend/src/pages/Admin.jsx
import React, { useEffect, useMemo, useState, useMemo as useMemo2 } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const TOTAL_WEEKS = 18;

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [week, setWeek] = useState(1);
  const [games, setGames] = useState([]);
  const [gotwHome, setGotwHome] = useState("");
  const [gotwAway, setGotwAway] = useState("");
  const [gotwTotal, setGotwTotal] = useState(""); // optional override

  const [potwYards, setPotwYards] = useState("");
  const [potwName, setPotwName] = useState("");
  const [potwTeam, setPotwTeam] = useState("");

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingG, setSavingG] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const [msg, setMsg] = useState("");

  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  useEffect(() => {
    if (!user) return;
    const bootstrap = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );
        const cw = res.data?.current_week ?? 1;
        setWeek(Number(cw));
      } catch {
        setWeek(1);
      }
    };
    bootstrap();
  }, [user]);

  const fetchWeekData = async (w) => {
    setLoading(true);
    setMsg("");
    try {
      const [gamesRes, detailsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/games/week/${w}`, axiosAuth),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/admin/week/${w}/details`)
      ]);
      const gs = gamesRes.data || [];
      setGames(gs);

      const det = detailsRes.data || null;
      setDetails(det);

      if (det?.gotw) {
        setGotwHome(det.gotw.home_team || "");
        setGotwAway(det.gotw.away_team || "");
        setGotwTotal(
          det.gotw.game_total_points === null ||
          typeof det.gotw.game_total_points === "undefined"
            ? ""
            : det.gotw.game_total_points
        );
      } else {
        setGotwHome("");
        setGotwAway("");
        setGotwTotal("");
      }

      if (det?.potw) {
        setPotwYards(
          det.potw.player_total_yards === null ||
          typeof det.potw.player_total_yards === "undefined"
            ? ""
            : det.potw.player_total_yards
        );
        setPotwName(det.potw.player_name || "");
        setPotwTeam(det.potw.team || "");
      } else {
        setPotwYards("");
        setPotwName("");
        setPotwTeam("");
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
      setMsg("Failed to load week data. Check backend logs.");
      setGames([]);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (week) fetchWeekData(week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  const onSelectGame = (game) => {
    setGotwHome(game.home_team);
    setGotwAway(game.away_team);
    setGotwTotal(""); // clear override when choosing a different matchup
  };

  // Find the currently selected matchup in this week's games
  const selectedGame = useMemo2(() => {
    return games.find(
      (g) => g.home_team === gotwHome && g.away_team === gotwAway
    );
  }, [games, gotwHome, gotwAway]);

  // Compute from final score if both scores exist
  const computedTotal =
    selectedGame &&
    selectedGame.home_score != null &&
    selectedGame.away_score != null
      ? Number(selectedGame.home_score) + Number(selectedGame.away_score)
      : null;

  const saveGOTW = async () => {
    if (!gotwHome || !gotwAway) {
      setMsg("Pick a matchup for GOTW.");
      return;
    }
    setSavingG(true);
    setMsg("");
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/admin/week/${week}/gotw`,
        {
          home_team: gotwHome,
          away_team: gotwAway,
          // Leave blank to let backend auto-calc from scores;
          // set a number only to override.
          game_total_points: gotwTotal === "" ? null : Number(gotwTotal),
        },
        axiosAuth
      );
      setMsg("✅ GOTW saved.");
      await fetchWeekData(week);
    } catch (err) {
      console.error("Save GOTW failed:", err);
      setMsg(err.response?.data?.error || "Failed to save GOTW.");
    } finally {
      setSavingG(false);
    }
  };

  const savePOTW = async () => {
    setSavingP(true);
    setMsg("");
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/admin/week/${week}/potw`,
        {
          player_total_yards: potwYards === "" ? null : Number(potwYards),
          player_name: potwName || undefined,
          team: potwTeam || undefined,
        },
        axiosAuth
      );
      setMsg("✅ POTW saved.");
      await fetchWeekData(week);
    } catch (err) {
      console.error("Save POTW failed:", err);
      setMsg(err.response?.data?.error || "Failed to save POTW.");
    } finally {
      setSavingP(false);
    }
  };

  if (!user) return null;
  if (!user.is_admin) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-2">Admin</h2>
        <p>You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin – Week Settings</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Week:</label>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
              const w = i + 1;
              return (
                <option key={w} value={w}>
                  Week {w}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Explainer */}
      <div className="p-4 rounded border bg-white">
        <p className="text-sm text-gray-700">
          <strong>GOTW:</strong> Pick the official matchup here. The system
          <strong> auto-calculates the total points</strong> from the final box score when available.
          Use the <em>Override Total Points</em> only for manual corrections.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          <strong>POTW:</strong> Enter the <em>official yards</em> after the week (unless automated).
          Leaving it blank beforehand is fine.
        </p>
      </div>

      {loading ? (
        <p>Loading week {week}…</p>
      ) : (
        <>
          {/* Current state summary */}
          <div className="p-4 rounded border bg-gray-50">
            <h3 className="font-semibold mb-2">Current Week {week} Status</h3>
            <ul className="list-disc list-inside text-sm">
              <li>
                First Sunday kickoff:{" "}
                {details?.first_sunday_kickoff
                  ? new Date(details.first_sunday_kickoff).toLocaleString()
                  : "N/A"}
              </li>
              <li>Locked: {details?.locked ? "Yes" : "No"}</li>
              <li>
                GOTW:{" "}
                {details?.gotw
                  ? `${details.gotw.home_team} vs ${details.gotw.away_team} (Override Total: ${
                      details.gotw.game_total_points ?? "—"
                    })`
                  : "—"}
              </li>
              <li>
                POTW yards (official):{" "}
                {details?.potw?.player_total_yards ?? "—"}
                {details?.potw?.player_name ? ` | ${details.potw.player_name}` : ""}
                {details?.potw?.team ? ` (${details.potw.team})` : ""}
              </li>
            </ul>
          </div>

          {/* GOTW editor */}
          <div className="p-4 rounded border">
            <h3 className="font-semibold mb-3">Game of the Week</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Pick Matchup</label>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {games.map((g) => (
                    <label
                      key={g.id}
                      className={[
                        "flex items-center justify-between border rounded px-3 py-2 cursor-pointer",
                        g.home_team === gotwHome && g.away_team === gotwAway
                          ? "bg-blue-100 border-blue-400"
                          : "hover:bg-gray-100",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="gotwGame"
                        className="mr-2"
                        checked={
                          g.home_team === gotwHome && g.away_team === gotwAway
                        }
                        onChange={() => onSelectGame(g)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {g.home_team} vs {g.away_team}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(g.kickoff || g.start_time || g.kickoff_time).toLocaleString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                {/* Computed from final scores */}
                <div className="text-sm mb-3">
                  <div className="font-medium mb-1">Computed from final score:</div>
                  {selectedGame ? (
                    <>
                      <div>
                        {selectedGame.home_team}:{" "}
                        <b>
                          {selectedGame.home_score ?? "—"}
                        </b>{" "}
                        &nbsp;|&nbsp; {selectedGame.away_team}:{" "}
                        <b>
                          {selectedGame.away_score ?? "—"}
                        </b>
                      </div>
                      <div className="mt-1">
                        Total:{" "}
                        <b className={computedTotal != null ? "text-green-700" : "text-gray-500"}>
                          {computedTotal != null ? computedTotal : "—"}
                        </b>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchWeekData(week)}
                        className="mt-2 text-xs underline text-blue-700"
                      >
                        Refresh scores
                      </button>
                    </>
                  ) : (
                    <div className="text-gray-500">Select a matchup to see the computed total.</div>
                  )}
                </div>

                {/* Override */}
                <label className="block text-sm font-medium mb-1">
                  Override Total Points (official result; <span className="italic">leave blank to auto-calc</span>)
                </label>
                <input
                  type="number"
                  value={gotwTotal}
                  onChange={(e) => setGotwTotal(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="e.g., 47 (only if you need to override)"
                />
                <p className="text-xs text-gray-600 mt-1">
                  If left blank, the system uses home_score + away_score.
                </p>

                <button
                  onClick={saveGOTW}
                  disabled={savingG || !gotwHome || !gotwAway}
                  className={[
                    "mt-3 px-4 py-2 rounded text-white font-semibold",
                    savingG || !gotwHome || !gotwAway
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700",
                  ].join(" ")}
                >
                  {savingG ? "Saving…" : "Save GOTW"}
                </button>
              </div>
            </div>
          </div>

          {/* POTW editor */}
          <div className="p-4 rounded border">
            <h3 className="font-semibold mb-3">Player of the Week (official yards)</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Official Total Yards (enter post-week)
                </label>
                <input
                  type="number"
                  min={0}
                  value={potwYards}
                  onChange={(e) => setPotwYards(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="e.g., 132"
                />
                <p className="text-xs text-gray-600 mt-1">
                  You can leave this blank before the week. Enter it after games conclude (unless automated).
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">(Optional) Player / Team</label>
                <input
                  type="text"
                  value={potwName}
                  onChange={(e) => setPotwName(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Player name (if you track it)"
                />
                <input
                  type="text"
                  value={potwTeam}
                  onChange={(e) => setPotwTeam(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Team (if you track it)"
                />
              </div>
            </div>
            <button
              onClick={savePOTW}
              disabled={savingP}
              className={[
                "mt-3 px-4 py-2 rounded text-white font-semibold",
                savingP ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700",
              ].join(" ")}
            >
              {savingP ? "Saving…" : "Save POTW"}
            </button>
          </div>

          {/* QA helpers */}
          <div className="p-4 rounded border bg-yellow-50">
            <h3 className="font-semibold mb-2">QA Helpers</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/leaderboard/week/${week}?debug_unlocked=1`)}
                className="px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600"
              >
                Preview Weekly Leaderboard (Unlocked)
              </button>
              <button
                onClick={() => navigate(`/leaderboard/week/${week}`)}
                className="px-4 py-2 rounded bg-slate-600 text-white hover:bg-slate-700"
              >
                View Weekly Leaderboard (Normal Lock)
              </button>
            </div>
          </div>

          {msg && (
            <div className="p-3 rounded border bg-white">{msg}</div>
          )}
        </>
      )}
    </div>
  );
}
