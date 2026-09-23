/**
 * Server-side natural-language task search for the MCP server.
 *
 * This is a dependency-free port of the web app's Fuse.js search
 * (src/lib/search.ts, currently on the unmerged web-mobile-consistency
 * branch). It keeps the same semantics:
 *
 *   1. Date queries ("sep", "sept 5", "september 12", "12/5", "2025-12-05")
 *      matched against due dates.
 *   2. Group/list name matches (case-insensitive substring).
 *   3. Fuzzy text search over title (weight 0.7) + notes (weight 0.3).
 *
 * Results merge in that priority order, deduped. The fuzzy scorer is a
 * lightweight token/subsequence matcher rather than Fuse's bitap algorithm,
 * so rankings may differ slightly from the web UI for very fuzzy queries —
 * exact and prefix matches behave identically. When the shared search module
 * lands on main, this can delegate to it.
 */

import type { GroupDoc, TaskDoc } from "./db";

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
 * Parse natural date queries into { month, day? }.
 * Handles: "sep", "sept 5", "september 5", "12/5", "12-5", "2025-12-05".
 */
export function parseDateQuery(q: string): DateQuery | null {
  const trimmed = q.trim().toLowerCase();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return { month: parseInt(isoMatch[2], 10) - 1, day: parseInt(isoMatch[3], 10) };
  }

  const numMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (numMatch) {
    return { month: parseInt(numMatch[1], 10) - 1, day: parseInt(numMatch[2], 10) };
  }

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
  const parts = dueDate.split("-");
  if (parts.length < 3) return false;
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (m !== dateQ.month) return false;
  if (dateQ.day !== undefined && d !== dateQ.day) return false;
  return true;
}

/** Ordered-subsequence (fuzzy) match: all chars of `needle` appear in order in `hay`. */
function subsequenceMatch(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) {
      i++;
      if (i === needle.length) return true;
    }
  }
  return false;
}

/** Quality of a single token against a field: 1 = substring, 0.6 = fuzzy, 0 = miss. */
function tokenFieldScore(token: string, field: string): number {
  const f = field.toLowerCase();
  if (f.includes(token)) return 1;
  if (token.length >= 2 && subsequenceMatch(token, f)) return 0.6;
  return 0;
}

/** Weighted fuzzy score for a task, mirroring the Fuse key weights (title 0.7, notes 0.3). */
function fuzzyScore(task: TaskDoc, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}'"]+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return 0;

  const title = task.title ?? "";
  const notes = task.notes ?? "";

  let sum = 0;
  for (const token of tokens) {
    // Direct mirror of the Fuse key weights: title 0.7, notes 0.3.
    sum += 0.7 * tokenFieldScore(token, title) + 0.3 * tokenFieldScore(token, notes);
  }
  return sum / tokens.length;
}

const FUZZY_THRESHOLD = 0.3;

/**
 * Search the user's tasks. `includeCompleted` defaults to true (matches web).
 * Archived tasks are excluded — agents search the working set.
 */
export function searchTasks(
  tasks: TaskDoc[],
  groups: GroupDoc[],
  query: string,
  opts: { includeCompleted?: boolean; limit?: number } = {}
): TaskDoc[] {
  const q = query.trim();
  if (!q) return [];

  const includeCompleted = opts.includeCompleted ?? true;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  let pool = tasks.filter((t) => !t.archived);
  if (!includeCompleted) pool = pool.filter((t) => !t.completed);

  const groupMap = new Map<string, GroupDoc>();
  for (const g of groups) groupMap.set(g.id, g);

  // 1. Date query
  const dateQ = parseDateQuery(q);
  const dateMatches: TaskDoc[] = dateQ
    ? pool.filter((t) => matchesDateQuery(t.dueDate, dateQ))
    : [];

  // 2. Group name matches
  const qLower = q.toLowerCase();
  const groupMatches = pool.filter((t) => {
    const g = t.groupId ? groupMap.get(t.groupId) : undefined;
    return !!g && g.name.toLowerCase().includes(qLower);
  });

  // 3. Fuzzy text search
  const textMatches = pool
    .map((t) => ({ task: t, score: fuzzyScore(t, q) }))
    .filter((r) => r.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.task);

  // Merge: date → group → text (deduped)
  const seen = new Set<string>();
  const merged: TaskDoc[] = [];
  for (const t of [...dateMatches, ...groupMatches, ...textMatches]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
      if (merged.length >= limit) break;
    }
  }
  return merged;
}
