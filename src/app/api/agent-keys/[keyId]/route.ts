import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireHuman, revokeApiKey } from "@/lib/mcp/keys";

export const dynamic = "force-dynamic";

/** Revoke one API key (sets revokedAt — the key stops working immediately). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  let uid: string;
  try {
    uid = await requireHuman(req.headers.get("authorization"));
  } catch (err) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: (err as { status?: number }).status ?? 401 }
    );
  }

  const { keyId } = await params;
  const revoked = await revokeApiKey(adminDb, uid, keyId);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
  }
  return NextResponse.json({ revoked: true, key_id: keyId });
}
