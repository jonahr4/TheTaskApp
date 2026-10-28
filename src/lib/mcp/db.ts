/**
 * MCP data-access layer — firebase-admin only, never the client SDK.
 *
 * Every query is scoped to `users/{uid}/...` where uid comes from the
 * verified API key. There is intentionally no function here that accepts an
 * arbitrary uid from tool arguments: the uid always comes from the key
 * context, which is what makes cross-user reads impossible by construction.
 *
 * Queries avoid composite indexes on purpose: we fetch ordered by the
 * single-field `order` index (the same query the web app already runs) and
 * apply filters in memory. Task collections are small (hundreds of docs),
 * so this stays fast without requiring new Firestore indexes.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { Task, TaskGroup } from "@/lib/types";

/** Firestore Timestamp-ish → ISO string. Tolerant of admin Timestamps, the
 *  test fake's shape, Dates, and plain ISO strings. */
export function toISO(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
    };
    if (typeof v.toDate === "function") {
      try {
        return v.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof v.toMillis === "function") {
      try {
        return new Date(v.toMillis()).toISOString();
      } catch {
        return null;
      }
    }
    if (typeof v.seconds === "number") {
      return new Date(v.seconds * 1000).toISOString();
    }
  }
  return null;
}

export function toMillis(value: unknown): number | null {
  const iso = toISO(value);
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export type TaskDoc = Task & {
  id: string;
  /**
   * Mobile-written fields not yet present in the web Task type (they land
   * with the web-mobile-consistency branch). Kept loose so reads never break.
   */
  location?: string | null;
  createdFrom?: string | null;
};
export type GroupDoc = TaskGroup & { id: string };

function taskFromSnap(id: string, data: Record<string, unknown>): TaskDoc {
  return {
    id,
    title: typeof data.title === "string" ? data.title : "",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    urgent: typeof data.urgent === "boolean" ? data.urgent : null,
    important: typeof data.important === "boolean" ? data.important : null,
    reminder: typeof data.reminder === "boolean" ? data.reminder : undefined,
    dueDate: typeof data.dueDate === "string" ? data.dueDate : null,
    dueTime: typeof data.dueTime === "string" ? data.dueTime : null,
    groupId: typeof data.groupId === "string" ? data.groupId : null,
    autoUrgentDays: typeof data.autoUrgentDays === "number" ? data.autoUrgentDays : null,
    location:
      typeof data.location === "string" ? data.location : data.location === null ? null : undefined,
    createdFrom: typeof data.createdFrom === "string" ? data.createdFrom : null,
    completed: data.completed === true,
    archived: data.archived === true,
    order: typeof data.order === "number" ? data.order : 0,
    createdAt: data.createdAt as Task["createdAt"],
    updatedAt: data.updatedAt as Task["updatedAt"],
  };
}

function groupFromSnap(id: string, data: Record<string, unknown>): GroupDoc {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    color: typeof data.color === "string" ? data.color : null,
    archived: data.archived === true,
    order: typeof data.order === "number" ? data.order : 0,
    createdAt: data.createdAt as TaskGroup["createdAt"],
  };
}

/** All tasks for the key's user, ordered by `order` (single-field index). */
export async function fetchTasks(db: Firestore, uid: string): Promise<TaskDoc[]> {
  const snap = await db
    .collection(`users/${uid}/tasks`)
    .orderBy("order", "asc")
    .get();
  const tasks = snap.docs.map((d) => taskFromSnap(d.id, d.data() as Record<string, unknown>));
  // Stable order for pagination: order, then id.
  tasks.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return tasks;
}

/** One task for the key's user, or null. Never crosses the uid boundary. */
export async function fetchTask(
  db: Firestore,
  uid: string,
  taskId: string
): Promise<TaskDoc | null> {
  if (!taskId || taskId.includes("/")) return null;
  const snap = await db.doc(`users/${uid}/tasks/${taskId}`).get();
  if (!snap.exists) return null;
  return taskFromSnap(snap.id, snap.data() as Record<string, unknown>);
}

/** All task groups for the key's user. */
export async function fetchGroups(db: Firestore, uid: string): Promise<GroupDoc[]> {
  const snap = await db
    .collection(`users/${uid}/taskGroups`)
    .orderBy("order", "asc")
    .get();
  const groups = snap.docs.map((d) => groupFromSnap(d.id, d.data() as Record<string, unknown>));
  groups.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return groups;
}

/** Display name for the summary resource (falls back to uid). */
export async function fetchDisplayName(db: Firestore, uid: string): Promise<string> {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return uid;
    const data = snap.data() as Record<string, unknown>;
    const name = data.displayName ?? data.name ?? data.email;
    return typeof name === "string" && name.length > 0 ? name : uid;
  } catch {
    return uid;
  }
}
