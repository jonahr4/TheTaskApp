/**
 * Append-only audit trail for MCP tool calls.
 *
 * Every tool invocation appends one document to
 * `users/{uid}/agentAudit/{autoId}`. Entries are create-only by convention:
 * this module exposes no update or delete, and the audit collection is never
 * read back by the MCP server itself (a future Settings → Agents page can
 * surface it read-only).
 */

import type { Firestore } from "firebase-admin/firestore";

export const AUDIT_ARGS_SUMMARY_MAX = 500;

export type AuditEntry = {
  keyId: string;
  keyLabel: string;
  tool: string;
  /** Truncated JSON of the tool arguments — no full note bodies. */
  argsSummary: string;
  /** ms epoch (avoids a serverTimestamp dependency in tests). */
  ts: number;
  ok: boolean;
  error?: string;
};

/** Summarize tool args for the audit log, truncated. Exported for tests. */
export function summarizeArgs(args: unknown, maxLen: number = AUDIT_ARGS_SUMMARY_MAX): string {
  let s: string;
  try {
    s = JSON.stringify(args ?? {});
  } catch {
    s = "[unserializable args]";
  }
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

export async function logToolCall(
  db: Firestore,
  uid: string,
  entry: {
    keyId: string;
    keyLabel: string;
    tool: string;
    /** Raw tool arguments — summarized and truncated before writing. */
    args: unknown;
    ok: boolean;
    error?: string;
    ts?: number;
  }
): Promise<void> {
  const full: AuditEntry = {
    keyId: entry.keyId,
    keyLabel: entry.keyLabel,
    tool: entry.tool,
    argsSummary: summarizeArgs(entry.args),
    ok: entry.ok,
    ...(entry.error !== undefined ? { error: entry.error } : {}),
    ts: entry.ts ?? Date.now(),
  };
  await db.collection(`users/${uid}/agentAudit`).add(full);
}
