/**
 * MCP API-key authentication, scopes, and per-key rate limiting.
 *
 * Keys are bearer secrets of the form `taskapp_live_<base64url>`, issued by
 * the human in Settings → Agents. Only the SHA-256 hash is stored, at
 * `users/{uid}/apiKeys/{keyId}`. Verification looks the hash up with a
 * collection-group query (single-field index on `keyHash` is automatic).
 *
 * Phase 1 is read-only: only the `tasks:read` scope gates tools. The
 * `tasks:write` and `ai:use` scope constants exist so key issuance can record
 * them, but no tool in this phase accepts them.
 */

import { createHash, randomBytes } from "crypto";
import type { Firestore } from "firebase-admin/firestore";

export const API_KEY_PREFIX = "taskapp_live_";

// Scopes — least privilege by default. Only tasks:read is enforced in Phase 1.
export const SCOPES = ["tasks:read", "tasks:write", "ai:use"] as const;
export type Scope = (typeof SCOPES)[number];

export const READ_SCOPES: Scope[] = ["tasks:read"];
export const VALID_SCOPES: ReadonlySet<string> = new Set(SCOPES);

// 60 reads/min sliding window (minute-bucket approximation stored on the key doc).
export const READ_RATE_LIMIT_PER_MINUTE = 60;
export const RATE_WINDOW_MS = 60_000;

export type McpKeyContext = {
  uid: string;
  keyId: string;
  keyLabel: string;
  scopes: Scope[];
  /** Firestore path of the key doc, for rate-limit bookkeeping. */
  keyDocPath: string;
};

export type ApiKeyRecord = {
  keyId: string;
  keyHash: string;
  keyPrefix: string;
  label: string;
  scopes: Scope[];
  createdAt: unknown;
  lastUsedAt: unknown;
  revokedAt: unknown;
  rateWindowStart: number | null;
  rateCount: number;
};

function sha256Hex(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Generate a new raw API secret. Shown to the human exactly once. */
export function generateApiSecret(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("base64url");
}

/** Hash a presented secret for lookup. Exported for tests. */
export function hashApiSecret(secret: string): string {
  return sha256Hex(secret);
}

export function isApiKeyFormat(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 16;
}

/** Extract a bearer token from an Authorization header. */
export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verify a presented API secret against Firestore.
 * Returns the key context, or null when the key is unknown or revoked.
 * Every successful verification is scoped to exactly one uid — there is no
 * code path that yields another user's data.
 */
export async function verifyApiKey(
  db: Firestore,
  presentedSecret: string
): Promise<McpKeyContext | null> {
  if (!isApiKeyFormat(presentedSecret)) return null;
  const keyHash = sha256Hex(presentedSecret);

  const snap = await db
    .collectionGroup("apiKeys")
    .where("keyHash", "==", keyHash)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  const data = docSnap.data() as Partial<ApiKeyRecord>;
  if (!data || data.revokedAt) return null;

  // The uid is the parent of the apiKeys subcollection: users/{uid}/apiKeys/{keyId}.
  const segments = docSnap.ref.path.split("/");
  const usersIdx = segments.lastIndexOf("users");
  const uid = usersIdx >= 0 ? segments[usersIdx + 1] : null;
  if (!uid || !data.keyId) return null;

  const scopes = (Array.isArray(data.scopes) ? data.scopes : []).filter((s): s is Scope =>
    VALID_SCOPES.has(s)
  );

  return {
    uid,
    keyId: data.keyId,
    keyLabel: typeof data.label === "string" ? data.label : "",
    scopes,
    keyDocPath: docSnap.ref.path,
  };
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

/**
 * Per-key sliding-window rate limit, enforced atomically in a transaction on
 * the key doc. Rejected requests do not write (no amplification on abuse).
 */
export async function checkRateLimit(
  db: Firestore,
  keyDocPath: string,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  const ref = db.doc(keyDocPath);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) as Partial<ApiKeyRecord>;
    if (data.revokedAt) {
      return { allowed: false, retryAfterMs: RATE_WINDOW_MS };
    }

    const windowStart =
      typeof data.rateWindowStart === "number" ? data.rateWindowStart : null;
    const count = typeof data.rateCount === "number" ? data.rateCount : 0;

    if (windowStart === null || nowMs - windowStart >= RATE_WINDOW_MS) {
      tx.update(ref, {
        rateWindowStart: nowMs,
        rateCount: 1,
        lastUsedAt: nowMs,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (count >= READ_RATE_LIMIT_PER_MINUTE) {
      return { allowed: false, retryAfterMs: windowStart + RATE_WINDOW_MS - nowMs };
    }

    tx.update(ref, { rateCount: count + 1, lastUsedAt: nowMs });
    return { allowed: true, retryAfterMs: 0 };
  });
}

/** True when the key context carries every scope in `required`. */
export function hasScopes(ctx: McpKeyContext, required: Scope[]): boolean {
  return required.every((s) => ctx.scopes.includes(s));
}
