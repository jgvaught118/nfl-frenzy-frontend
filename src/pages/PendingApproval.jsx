import React from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function PendingApproval() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow mt-12 text-center">
      <h2 className="text-2xl font-bold mb-3">Thanks for signing up!</h2>
      <p className="text-gray-700">
        Your account <b>{user?.email}</b> is pending approval by an admin.
      </p>
      <p className="text-gray-700 mt-2">
        You’ll receive access once an admin approves your account.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={logout}
          className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-800"
        >
          Log out
        </button>
        <Link
          to="/"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
