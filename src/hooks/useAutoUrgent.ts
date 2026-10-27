import { useEffect, useRef } from "react";
import { updateTask } from "@/lib/firestore";
import type { Task } from "@/lib/types";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useAutoUrgent(uid: string | undefined, tasks: Task[]) {
  // Always check the latest tasks, even from the repeating interval,
  // without tearing down and re-creating the timer on every snapshot.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    const check = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const t of tasksRef.current) {
        if (cancelled) return;
        if (
          t.autoUrgentDays != null &&
          t.dueDate &&
          !t.urgent &&
          !t.completed
        ) {
          const due = new Date(`${t.dueDate}T00:00:00`);
          if (Number.isNaN(due.getTime())) {
            console.warn(
              `[auto-urgent] skipping task ${t.id}: invalid dueDate "${t.dueDate}"`
            );
            continue;
          }
          const triggerDate = new Date(
            due.getTime() - t.autoUrgentDays * 86400000
          );
          if (today >= triggerDate) {
            try {
              await updateTask(uid, t.id, { urgent: true });
            } catch (err) {
              // Never fail silently: a rejected write used to disappear
              // without a trace, making the feature look broken.
              console.error(
                `[auto-urgent] failed to mark task ${t.id} urgent:`,
                err
              );
            }
          }
        }
      }
    };

    // Run once on mount and whenever tasks change (e.g. the initial
    // Firestore snapshot arriving after mount), then re-check on a timer
    // for long-lived sessions.
    void check();

    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [uid, tasks]);
}
