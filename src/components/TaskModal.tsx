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
import type { Task, Quadrant, CreatedFrom } from "@/lib/types";
import { Trash2, Check, Bell, Minus, Plus } from "lucide-react";

const miniQuadrants: { key: Quadrant; label: string; urgent: boolean; important: boolean }[] = [
  { key: "DO", label: "Do First", urgent: true, important: true },
  { key: "SCHEDULE", label: "Schedule", urgent: false, important: true },
  { key: "DELEGATE", label: "Delegate", urgent: true, important: false },
  { key: "DELETE", label: "Eliminate", urgent: false, important: false },
];

// Quadrant chrome driven by CSS vars so it follows light/dark theme
// (vars are ported from the mobile app's QUADRANT_META).
const qVar = (key: Quadrant, prop: "bg" | "color" | "border") =>
  `var(--q-${key.toLowerCase()}-${prop})`;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--bg-active)]"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: Task | null;
  defaultGroupId?: string | null;
  defaultUrgent?: boolean;
  defaultImportant?: boolean;
  defaultDueDate?: string | null;
  defaultDueTime?: string | null;
  /** Where the task is being created from — stamped on new tasks (mobile parity). */
  createdFrom?: CreatedFrom;
};

export function TaskModal({ open, onOpenChange, task, defaultGroupId, defaultUrgent, defaultImportant, defaultDueDate, defaultDueTime, createdFrom }: Props) {
  const { user } = useAuth();
  const { groups } = useTaskGroups(user?.uid);
  const { tasks } = useTasks(user?.uid);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [noPriority, setNoPriority] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [groupId, setGroupId] = useState("");
  const [completed, setCompleted] = useState(false);
  const [reminder, setReminder] = useState(false);
  // Auto-urgent: mobile-style toggle + stepper (1–30 days), not a dropdown
  const [autoUrgentEnabled, setAutoUrgentEnabled] = useState(false);
  const [autoUrgentDays, setAutoUrgentDays] = useState(1);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
      setUrgent(task.urgent ?? false);
      setImportant(task.important ?? false);
      setDueDate(task.dueDate || "");
      setDueTime(task.dueTime || "");
      setGroupId(task.groupId || "");
      setCompleted(task.completed);
      setReminder(task.reminder ?? false);
      // Check if task has no priority (null values)
      setNoPriority(task.urgent === null || task.important === null);
      const days = task.autoUrgentDays;
      setAutoUrgentEnabled(days != null && days > 0);
      setAutoUrgentDays(days && days > 0 ? days : 1);
    } else {
      setTitle("");
      setNotes("");
      setUrgent(defaultUrgent ?? true);
      setImportant(defaultImportant ?? true);
      setNoPriority(false);
      setDueDate(defaultDueDate || "");
      setDueTime(defaultDueTime || "");
      setGroupId(defaultGroupId || "");
      setCompleted(false);
      setReminder(false);
      setAutoUrgentEnabled(false);
      setAutoUrgentDays(1);
    }
  }, [task, open, defaultGroupId, defaultUrgent, defaultImportant, defaultDueDate, defaultDueTime]);

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    const data = {
      title: title.trim(),
      notes: notes.trim() || "",
      urgent: noPriority ? null : urgent,
      important: noPriority ? null : important,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      groupId: groupId || null,
      autoUrgentDays: autoUrgentEnabled ? autoUrgentDays : null,
      reminder,
      completed,
      order: task ? task.order : tasks.length,
    };
    if (task) {
      await updateTask(user.uid, task.id, data);
    } else {
      await createTask(user.uid, { ...data, createdFrom: createdFrom ?? "tasks" } as any);
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
            value={noPriority ? "none" : (miniQuadrants.find((q) => urgent === q.urgent && important === q.important)?.key ?? "DO")}
            onChange={(e) => {
              if (e.target.value === "none") {
                setNoPriority(true);
                setUrgent(false);
                setImportant(false);
              } else {
                const next = miniQuadrants.find((q) => q.key === e.target.value);
                if (next) { setUrgent(next.urgent); setImportant(next.important); setNoPriority(false); }
              }
            }}
            className="flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)] sm:hidden"
          >
            {miniQuadrants.map((q) => (
              <option key={q.key} value={q.key}>{q.label}</option>
            ))}
            <option value="none">No Priority</option>
          </select>
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-2">
            {miniQuadrants.map((q) => {
              const selected = !noPriority && urgent === q.urgent && important === q.important;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      // Clicking selected priority deselects it
                      setNoPriority(true);
                      setUrgent(false);
                      setImportant(false);
                    } else {
                      setUrgent(q.urgent);
                      setImportant(q.important);
                      setNoPriority(false);
                    }
                  }}
                  style={{
                    backgroundColor: qVar(q.key, "bg"),
                    borderColor: qVar(q.key, "border"),
                    color: qVar(q.key, "color"),
                    boxShadow: selected ? `0 0 0 2px ${qVar(q.key, "color")}` : undefined,
                    opacity: selected ? 1 : 0.75,
                  }}
                  className="relative flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all hover:opacity-100"
                >
                  {selected && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: qVar(q.key, "color") }}>
                      <Check size={10} strokeWidth={3} className="text-white" />
                    </span>
                  )}
                  <span className="text-xs font-medium">{q.label}</span>
                </button>
              );
            })}
          </div>
          {noPriority && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">No priority selected. Click a priority to set one.</p>
          )}
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

          {/* Reminder — the field already existed on the type; now it has UI (mobile parity) */}
          <div className="sm:col-span-2 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <Bell size={15} className="text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Reminder</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">Get notified before this task is due</p>
              </div>
            </div>
            <Toggle checked={reminder} onChange={setReminder} label="Reminder" />
          </div>

          {/* Auto-urgent — mobile-style toggle + stepper */}
          {dueDate && (
            <div className="sm:col-span-2 rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Auto-urgent</p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    {autoUrgentEnabled
                      ? `Mark urgent ${autoUrgentDays} day${autoUrgentDays > 1 ? "s" : ""} before due`
                      : "Automatically mark as urgent before the due date"}
                  </p>
                </div>
                <Toggle checked={autoUrgentEnabled} onChange={setAutoUrgentEnabled} label="Auto-urgent" />
              </div>
              {autoUrgentEnabled && (
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Decrease days"
                    onClick={() => setAutoUrgentDays((d) => Math.max(1, d - 1))}
                    disabled={autoUrgentDays <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-16 text-center text-sm font-semibold text-[var(--text-primary)]">
                    {autoUrgentDays} day{autoUrgentDays > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase days"
                    onClick={() => setAutoUrgentDays((d) => Math.min(30, d + 1))}
                    disabled={autoUrgentDays >= 30}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Completed toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <button
            type="button"
            onClick={() => setCompleted(!completed)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 transition-all ${completed ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
          >
            {completed && <Check size={12} className="text-white" strokeWidth={3} />}
          </button>
          <span className="text-sm text-[var(--text-primary)]">Completed</span>
        </label>
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
