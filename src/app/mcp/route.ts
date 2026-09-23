/**
 * POST /mcp — stateless Streamable HTTP MCP endpoint (Phase 1, read-only).
 *
 * Per request: verify the API key → enforce the per-key rate limit → build a
 * fresh McpServer → handle the JSON-RPC request with a fresh
 * WebStandardStreamableHTTPServerTransport (sessionIdGenerator: undefined,
 * enableJsonResponse: true). No session affinity, no shared state between
 * requests — this is the serverless-friendly pattern.
 *
 * GET /mcp intentionally returns 405: there is no SSE stream to resume.
 */

import { NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { adminDb } from "@/lib/firebase-admin";
import {
  checkRateLimit,
  parseBearerToken,
  verifyApiKey,
} from "@/lib/mcp/auth";
import { createMcpServer, MCP_SERVER_VERSION } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const presented = parseBearerToken(req.headers.get("authorization"));
  if (!presented) {
    return NextResponse.json({ error: "Missing or malformed Authorization header" }, { status: 401 });
  }

  const keyCtx = await verifyApiKey(adminDb, presented);
  if (!keyCtx) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  const rate = await checkRateLimit(adminDb, keyCtx.keyDocPath);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retry_after_ms: rate.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const server = createMcpServer(keyCtx, { db: adminDb });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody: body });
    // Attach the server version for observability; the JSON-RPC payload is untouched.
    response.headers.set("X-TaskApp-MCP-Version", MCP_SERVER_VERSION);
    return response;
  } catch (err) {
    console.error("[mcp] request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await transport.close().catch(() => {});
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST /mcp for JSON-RPC requests." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
