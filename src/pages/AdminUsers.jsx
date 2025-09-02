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
    id: u.id,
    email: u.email || "",
    first_name: u.first_name || "",
    last_name: u.last_name || "",
    name: u.name || "",
    is_admin: !!u.is_admin,
    created_at: u.created_at,
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
  const [status, setStatus] = useState("all"); // ✅ default to ALL so you see everyone
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState(null);

  const backend = import.meta.env.VITE_BACKEND_URL;
  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  // --- Fetch users (use your known-good /admin/users; then fallback to old pair) ---
  const fetchUsers = async (override = {}) => {
    setLoading(true);
    setMsg("");
    setErr("");
    const effectiveStatus = override.status ?? status;
    const effectiveQuery = override.q ?? q;

    try {
      const res = await axios.get(`${backend}/admin/users`, {
        params: { status: effectiveStatus, q: effectiveQuery || undefined },
        ...axiosAuth,
      });

      const payload = res.data;
      const usersArray = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.users)
        ? payload.users
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      const normalized = usersArray.map(normalizeUser);
      const filtered = filterByQuery(
        filterByStatus(normalized, effectiveStatus),
        effectiveQuery
      );
      setRows(filtered);
    } catch (e1) {
      // Fallback: old endpoints (pending + all)
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

  // -------- Save inline edits (try quick-edit; fallback to legacy) --------
  const saveInline = async (row) => {
    setSavingId(row.id);
    setMsg("");
    setErr("");

    const payload = {
      email: row.email || null,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      name: row.name || null,
      approved: !!row.approved,
      is_active: !!row.is_active,
    };

    try {
      // if you later add the quick-edit route, this will succeed
      await axios.put(
        `${backend}/admin/quick-edit/users/${row.id}`,
        payload,
        axiosAuth
      );
      setMsg("✅ Saved");
    } catch {
      // fallback to the generic update route that likely exists
      try {
        await axios.put(`${backend}/admin/users/${row.id}`, payload, axiosAuth);
        setMsg("✅ Saved");
      } catch (e2) {
        console.error(e2);
        setErr(e2.response?.data?.error || "Save failed");
      }
    } finally {
      setSavingId(null);
      fetchUsers();
    }
  };

  // Local edits
  const onChangeField = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // -------- Actions (keep your existing flows) --------
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
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
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
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">First</th>
                <th className="px-3 py-2">Last</th>
                <th className="px-3 py-2">Display Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((u, i) => {
                  const canDelete = u.id !== user.id; // don’t let you delete yourself
                  return (
                    <tr key={u.id} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="px-3 py-2">{u.id}</td>

                      {/* Inline-editable fields */}
                      <td className="px-3 py-2">
                        <input
                          className="border rounded px-2 py-1 w-64"
                          value={u.email}
                          onChange={(e) =>
                            onChangeField(u.id, "email", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="border rounded px-2 py-1 w-28"
                          value={u.first_name}
                          onChange={(e) =>
                            onChangeField(u.id, "first_name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="border rounded px-2 py-1 w-28"
                          value={u.last_name}
                          onChange={(e) =>
                            onChangeField(u.id, "last_name", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="border rounded px-2 py-1 w-40"
                          value={u.name}
                          onChange={(e) =>
                            onChangeField(u.id, "name", e.target.value)
                          }
                        />
                      </td>

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
                            onClick={() => saveInline(u)}
                            disabled={savingId === u.id}
                            className={`px-2 py-1 rounded text-white ${
                              savingId === u.id
                                ? "bg-gray-400 cursor-wait"
                                : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                            title="Save name/email changes"
                          >
                            {savingId === u.id ? "Saving…" : "Save"}
                          </button>

                          <button
                            onClick={() => removeUser(u.id, u.email)}
                            disabled={u.id === user.id}
                            className={`px-2 py-1 rounded text-white ${
                              u.id !== user.id
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-red-300 cursor-not-allowed"
                            }`}
                            title={
                              u.id === user.id
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
