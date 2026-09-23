import type { NextRequest } from "next/server";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the caller's uid, or null when the token is missing/invalid.
 *
 * The firebase-admin import is lazy so this module stays side-effect-free
 * at load time (keeps unit tests that import the route helpers green).
 */
export async function requireUser(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  const token =
    header && header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) return null;
  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
