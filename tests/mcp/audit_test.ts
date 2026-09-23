import { AUDIT_ARGS_SUMMARY_MAX, logToolCall, summarizeArgs } from "@/lib/mcp/audit";
import { FakeDb } from "./helpers/fakeDb";

describe("summarizeArgs", () => {
  test("serializes args to JSON", () => {
    expect(summarizeArgs({ a: 1 })).toBe('{"a":1}');
    expect(summarizeArgs(undefined)).toBe("{}");
  });

  test("truncates long args", () => {
    const long = "x".repeat(AUDIT_ARGS_SUMMARY_MAX + 100);
    const s = summarizeArgs({ q: long });
    expect(s.length).toBeLessThanOrEqual(AUDIT_ARGS_SUMMARY_MAX + 1);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("logToolCall", () => {
  test("appends a create-only entry under the user's agentAudit", async () => {
    const fake = new FakeDb();
    await logToolCall(fake.asFirestore(), "user-1", {
      keyId: "key-1",
      keyLabel: "Muse",
      tool: "tasks_list",
      args: { status: "active", limit: 50 },
      ok: true,
    });

    const docs = fake.docsUnder("users/user-1/agentAudit");
    expect(docs).toHaveLength(1);
    const entry = docs[0].data as Record<string, unknown>;
    expect(entry.keyId).toBe("key-1");
    expect(entry.keyLabel).toBe("Muse");
    expect(entry.tool).toBe("tasks_list");
    expect(entry.argsSummary).toBe('{"status":"active","limit":50}');
    expect(entry.ok).toBe(true);
    expect(typeof entry.ts).toBe("number");
  });

  test("records failures with the error message", async () => {
    const fake = new FakeDb();
    await logToolCall(fake.asFirestore(), "user-1", {
      keyId: "key-1",
      keyLabel: "Muse",
      tool: "tasks_get",
      args: { task_id: "nope" },
      ok: false,
      error: "Task not found: nope",
    });

    const docs = fake.docsUnder("users/user-1/agentAudit");
    const entry = docs[0].data as Record<string, unknown>;
    expect(entry.ok).toBe(false);
    expect(entry.error).toBe("Task not found: nope");
  });

  test("audit module exposes no update or delete", async () => {
    const mod = await import("@/lib/mcp/audit");
    const names = Object.keys(mod);
    expect(names).toEqual(expect.arrayContaining(["logToolCall", "summarizeArgs"]));
    expect(names.some((n) => /update|delete|remove/i.test(n))).toBe(false);
  });
});
