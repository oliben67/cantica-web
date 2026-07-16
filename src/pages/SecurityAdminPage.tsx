import {
  AdminUsersPanel,
  ApiTokensPanel,
  DirectoryMappingsPanel,
  SecureProvider,
  canticaWebTheme,
  createFetchTransport,
  type SecureTheme,
} from "@cantica/secure-ui";
import "@cantica/secure-ui/styles.css";
import { KeyRound, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useRequireAdmin } from "@/lib/auth-hooks";

const TOKEN_KEY = "cantica_token";

// Match the shared library's tokens to cantica-web's zinc/violet palette so the
// panels feel native. Light-mode values; dark mode is handled below.
const lightTheme: SecureTheme = {
  ...canticaWebTheme,
  accent: "#7c3aed",
  bg: "#ffffff",
  surface: "#fafafa",
  border: "#e4e4e7",
  text: "#18181b",
  textMuted: "#71717a",
};

const darkTheme: SecureTheme = {
  ...lightTheme,
  bg: "#18181b",
  surface: "#27272a",
  border: "#3f3f46",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
};

type Tab = "users" | "directory" | "tokens";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "directory", label: "Directory", icon: ShieldCheck },
  { id: "tokens", label: "API Tokens", icon: KeyRound },
];

/**
 * Admin security screens (extraction roadmap Phase E). Renders the shared
 * @cantica/secure-ui panels over a fetch transport that reuses cantica-web's
 * bearer token. Only reachable when the server runs with the security shim
 * mounted; the panels degrade to a clear error if those routes are absent.
 */
export function SecurityAdminPage() {
  const loading = useRequireAdmin();
  const [tab, setTab] = useState<Tab>("users");

  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const theme = isDark ? darkTheme : lightTheme;

  const transport = useMemo(
    () =>
      createFetchTransport({
        baseUrl: "/",
        getToken: () => localStorage.getItem(TOKEN_KEY),
      }),
    [],
  );

  if (loading) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        Security
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Manage users, directory role mappings, and API tokens.
      </p>

      <div className="mb-5 flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm " +
              (tab === id
                ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <SecureProvider transport={transport} theme={theme}>
        {tab === "users" && <AdminUsersPanel />}
        {tab === "directory" && <DirectoryMappingsPanel />}
        {tab === "tokens" && <ApiTokensPanel />}
      </SecureProvider>
    </div>
  );
}
