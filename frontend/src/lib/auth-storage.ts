"use client";

const TOKEN_KEY = "codeclash_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `codeclash_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = "codeclash_token=; path=/; max-age=0; samesite=lax";
}
