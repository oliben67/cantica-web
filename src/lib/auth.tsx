import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const TOKEN_KEY = "cantica_token";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  is_active: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  /** True while the initial /auth/me check is in flight — don't redirect yet. */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
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

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * Redirect to /login if the auth check is complete and no user is found.
 * Returns true while the check is still in flight (caller should render null/spinner).
 */
export function useRequireAuth(): boolean {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, navigate]);

  return isLoading;
}

/**
 * Same as useRequireAuth but also requires the admin role.
 * Redirects non-admins to "/" (not /login).
 */
export function useRequireAdmin(): boolean {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (!isAdmin) navigate("/", { replace: true });
  }, [isLoading, user, isAdmin, navigate]);

  return isLoading;
}
