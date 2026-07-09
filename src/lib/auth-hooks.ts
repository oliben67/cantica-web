import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, type AuthState } from "./auth-context";

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
