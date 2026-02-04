import { Timestamp } from "firebase/firestore";

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
  completed: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TaskGroup = {
  id: string;
  name: string;
  color: string | null;
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
