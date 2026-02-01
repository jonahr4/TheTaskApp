"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { createTask, updateTask, deleteTask } from "@/lib/firestore";
import { useTasks } from "@/hooks/useTasks";
import type { Task, Quadrant } from "@/lib/types";
import { Trash2, Check } from "lucide-react";

const miniQuadrants: { key: Quadrant; label: string; urgent: boolean; important: boolean; bg: string; bgSelected: string; border: string; text: string; ring: string }[] = [
  { key: "DO",       label: "Do First",  urgent: true,  important: true,  bg: "bg-red-50",   bgSelected: "bg-red-100",   border: "border-red-200",   text: "text-red-700",   ring: "ring-red-400" },
  { key: "SCHEDULE", label: "Schedule",   urgent: false, important: true,  bg: "bg-blue-50",  bgSelected: "bg-blue-100",  border: "border-blue-200",  text: "text-blue-700",  ring: "ring-blue-400" },
  { key: "DELEGATE", label: "Delegate",   urgent: true,  important: false, bg: "bg-amber-50", bgSelected: "bg-amber-100", border: "border-amber-200", text: "text-amber-700", ring: "ring-amber-400" },
  { key: "DELETE",   label: "Eliminate",  urgent: false, important: false, bg: "bg-gray-50",  bgSelected: "bg-gray-100",  border: "border-gray-200",  text: "text-gray-600",  ring: "ring-gray-400" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: Task | null;
  defaultGroupId?: string | null;
  defaultUrgent?: boolean;
  defaultImportant?: boolean;
};

export function TaskModal({ open, onOpenChange, task, defaultGroupId, defaultUrgent, defaultImportant }: Props) {
  const { user } = useAuth();
  const { groups } = useTaskGroups(user?.uid);
  const { tasks } = useTasks(user?.uid);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [groupId, setGroupId] = useState("");
  const [completed, setCompleted] = useState(false);
  const [autoUrgentDays, setAutoUrgentDays] = useState<string>("off");
  const [customDays, setCustomDays] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
      setUrgent(task.urgent);
      setImportant(task.important);
      setDueDate(task.dueDate || "");
      setDueTime(task.dueTime || "");
      setGroupId(task.groupId || "");
      setCompleted(task.completed);
      const days = task.autoUrgentDays;
      if (days == null) { setAutoUrgentDays("off"); setCustomDays(""); }
      else if (days === 1) { setAutoUrgentDays("1"); setCustomDays(""); }
      else if (days === 2) { setAutoUrgentDays("2"); setCustomDays(""); }
      else if (days === 7) { setAutoUrgentDays("7"); setCustomDays(""); }
      else { setAutoUrgentDays("custom"); setCustomDays(String(days)); }
    } else {
      setTitle("");
      setNotes("");
      setUrgent(defaultUrgent ?? true);
      setImportant(defaultImportant ?? true);
      setDueDate("");
      setDueTime("");
      setGroupId(defaultGroupId || "");
      setCompleted(false);
      setAutoUrgentDays("off");
      setCustomDays("");
    }
  }, [task, open, defaultGroupId, defaultUrgent, defaultImportant]);

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    const data = {
      title: title.trim(),
      notes: notes.trim() || "",
      urgent,
      important,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      groupId: groupId || null,
      autoUrgentDays: autoUrgentDays === "off" ? null : autoUrgentDays === "custom" ? (parseInt(customDays) || null) : parseInt(autoUrgentDays),
      completed,
      order: task ? task.order : tasks.length,
    };
    if (task) {
      await updateTask(user.uid, task.id, data);
    } else {
      await createTask(user.uid, data as any);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!user || !task) return;
    await deleteTask(user.uid, task.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add details..." />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Priority</label>
          <select
            value={miniQuadrants.find((q) => urgent === q.urgent && important === q.important)?.key ?? "DO"}
            onChange={(e) => {
              const next = miniQuadrants.find((q) => q.key === e.target.value);
              if (next) { setUrgent(next.urgent); setImportant(next.important); }
            }}
            className="flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)] sm:hidden"
          >
            {miniQuadrants.map((q) => (
              <option key={q.key} value={q.key}>{q.label}</option>
            ))}
          </select>
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-2">
            {miniQuadrants.map((q) => {
              const selected = urgent === q.urgent && important === q.important;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => { setUrgent(q.urgent); setImportant(q.important); }}
                  className={`relative flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all ${
                    selected
                      ? `${q.bgSelected} ${q.border} ring-2 ${q.ring} ring-offset-1`
                      : `${q.bg} ${q.border} hover:${q.bgSelected} opacity-70 hover:opacity-100`
                  }`}
                >
                  {selected && (
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${q.bgSelected} ${q.text}`}>
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                  <span className={`text-xs font-medium ${q.text}`}>{q.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Time</label>
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">List</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">General Tasks</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          {dueDate && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Auto-urgent</label>
              <div className="flex items-center gap-2">
                <select
                  value={autoUrgentDays}
                  onChange={(e) => setAutoUrgentDays(e.target.value)}
                  className="flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="off">Off</option>
                  <option value="1">1 day before</option>
                  <option value="2">2 days before</option>
                  <option value="7">1 week before</option>
                  <option value="custom">Custom</option>
                </select>
                {autoUrgentDays === "custom" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      min="1"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="Days"
                      className="w-20"
                    />
                    <span className="text-xs text-[var(--text-tertiary)]">days</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Automatically mark as urgent before due date</p>
            </div>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        {task && (
          <Button variant="ghost" size="icon" className="mr-auto text-[var(--destructive)] hover:bg-red-50" onClick={handleDelete}>
            <Trash2 size={16} />
          </Button>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={!title.trim()}>
          {task ? "Save changes" : "Create task"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
