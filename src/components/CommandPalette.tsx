"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { searchTasks } from "@/lib/search";
import { getQuadrant, type Task } from "@/lib/types";
import { TaskModal } from "@/components/TaskModal";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function formatDue(t: Task): string | null {
  if (!t.dueDate) return null;
  const [y, m, d] = t.dueDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchTasks(tasks, groups, query).slice(0, 12), [tasks, groups, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open ]);

  useEffect(() => setActiveIdx(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && results[activeIdx]) {
        setEditTask(results[activeIdx]);
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, onOpenChange]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  const groupName = (t: Task) => {
    if (!t.groupId) return "General Tasks";
    return groups.find((g) => g.id === t.groupId)?.name ?? "General Tasks";
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" style={{ animation: "fade-in 0.15s ease" }} onClick={() => onOpenChange(false)} />
        <div
          className="relative z-[61] w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-xl)]"
          style={{ animation: "cmdk-in 0.15s ease" }}
        >
          <div className="flex items-center gap-2.5 border-b border-[var(--border-light)] px-4">
            <Search size={16} className="shrink-0 text-[var(--text-tertiary)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, lists, dates… (try “sep 5”)"
              className="h-12 w-full bg-transparent text-[var(--font-md)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
            />
            <kbd className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-light)] bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
              esc
            </kbd>
          </div>

          <div ref={listRef} className="cmdk-list max-h-[40vh] overflow-auto p-1.5">
            {query.trim() === "" ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--text-tertiary)]">
                Search your tasks by title, notes, list name, or due date.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--text-tertiary)]">
                No tasks match “{query.trim()}”.
              </p>
            ) : (
              results.map((t, i) => {
                const q = getQuadrant(t);
                const due = formatDue(t);
                return (
                  <button
                    key={t.id}
                    data-idx={i}
                    onClick={() => { setEditTask(t); setModalOpen(true); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-colors",
                      i === activeIdx ? "bg-[var(--bg-hover)]" : "bg-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2",
                        t.completed ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                      )}
                    >
                      {t.completed && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", t.completed ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]")}>
                        {t.title}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--text-tertiary)]">
                        {groupName(t)}{q ? ` • ${q === "DO" ? "Do First" : q === "SCHEDULE" ? "Schedule" : q === "DELEGATE" ? "Delegate" : "Eliminate"}` : ""}
                      </span>
                    </span>
                    {due && (
                      <span className="shrink-0 rounded-[var(--radius-full)] bg-[var(--accent-light)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                        {due}
                      </span>
                    )}
                    {i === activeIdx && <CornerDownLeft size={13} className="shrink-0 text-[var(--text-tertiary)]" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-[var(--border-light)] px-4 py-2.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border-light)] px-1">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border-light)] px-1">↵</kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border-light)] px-1">esc</kbd> close</span>
          </div>
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onOpenChange={(v) => { setModalOpen(v); if (!v) { setEditTask(null); onOpenChange(false); } }}
        task={editTask}
      />
    </>
  );
}
