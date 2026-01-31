"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { createGroup, updateGroup, deleteGroup } from "@/lib/firestore";
import type { TaskGroup } from "@/lib/types";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group?: TaskGroup | null;
};

export function GroupModal({ open, onOpenChange, group }: Props) {
  const { user } = useAuth();
  const { groups } = useTaskGroups(user?.uid);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(group?.name || "");
  }, [group, open]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    if (group) {
      await updateGroup(user.uid, group.id, { name: name.trim() });
    } else {
      await createGroup(user.uid, { name: name.trim(), order: groups.length });
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!user || !group) return;
    await deleteGroup(user.uid, group.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{group ? "Edit List" : "New List"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">List Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work, Personal, CS 505" autoFocus />
      </DialogBody>
      <DialogFooter>
        {group && (
          <Button variant="ghost" size="icon" className="mr-auto text-[var(--destructive)] hover:bg-red-50" onClick={handleDelete}>
            <Trash2 size={16} />
          </Button>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim()}>
          {group ? "Save" : "Create list"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
