// src/pages/PicksForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TOTAL_WEEKS = 18;

/** Inline Highlights panel (so you don't need a separate file) */
function HighlightsPanel({ week, className = "" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let done = false;
    async function run() {
      try {
        setLoading(true);
        setErr("");
        const url = `${import.meta.env.VITE_BACKEND_URL}/games/highlights/${week}`;
        const res = await axios.get(url);
        if (!done) setData(res.data?.data || null);
      } catch (e) {
        if (!done) setErr("Could not load highlights.");
      } finally {
        if (!done) setLoading(false);
      }
    }
    run();
    return () => {
      done = true;
    };
  }, [week]);

  if (loading) {
    return (
      <div className={`rounded-xl border p-4 bg-white shadow-sm ${className}`}>
        <div className="text-sm text-gray-500">Loading highlights…</div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className={`rounded-xl border p-4 bg-white shadow-sm ${className}`}>
        <div className="text-sm text-red-600">{err || "No highlights available."}</div>
      </div>
    );
  }

  const { gotw, potw } = data;

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className}`}>
      {/* GOTW */}
      <div className="rounded-xl border p-4 bg-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Game of the Week
        </div>
        {gotw ? (
          <>
            <div className="text-lg font-semibold text-gray-900">
              {gotw.away_team} @ {gotw.home_team}
            </div>
            {gotw.start_time && (
              <div className="text-sm text-gray-600 mt-1">
                Kickoff: {new Date(gotw.start_time).toLocaleString()}
              </div>
            )}
            <div className="text-sm text-gray-700 mt-3">
              Enter your <b>total points</b> prediction for this matchup below.
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">No GOTW set for week {week}.</div>
        )}
      </div>

      {/* POTW */}
      <div className="rounded-xl border p-4 bg-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Player of the Week
        </div>
        {potw ? (
          <>
            <div className="text-lg font-semibold text-gray-900">
              {potw.player}
              {potw.team ? <span className="text-gray-600 font-normal"> — {potw.team}</span> : null}
            </div>
            <div className="text-sm text-gray-700 mt-3">
              Enter your <b>total yards</b> prediction for this player below.
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">No POTW set for week {week}.</div>
        )}
      </div>
    </div>
  );
}

export default function PicksForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { week: weekParam } = useParams();
  const week = Number(weekParam || 1);

  const [games, setGames] = useState([]);
  const [pickedTeams, setPickedTeams] = useState([]);              // teams user already used this season
  const [selectedTeam, setSelectedTeam] = useState("");
  const [existingPickTeam, setExistingPickTeam] = useState("");    // team already submitted for this week (if any)
  const [potwPrediction, setPotwPrediction] = useState("");
  const [gotwPrediction, setGotwPrediction] = useState("");

  // highlights context
  const [gotwContext, setGotwContext] = useState(null);
  const [potwContext, setPotwContext] = useState(null);

  const [loading, setLoading] = useState(true);

  // locking
  const [globalLocked, setGlobalLocked] = useState(false);         // first Sunday kickoff lock
  const [lockedGames, setLockedGames] = useState([]);              // [game.id, ...] already kicked off
  const [countdown, setCountdown] = useState("");                  // live countdown text
  const countdownTimerRef = useRef(null);

  const axiosConfig = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  // ---------- helpers ----------
  const fmtTimeLeft = (msLeft) => {
    const sec = Math.max(0, Math.floor(msLeft / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const kickoffDate = (g) => {
    const val = g.kickoff ?? g.start_time ?? g.kickoff_time;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const makeCountdown = (targetDate) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const tick = () => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) {
        setGlobalLocked(true);
        setCountdown("Picks are now locked!");
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        return;
      }
      setCountdown(`Time until first Sunday kickoff: ${fmtTimeLeft(diff)}`);
    };
    tick();
    countdownTimerRef.current = setInterval(tick, 1000);
  };

  const computeFirstSundayKickoff = (gamesList) => {
    const sundays = gamesList
      .map(kickoffDate)
      .filter((d) => d && d.getUTCDay() === 0) // 0 = Sunday
      .sort((a, b) => a - b);
    return sundays[0] || null;
  };

  // ---------- fetch on mount / when week changes ----------
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const run = async () => {
      try {
        setLoading(true);

        // 1) Games for the week
        const gamesRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/games/week/${week}`,
          axiosConfig
        );
        const gamesData = Array.isArray(gamesRes.data) ? gamesRes.data : [];
        setGames(gamesData);

        // 2) All teams user has used (season)
        const seasonRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/season/private`,
          { params: { user_id: user.id }, ...axiosConfig }
        );
        const alreadyUsed = (seasonRes.data || []).map((p) => p.team);
        setPickedTeams(alreadyUsed);

        // 3) Existing pick for this week (if any)
        const weekPickRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/private`,
          { params: { user_id: user.id }, ...axiosConfig }
        );
        const existing = (weekPickRes.data || [])[0];
        if (existing) {
          setExistingPickTeam(existing.team || "");
          setSelectedTeam(existing.team || "");
          setPotwPrediction(
            existing.potw_prediction === null || typeof existing.potw_prediction === "undefined"
              ? ""
              : String(existing.potw_prediction)
          );
          setGotwPrediction(
            existing.gotw_prediction === null || typeof existing.gotw_prediction === "undefined"
              ? ""
              : String(existing.gotw_prediction)
          );
        } else {
          setExistingPickTeam("");
          setSelectedTeam("");
          setPotwPrediction("");
          setGotwPrediction("");
        }

        // 4) Per-game locks
        const now = new Date();
        const alreadyLockedIds = gamesData
          .map((g) => ({ id: g.id, d: kickoffDate(g) }))
          .filter(({ d }) => d && d <= now)
          .map(({ id }) => id);
        setLockedGames(alreadyLockedIds);

        // 5) Global lock (first Sunday kickoff)
        const firstSunday = computeFirstSundayKickoff(gamesData);
        if (firstSunday) {
          if (now >= firstSunday) {
            setGlobalLocked(true);
            setCountdown("Picks are now locked!");
          } else {
            setGlobalLocked(false);
            makeCountdown(firstSunday);
          }
        } else {
          setGlobalLocked(false);
          setCountdown("");
        }

        // 6) Highlights context (GOTW/POTW)
        try {
          const hRes = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/games/highlights/${week}`
          );
          const h = hRes.data?.data || null;
          setGotwContext(h?.gotw || null);
          setPotwContext(h?.potw || null);
        } catch {
          setGotwContext(null);
          setPotwContext(null);
        }
      } catch (err) {
        console.error("Error loading picks form:", err);
      } finally {
        setLoading(false);
      }
    };

    run();

    // cleanup interval
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [user, week, navigate, axiosConfig]);

  // ---------- submission ----------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTeam) {
      alert("Please select a team before submitting.");
      return;
    }
    if (globalLocked) {
      alert("Picks are locked because the first Sunday game has kicked off.");
      return;
    }

    // prevent using a previously used team (unless it's the same as the existing pick for this week)
    const tryingToReuse =
      pickedTeams.includes(selectedTeam) && selectedTeam !== existingPickTeam;
    if (tryingToReuse) {
      alert(`You already used ${selectedTeam} earlier this season. Please choose a different team.`);
      return;
    }

    // prevent picking a game that has already kicked off
    const gameForTeam = games.find(
      (g) => g.home_team === selectedTeam || g.away_team === selectedTeam
    );
    if (!gameForTeam) {
      alert("Unable to find the selected team's game. Please try again.");
      return;
    }
    if (lockedGames.includes(gameForTeam.id)) {
      alert("That game has already kicked off. Please choose another game.");
      return;
    }

    // numbers or null
    const gotwVal = gotwPrediction === "" ? null : Number(gotwPrediction);
    const potwVal = potwPrediction === "" ? null : Number(potwPrediction);

    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/picks/submit`,
        {
          user_id: user.id,
          week: Number(week),
          team: selectedTeam,
          potw_prediction: potwVal,
          gotw_prediction: gotwVal,
        },
        {
          ...axiosConfig,
          headers: { ...axiosConfig.headers, "Content-Type": "application/json" },
        }
      );
      navigate("/dashboard");
    } catch (error) {
      console.error("Error submitting picks:", error);
      alert(error.response?.data?.error || "Failed to submit picks. Please try again.");
    }
  };

  const handleWeekChange = (e) => {
    navigate(`/picks/${e.target.value}`);
  };

  if (loading) return <p>Loading game data...</p>;

  // ---------- UI helpers ----------
  const isTeamAlreadyUsed = (team) =>
    pickedTeams.includes(team) && team !== existingPickTeam;

  const isGameLocked = (game) =>
    globalLocked || lockedGames.includes(game.id);

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Make Your Picks for Week {week}</h2>

        <select
          value={week}
          onChange={handleWeekChange}
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

      {/* NEW: Highlights (GOTW & POTW) */}
      <HighlightsPanel week={week} className="mb-6" />

      {!!countdown && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">
          {countdown}
        </div>
      )}

      {(selectedTeam || potwPrediction || gotwPrediction) && (
        <div className="mb-6 p-4 border rounded bg-gray-100">
          <h3 className="font-semibold mb-2">Your Picks (not yet submitted)</h3>
          {selectedTeam && (
            <p>
              ⚡ Team Pick: <strong>{selectedTeam}</strong>
              {selectedTeam === existingPickTeam && " (currently saved for this week)"}
            </p>
          )}
          {gotwPrediction !== "" && (
            <p>
              🎯 GOTW Total Points: <strong>{gotwPrediction}</strong>
            </p>
          )}
          {potwPrediction !== "" && (
            <p>
              🏈 POTW Yardage: <strong>{potwPrediction}</strong>
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {games.map((game) => {
          const locked = isGameLocked(game);
          const k = kickoffDate(game);

          return (
            <div
              key={game.id}
              className={`border rounded p-4 ${locked ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">
                  {game.home_team} vs {game.away_team}
                </h3>
                <div className="text-sm text-gray-600">
                  {k ? `${k.toLocaleString()} (local)` : "Kickoff: TBA"}
                </div>
              </div>

              <div className="mb-2">
                <span className="font-medium">Betting Odds:</span>{" "}
                {game.favorite ?? "—"}{game.spread != null ? ` - ${game.spread}` : ""}
              </div>

              <div className="flex flex-wrap gap-3">
                {[game.home_team, game.away_team].map((team) => {
                  const isFavorite = game.favorite ? team === game.favorite : null;
                  const selected = selectedTeam === team;
                  const alreadyUsed = isTeamAlreadyUsed(team);
                  const disabled = locked || alreadyUsed;

                  return (
                    <label
                      key={team}
                      className={[
                        "flex items-center gap-2 border rounded px-3 py-2 cursor-pointer transition-all",
                        selected ? "bg-blue-200 border-blue-500 font-semibold" : "",
                        !selected && isFavorite === true ? "bg-yellow-100 border-yellow-400" : "",
                        !selected && isFavorite === false ? "bg-green-100 border-green-400" : "",
                        disabled ? "opacity-50 cursor-not-allowed line-through" : "hover:shadow-md hover:scale-[1.01]",
                      ].join(" ")}
                      title={
                        locked
                          ? "This game has already kicked off."
                          : alreadyUsed
                          ? "You already used this team earlier this season."
                          : isFavorite === true
                          ? "Favorite (1 point if correct)"
                          : isFavorite === false
                          ? "Underdog (2 points if correct)"
                          : "Pick"
                      }
                    >
                      <input
                        type="radio"
                        name={`teamSelection-${game.id}`}
                        value={team}
                        disabled={disabled}
                        checked={selected}
                        onChange={() => setSelectedTeam(team)}
                      />
                      <span className="flex items-center gap-2">
                        <span>{team}</span>
                        {isFavorite === true && <span aria-hidden>⭐</span>}
                        {alreadyUsed && <span className="text-xs bg-gray-200 px-1 rounded">Used</span>}
                        {selected && <span aria-hidden>✔️</span>}
                      </span>
                    </label>
                  );
                })}
              </div>

              {locked && (
                <p className="mt-2 text-sm text-red-600">
                  Game locked: Already kicked off or global lock active.
                </p>
              )}
            </div>
          );
        })}

        {/* GOTW / POTW inputs (now with live context) */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block mb-1 font-medium">
              GOTW Total Points
              {gotwContext ? (
                <span className="ml-2 text-xs text-gray-600">
                  ({gotwContext.away_team} @ {gotwContext.home_team})
                </span>
              ) : null}
            </label>
            <input
              type="number"
              min={0}
              value={gotwPrediction}
              onChange={(e) => setGotwPrediction(e.target.value)}
              className="border rounded px-2 py-1 w-full"
              disabled={globalLocked}
              placeholder="e.g., 41"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">
              POTW Yardage
              {potwContext ? (
                <span className="ml-2 text-xs text-gray-600">
                  ({potwContext.player}{potwContext.team ? ` — ${potwContext.team}` : ""})
                </span>
              ) : null}
            </label>
            <input
              type="number"
              min={0}
              value={potwPrediction}
              onChange={(e) => setPotwPrediction(e.target.value)}
              className="border rounded px-2 py-1 w-full"
              disabled={globalLocked}
              placeholder="e.g., 95"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={globalLocked || !selectedTeam}
            className={`mt-2 px-6 py-2 rounded text-white font-bold ${
              globalLocked || !selectedTeam
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            Submit Picks
          </button>

          <button
            type="button"
            onClick={() => navigate(`/leaderboard/week/${week}`)}
            className="mt-2 px-6 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Weekly Leaderboard
          </button>
        </div>
      </form>
    </div>
  );
}
