// src/pages/AdminEmail.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const backend = import.meta.env.VITE_BACKEND_URL;

  const axiosAuth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  // Core fields
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("active"); // all | active | inactive | pending | admins | custom
  const [emails, setEmails] = useState(""); // for custom
  const [q, setQ] = useState(""); // audience search filter

  // UX
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Preview & probe results
  const [previewHtml, setPreviewHtml] = useState("");
  const [count, setCount] = useState(0);
  const [sample, setSample] = useState([]);
  const [emailConfigured, setEmailConfigured] = useState(null); // null until first call

  // Test send
  const [testTo, setTestTo] = useState("");

  // Dry-run toggle
  const [dryRun, setDryRun] = useState(false);

  if (!user) return null;
  if (!user.is_admin) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-2">Admin Email</h2>
        <p>You must be an admin to view this page.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-3 px-4 py-2 rounded bg-gray-800 text-white"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const parseEmails = () =>
    emails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

  const clearAlerts = () => {
    setMsg("");
    setErr("");
  };

  const preview = async () => {
    clearAlerts();
    setPreviewHtml("");
    setSample([]);
    setBusy(true);
    try {
      const payload = {
        subject,
        body,
        audience,
        q: q || undefined,
        emails: audience === "custom" ? parseEmails() : undefined,
      };
      const res = await axios.post(`${backend}/admin/email/preview`, payload, axiosAuth);
      setPreviewHtml(res.data?.preview_html || "");
      setCount(res.data?.recipients_count || 0);
      setSample(res.data?.sample || []);
      setEmailConfigured(!!res.data?.email_configured);
      setMsg(
        `Preview ready. Audience size: ${res.data?.recipients_count || 0}. Email configured: ${
          res.data?.email_configured ? "Yes" : "No (simulated)"
        }`
      );
    } catch (e) {
      setErr(e.response?.data?.error || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const probeRecipients = async () => {
    clearAlerts();
    setBusy(true);
    try {
      const res = await axios.get(`${backend}/admin/email/recipients`, {
        ...axiosAuth,
        params: { audience, q: q || undefined },
      });
      setCount(res.data?.count || 0);
      setSample(res.data?.sample || []);
      setMsg(`Audience probe: ${res.data?.count || 0} recipients (showing up to 10 in sample).`);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to list recipients");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    clearAlerts();
    if (!testTo.trim()) {
      setErr("Enter a test recipient");
      return;
    }
    if (!subject || !body) {
      setErr("Subject and body are required");
      return;
    }
    setBusy(true);
    try {
      const payload = { to: testTo.trim(), subject, body };
      const res = await axios.post(`${backend}/admin/email/test`, payload, axiosAuth);
      setEmailConfigured(!!res.data?.email_configured);
      setMsg(`Test email sent to ${res.data?.sent_to}. Email configured: ${res.data?.email_configured ? "Yes" : "No (simulated)"}`);
    } catch (e) {
      setErr(e.response?.data?.error || "Test email failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    clearAlerts();
    if (!subject || !body) {
      setErr("Subject and body are required");
      return;
    }
    if (audience === "custom" && parseEmails().length === 0) {
      setErr("Custom audience selected but no emails provided.");
      return;
    }
    if (!window.confirm(dryRun ? "Run a dry-run (no emails sent)?" : "Send this email now?")) return;

    setBusy(true);
    try {
      const payload = {
        subject,
        body,
        audience,
        q: q || undefined,
        emails: audience === "custom" ? parseEmails() : undefined,
        dryRun,
      };
      const res = await axios.post(`${backend}/admin/email/broadcast`, payload, axiosAuth);
      setEmailConfigured(!!res.data?.email_configured);
      setMsg(
        dryRun
          ? `Dry run complete. Audience size: ${res.data?.recipients_count || 0}.`
          : `Sent ${res.data?.sent_count || 0} of ${res.data?.recipients_count || 0}.`
      );
    } catch (e) {
      setErr(e.response?.data?.error || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin — Email Broadcast</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-3 py-2 rounded bg-gray-800 text-white"
          >
            Dashboard
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`p-3 rounded border ${
            err
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {err || msg}
        </div>
      )}

      {/* Top row: Subject / Audience / Filter */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
            placeholder="Weekly update: Week 1 is live!"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Audience</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={busy}
          >
            <option value="all">All users</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="pending">Pending approval</option>
            <option value="admins">Admins</option>
            <option value="custom">Custom list…</option>
          </select>
        </div>
      </div>

      {/* Audience search & custom list */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Audience filter (optional)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
            placeholder="Search by name or email"
          />
          <p className="text-xs text-gray-500 mt-1">
            Applies to all audiences except custom. Example: "jack" or "@gmail.com"
          </p>
        </div>

        {audience === "custom" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Custom emails (comma or newlines)
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 h-24"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              disabled={busy}
              placeholder="a@ex.com, b@ex.com"
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium mb-1">Body</label>
        <textarea
          className="w-full border rounded px-3 py-2 h-44"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={busy}
          placeholder={`Hi everyone,

Picks for Week 1 are open now. Deadline is Sunday 10:59 AM Arizona time.

Good luck!`}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={preview}
          disabled={busy || !subject || !body}
          className={`px-4 py-2 rounded text-white ${
            busy || !subject || !body ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          Preview
        </button>

        <button
          onClick={probeRecipients}
          disabled={busy}
          className={`px-4 py-2 rounded text-white ${
            busy ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          Probe recipients
        </button>

        <label className="inline-flex items-center gap-2 ml-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={busy}
          />
          <span className="text-sm text-gray-700">Dry run</span>
        </label>

        <button
          onClick={send}
          disabled={busy || !subject || !body}
          className={`px-4 py-2 rounded text-white ${
            busy || !subject || !body ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {dryRun ? "Run Dry-Run" : "Send"}
        </button>

        {count > 0 && (
          <span className="text-sm text-gray-600">
            Audience size: {count}
          </span>
        )}

        {emailConfigured !== null && (
          <span
            className={`text-sm ml-auto ${
              emailConfigured ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            Delivery: {emailConfigured ? "Configured" : "Simulated"}
          </span>
        )}
      </div>

      {/* Sample list */}
      {!!sample.length && (
        <div className="border rounded p-3 text-sm bg-gray-50">
          <div className="font-medium mb-1">Sample recipients (max 10):</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {sample.map((e, i) => (
              <li key={`${e}-${i}`}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Test send */}
      <div className="border rounded p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">Send Test</h3>
          <span className="text-xs text-gray-500">(single recipient)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 min-w-[220px] border rounded px-3 py-2"
            placeholder="you@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            disabled={busy}
          />
          <button
            onClick={sendTest}
            disabled={busy || !subject || !body || !testTo}
            className={`px-4 py-2 rounded text-white ${
              busy || !subject || !body || !testTo
                ? "bg-gray-400"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            Send test
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Uses the current Subject/Body above.
        </p>
      </div>

      {/* Preview IFRAME */}
      {previewHtml && (
        <div className="border rounded overflow-hidden">
          <div className="bg-gray-100 px-3 py-2 text-sm font-medium">
            Preview
          </div>
          <div className="p-0">
            <iframe
              title="Email Preview"
              style={{ width: "100%", height: "440px", border: 0 }}
              srcDoc={previewHtml}
            />
          </div>
        </div>
      )}
    </div>
  );
}
