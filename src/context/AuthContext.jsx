// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const backend = import.meta.env.VITE_BACKEND_URL;

  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  // attach Authorization automatically if a token exists
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  }, []);

  // hydrate user on app load
  useEffect(() => {
    const run = async () => {
      try {
        const t = localStorage.getItem("token");
        if (!t) return;
        // keep using your existing /users/me endpoint
        const me = await axios.get(`${backend}/users/me`);
        setUser(me.data.user);
      } catch {
        // invalid/expired token – clear it
        localStorage.removeItem("token");
        delete axios.defaults.headers.common["Authorization"];
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    };
    run();
  }, [backend]);

  /** Login: returns { user } or throws Error(message) */
  const login = async (email, password) => {
    try {
      const res = await axios.post(`${backend}/auth/login`, { email, password });
      const { token, user } = res.data || {};
      if (!token || !user) throw new Error("Invalid login response");
      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(user);
      return { user };
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login failed";
      // Surface backend messages like “awaiting admin approval” / “deactivated”
      throw new Error(msg);
    }
  };

  /**
   * Signup:
   * backend returns { ok:true, status:"pending", message:"..." }
   * We DO NOT log the user in (no token until approved).
   */
  const signup = async ({ first_name, last_name, email, password }) => {
    try {
      const res = await axios.post(`${backend}/auth/signup`, {
        first_name,
        last_name,
        email,
        password,
      });
      // Ensure we’re not accidentally logged in from a previous session
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["Authorization"];
      setUser(null);
      return res.data; // { ok, status: 'pending', message }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Signup failed";
      throw new Error(msg);
    }
  };

  /** Manually reload the current user (after approvals, etc.) */
  const refreshUser = async () => {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const me = await axios.get(`${backend}/users/me`);
    setUser(me.data.user);
    return me.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, login, signup, logout, refreshUser, bootLoading }),
    [user, bootLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
