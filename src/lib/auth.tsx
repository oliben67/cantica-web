import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth-context";

const TOKEN_KEY = "cantica_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!token) return;
    fetch("/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((u: AuthUser) => { setUser(u); setIsLoading(false); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setIsLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for 401s from the api.ts request() helper
  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      setToken(null);
    }
    window.addEventListener("cantica:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cantica:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text);
    }
    const data = await res.json() as { access_token: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, token,
        isAdmin: user?.roles.includes("admin") ?? false,
        isLoading,
        login, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
