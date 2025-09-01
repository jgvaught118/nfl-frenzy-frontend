// src/pages/HowToPlay.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function HowToPlay() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold">How to Play</h1>
        <p className="text-gray-600">
          Welcome to NFL Frenzy! This page explains weekly picks, scoring, locks, and tie-breakers.
        </p>

        {/* quick nav */}
        <nav className="text-sm text-blue-700 flex flex-wrap gap-x-3 gap-y-1">
          <a href="#legend" className="underline">Legend</a>
          <a href="#basics" className="underline">Weekly Basics</a>
          <a href="#season" className="underline">Season Constraints</a>
          <a href="#scoring" className="underline">Scoring</a>
          <a href="#locks" className="underline">Deadlines & Locks</a>
          <a href="#tiebreakers" className="underline">Tie-Breakers</a>
          <a href="#entry" className="underline">Entry & Access</a>
          <a href="#tips" className="underline">Tips</a>
        </nav>
      </header>

      {/* Quick legend */}
      <section id="legend" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Legend</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <span className="font-semibold">⭐ Favorite</span> — pick the favorite and get{" "}
            <span className="font-semibold">1 point</span> if that team wins.
          </li>
          <li>
            <span className="font-semibold">Underdog</span> — pick the underdog and get{" "}
            <span className="font-semibold">2 points</span> if that team wins.
          </li>
          <li>
            <span className="font-semibold">🎯 GOTW</span> — <em>Game of the Week</em> total points prediction.
          </li>
          <li>
            <span className="font-semibold">🏈 POTW</span> — <em>Player of the Week</em> total yards prediction.
          </li>
        </ul>
      </section>

      {/* Basics */}
      <section id="basics" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Weekly Basics</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            Go to <Link className="text-blue-600 underline" to="/dashboard">Dashboard</Link> and open{" "}
            <Link className="text-blue-600 underline" to="/picks/1">Weekly Picks</Link> for the week you want.
          </li>
          <li>
            Select exactly <span className="font-semibold">one team</span> to win its game (you can’t reuse a team later in the season).
          </li>
          <li>
            Enter your <span className="font-semibold">GOTW</span> (total points) and{" "}
            <span className="font-semibold">POTW</span> (player total yards) predictions.
          </li>
          <li>
            Click <span className="font-semibold">Submit Picks</span>. You can edit until the lock time (see below).
          </li>
        </ol>
      </section>

      {/* Season constraint */}
      <section id="season" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Season Constraints</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <span className="font-semibold">One-and-done teams:</span> once you pick a team in any week, you
            cannot use that team again for the rest of the regular season.
          </li>
        </ul>
      </section>

      {/* Scoring */}
      <section id="scoring" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Scoring</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><span className="font-semibold">Favorite correct = 1 point</span></li>
          <li><span className="font-semibold">Underdog correct = 2 points</span></li>
          <li>
            <span className="font-semibold">GOTW &amp; POTW</span> are currently used as{" "}
            <span className="font-semibold">tie-breakers</span>. If bonus points are enabled later,
            this page will be updated.
          </li>
        </ul>
      </section>

      {/* Locks */}
      <section id="locks" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Deadlines &amp; Locks</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <span className="font-semibold">Per-game lock:</span> once a game kicks off, that game is locked and
            you can’t pick either team from that game.
          </li>
          <li>
            <span className="font-semibold">Global lock:</span> at the <em>first Sunday kickoff</em> of the week,
            all remaining picks lock. The site shows a countdown so you always know the time left.
          </li>
        </ul>
        <p className="text-gray-600 mt-2 text-sm">
          Times display in your local timezone; locking logic is consistent server-wide.
        </p>
      </section>

      {/* Tie-breakers */}
      <section id="tiebreakers" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Tie-Breakers</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li><span className="font-semibold">Closest GOTW total points</span> (absolute difference).</li>
          <li><span className="font-semibold">Closest POTW yards</span> (absolute difference).</li>
          <li>If still tied: earliest submission timestamp wins.</li>
        </ol>
        <p className="text-gray-600 mt-2 text-sm">
          Admin may adjust tie rules before Week 1 results finalize; any change will be posted here.
        </p>
      </section>

      {/* Entry / Access */}
      <section id="entry" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Entry &amp; Access</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            New users must send the entry fee (see Rules PDF) and then request access by signing up.
            The admin will approve access after payment is confirmed.
          </li>
          <li>
            Problems? Email{" "}
            <a className="text-blue-600 underline" href="mailto:jgvaught118@gmail.com">jgvaught118@gmail.com</a>{" "}
            or text{" "}
            <a className="text-blue-600 underline" href="sms:+16028283169">602-828-3169</a>.
          </li>
        </ul>
      </section>

      {/* Tips */}
      <section id="tips" className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold mb-3">Tips</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Use the Underdog wisely — 2 points can swing a week.</li>
          <li>Don’t forget your GOTW/POTW predictions; they break ties.</li>
          <li>You can edit your pick until it locks — watch the countdown.</li>
        </ul>
      </section>

      <footer className="text-sm text-gray-500">
        Last updated {new Date().toLocaleDateString()}.
      </footer>
    </div>
  );
}
