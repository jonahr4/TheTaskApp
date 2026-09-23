/**
 * Phase 1 read tools for the MCP server. All tools require the `tasks:read`
 * scope and operate strictly on the key owner's data (uid comes from the
 * verified key context — never from tool arguments).
 *
 * Polling: `tasks_list` accepts `updated_since` (ISO timestamp) and returns
 * tasks with `updatedAt` newer than that value. Recommended poll interval is
 * >= 5 minutes. Note: `updatedAt` is written by the web client's mutation
 * paths today; stamping it on every server/mobile mutation path is a
 * follow-up (see PR description), so very old docs may lack it and will not
 * appear in `updated_since` results.
 */

import { z } from "zod";
import type { Firestore } from "firebase-admin/firestore";
import { getQuadrant } from "@/lib/types";
import { hasScopes, type McpKeyContext, type Scope } from "./auth";
import { fetchGroups, fetchTask, fetchTasks, toISO, toMillis, type GroupDoc, type TaskDoc } from "./db";
import { searchTasks } from "./search";

export type McpRequestContext = McpKeyContext & { db: Firestore };

export type ToolHandler = (args: Record<string, unknown>, ctx: McpRequestContext) => Promise<unknown>;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  requiredScopes: Scope[];
  handler: ToolHandler;
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function clampLimit(v: unknown, def: number): number {
  const n = asNumber(v) ?? def;
  return Math.min(Math.max(Math.floor(n), 1), 200);
}

function serializeTask(t: TaskDoc, groupName?: string) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes ?? null,
    urgent: t.urgent,
    important: t.important,
    reminder: t.reminder ?? null,
    due_date: t.dueDate,
    due_time: t.dueTime,
    group_id: t.groupId,
    group_name: groupName ?? null,
    location: t.location ?? null,
    created_from: t.createdFrom ?? null,
    completed: t.completed,
    archived: t.archived ?? false,
    order: t.order,
    created_at: toISO(t.createdAt),
    updated_at: toISO(t.updatedAt),
    quadrant: getQuadrant(t),
  };
}

function groupNames(groups: GroupDoc[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) m.set(g.id, g.name);
  return m;
}

type ListStatus = "active" | "completed" | "archived" | "all";

function statusMatches(t: TaskDoc, status: ListStatus): boolean {
  switch (status) {
    case "active":
      return !t.completed && !t.archived;
    case "completed":
      return t.completed && !t.archived;
    case "archived":
      return !!t.archived;
    case "all":
      return true;
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ms epoch for a task's due moment; null when there is no due date. */
function dueMs(t: TaskDoc): number | null {
  if (!t.dueDate) return null;
  const time = t.dueTime ?? "23:59";
  const ms = Date.parse(`${t.dueDate}T${time}:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

const tasksList: ToolDef = {
  name: "tasks_list",
  description:
    "List the user's tasks, newest-first by manual order. Read-only: you are acting on the user's own data. " +
    "For polling, pass updated_since (ISO timestamp) to get only tasks changed since then; recommended poll interval is 5 minutes or more.",
  inputSchema: {
    group_id: z.string().optional().describe("Filter to a single task group (list) ID."),
    status: z
      .enum(["active", "completed", "archived", "all"])
      .optional()
      .describe("Which tasks to include. Defaults to 'active'."),
    limit: z.number().int().optional().describe("Max tasks to return. Default 50, max 200."),
    cursor: z
      .string()
      .optional()
      .describe("Opaque cursor from a previous response's next_cursor for pagination."),
    updated_since: z
      .string()
      .optional()
      .describe("ISO timestamp: only tasks with updatedAt after this value (for polling)."),
  },
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const status = (asString(args.status) ?? "active") as ListStatus;
    if (!["active", "completed", "archived", "all"].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    const groupId = asString(args.group_id);
    const limit = clampLimit(args.limit, 50);
    const cursor = asString(args.cursor);
    const updatedSince = asString(args.updated_since);
    let sinceMs: number | null = null;
    if (updatedSince !== undefined) {
      sinceMs = Date.parse(updatedSince);
      if (Number.isNaN(sinceMs)) throw new Error("updated_since must be an ISO timestamp");
    }

    const [tasks, groups] = await Promise.all([
      fetchTasks(ctx.db, ctx.uid),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    const names = groupNames(groups);

    let filtered = tasks.filter((t) => statusMatches(t, status));
    if (groupId !== undefined) filtered = filtered.filter((t) => t.groupId === groupId);
    if (sinceMs !== null) {
      filtered = filtered.filter((t) => {
        const ms = toMillis(t.updatedAt);
        return ms !== null && ms > sinceMs;
      });
    }

    let start = 0;
    if (cursor !== undefined) {
      const idx = filtered.findIndex((t) => t.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = filtered.slice(start, start + limit);
    const nextCursor =
      page.length > 0 && start + limit < filtered.length
        ? page[page.length - 1].id
        : undefined;

    return {
      tasks: page.map((t) => serializeTask(t, t.groupId ? names.get(t.groupId) : undefined)),
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    };
  },
};

const tasksGet: ToolDef = {
  name: "tasks_get",
  description:
    "Get one task by ID, including location, provenance, and reminder fields. Read-only.",
  inputSchema: {
    task_id: z.string().describe("The task ID."),
  },
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const taskId = asString(args.task_id);
    if (!taskId) throw new Error("task_id is required");
    const [task, groups] = await Promise.all([
      fetchTask(ctx.db, ctx.uid, taskId),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const names = groupNames(groups);
    return { task: serializeTask(task, task.groupId ? names.get(task.groupId) : undefined) };
  },
};

const tasksSearch: ToolDef = {
  name: "tasks_search",
  description:
    "Natural-language search over the user's tasks. Understands date queries like 'sep 5', '12/5', or '2025-12-05' (matched against due dates), group/list names, and fuzzy text matching on titles and notes. Read-only.",
  inputSchema: {
    query: z.string().describe("Search query, e.g. 'groceries', 'sep 5', or 'work'."),
    include_completed: z
      .boolean()
      .optional()
      .describe("Include completed tasks. Defaults to true."),
    limit: z.number().int().optional().describe("Max tasks to return. Default 50, max 200."),
  },
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const query = asString(args.query);
    if (!query || !query.trim()) throw new Error("query is required");
    const includeCompleted = asBoolean(args.include_completed) ?? true;
    const limit = clampLimit(args.limit, 50);

    const [tasks, groups] = await Promise.all([
      fetchTasks(ctx.db, ctx.uid),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    const names = groupNames(groups);
    const results = searchTasks(tasks, groups, query, { includeCompleted, limit });
    return {
      tasks: results.map((t) =>
        serializeTask(t, t.groupId ? names.get(t.groupId) : undefined)
      ),
    };
  },
};

const MATRIX_BUCKET_LIMIT = 100;

const matrixView: ToolDef = {
  name: "matrix_view",
  description:
    "The user's Eisenhower matrix: active tasks grouped into DO (urgent+important), SCHEDULE, DELEGATE, DELETE quadrants, plus uncategorized tasks missing urgency/importance. Read-only.",
  inputSchema: {},
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const [tasks, groups] = await Promise.all([
      fetchTasks(ctx.db, ctx.uid),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    const names = groupNames(groups);
    const buckets: Record<string, TaskDoc[]> = {
      DO: [],
      SCHEDULE: [],
      DELEGATE: [],
      DELETE: [],
      uncategorized: [],
    };
    for (const t of tasks) {
      if (t.completed || t.archived) continue;
      const q = getQuadrant(t);
      buckets[q ?? "uncategorized"].push(t);
    }
    const quadrants: Record<string, { tasks: unknown[]; truncated: boolean }> = {};
    for (const [name, bucket] of Object.entries(buckets)) {
      quadrants[name] = {
        tasks: bucket
          .slice(0, MATRIX_BUCKET_LIMIT)
          .map((t) => serializeTask(t, t.groupId ? names.get(t.groupId) : undefined)),
        truncated: bucket.length > MATRIX_BUCKET_LIMIT,
      };
    }
    return { quadrants };
  },
};

const calendarView: ToolDef = {
  name: "calendar_view",
  description:
    "Tasks with due dates in a date range (inclusive), same semantics as the app's calendar view. Dates are YYYY-MM-DD. Read-only.",
  inputSchema: {
    start: z.string().describe("Range start, YYYY-MM-DD."),
    end: z.string().describe("Range end, YYYY-MM-DD."),
  },
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const start = asString(args.start);
    const end = asString(args.end);
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    if (!start || !valid.test(start)) throw new Error("start must be YYYY-MM-DD");
    if (!end || !valid.test(end)) throw new Error("end must be YYYY-MM-DD");
    if (start > end) throw new Error("start must not be after end");

    const [tasks, groups] = await Promise.all([
      fetchTasks(ctx.db, ctx.uid),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    const names = groupNames(groups);
    const inRange = tasks
      .filter((t) => !t.archived && t.dueDate !== null && t.dueDate >= start && t.dueDate <= end)
      .sort((a, b) =>
        (a.dueDate as string) < (b.dueDate as string)
          ? -1
          : (a.dueDate as string) > (b.dueDate as string)
            ? 1
            : (a.dueTime ?? "") < (b.dueTime ?? "")
              ? -1
              : 1
      );
    return {
      tasks: inRange.map((t) =>
        serializeTask(t, t.groupId ? names.get(t.groupId) : undefined)
      ),
    };
  },
};

const groupsList: ToolDef = {
  name: "groups_list",
  description: "List the user's task groups (lists). Read-only.",
  inputSchema: {},
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const groups = await fetchGroups(ctx.db, ctx.uid);
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        archived: g.archived ?? false,
        order: g.order,
      })),
    };
  },
};

const upcoming: ToolDef = {
  name: "upcoming",
  description:
    "What needs the user's attention: overdue tasks plus tasks due within the next N hours (default 24). Overdue items come first. Read-only.",
  inputSchema: {
    hours: z
      .number()
      .int()
      .optional()
      .describe("Look-ahead window in hours. Default 24, max 720."),
  },
  requiredScopes: ["tasks:read"],
  handler: async (args, ctx) => {
    const hours = Math.min(Math.max(Math.floor(asNumber(args.hours) ?? 24), 1), 720);
    const nowMs = Date.now();
    const cutoff = nowMs + hours * 3600_000;
    const today = todayUTC();

    const [tasks, groups] = await Promise.all([
      fetchTasks(ctx.db, ctx.uid),
      fetchGroups(ctx.db, ctx.uid),
    ]);
    const names = groupNames(groups);

    const overdue: TaskDoc[] = [];
    const soon: TaskDoc[] = [];
    for (const t of tasks) {
      if (t.completed || t.archived || !t.dueDate) continue;
      const ms = dueMs(t);
      if (ms === null) continue;
      if (t.dueDate < today || ms < nowMs - 60_000) {
        overdue.push(t);
      } else if (ms <= cutoff) {
        soon.push(t);
      }
    }
    const byDue = (a: TaskDoc, b: TaskDoc) => (dueMs(a) as number) - (dueMs(b) as number);
    overdue.sort(byDue);
    soon.sort(byDue);

    return {
      tasks: [...overdue, ...soon].map((t) =>
        serializeTask(t, t.groupId ? names.get(t.groupId) : undefined)
      ),
    };
  },
};

export const READ_TOOLS: ToolDef[] = [
  tasksList,
  tasksGet,
  tasksSearch,
  matrixView,
  calendarView,
  groupsList,
  upcoming,
];

/** Scope gate shared by every tool handler. Throws on insufficient scope. */
export function assertToolScope(tool: ToolDef, ctx: McpKeyContext): void {
  if (!hasScopes(ctx, tool.requiredScopes)) {
    throw new Error(
      `Insufficient scope for tool '${tool.name}': requires ${tool.requiredScopes.join(", ")}`
    );
  }
}
