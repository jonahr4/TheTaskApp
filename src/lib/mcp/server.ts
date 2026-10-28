/**
 * MCP server factory. One McpServer instance is built per request (stateless),
 * with the read tools and the summary resource registered.
 *
 * Every tool call is wrapped with the scope gate and the append-only audit
 * log. Tool handlers themselves never see the raw API secret — only the
 * verified key context.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { Firestore } from "firebase-admin/firestore";
import type { McpKeyContext } from "./auth";
import { assertToolScope, READ_TOOLS } from "./tools";
import { logToolCall } from "./audit";
import { fetchDisplayName, fetchGroups, fetchTasks } from "./db";

export const MCP_SERVER_NAME = "taskapp";
export const MCP_SERVER_VERSION = "1.0.0-phase1";

export type McpServerDeps = {
  db: Firestore;
};

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build a fresh, stateless MCP server for one authenticated request. */
export function createMcpServer(ctx: McpKeyContext, deps: McpServerDeps): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  for (const tool of READ_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        let ok = true;
        let error: string | undefined;
        let result: unknown;
        try {
          assertToolScope(tool, ctx);
          result = await tool.handler(args, { ...ctx, db: deps.db });
        } catch (err) {
          ok = false;
          error = err instanceof Error ? err.message : String(err);
        }

        // Audit every call (create-only). A failed audit write must not mask
        // the tool result, but it also must not go unnoticed in logs.
        try {
          await logToolCall(deps.db, ctx.uid, {
            keyId: ctx.keyId,
            keyLabel: ctx.keyLabel,
            tool: tool.name,
            args,
            ok,
            ...(error !== undefined ? { error } : {}),
          });
        } catch (auditErr) {
          console.error("[mcp] audit write failed:", auditErr);
        }

        if (!ok) {
          throw new McpError(ErrorCode.InternalError, error ?? "Tool failed");
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      }
    );
  }

  server.registerResource(
    "user-summary",
    "taskapp://user/summary",
    {
      title: "User summary",
      description:
        "Orientation snapshot for the agent: display name, task counts (active, overdue, due today), and task groups. Read-only.",
      mimeType: "application/json",
    },
    async (uri) => {
      const [displayName, tasks, groups] = await Promise.all([
        fetchDisplayName(deps.db, ctx.uid),
        fetchTasks(deps.db, ctx.uid),
        fetchGroups(deps.db, ctx.uid),
      ]);
      const today = todayUTC();
      let active = 0;
      let overdue = 0;
      let dueToday = 0;
      for (const t of tasks) {
        if (t.archived) continue;
        if (t.completed) continue;
        active++;
        if (t.dueDate) {
          if (t.dueDate < today) overdue++;
          else if (t.dueDate === today) dueToday++;
        }
      }
      const summary = {
        display_name: displayName,
        task_counts: { active, overdue, due_today: dueToday },
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          color: g.color,
          archived: g.archived ?? false,
        })),
      };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(summary),
          },
        ],
      };
    }
  );

  return server;
}
