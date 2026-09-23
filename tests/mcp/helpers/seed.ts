import { mockTask, mockGroup, fakeTimestamp } from "../../helpers/mockTask";
import { FakeDb } from "./fakeDb";

export function seedTask(
  db: FakeDb,
  uid: string,
  overrides: Record<string, unknown> = {}
) {
  const t = mockTask(overrides as never);
  const { id, ...data } = t as unknown as Record<string, unknown> & { id: string };
  db.seed(`users/${uid}/tasks/${id}`, data);
  return id;
}

export function seedGroup(
  db: FakeDb,
  uid: string,
  overrides: Record<string, unknown> = {}
) {
  const g = mockGroup(overrides as never);
  const { id, ...data } = g as unknown as Record<string, unknown> & { id: string };
  db.seed(`users/${uid}/taskGroups/${id}`, data);
  return id;
}

export function seedApiKey(
  db: FakeDb,
  uid: string,
  keyId: string,
  keyHash: string,
  overrides: Record<string, unknown> = {}
) {
  db.seed(`users/${uid}/apiKeys/${keyId}`, {
    keyId,
    keyHash,
    keyPrefix: "taskapp_live_test",
    label: "Test key",
    scopes: ["tasks:read"],
    createdAt: Date.now(),
    lastUsedAt: null,
    revokedAt: null,
    rateWindowStart: null,
    rateCount: 0,
    ...overrides,
  });
}

export { fakeTimestamp };
