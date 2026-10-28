import {
  API_KEY_PREFIX,
  checkRateLimit,
  generateApiSecret,
  hashApiSecret,
  hasScopes,
  isApiKeyFormat,
  parseBearerToken,
  READ_RATE_LIMIT_PER_MINUTE,
  verifyApiKey,
} from "@/lib/mcp/auth";
import { FakeDb } from "./helpers/fakeDb";
import { seedApiKey } from "./helpers/seed";

describe("API key format", () => {
  test("generateApiSecret produces unique taskapp_live_ secrets", () => {
    const a = generateApiSecret();
    const b = generateApiSecret();
    expect(a).not.toBe(b);
    expect(isApiKeyFormat(a)).toBe(true);
    expect(a.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  test("isApiKeyFormat rejects junk", () => {
    expect(isApiKeyFormat(null)).toBe(false);
    expect(isApiKeyFormat("")).toBe(false);
    expect(isApiKeyFormat("Bearer abc")).toBe(false);
    expect(isApiKeyFormat("taskapp_live_")).toBe(false);
    expect(isApiKeyFormat("firebase-id-token-xyz")).toBe(false);
  });

  test("hashApiSecret is deterministic", () => {
    expect(hashApiSecret("taskapp_live_abc")).toBe(hashApiSecret("taskapp_live_abc"));
    expect(hashApiSecret("taskapp_live_abc")).not.toBe(hashApiSecret("taskapp_live_abd"));
  });

  test("parseBearerToken extracts the token", () => {
    expect(parseBearerToken("Bearer taskapp_live_abc")).toBe("taskapp_live_abc");
    expect(parseBearerToken("bearer taskapp_live_abc")).toBe("taskapp_live_abc");
    expect(parseBearerToken(null)).toBe(null);
    expect(parseBearerToken("Basic xyz")).toBe(null);
  });
});

describe("verifyApiKey", () => {
  test("valid key resolves to the owning uid with scopes", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret), {
      label: "Muse",
      scopes: ["tasks:read"],
    });

    const ctx = await verifyApiKey(fake.asFirestore(), secret);
    expect(ctx).not.toBe(null);
    expect(ctx!.uid).toBe("user-1");
    expect(ctx!.keyId).toBe("key-1");
    expect(ctx!.keyLabel).toBe("Muse");
    expect(ctx!.scopes).toEqual(["tasks:read"]);
  });

  test("unknown secret returns null", async () => {
    const fake = new FakeDb();
    const ctx = await verifyApiKey(fake.asFirestore(), generateApiSecret());
    expect(ctx).toBe(null);
  });

  test("revoked key returns null", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret), { revokedAt: Date.now() });
    expect(await verifyApiKey(fake.asFirestore(), secret)).toBe(null);
  });

  test("unknown scopes are filtered out", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret), {
      scopes: ["tasks:read", "nonsense:scope"],
    });
    const ctx = await verifyApiKey(fake.asFirestore(), secret);
    expect(ctx!.scopes).toEqual(["tasks:read"]);
  });
});

describe("checkRateLimit", () => {
  test("allows 60 reads then rejects the 61st", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret));
    const db = fake.asFirestore();
    const path = "users/user-1/apiKeys/key-1";

    for (let i = 0; i < READ_RATE_LIMIT_PER_MINUTE; i++) {
      const r = await checkRateLimit(db, path, 1_000_000 + i * 100);
      expect(r.allowed).toBe(true);
    }
    const rejected = await checkRateLimit(db, path, 1_000_000 + 59_000);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
  });

  test("window resets after 60 seconds", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret));
    const db = fake.asFirestore();
    const path = "users/user-1/apiKeys/key-1";

    for (let i = 0; i < READ_RATE_LIMIT_PER_MINUTE; i++) {
      await checkRateLimit(db, path, 1_000_000);
    }
    expect((await checkRateLimit(db, path, 1_000_000)).allowed).toBe(false);
    // 61s later: fresh window
    expect((await checkRateLimit(db, path, 1_000_000 + 61_000)).allowed).toBe(true);
  });

  test("revoked key is rejected without writing", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret), { revokedAt: 5 });
    const r = await checkRateLimit(fake.asFirestore(), "users/user-1/apiKeys/key-1", 1_000_000);
    expect(r.allowed).toBe(false);
  });

  test("lastUsedAt is updated on allowed requests", async () => {
    const fake = new FakeDb();
    const secret = generateApiSecret();
    seedApiKey(fake, "user-1", "key-1", hashApiSecret(secret));
    await checkRateLimit(fake.asFirestore(), "users/user-1/apiKeys/key-1", 7_000_000);
    const snap = await fake.doc("users/user-1/apiKeys/key-1").get();
    expect(snap.data()!.lastUsedAt).toBe(7_000_000);
  });
});

describe("hasScopes", () => {
  test("requires every listed scope", () => {
    const ctx = {
      uid: "u",
      keyId: "k",
      keyLabel: "l",
      scopes: ["tasks:read"] as Array<"tasks:read" | "tasks:write" | "ai:use">,
      keyDocPath: "p",
    };
    expect(hasScopes(ctx, ["tasks:read"])).toBe(true);
    expect(hasScopes(ctx, ["tasks:read", "tasks:write"])).toBe(false);
    expect(hasScopes(ctx, [])).toBe(true);
  });
});
