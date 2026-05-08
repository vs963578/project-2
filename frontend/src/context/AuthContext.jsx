import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiLogin, apiRegister, apiMe } from "../lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "cq_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "authenticated" | "unauthenticated"

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const me = await apiMe();
      setUser(me);
      setStatus("authenticated");
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    bootstrap();
    const handler = () => {
      setUser(null);
      setStatus("unauthenticated");
    };
    window.addEventListener("cq:unauthorized", handler);
    return () => window.removeEventListener("cq:unauthorized", handler);
  }, [bootstrap]);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  };

  const register = async (email, password, name) => {
    const res = await apiRegister(email, password, name);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
