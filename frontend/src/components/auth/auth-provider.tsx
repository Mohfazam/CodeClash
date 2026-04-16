"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";
import { disconnectSocket } from "@/lib/socket";
import { AuthResponse, AuthUser } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    const activeToken = getToken();
    if (!activeToken) {
      setUser(null);
      setTokenState(null);
      return;
    }
    const me = await apiRequest<AuthUser>({
      path: "/api/auth/me",
      token: activeToken,
    });
    setUser(me);
    setTokenState(activeToken);
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        await refreshMe();
      } catch {
        clearToken();
        setUser(null);
        setTokenState(null);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, []);

  const authByEndpoint = async (path: "/api/auth/login" | "/api/auth/register", payload: Record<string, string>) => {
    const data = await apiRequest<AuthResponse>({
      path,
      method: "POST",
      body: payload,
    });
    setToken(data.token);
    setTokenState(data.token);
    await refreshMe();
  };

  const login = async (email: string, password: string) => authByEndpoint("/api/auth/login", { email, password });
  const register = async (email: string, username: string, password: string) =>
    authByEndpoint("/api/auth/register", { email, username, password });

  const logout = () => {
    disconnectSocket();
    clearToken();
    setUser(null);
    setTokenState(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
