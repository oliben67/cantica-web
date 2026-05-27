import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Mail, Plus, QrCode, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useRequireAdmin } from "@/lib/auth";
import {
  type AdminInvite,
  type AdminUser,
  createAdminUser,
  createInvite,
  deleteAdminUser,
  listAdminUsers,
  listInvites,
  updateAdminUser,
} from "@/lib/api";

// ── small helpers ──────────────────────────────────────────────────────────

function Badge({ role }: { role: string }) {
  const colour =
    role === "admin"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colour}`}>{role}</span>
  );
}

// ── create-user form ───────────────────────────────────────────────────────

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState("user");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createAdminUser({
        username,
        email,
        password,
        roles: roles.split(",").map((r) => r.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      <h2 className="sm:col-span-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        New user
      </h2>

      {[
        { label: "Username", value: username, set: setUsername, type: "text", required: true },
        { label: "Email", value: email, set: setEmail, type: "email", required: false },
        { label: "Password", value: password, set: setPassword, type: "password", required: true },
        { label: "Roles (comma-separated)", value: roles, set: setRoles, type: "text", required: true },
      ].map(({ label, value, set, type, required }) => (
        <label key={label} className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">{label}</span>
          <input
            type={type}
            required={required}
            value={value}
            onChange={(e) => set(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>
      ))}

      {error && (
        <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors"
        >
          {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
          Create
        </button>
      </div>
    </form>
  );
}

// ── user row ───────────────────────────────────────────────────────────────

function UserRow({ user, currentId }: { user: AdminUser; currentId: string }) {
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminUser(user.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: () => updateAdminUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const isSelf = user.id === currentId;

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {user.username}
        {isSelf && (
          <span className="ml-2 text-xs text-zinc-400">(you)</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{user.email || "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => <Badge key={r} role={r} />)}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            user.is_active
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {user.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
          {user.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">
        {new Date(user.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            title={user.is_active ? "Deactivate" : "Activate"}
            disabled={isSelf || toggleMutation.isPending}
            onClick={() => toggleMutation.mutate()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            <ShieldOff size={14} />
          </button>
          <button
            title="Delete"
            disabled={isSelf || deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Delete user "${user.username}"?`)) deleteMutation.mutate();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── invite QR modal ────────────────────────────────────────────────────────

function InviteQRModal({ invite, onClose }: { invite: AdminInvite; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, invite.invite_url, { width: 200, margin: 2 });
    }
  }, [invite.invite_url]);

  function copy() {
    void navigator.clipboard.writeText(invite.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Invite created</h2>
        <p className="text-sm text-zinc-500 mb-4">
          {invite.email ? <>Sent to <strong>{invite.email}</strong> — </> : ""}
          Share the link or QR code below.
        </p>
        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 mb-4">
          <code className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate">{invite.invite_url}</code>
          <button onClick={copy} className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
            <Copy size={14} />
          </button>
        </div>
        {copied && <p className="text-xs text-emerald-500 text-center mb-3">Copied!</p>}
        <p className="text-xs text-zinc-400 text-center mb-4">
          Token: <code className="font-mono">{invite.token}</code> · Expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>
        <button onClick={onClose} className="w-full px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

// ── invite form ────────────────────────────────────────────────────────────

function InviteSection() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<AdminInvite | null>(null);

  const { data: invites, isLoading } = useQuery({ queryKey: ["invites"], queryFn: listInvites });

  const mutation = useMutation({
    mutationFn: () => createInvite(email),
    onSuccess: (inv) => {
      void qc.invalidateQueries({ queryKey: ["invites"] });
      setNewInvite(inv);
      setEmail("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Invite users</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Send a one-time registration link</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}
        className="flex gap-2 mb-6">
        <input type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <button type="submit" disabled={mutation.isPending || !email}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors whitespace-nowrap">
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Send invite
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {isLoading && <div className="text-sm text-zinc-400 flex items-center gap-2 justify-center py-4"><Loader2 size={14} className="animate-spin" />Loading…</div>}

      {invites && invites.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 uppercase tracking-wide">
              <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Expires</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {(invites as AdminInvite[]).map((inv) => (
                <tr key={inv.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{inv.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${inv.used ? "text-zinc-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {inv.used ? "Used" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!inv.used && (
                      <button onClick={() => setNewInvite(inv)} title="Show QR / link"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
                        <QrCode size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newInvite && <InviteQRModal invite={newInvite} onClose={() => setNewInvite(null)} />}
    </section>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

type AdminTab = "users" | "invites";

export function AdminPage() {
  const { user } = useAuth();
  const authLoading = useRequireAdmin();
  const [tab, setTab] = useState<AdminTab>("users");
  const [showForm, setShowForm] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    enabled: !authLoading && tab === "users",
  });

  if (authLoading) return null;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "users", label: "Users" },
    { id: "invites", label: "Invites" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Admin</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage users · <Link to="/admin/federation" className="text-violet-600 hover:underline">Federation</Link>
          </p>
        </div>
        {tab === "users" && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
            <Plus size={14} /> New user
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <>
          {showForm && <div className="mb-6"><CreateUserForm onDone={() => setShowForm(false)} /></div>}
          {isLoading && <div className="flex items-center gap-2 text-sm text-zinc-400 py-12 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>}
          {users && users.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => <UserRow key={u.id} user={u} currentId={user!.id} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Invites tab */}
      {tab === "invites" && <InviteSection />}
    </main>
  );
}
