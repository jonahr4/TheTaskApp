"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { createGroup, updateGroup, deleteGroup } from "@/lib/firestore";
import type { TaskGroup } from "@/lib/types";
import { Trash2, Check } from "lucide-react";

const GROUP_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#64748b",
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group?: TaskGroup | null;
};

export function GroupModal({ open, onOpenChange, group }: Props) {
  const { user } = useAuth();
  const { groups } = useTaskGroups(user?.uid);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0]);

  useEffect(() => {
    setName(group?.name || "");
    setColor(group?.color || GROUP_COLORS[0]);
  }, [group, open]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    if (group) {
      await updateGroup(user.uid, group.id, { name: name.trim(), color });
    } else {
      await createGroup(user.uid, { name: name.trim(), color, order: groups.length });
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
      <DialogBody className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">List Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work, Personal, CS 505" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Color</label>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {color === c && <Check size={13} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
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
