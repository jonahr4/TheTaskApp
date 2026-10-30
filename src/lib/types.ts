import { Timestamp } from "firebase/firestore";

// Shared type layer — single source of truth for the web app.
// Mirrors the mobile app's lib/types.ts (jonahr4/TaskApp-Mobile) so the two
// stay in sync. New fields are OPTIONAL so old mobile builds keep working:
// additive changes only, never renames or removals.

export type CreatedFrom = "tasks" | "ai" | "calendar" | "matrix";

export type Task = {
  id: string;
  title: string;
  notes?: string;
  urgent: boolean | null;
  important: boolean | null;
  reminder?: boolean;
  dueDate: string | null;
  dueTime: string | null;
  groupId: string | null;
  autoUrgentDays: number | null;
  // Mobile-parity fields (optional / additive)
  location?: string | null;
  createdFrom?: CreatedFrom | null;
  completed: boolean;
  // Web-only field; the mobile app ignores it
  archived?: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TaskGroup = {
  id: string;
  name: string;
  color: string | null;
  archived?: boolean;
  order: number;
  createdAt: Timestamp;
};

export type Quadrant = "DO" | "SCHEDULE" | "DELEGATE" | "DELETE";

export function getQuadrant(t: Task): Quadrant | null {
  if (t.urgent === null || t.important === null) return null;
  if (t.urgent && t.important) return "DO";
  if (!t.urgent && t.important) return "SCHEDULE";
  if (t.urgent && !t.important) return "DELEGATE";
  return "DELETE";
}

// Quadrant colors ported 1:1 from the mobile app's QUADRANT_META
// (TaskApp-Mobile lib/types.ts), including the dark-mode variants.
export const QUADRANT_META: Record<
  Quadrant,
  {
    label: string;
    sublabel: string;
    color: string;
    bg: string;
    border: string;
    darkColor: string;
    darkBg: string;
    darkBorder: string;
    urgent: boolean;
    important: boolean;
  }
> = {
  DO: {
    label: "Important & Urgent", sublabel: "Do First",
    color: "#dc2626", bg: "#fef2f2", border: "#fca5a5",
    darkColor: "#ff6b6b", darkBg: "#2d1515", darkBorder: "#7f2020",
    urgent: true, important: true,
  },
  SCHEDULE: {
    label: "Important & Not Urgent", sublabel: "Schedule",
    color: "#2563eb", bg: "#eff6ff", border: "#93c5fd",
    darkColor: "#60a5fa", darkBg: "#0f1e35", darkBorder: "#1e3a6e",
    urgent: false, important: true,
  },
  DELEGATE: {
    label: "Urgent & Not Important", sublabel: "Delegate",
    color: "#d97706", bg: "#fffbeb", border: "#fbbf24",
    darkColor: "#fbbf24", darkBg: "#2a1f08", darkBorder: "#78400a",
    urgent: true, important: false,
  },
  DELETE: {
    label: "Not Important or Urgent", sublabel: "Eliminate",
    color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db",
    darkColor: "#9ca3af", darkBg: "#26282c", darkBorder: "#3a3d42",
    urgent: false, important: false,
  },
};
