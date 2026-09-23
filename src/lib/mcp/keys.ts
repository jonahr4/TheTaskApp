/**
 * API-key issuance and revocation, performed by the signed-in human (never by
 * an agent — keys cannot be created through the MCP server itself).
 *
 * Human authentication reuses the Firebase ID-token pattern: the web client
 * sends `Authorization: Bearer <Firebase ID token>`, verified server-side
 * with firebase-admin. The admin import is lazy so this module stays
 * side-effect-free for unit tests (same pattern as the /api/ai/* hardening).
 */

import { randomUUID } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  API_KEY_PREFIX,
  generateApiSecret,
  hashApiSecret,
  isApiKeyFormat,
  VALID_SCOPES,
  type ApiKeyRecord,
  type Scope,
} from "./auth";

export type KeyListItem = {
  key_id: string;
  label: string;
  scopes: Scope[];
  key_prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

type AdminAuth = {
  verifyIdToken: (token: string) => Promise<{ uid: string }>;
};

let cachedAuth: AdminAuth | null = null;

async function getAdminAuth(): Promise<AdminAuth> {
  if (!cachedAuth) {
    // Lazy import: keeps this module importable in jest without credentials.
    const mod = await import("firebase-admin/auth");
    const appMod = await import("firebase-admin/app");
    const { getApps, initializeApp, cert } = appMod;
    type ServiceAccount = import("firebase-admin/app").ServiceAccount;
    if (getApps().length === 0) {
      const serviceAccount: ServiceAccount = {
        projectId:
          process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      };
      initializeApp({ credential: cert(serviceAccount) });
    }
    cachedAuth = mod.getAuth() as unknown as AdminAuth;
  }
  return cachedAuth;
}

/** Verify the human's Firebase ID token from an Authorization header. */
export async function requireHuman(authorization: string | null): Promise<string> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;
  // Never confuse an agent API key with a human session.
  if (!token || isApiKeyFormat(token)) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  try {
    const auth = await getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    if (!decoded?.uid) throw new Error("no uid");
    return decoded.uid;
  } catch {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}

function toISODate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "object") {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === "function") {
      try {
        return v.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  }
  return null;
}

function toListItem(id: string, data: Partial<ApiKeyRecord>): KeyListItem {
  return {
    key_id: id,
    label: typeof data.label === "string" ? data.label : "",
    scopes: (Array.isArray(data.scopes) ? data.scopes : []).filter((s): s is Scope =>
      VALID_SCOPES.has(s)
    ),
    key_prefix: typeof data.keyPrefix === "string" ? data.keyPrefix : "",
    created_at: toISODate(data.createdAt),
    last_used_at: toISODate(data.lastUsedAt),
    revoked_at: toISODate(data.revokedAt),
  };
}

/** Issue a new key for the human's uid. Returns the record (sans secret) and the one-time secret. */
export async function createApiKey(
  db: Firestore,
  uid: string,
  label: string,
  scopes: string[]
): Promise<{ item: KeyListItem; secret: string }> {
  const cleanLabel = label.trim().slice(0, 80) || "Untitled key";
  const cleanScopes = [...new Set(scopes)].filter((s): s is Scope => VALID_SCOPES.has(s));
  if (cleanScopes.length === 0) {
    throw Object.assign(new Error("At least one scope is required"), { status: 400 });
  }

  const secret = generateApiSecret();
  const keyId = randomUUID();
  const record: ApiKeyRecord = {
    keyId,
    keyHash: hashApiSecret(secret),
    keyPrefix: secret.slice(0, API_KEY_PREFIX.length + 8),
    label: cleanLabel,
    scopes: cleanScopes,
    createdAt: Date.now(),
    lastUsedAt: null,
    revokedAt: null,
    rateWindowStart: null,
    rateCount: 0,
  };
  await db.doc(`users/${uid}/apiKeys/${keyId}`).set(record);
  return { item: toListItem(keyId, record), secret };
}

/** List the human's keys (hashes never leave the server). */
export async function listApiKeys(db: Firestore, uid: string): Promise<KeyListItem[]> {
  const snap = await db.collection(`users/${uid}/apiKeys`).get();
  return snap.docs.map((d) => toListItem(d.id, d.data() as Partial<ApiKeyRecord>));
}

/** Revoke one key. Returns true when a key was actually revoked. */
export async function revokeApiKey(
  db: Firestore,
  uid: string,
  keyId: string
): Promise<boolean> {
  if (!keyId || keyId.includes("/")) return false;
  const ref = db.doc(`users/${uid}/apiKeys/${keyId}`);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as Partial<ApiKeyRecord>;
  if (data.revokedAt) return false;
  await ref.update({ revokedAt: Date.now() });
  return true;
}

/** Revoke every active key for the uid (the panic button). Returns the count revoked. */
export async function revokeAllApiKeys(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection(`users/${uid}/apiKeys`).get();
  const now = Date.now();
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data() as Partial<ApiKeyRecord>;
    if (!data.revokedAt) {
      await d.ref.update({ revokedAt: now });
      count++;
    }
  }
  return count;
}
