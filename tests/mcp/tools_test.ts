/**
 * @jest-environment node
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  assertToolScope,
  READ_TOOLS,
  type McpRequestContext,
  type ToolDef,
} from "@/lib/mcp/tools";
import { createMcpServer } from "@/lib/mcp/server";
import { FakeDb } from "./helpers/fakeDb";
import { fakeTimestamp, seedGroup, seedTask } from "./helpers/seed";

const UID = "user-1";

function ctx(overrides: Partial<McpRequestContext> = {}): McpRequestContext {
  return {
    uid: UID,
    keyId: "key-1",
    keyLabel: "Test key",
    scopes: ["tasks:read"],
    keyDocPath: `users/${UID}/apiKeys/key-1`,
    db: null as never,
    ...overrides,
  };
}

function tool(name: string): ToolDef {
  const t = READ_TOOLS.find((t) => t.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t;
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

describe("tasks_list", () => {
  test("defaults to active tasks", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Active", order: 0 });
    seedTask(fake, UID, { id: "t2", title: "Done", order: 1, completed: true });
    seedTask(fake, UID, { id: "t3", title: "Archived", order: 2, archived: true });

    const res = (await tool("tasks_list").handler({}, ctx({ db: fake.asFirestore() }))) as {
      tasks: Array<{ id: string }>;
    };
    expect(res.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  test("status filters", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Active", order: 0 });
    seedTask(fake, UID, { id: "t2", title: "Done", order: 1, completed: true });
    seedTask(fake, UID, { id: "t3", title: "Archived", order: 2, archived: true });
    const c = ctx({ db: fake.asFirestore() });

    const completed = (await tool("tasks_list").handler({ status: "completed" }, c)) as {
      tasks: Array<{ id: string }>;
    };
    expect(completed.tasks.map((t) => t.id)).toEqual(["t2"]);

    const archived = (await tool("tasks_list").handler({ status: "archived" }, c)) as {
      tasks: Array<{ id: string }>;
    };
    expect(archived.tasks.map((t) => t.id)).toEqual(["t3"]);

    const all = (await tool("tasks_list").handler({ status: "all" }, c)) as {
      tasks: Array<{ id: string }>;
    };
    expect(all.tasks).toHaveLength(3);
  });

  test("group_id filter", async () => {
    const fake = new FakeDb();
    seedGroup(fake, UID, { id: "g1", name: "Work" });
    seedTask(fake, UID, { id: "t1", title: "In group", order: 0, groupId: "g1" });
    seedTask(fake, UID, { id: "t2", title: "No group", order: 1, groupId: null });

    const res = (await tool("tasks_list").handler(
      { group_id: "g1" },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string; group_name: string | null }> };
    expect(res.tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(res.tasks[0].group_name).toBe("Work");
  });

  test("cursor pagination", async () => {
    const fake = new FakeDb();
    for (let i = 0; i < 5; i++) seedTask(fake, UID, { id: `t${i}`, title: `T${i}`, order: i });
    const c = ctx({ db: fake.asFirestore() });

    const p1 = (await tool("tasks_list").handler({ limit: 2 }, c)) as {
      tasks: Array<{ id: string }>;
      next_cursor?: string;
    };
    expect(p1.tasks.map((t) => t.id)).toEqual(["t0", "t1"]);
    expect(p1.next_cursor).toBe("t1");

    const p2 = (await tool("tasks_list").handler({ limit: 2, cursor: p1.next_cursor }, c)) as {
      tasks: Array<{ id: string }>;
      next_cursor?: string;
    };
    expect(p2.tasks.map((t) => t.id)).toEqual(["t2", "t3"]);
    expect(p2.next_cursor).toBe("t3");

    const p3 = (await tool("tasks_list").handler({ limit: 2, cursor: p2.next_cursor }, c)) as {
      tasks: Array<{ id: string }>;
      next_cursor?: string;
    };
    expect(p3.tasks.map((t) => t.id)).toEqual(["t4"]);
    expect(p3.next_cursor).toBeUndefined();
  });

  test("limit is clamped to 200", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "T" });
    const res = (await tool("tasks_list").handler(
      { limit: 500 },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: unknown[] };
    expect(res.tasks).toHaveLength(1); // would be 500 without the clamp
  });

  test("updated_since filters on updatedAt", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, {
      id: "old",
      title: "Old",
      order: 0,
      updatedAt: fakeTimestamp(new Date("2026-09-01T00:00:00Z")),
    });
    seedTask(fake, UID, {
      id: "new",
      title: "New",
      order: 1,
      updatedAt: fakeTimestamp(new Date("2026-09-20T00:00:00Z")),
    });
    seedTask(fake, UID, { id: "nodate", title: "No date", order: 2, updatedAt: undefined });

    const res = (await tool("tasks_list").handler(
      { updated_since: "2026-09-10T00:00:00Z" },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string }> };
    // docs without updatedAt cannot match an updated_since filter (documented gap)
    expect(res.tasks.map((t) => t.id)).toEqual(["new"]);
  });

  test("invalid updated_since throws", async () => {
    const fake = new FakeDb();
    await expect(
      tool("tasks_list").handler({ updated_since: "not-a-date" }, ctx({ db: fake.asFirestore() }))
    ).rejects.toThrow("ISO timestamp");
  });
});

describe("tasks_get", () => {
  test("returns the full task", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, {
      id: "t1",
      title: "Full",
      notes: "notes here",
      urgent: true,
      important: true,
      dueDate: "2026-09-25",
      location: "Boston",
    });
    const res = (await tool("tasks_get").handler(
      { task_id: "t1" },
      ctx({ db: fake.asFirestore() })
    )) as { task: Record<string, unknown> };
    expect(res.task.title).toBe("Full");
    expect(res.task.notes).toBe("notes here");
    expect(res.task.quadrant).toBe("DO");
    expect(res.task.location).toBe("Boston");
    expect(res.task.due_date).toBe("2026-09-25");
  });

  test("unknown id throws", async () => {
    const fake = new FakeDb();
    await expect(
      tool("tasks_get").handler({ task_id: "nope" }, ctx({ db: fake.asFirestore() }))
    ).rejects.toThrow("not found");
  });

  test("path traversal in task_id is rejected", async () => {
    const fake = new FakeDb();
    await expect(
      tool("tasks_get").handler({ task_id: "../other" }, ctx({ db: fake.asFirestore() }))
    ).rejects.toThrow("not found");
  });
});

describe("tasks_search", () => {
  test("date query matches due dates", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Party", order: 0, dueDate: "2026-09-05" });
    seedTask(fake, UID, { id: "t2", title: "Other", order: 1, dueDate: "2026-10-01" });

    const res = (await tool("tasks_search").handler(
      { query: "sep 5" },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string }> };
    expect(res.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  test("group name query matches tasks in that group", async () => {
    const fake = new FakeDb();
    seedGroup(fake, UID, { id: "g1", name: "Groceries" });
    seedTask(fake, UID, { id: "t1", title: "Milk", order: 0, groupId: "g1" });
    seedTask(fake, UID, { id: "t2", title: "Homework", order: 1 });

    const res = (await tool("tasks_search").handler(
      { query: "grocer" },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string }> };
    expect(res.tasks.map((t) => t.id)).toContain("t1");
  });

  test("fuzzy text matches titles and notes", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Buy groceries", order: 0 });
    seedTask(fake, UID, { id: "t2", title: "File taxes", order: 1, notes: "before april" });

    const c = ctx({ db: fake.asFirestore() });
    const r1 = (await tool("tasks_search").handler({ query: "grocer" }, c)) as {
      tasks: Array<{ id: string }>;
    };
    expect(r1.tasks.map((t) => t.id)).toEqual(["t1"]);

    const r2 = (await tool("tasks_search").handler({ query: "april" }, c)) as {
      tasks: Array<{ id: string }>;
    };
    expect(r2.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  test("empty query throws", async () => {
    const fake = new FakeDb();
    await expect(
      tool("tasks_search").handler({ query: "   " }, ctx({ db: fake.asFirestore() }))
    ).rejects.toThrow("query is required");
  });
});

describe("matrix_view", () => {
  test("buckets tasks by quadrant", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "do", title: "DO", order: 0, urgent: true, important: true });
    seedTask(fake, UID, { id: "sched", title: "S", order: 1, urgent: false, important: true });
    seedTask(fake, UID, { id: "none", title: "?", order: 2, urgent: null, important: null });
    seedTask(fake, UID, { id: "done", title: "Done", order: 3, urgent: true, important: true, completed: true });

    const res = (await tool("matrix_view").handler(
      {},
      ctx({ db: fake.asFirestore() })
    )) as { quadrants: Record<string, { tasks: Array<{ id: string }>; truncated: boolean }> };

    expect(res.quadrants.DO.tasks.map((t) => t.id)).toEqual(["do"]);
    expect(res.quadrants.SCHEDULE.tasks.map((t) => t.id)).toEqual(["sched"]);
    expect(res.quadrants.uncategorized.tasks.map((t) => t.id)).toEqual(["none"]);
    expect(res.quadrants.DO.truncated).toBe(false);
    // completed tasks are excluded from the matrix
    expect(JSON.stringify(res.quadrants)).not.toContain("done");
  });
});

describe("calendar_view", () => {
  test("returns tasks with due dates in range, sorted", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "a", title: "A", order: 0, dueDate: "2026-09-24", dueTime: "18:00" });
    seedTask(fake, UID, { id: "b", title: "B", order: 1, dueDate: "2026-09-26" });
    seedTask(fake, UID, { id: "c", title: "C", order: 2, dueDate: "2026-10-05" });
    seedTask(fake, UID, { id: "d", title: "D", order: 3, dueDate: null });

    const res = (await tool("calendar_view").handler(
      { start: "2026-09-24", end: "2026-09-30" },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string }> };
    expect(res.tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("rejects bad dates", async () => {
    const fake = new FakeDb();
    const c = ctx({ db: fake.asFirestore() });
    await expect(
      tool("calendar_view").handler({ start: "tomorrow", end: "2026-09-30" }, c)
    ).rejects.toThrow("YYYY-MM-DD");
    await expect(
      tool("calendar_view").handler({ start: "2026-09-30", end: "2026-09-24" }, c)
    ).rejects.toThrow("start must not be after end");
  });
});

describe("groups_list", () => {
  test("lists groups", async () => {
    const fake = new FakeDb();
    seedGroup(fake, UID, { id: "g1", name: "Work", order: 0 });
    seedGroup(fake, UID, { id: "g2", name: "Personal", order: 1 });

    const res = (await tool("groups_list").handler(
      {},
      ctx({ db: fake.asFirestore() })
    )) as { groups: Array<{ id: string; name: string }> };
    expect(res.groups.map((g) => g.name)).toEqual(["Work", "Personal"]);
  });
});

describe("upcoming", () => {
  test("overdue first, then due-soon, far-future excluded", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "overdue", title: "Overdue", order: 0, dueDate: daysFromNow(-2) });
    seedTask(fake, UID, { id: "soon", title: "Soon", order: 1, dueDate: daysFromNow(1) });
    seedTask(fake, UID, { id: "far", title: "Far", order: 2, dueDate: daysFromNow(30) });
    seedTask(fake, UID, { id: "done", title: "Done", order: 3, dueDate: daysFromNow(-1), completed: true });

    const res = (await tool("upcoming").handler(
      { hours: 48 },
      ctx({ db: fake.asFirestore() })
    )) as { tasks: Array<{ id: string }> };
    expect(res.tasks.map((t) => t.id)).toEqual(["overdue", "soon"]);
  });
});

describe("assertToolScope", () => {
  test("throws when the key lacks the required scope", () => {
    const t = tool("tasks_list");
    const noScope = ctx({ scopes: [] });
    expect(() => assertToolScope(t, noScope)).toThrow("Insufficient scope");
    expect(() => assertToolScope(t, ctx())).not.toThrow();
  });
});

describe("MCP transport round-trip", () => {
  async function callMcp(
    server: McpServer,
    body: unknown
  ): Promise<{ status: number; json: unknown }> {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const res = await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(body),
      }),
      { parsedBody: body }
    );
    return { status: res.status, json: JSON.parse(await res.text()) };
  }

  test("tools/list exposes the 7 Phase 1 read tools", async () => {
    const fake = new FakeDb();
    const server = createMcpServer(
      ctx({ db: fake.asFirestore() }),
      { db: fake.asFirestore() }
    );
    const { status, json } = await callMcp(server, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(status).toBe(200);
    const names = (json as { result: { tools: Array<{ name: string }> } }).result.tools.map(
      (t) => t.name
    );
    expect(names.sort()).toEqual(
      ["calendar_view", "groups_list", "matrix_view", "tasks_get", "tasks_list", "tasks_search", "upcoming"].sort()
    );
  });

  test("tools/call tasks_list returns JSON and writes an audit entry", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Via MCP", order: 0 });
    const server = createMcpServer(
      ctx({ db: fake.asFirestore() }),
      { db: fake.asFirestore() }
    );
    const { status, json } = await callMcp(server, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "tasks_list", arguments: {} },
    });
    expect(status).toBe(200);
    const text = (json as { result: { content: Array<{ text: string }> } }).result.content[0].text;
    const parsed = JSON.parse(text) as { tasks: Array<{ title: string }> };
    expect(parsed.tasks.map((t) => t.title)).toEqual(["Via MCP"]);

    const audits = fake.docsUnder(`users/${UID}/agentAudit`);
    expect(audits).toHaveLength(1);
    const entry = audits[0].data as Record<string, unknown>;
    expect(entry.tool).toBe("tasks_list");
    expect(entry.ok).toBe(true);
    expect(entry.keyId).toBe("key-1");
  });

  test("resources/read taskapp://user/summary returns counts", async () => {
    const fake = new FakeDb();
    seedTask(fake, UID, { id: "t1", title: "Active", order: 0, dueDate: daysFromNow(0) });
    seedTask(fake, UID, { id: "t2", title: "Old", order: 1, dueDate: daysFromNow(-3) });
    seedGroup(fake, UID, { id: "g1", name: "Work", order: 0 });
    fake.seed(`users/${UID}`, { displayName: "Test User" });

    const server = createMcpServer(
      ctx({ db: fake.asFirestore() }),
      { db: fake.asFirestore() }
    );
    const { status, json } = await callMcp(server, {
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "taskapp://user/summary" },
    });
    expect(status).toBe(200);
    const text = (json as { result: { contents: Array<{ text: string }> } }).result.contents[0].text;
    const summary = JSON.parse(text) as {
      display_name: string;
      task_counts: { active: number; overdue: number; due_today: number };
      groups: Array<{ name: string }>;
    };
    expect(summary.display_name).toBe("Test User");
    expect(summary.task_counts).toEqual({ active: 2, overdue: 1, due_today: 1 });
    expect(summary.groups.map((g) => g.name)).toEqual(["Work"]);
  });
});
