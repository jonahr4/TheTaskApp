import { NextResponse } from "next/server";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

/** GET /mcp/health — uptime check. No auth required, reveals nothing. */
export async function GET() {
  return NextResponse.json({ ok: true, version: MCP_SERVER_VERSION });
}
