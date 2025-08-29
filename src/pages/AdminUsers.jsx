// src/pages/AdminUsers.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending Approval" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function statusPill({ is_active, pending_approval }) {
  if (pending_approval)
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800">
        Pending
      </span>
    );
  if (is_active)
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
        Active
      </span>
    );
  return (
    <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-800">
      Inactive
    </span>
  );
}

/** Normalize user to have pending_approval + is_active flags consistently */
function normalizeUser(u) {
  const approved =
    typeof u.approved === "boolean"
      ? u.approved
      : u.pending_approval === true
      ? false
      : u.approved ?? true;

  const deactivated =
    typeof u.deactivated === "boolean"
      ? u.deactivated
      : u.is_active === false
      ? true
      : u.deactivated ?? false;

  const pending_approval =
    typeof u.pending_approval === "boolean" ? u.pending_approval : !approved;

  const is_active =
    typeof u.is_active === "boolean" ? u.is_active : approved && !deactivated;

  return {
    ...u,
    approved,
    deactivated,
    pending_approval,
    is_active,
  };
}

/** Client-side helpers (fallback if server doesn't filter) */
function filterByStatus(users, status) {
  if (status === "all") return users;
  if (status === "pending") return users.filter((u) => u.pending_approval);
  if (status === "active") return users.filter((u) => u.is_active);
  if (status === "inactive") return users.filter((u) => !u.is_active);
  return users;
}

function filterByQuery(users, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return users;
  return users.filter((u) => {
    const name = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return (
      (name || "").toLowerCase().includes(needle) ||
      (u.email || "").toLowerCase().includes(needle)
    );
  });
}

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const backend = import.meta.env.VITE_BACKEND_URL;
  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  // --- Fetch users with graceful fallbacks ---
  const fetchUsers = async (override = {}) => {
    setLoading(true);
    setMsg("");
    setErr("");
    const effectiveStatus = override.status ?? status;
    const effectiveQuery = override.q ?? q;

    try {
      // Preferred: single endpoint with server-side filters
      const res = await axios.get(`${backend}/admin/users`, {
        params: { status: effectiveStatus, q: effectiveQuery || undefined },
        ...axiosAuth,
      });

      const payload = res.data;
      const usersArray = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.users)
        ? payload.users
        : [];

      setRows(usersArray.map(normalizeUser));
    } catch (e1) {
      // Fallback: older endpoints
      try {
        const [pRes, aRes] = await Promise.allSettled([
          axios.get(`${backend}/admin/users/pending`, axiosAuth),
          axios.get(`${backend}/admin/users`, axiosAuth),
        ]);

        let merged = [];
        if (pRes.status === "fulfilled") merged = merged.concat(pRes.value.data || []);
        if (aRes.status === "fulfilled") merged = merged.concat(aRes.value.data || []);

        const normalized = merged.map(normalizeUser);
        const filtered = filterByQuery(
          filterByStatus(normalized, effectiveStatus),
          effectiveQuery
        );
        setRows(filtered);
      } catch (e2) {
        console.error("Load users failed:", e2);
        setErr(e2.response?.data?.error || "Failed to load users");
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Gate non-admins & initial load
  useEffect(() => {
    if (!user) return;
    if (!user.is_admin) {
      navigate("/dashboard");
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 🔄 Auto-refresh whenever the Status filter changes
  useEffect(() => {
    if (!user?.is_admin) return;
    fetchUsers({ status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const withBusy = async (fn, successMsg) => {
    try {
      setMsg("");
      setErr("");
      await fn();
      setMsg(successMsg);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setErr(e.response?.data?.error || "Request failed");
    }
  };

  // -------- Actions (try PUT first, then POST fallback) --------
  const approve = (id) =>
    withBusy(
      async () => {
        try {
          await axios.put(`${backend}/admin/users/${id}/approve`, {}, axiosAuth);
        } catch {
          await axios.post(`${backend}/admin/users/${id}/approve`, {}, axiosAuth);
        }
      },
      "✅ User approved"
    );

  const decline = (id) =>
    withBusy(
      async () => {
        try {
          await axios.put(`${backend}/admin/users/${id}/decline`, {}, axiosAuth);
        } catch {
          await axios.post(`${backend}/admin/users/${id}/deny`, {}, axiosAuth);
        }
      },
      "✅ User declined"
    );

  const activate = (id) =>
    withBusy(
      async () => {
        try {
          await axios.put(`${backend}/admin/users/${id}/activate`, {}, axiosAuth);
        } catch {
          await axios.post(`${backend}/admin/users/${id}/activate`, {}, axiosAuth);
        }
      },
      "✅ User activated"
    );

  const deactivate = (id) =>
    withBusy(
      async () => {
        try {
          await axios.put(`${backend}/admin/users/${id}/deactivate`, {}, axiosAuth);
        } catch {
          await axios.post(`${backend}/admin/users/${id}/deactivate`, {}, axiosAuth);
        }
      },
      "✅ User deactivated"
    );

  const toggleAdmin = (id, is_admin) =>
    withBusy(
      async () => {
        try {
          await axios.put(
            `${backend}/admin/users/${id}/admin-role`,
            { is_admin: !is_admin },
            axiosAuth
          );
        } catch {
          if (!is_admin) {
            await axios.post(`${backend}/admin/users/${id}/make-admin`, {}, axiosAuth);
          } else {
            await axios.post(`${backend}/admin/users/${id}/remove-admin`, {}, axiosAuth);
          }
        }
      },
      `✅ ${!is_admin ? "Granted" : "Removed"} admin`
    );

  const removeUser = (id, email) => {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    return withBusy(
      async () => {
        try {
          await axios.delete(`${backend}/admin/users/${id}`, axiosAuth);
        } catch {
          await axios.post(`${backend}/admin/users/${id}/delete`, {}, axiosAuth);
        }
      },
      "🗑️ User deleted"
    );
  };

  // 🔎 Filters
  const applyFilters = () => fetchUsers();
  const resetSearch = () => {
    setQ("");
    fetchUsers({ q: "" });
  };
  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-bold">Admin — Manage Users</h2>

        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            title="Filter by status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search name or email"
            className="border rounded px-2 py-1 text-sm"
          />

          <button
            onClick={applyFilters}
            className="text-sm bg-gray-800 text-white px-3 py-2 rounded hover:bg-black"
            title="Apply current filters"
          >
            Apply
          </button>

          <button
            onClick={resetSearch}
            className="text-sm bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300"
            title="Clear search"
          >
            Reset
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`mb-3 p-3 rounded border ${
            err
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {err || msg}
        </div>
      )}

      {loading ? (
        <p>Loading users…</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((u, i) => {
                  const canDelete = u.id !== user.id; // don’t let you delete yourself
                  const displayName =
                    u.name ||
                    `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                    "—";
                  return (
                    <tr key={u.id} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="px-3 py-2">{displayName}</td>
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2">
                        {statusPill({
                          is_active: u.is_active,
                          pending_approval: u.pending_approval,
                        })}
                      </td>
                      <td className="px-3 py-2">{u.is_admin ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {u.pending_approval ? (
                            <>
                              <button
                                onClick={() => approve(u.id)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => decline(u.id)}
                                className="px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700"
                              >
                                Decline
                              </button>
                            </>
                          ) : u.is_active ? (
                            <button
                              onClick={() => deactivate(u.id)}
                              className="px-2 py-1 rounded bg-gray-600 text-white hover:bg-gray-700"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => activate(u.id)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              Activate
                            </button>
                          )}

                          <button
                            onClick={() => toggleAdmin(u.id, u.is_admin)}
                            className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            {u.is_admin ? "Remove Admin" : "Make Admin"}
                          </button>

                          <button
                            onClick={() => removeUser(u.id, u.email)}
                            disabled={!canDelete}
                            className={`px-2 py-1 rounded text-white ${
                              canDelete
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-red-300 cursor-not-allowed"
                            }`}
                            title={
                              !canDelete
                                ? "You cannot delete your own account"
                                : "Delete user"
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
