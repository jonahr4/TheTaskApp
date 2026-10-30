import Fuse from "fuse.js";
import type { Task, TaskGroup } from "./types";

// Natural-language search ported from the mobile app (templates tab).

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export type DateQuery = { month: number; day?: number };

/**
 * Parse natural date queries into { month, day? } for matching.
 * Handles: "sep", "sept 5", "september 5", "12/5", "12-5", "2025-12-05"
 */
export function parseDateQuery(q: string): DateQuery | null {
  const trimmed = q.trim().toLowerCase();

  // ISO: 2025-12-05
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return { month: parseInt(isoMatch[2], 10) - 1, day: parseInt(isoMatch[3], 10) };
  }

  // Numeric: 12/5 or 12-5
  const numMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (numMatch) {
    return { month: parseInt(numMatch[1], 10) - 1, day: parseInt(numMatch[2], 10) };
  }

  // Month name with optional day: "sep", "sept 5", "september 12"
  const nameMatch = trimmed.match(/^([a-z]+)\s*(\d{1,2})?$/);
  if (nameMatch) {
    const monthNum = MONTH_NAMES[nameMatch[1]];
    if (monthNum !== undefined) {
      return { month: monthNum, day: nameMatch[2] ? parseInt(nameMatch[2], 10) : undefined };
    }
  }

  return null;
}

export function matchesDateQuery(dueDate: string | null, dateQ: DateQuery): boolean {
  if (!dueDate) return false;
  // dueDate is "YYYY-MM-DD"
  const parts = dueDate.split("-");
  if (parts.length < 3) return false;
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (m !== dateQ.month) return false;
  if (dateQ.day !== undefined && d !== dateQ.day) return false;
  return true;
}

const fuseOptions = {
  keys: [
    { name: "title", weight: 0.7 },
    { name: "notes", weight: 0.3 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

/**
 * Search tasks the same way the mobile app does:
 * 1. date queries ("sep 5", "12/5") matched against due dates
 * 2. group/list name matches (case-insensitive contains)
 * 3. fuzzy text search on title + notes
 * Results are merged in that priority order, deduped.
 */
export function searchTasks(
  tasks: Task[],
  groups: TaskGroup[],
  query: string,
  opts: { includeCompleted?: boolean } = {}
): Task[] {
  const q = query.trim();
  if (!q) return [];

  const includeCompleted = opts.includeCompleted ?? true;
  let pool = tasks;
  if (!includeCompleted) pool = tasks.filter((t) => !t.completed);

  const groupMap: Record<string, TaskGroup> = {};
  for (const g of groups) groupMap[g.id] = g;

  // 1. Date query
  const dateQ = parseDateQuery(q);
  const dateMatches: Task[] = dateQ ? pool.filter((t) => matchesDateQuery(t.dueDate, dateQ)) : [];

  // 2. Group name matches
  const qLower = q.toLowerCase();
  const groupMatches = pool.filter((t) => {
    const g = t.groupId ? groupMap[t.groupId] : undefined;
    return !!g && g.name.toLowerCase().includes(qLower);
  });

  // 3. Fuzzy text search
  const fuse = new Fuse(pool, fuseOptions);
  const textResults = fuse.search(q).map((r) => r.item);

  // Merge: date → group → text (deduped)
  const seen = new Set<string>();
  const merged: Task[] = [];
  for (const t of [...dateMatches, ...groupMatches, ...textResults]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
  }
  return merged;
}
