import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite, validateInviteToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-hooks";

type Step = "validate" | "register" | "done";

function Field({
  label, id, type = "text", value, onChange, required = true,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        id={id} type={type} required={required} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </label>
  );
}

export function InvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  useAuth();

  const [step, setStep] = useState<Step>("validate");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const autoValidated = useRef(false);

  // Auto-validate when token arrives from URL
  useEffect(() => {
    if (token && !autoValidated.current) {
      autoValidated.current = true;
      void handleValidate(token);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleValidate(t: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await validateInviteToken(t);
      if (!result.valid) {
        setError(result.message || "Invalid invite link");
      } else {
        setEmail(result.email);
        setUserEmail(result.email);
        setStep("register");
      }
    } catch {
      setError("Could not validate the invite token");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) { setError("Passwords do not match"); return; }
    setError(null);
    setLoading(true);
    try {
      const session = await acceptInvite(token, { username, password, email: userEmail || email });
      localStorage.setItem("cantica_token", session.access_token);
      setStep("done");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen size={28} className="text-violet-600" />
          <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Cantica</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">

          {/* ── Step 1: enter / validate token ─────────────────────────── */}
          {step === "validate" && (
            <>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Accept invitation</h1>
              <p className="text-sm text-zinc-500 mb-6">Enter the invite token from your email.</p>
              <form onSubmit={(e) => { e.preventDefault(); void handleValidate(token); }} className="space-y-4">
                <Field label="Invite token" id="token" value={token} onChange={setToken} />
                {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading || !token}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Continue
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: create account ──────────────────────────────────── */}
          {step === "register" && (
            <>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Create your account</h1>
              {email && <p className="text-sm text-zinc-500 mb-6">Invited as <strong>{email}</strong></p>}
              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="Username" id="username" value={username} onChange={setUsername} />
                <Field label="Email" id="email" type="email" value={userEmail} onChange={setUserEmail} required={false} />
                <Field label="Password" id="password" type="password" value={password} onChange={setPassword} />
                <Field label="Confirm password" id="password2" type="password" value={password2} onChange={setPassword2} />
                {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Create account
                </button>
              </form>
            </>
          )}

          {/* ── Done ───────────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Welcome, {username}!</p>
                <p className="text-sm text-zinc-500 mt-1">Redirecting you…</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
