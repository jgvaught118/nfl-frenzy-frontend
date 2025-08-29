import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [first_name, setFirst] = useState("");
  const [last_name, setLast]   = useState("");
  const [email, setEmail]      = useState("");
  const [password, setPass]    = useState("");
  const [confirm, setConfirm]  = useState("");
  const [err, setErr]          = useState("");
  const [busy, setBusy]        = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    try {
      setBusy(true);
      const user = await signup({ first_name, last_name, email, password });
      // If the new user needs approval, route them to /pending; else to dashboard
      if (user && user.approved === false) {
        navigate("/pending");
      } else {
        navigate("/dashboard");
      }
    } catch (e) {
      console.error(e);
      setErr(e.response?.data?.error || e.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-12">
      <h2 className="text-2xl font-bold mb-4 text-center">Create Account</h2>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-1/2"
            placeholder="First name"
            value={first_name}
            onChange={(e) => setFirst(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2 w-1/2"
            placeholder="Last name"
            value={last_name}
            onChange={(e) => setLast(e.target.value)}
            required
          />
        </div>

        <input
          type="email"
          className="border rounded px-3 py-2 w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="border rounded px-3 py-2 w-full"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
          minLength={8}
        />

        <input
          type="password"
          className="border rounded px-3 py-2 w-full"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={busy}
          className={`w-full px-4 py-2 rounded text-white font-semibold ${
            busy ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy ? "Creating…" : "Create Account"}
        </button>

        {err && <p className="text-red-600 text-center">{err}</p>}

        <p className="text-center text-sm text-gray-600 mt-2">
          Already have an account?{" "}
          <Link to="/" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
