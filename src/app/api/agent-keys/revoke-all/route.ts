import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireHuman, revokeAllApiKeys } from "@/lib/mcp/keys";

export const dynamic = "force-dynamic";

/** Revoke every active API key for the signed-in human (the panic button). */
export async function POST(req: Request) {
  let uid: string;
  try {
    uid = await requireHuman(req.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: (err as { status?: number }).status ?? 401 }
    );
  }

  const revoked = await revokeAllApiKeys(adminDb, uid);
  return NextResponse.json({ revoked_count: revoked });
}
