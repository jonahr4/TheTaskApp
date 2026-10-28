import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createApiKey, listApiKeys, requireHuman } from "@/lib/mcp/keys";

export const dynamic = "force-dynamic";

function unauthorized(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

/** List the signed-in human's API keys (metadata only — never hashes or secrets). */
export async function GET(req: Request) {
  let uid: string;
  try {
    uid = await requireHuman(req.headers.get("authorization"));
  } catch (err) {
    return unauthorized("Unauthorized", (err as { status?: number }).status ?? 401);
  }
  const keys = await listApiKeys(adminDb, uid);
  return NextResponse.json({ keys });
}

/**
 * Issue a new API key for the signed-in human.
 * Body: { label?: string, scopes?: string[] } — defaults to ["tasks:read"].
 * The raw secret is returned exactly once.
 */
export async function POST(req: Request) {
  let uid: string;
  try {
    uid = await requireHuman(req.headers.get("authorization"));
  } catch (err) {
    return unauthorized("Unauthorized", (err as { status?: number }).status ?? 401);
  }

  let body: { label?: unknown; scopes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : "Untitled key";
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s): s is string => typeof s === "string")
    : ["tasks:read"];

  try {
    const { item, secret } = await createApiKey(adminDb, uid, label, scopes);
    return NextResponse.json({ key: item, secret }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create key" },
      { status }
    );
  }
}
