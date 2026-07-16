import { createContext } from "react";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  is_active: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  /** True while the initial /auth/me check is in flight — don't redirect yet. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
