/**
 * User isolation: the MCP server must never read across the uid boundary.
 * Every data function takes the uid from the verified key context — tool
 * arguments cannot smuggle in another user's id.
 */
import { generateApiSecret, hashApiSecret, verifyApiKey } from "@/lib/mcp/auth";
import { fetchTask, fetchTasks } from "@/lib/mcp/db";
import { READ_TOOLS, type McpRequestContext } from "@/lib/mcp/tools";
import { FakeDb } from "./helpers/fakeDb";
import { seedApiKey, seedTask } from "./helpers/seed";

function ctxFor(uid: string): McpRequestContext {
  return {
    uid,
    keyId: "key-1",
    keyLabel: "Test key",
    scopes: ["tasks:read"],
    keyDocPath: `users/${uid}/apiKeys/key-1`,
    db: null as never, // replaced per-call below
  };
}

describe("user isolation", () => {
  test("tasks_list for user A never returns user B's tasks", async () => {
    const fake = new FakeDb();
    seedTask(fake, "alice", { id: "a-task-1", title: "Alice task" });
    seedTask(fake, "bob", { id: "b-task-1", title: "Bob task" });

    const list = READ_TOOLS.find((t) => t.name === "tasks_list")!;
    const ctx = { ...ctxFor("alice"), db: fake.asFirestore() };
    const result = (await list.handler({}, ctx)) as { tasks: Array<{ title: string }> };

    expect(result.tasks.map((t) => t.title)).toEqual(["Alice task"]);
  });

  test("tasks_get cannot fetch another user's task by id", async () => {
    const fake = new FakeDb();
    seedTask(fake, "bob", { id: "b-secret", title: "Bob secret" });

    expect(await fetchTask(fake.asFirestore(), "alice", "b-secret")).toBe(null);

    const get = READ_TOOLS.find((t) => t.name === "tasks_get")!;
    const ctx = { ...ctxFor("alice"), db: fake.asFirestore() };
    await expect(get.handler({ task_id: "b-secret" }, ctx)).rejects.toThrow("not found");
  });

  test("a key issued under one uid resolves to exactly that uid", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "bob", "key-9", hashApiSecret(secret));

    const ctx = await verifyApiKey(fake.asFirestore(), secret);
    expect(ctx!.uid).toBe("bob");

    // Even if an attacker crafts tool args containing another uid, the data
    // layer only ever uses ctx.uid.
    seedTask(fake, "alice", { id: "a-1", title: "Alice" });
    const tasks = await fetchTasks(fake.asFirestore(), ctx!.uid);
    expect(tasks.every((t) => t.id !== "a-1")).toBe(true);
  });

  test("tasks_search only searches the key owner's tasks", async () => {
    const fake = new FakeDb();
    seedTask(fake, "alice", { id: "a-1", title: "Buy milk" });
    seedTask(fake, "bob", { id: "b-1", title: "Buy milk for Bob" });

    const search = READ_TOOLS.find((t) => t.name === "tasks_search")!;
    const ctx = { ...ctxFor("alice"), db: fake.asFirestore() };
    const result = (await search.handler({ query: "milk" }, ctx)) as {
      tasks: Array<{ id: string }>;
    };
    expect(result.tasks.map((t) => t.id)).toEqual(["a-1"]);
  });
});
