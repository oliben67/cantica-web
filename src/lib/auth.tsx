import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth-context";
import { clearDeviceKey, hasDeviceKey, reAssertSession } from "./device-key";

const TOKEN_KEY = "cantica_token";

// The Cantica server serves auth through the cantica-secure shim by default
// (CANTICA_SECURITY_SHIM=true). This maps its /v1/auth/me principal onto the
// web's AuthUser and drives login via /v1/auth/login. In local mode (auth
// disabled) /v1/auth/me returns the local admin with no token, so the app is
// usable without signing in; an anonymous principal is treated as "not signed
// in" so the login page still gates protected views when auth is enabled.

interface SecurePrincipal {
  user_id: string;
  email: string;
  roles: string[];
  anonymous: boolean;
}

function toAuthUser(p: SecurePrincipal): AuthUser {
  return {
    id: p.user_id,
    username: p.email || p.user_id,
    email: p.email,
    roles: p.roles,
    is_active: true,
  };
}

async function fetchMe(token: string | null): Promise<AuthUser | null> {
  try {
    const res = await fetch("/v1/auth/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const p = (await res.json()) as SecurePrincipal;
    if (p.anonymous) return null; // not a real session — require login
    return toAuthUser(p);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Always probe /v1/auth/me: in local mode it yields the admin without a
    // token; with a stored token it restores the session; otherwise → login.
    // If the token is stale but a device key is enrolled, re-assert first.
    (async () => {
      let u = await fetchMe(localStorage.getItem(TOKEN_KEY));
      if (!u && hasDeviceKey()) {
        const fresh = await reAssertSession();
        if (fresh) u = await fetchMe(fresh);
      }
      if (!u) localStorage.removeItem(TOKEN_KEY);
      setUser(u);
      setToken(u ? localStorage.getItem(TOKEN_KEY) : null);
      setIsLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for 401s from the api.ts request() helper.
  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      setToken(null);
    }
    window.addEventListener("cantica:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cantica:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text);
    }
    const data = (await res.json()) as { access_token: string };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    const me = await fetchMe(data.access_token);
    if (!me) {
      localStorage.removeItem(TOKEN_KEY);
      throw new Error("Signed in, but the account is not usable — contact an administrator.");
    }
    setToken(data.access_token);
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    clearDeviceKey();
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
