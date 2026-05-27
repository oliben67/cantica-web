import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  Network,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { } from "react-router-dom";
import { useAuth, useRequireAdmin } from "@/lib/auth";
import {
  type Federation,
  type FederationMember,
  type FederationPeer,
  addPeer,
  createFederation,
  getIdentity,
  listFederationMembers,
  listFederations,
  listPeers,
  removePeer,
} from "@/lib/api";

// ── small helpers ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ── Members row (lazy-loaded) ──────────────────────────────────────────────

function MembersPanel({ fed }: { fed: Federation }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fed-members", fed.id],
    queryFn: () => listFederationMembers(fed.id),
  });

  if (isLoading) return <div className="px-4 py-3 text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading members…</div>;

  const members: FederationMember[] = data ?? [];
  if (members.length === 0) return <div className="px-4 py-3 text-sm text-zinc-400">No members yet.</div>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-400 uppercase tracking-wide">
        <tr>
          <th className="px-4 py-2">URL</th>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">Joined</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id} className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-xs">{m.federate_url || "—"}</td>
            <td className="px-4 py-2">
              <span className={`text-xs font-medium ${m.is_accepted ? "text-emerald-600" : "text-amber-500"}`}>
                {m.is_accepted ? "Accepted" : "Pending"}
              </span>
            </td>
            <td className="px-4 py-2 text-zinc-400 text-xs">{new Date(m.joined_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Federation row ─────────────────────────────────────────────────────────

function FederationRow({ fed }: { fed: Federation }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 first:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} className="text-zinc-400 shrink-0" /> : <ChevronRight size={14} className="text-zinc-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fed.name}</span>
            {fed.is_founder && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-medium">
                <Star size={10} /> Founded here
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{fed.id}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
          <Users size={12} />
          {fed.member_count}
        </div>
      </button>
      {open && (
        <div className="bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800">
          <MembersPanel fed={fed} />
        </div>
      )}
    </div>
  );
}

// ── Peers section ──────────────────────────────────────────────────────────

function PeersSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const { data: peers, isLoading } = useQuery({ queryKey: ["peers"], queryFn: listPeers });

  const addMutation = useMutation({
    mutationFn: () => addPeer({ name, url, api_key: apiKey || undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["peers"] }); setShowForm(false); setName(""); setUrl(""); setApiKey(""); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePeer(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["peers"] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader><Globe size={16} className="text-violet-500" />Read-only Peers</SectionHeader>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
          <Plus size={12} /> Add peer
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); setErr(null); addMutation.mutate(); }}
          className="mb-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Name", value: name, set: setName, placeholder: "My peer", required: true },
            { label: "URL", value: url, set: setUrl, placeholder: "https://peer.example.com", required: true },
            { label: "API Key (optional)", value: apiKey, set: setApiKey, placeholder: "sk-…", required: false },
          ].map(({ label, value, set, placeholder, required }) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">{label}</span>
              <input required={required} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </label>
          ))}
          {err && <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{err}</p>}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors">
              {addMutation.isPending && <Loader2 size={12} className="animate-spin" />}Add
            </button>
          </div>
        </form>
      )}

      {isLoading && <div className="text-sm text-zinc-400 flex items-center gap-2 py-4 justify-center"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
      {peers && peers.length === 0 && <p className="text-sm text-zinc-400 py-4 text-center">No peers configured.</p>}
      {peers && peers.length > 0 && (
        <Card>
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 uppercase tracking-wide">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Auth</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {(peers as FederationPeer[]).map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono text-xs">{p.url}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{p.api_key ? "API key" : "None"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm(`Remove peer "${p.name}"?`)) removeMutation.mutate(p.id); }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function FederationPage() {
  useAuth();
  const authLoading = useRequireAdmin();
  const qc = useQueryClient();
  const [newFedName, setNewFedName] = useState("");
  const [showNewFed, setShowNewFed] = useState(false);
  const [fedErr, setFedErr] = useState<string | null>(null);

  const { data: federations, isLoading } = useQuery({
    queryKey: ["federations"],
    queryFn: listFederations,
    enabled: !authLoading,
  });

  const { data: identity } = useQuery({ queryKey: ["identity"], queryFn: getIdentity, enabled: !authLoading });

  const createMutation = useMutation({
    mutationFn: () => createFederation(newFedName),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["federations"] }); setShowNewFed(false); setNewFedName(""); },
    onError: (e) => setFedErr(e instanceof Error ? e.message : "Failed"),
  });

  if (authLoading) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Network size={20} className="text-violet-500" /> Federation
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Memberships and read-only peers</p>
        </div>
        <button onClick={() => setShowNewFed(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
          <Plus size={14} /> New federation
        </button>
      </div>

      {/* Server identity */}
      {identity && (
        <section>
          <SectionHeader>This server's identity</SectionHeader>
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs font-mono text-zinc-500 break-all">
            <span className="text-zinc-400 select-none">Public key: </span>
            {identity.public_key_pem.slice(0, 80)}…
          </div>
        </section>
      )}

      {/* Federations */}
      <section>
        <SectionHeader><Users size={16} className="text-violet-500" />Federations</SectionHeader>

        {showNewFed && (
          <form onSubmit={(e) => { e.preventDefault(); setFedErr(null); createMutation.mutate(); }}
            className="mb-4 flex items-end gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <label className="flex-1 flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Federation name</span>
              <input required value={newFedName} onChange={(e) => setNewFedName(e.target.value)} placeholder="My Network"
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </label>
            {fedErr && <p className="text-sm text-red-500">{fedErr}</p>}
            <button type="button" onClick={() => setShowNewFed(false)} className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-colors">
              {createMutation.isPending && <Loader2 size={12} className="animate-spin" />} Create
            </button>
          </form>
        )}

        {isLoading && <div className="text-sm text-zinc-400 flex items-center gap-2 py-4 justify-center"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
        {federations?.length === 0 && <p className="text-sm text-zinc-400 py-4 text-center">Not a member of any federation yet.</p>}
        {federations && federations.length > 0 && (
          <Card>
            {federations.map((f) => <FederationRow key={f.id} fed={f} />)}
          </Card>
        )}
      </section>

      {/* Read-only peers */}
      <PeersSection />
    </main>
  );
}
