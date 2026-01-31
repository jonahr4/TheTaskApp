"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { groupsQuery } from "@/lib/firestore";
import type { TaskGroup } from "@/lib/types";

export function useTaskGroups(uid: string | undefined) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(groupsQuery(uid), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskGroup)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { groups, loading };
}
