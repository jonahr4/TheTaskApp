"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { tasksQuery } from "@/lib/firestore";
import type { Task } from "@/lib/types";

export function useTasks(uid: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(tasksQuery(uid), (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { tasks, loading };
}
