// src/pages/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login, bootLoading } = useAuth(); // signup handled directly (pending flow)
  const navigate = useNavigate();
  const location = useLocation();
  const backend = import.meta.env.VITE_BACKEND_URL;

  // Read query params once
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialMode = (() => {
    const m = (qs.get("mode") || "").toLowerCase();
    if (m === "signup") return "signup";
    if (m === "reset") return "reset";
    return "login";
  })();
  const initialToken = qs.get("token") || "";

  // Modes: 'login' | 'signup' | 'reset'
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Standard form
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
  });

  // Reset flow state
  const [resetToken, setResetToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  // If user already authed, bounce to dashboard
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");

    // When leaving reset mode, clear reset fields
    if (next !== "reset") {
      setResetToken("");
      setNewPassword("");
      setNewPassword2("");
    }

    // When leaving signup mode, clear name/confirm but keep email (convenient)
    if (next !== "signup") {
      setForm((f) => ({ ...f, first_name: "", last_name: "", confirm: "" }));
    }
  };

  const validate = () => {
    if (mode === "login") {
      if (!form.email.trim() || !form.password) return "Please enter email and password.";
    } else if (mode === "signup") {
      if (!form.first_name.trim()) return "Please enter your first name.";
      if (!form.email.trim() || !form.password) return "Please enter email and password.";
      if (form.password.length < 8) return "Password must be at least 8 characters.";
      if (form.password !== form.confirm) return "Passwords do not match.";
    } else if (mode === "reset") {
      if (resetToken) {
        if (!newPassword) return "Please enter a new password.";
        if (newPassword.length < 8) return "Password must be at least 8 characters.";
        if (newPassword !== newPassword2) return "New passwords do not match.";
      } else {
        if (!form.email.trim()) return "Please enter your email.";
      }
    }
    return "";
  };

  // Friendly mapping of backend error codes
  const mapLoginError = (err) => {
    const code = err?.response?.data?.code;
    const msg = err?.response?.data?.error || err?.message || "Login failed.";
    if (code === "INACTIVE") return "Your account is deactivated. Please contact an admin.";
    if (code === "PENDING_APPROVAL") return "Your account is awaiting admin approval. You’ll be able to sign in once approved.";
    return msg;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const v = validate();
    if (v) { setError(v); return; }

    try {
      setBusy(true);

      if (mode === "login") {
        await login(form.email.trim().toLowerCase(), form.password);
        navigate("/dashboard", { replace: true });
        return;
      }

      if (mode === "signup") {
        const res = await axios.post(`${backend}/auth/signup`, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || "",
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        const pending = res.data?.pending || res.data?.status === "pending";
        const message =
          res.data?.message ||
          "Account created. An admin must approve your access before you can sign in.";
        setNotice(
          pending
            ? message
            : "Account created. If you can’t sign in yet, you may still be awaiting admin approval."
        );
        setMode("login");
        setForm((f) => ({ first_name: "", last_name: "", email: f.email, password: "", confirm: "" }));
        return;
      }

      // mode === "reset"
      if (!resetToken) {
        // Request link
        const res = await axios.post(`${backend}/auth/request-reset`, {
          email: form.email.trim().toLowerCase(),
        });
        setNotice(res.data?.message || "If that email exists, a reset link has been created.");

        // Dev convenience: auto-extract token if dev_reset_url is returned
        const devUrl = res.data?.dev_reset_url;
        if (devUrl) {
          try {
            const u = new URL(devUrl);
            const t = u.searchParams.get("token");
            if (t) setResetToken(t);
          } catch { /* ignore */ }
        }
        return;
      } else {
        // Perform reset
        const res = await axios.post(`${backend}/auth/perform-reset`, {
          token: resetToken,
          new_password: newPassword,
        });
        setNotice(res.data?.message || "Password updated. You can now sign in with your new password.");
        setMode("login");
        setResetToken("");
        setNewPassword("");
        setNewPassword2("");
        setForm((f) => ({ ...f, password: "", confirm: "" }));
        return;
      }
    } catch (err) {
      const msg =
        mode === "login"
          ? mapLoginError(err)
          : err?.response?.data?.error ||
            err?.message ||
            (resetToken ? "Reset failed." : "Reset request failed.");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (bootLoading) return <div className="p-6 text-center">Loading…</div>;

  const isResetWithToken = mode === "reset" && !!resetToken;

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-2 text-center">
        {mode === "login"
          ? "Welcome back"
          : mode === "signup"
          ? "Create your account"
          : isResetWithToken
          ? "Set a new password"
          : "Forgot your password?"}
      </h2>
      <p className="text-center text-sm text-gray-600 mb-6">
        {mode === "login"
          ? "Sign in to continue to NFL Frenzy."
          : mode === "signup"
          ? "Sign up to join NFL Frenzy. An admin will approve your access."
          : isResetWithToken
          ? "Enter a new password for your account."
          : "Enter your email to request a reset link."}
      </p>

      {notice && (
        <div className="mb-4 p-3 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm whitespace-pre-wrap">
          {notice}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* SIGNUP FIELDS */}
        {mode === "signup" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">First name</label>
              <input
                name="first_name"
                value={form.first_name}
                onChange={onChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Wack"
                autoComplete="given-name"
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last name (optional)</label>
              <input
                name="last_name"
                value={form.last_name}
                onChange={onChange}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Johnson"
                autoComplete="family-name"
                disabled={busy}
              />
            </div>
          </>
        )}

        {/* EMAIL — shown except in reset-with-token */}
        {!(mode === "reset" && isResetWithToken) && (
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </div>
        )}

        {/* PASSWORD — login + signup */}
        {(mode === "login" || mode === "signup") && (
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              placeholder={mode === "signup" ? "min 8 characters" : "••••••••"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              disabled={busy}
            />
          </div>
        )}

        {/* CONFIRM — signup */}
        {mode === "signup" && (
          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              placeholder="repeat your password"
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
        )}

        {/* RESET: new password form (when token present) */}
        {mode === "reset" && isResetWithToken && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="min 8 characters"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm new password</label>
              <input
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="repeat new password"
                autoComplete="new-password"
                disabled={busy}
              />
            </div>
          </>
        )}

        {/* RESET: request form (no token yet) */}
        {mode === "reset" && !isResetWithToken && (
          <div className="text-xs text-gray-600">
            We’ll create a reset link for this email. In development, the link is shown on this page.
          </div>
        )}

        {error && (
          <div className="p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`w-full px-4 py-2 rounded text-white font-semibold ${
            busy ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {busy
            ? mode === "login"
              ? "Signing in…"
              : mode === "signup"
              ? "Creating account…"
              : isResetWithToken
              ? "Updating password…"
              : "Creating reset link…"
            : mode === "login"
            ? "Sign in"
            : mode === "signup"
            ? "Sign up"
            : isResetWithToken
            ? "Set new password"
            : "Request reset link"}
        </button>
      </form>

      {/* Footer switches */}
      <div className="mt-4 text-center text-sm">
        {mode === "login" && (
          <div className="flex flex-col gap-2 items-center">
            <div>
              Don’t have an account?{" "}
              <button className="text-blue-700 underline" onClick={() => switchMode("signup")} disabled={busy}>
                Create one
              </button>
            </div>
            <div>
              Forgot your password?{" "}
              <button className="text-blue-700 underline" onClick={() => switchMode("reset")} disabled={busy}>
                Reset it
              </button>
            </div>
          </div>
        )}

        {mode === "signup" && (
          <div>
            Already have an account?{" "}
            <button className="text-blue-700 underline" onClick={() => switchMode("login")} disabled={busy}>
              Sign in
            </button>
          </div>
        )}

        {mode === "reset" && (
          <div>
            Remembered it?{" "}
            <button className="text-blue-700 underline" onClick={() => switchMode("login")} disabled={busy}>
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
