"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { groupsQuery } from "@/lib/firestore";
import type { TaskGroup } from "@/lib/types";

export function useTaskGroups(uid: string | undefined, includeArchived: boolean = false) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(groupsQuery(uid), (snap) => {
      let fetchedGroups = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskGroup));
      if (!includeArchived) {
        fetchedGroups = fetchedGroups.filter((g) => !g.archived);
      }
      setGroups(fetchedGroups);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { groups, loading };
}
