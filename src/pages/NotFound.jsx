// src/pages/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center">
        <div className="text-7xl mb-2">🧐</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-gray-600 mb-6">
          The page you’re looking for doesn’t exist (or may have moved).
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
