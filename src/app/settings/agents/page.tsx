"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Copy, Check, KeyRound, ShieldAlert } from "lucide-react";

type ApiKey = {
  key_id: string;
  label: string;
  scopes: string[];
  key_prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

const SCOPES = [
  { id: "tasks:read", label: "Read tasks", hint: "Phase 1 — all read tools + summary resource" },
  { id: "tasks:write", label: "Write tasks", hint: "Phase 2 — not enforced by any tool yet" },
  { id: "ai:use", label: "Use AI", hint: "Phase 2 — not enforced by any tool yet" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AgentsSettingsPage() {
  const { user, loading, signIn } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["tasks:read"]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await user!.getIdToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-keys", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoadingKeys(false);
    }
  }, [user, authHeaders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createKey = async () => {
    setCreating(true);
    setError(null);
    setNewSecret(null);
    try {
      const res = await fetch("/api/agent-keys", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ label: label.trim() || "Untitled key", scopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create key");
      setNewSecret(data.secret as string);
      setLabel("");
      setScopes(["tasks:read"]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string, keyLabel: string) => {
    if (!window.confirm(`Revoke "${keyLabel}"? Agents using it will stop working immediately.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/agent-keys/${keyId}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to revoke key");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke key");
    }
  };

  const revokeAll = async () => {
    if (!window.confirm("Revoke ALL API keys? This disconnects every agent immediately.")) return;
    setError(null);
    try {
      const res = await fetch("/api/agent-keys/revoke-all", {
        method: "POST",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to revoke keys");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke keys");
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the secret is still visible above
    }
  };

  const toggleScope = (id: string) =>
    setScopes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} /> Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Agents</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          API keys let your own AI agents read your tasks through the MCP server at{" "}
          <code className="rounded bg-[var(--bg-hover)] px-1">POST /mcp</code>. Keys are
          read-only in Phase 1 and can be revoked at any time.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">Checking sign-in…</p>
        ) : !user ? (
          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-6">
            <p className="text-sm text-[var(--text-secondary)]">
              Sign in to manage agent API keys.
            </p>
            <Button className="mt-3" onClick={signIn}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {newSecret && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <ShieldAlert size={16} /> Copy this key now — it will never be shown again.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-white px-3 py-2 text-sm text-amber-950">
                    {newSecret}
                  </code>
                  <Button size="sm" variant="outline" onClick={copySecret}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Create a key</h2>
              <div className="mt-3 space-y-3">
                <Input
                  placeholder="Label, e.g. Muse"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                />
                <div className="space-y-2">
                  {SCOPES.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-start gap-2">
                      <Checkbox checked={scopes.includes(s.id)} onCheckedChange={() => toggleScope(s.id)} />
                      <span>
                        <span className="block text-sm text-[var(--text-primary)]">
                          <code className="mr-1 rounded bg-[var(--bg-hover)] px-1">{s.id}</code>
                          {s.label}
                        </span>
                        <span className="block text-xs text-[var(--text-tertiary)]">{s.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button onClick={createKey} disabled={creating || scopes.length === 0}>
                  <KeyRound size={14} /> {creating ? "Creating…" : "Create key"}
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Your keys</h2>
                {keys.some((k) => !k.revoked_at) && (
                  <Button size="sm" variant="destructive" onClick={revokeAll}>
                    Revoke all
                  </Button>
                )}
              </div>
              {loadingKeys ? (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
              ) : keys.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">No keys yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {keys.map((k) => (
                    <li
                      key={k.key_id}
                      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {k.label}{" "}
                          <span className="font-normal text-[var(--text-tertiary)]">
                            <code>{k.key_prefix}…</code>
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                          {k.scopes.join(", ")} · created {fmtDate(k.created_at)} · last used{" "}
                          {fmtDate(k.last_used_at)}
                          {k.revoked_at && (
                            <span className="text-red-600"> · revoked {fmtDate(k.revoked_at)}</span>
                          )}
                        </p>
                      </div>
                      {!k.revoked_at && (
                        <Button size="sm" variant="outline" onClick={() => revokeKey(k.key_id, k.label)}>
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
