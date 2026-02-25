"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { tasksQuery } from "@/lib/firestore";
import type { Task } from "@/lib/types";

export function useTasks(uid: string | undefined, includeArchived: boolean = false) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(tasksQuery(uid), (snap) => {
      let fetchedTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      if (!includeArchived) {
        fetchedTasks = fetchedTasks.filter((t) => !t.archived);
      }
      setTasks(fetchedTasks);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { tasks, loading };
}
