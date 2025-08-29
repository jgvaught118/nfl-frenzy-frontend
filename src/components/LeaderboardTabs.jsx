// src/components/LeaderboardTabs.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function LeaderboardTabs({ active, totalWeeks = 18 }) {
  const navigate = useNavigate();
  const { search } = useLocation(); // preserve ?debug_unlocked=1, etc.

  const go = (path) => navigate(`${path}${search || ""}`);

  const base =
    "px-3 py-1 rounded border text-sm transition-colors duration-150";
  const activeCls = "bg-blue-600 text-white border-blue-600";
  const inactive = "bg-white text-gray-700 hover:bg-gray-50";

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => go("/leaderboard/overall")}
        className={`${base} ${active === "overall" ? activeCls : inactive}`}
      >
        Overall
      </button>

      {Array.from({ length: totalWeeks }, (_, i) => {
        const w = i + 1;
        return (
          <button
            key={w}
            onClick={() => go(`/leaderboard/week/${w}`)}
            className={`${base} ${active === w ? activeCls : inactive}`}
          >
            W{w}
          </button>
        );
      })}
    </div>
  );
}
