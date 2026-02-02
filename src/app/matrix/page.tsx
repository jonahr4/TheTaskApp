"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask, updateTask, deleteTask } from "@/lib/firestore";
import { TaskModal } from "@/components/TaskModal";
import { getQuadrant, type Task, type Quadrant } from "@/lib/types";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { TaskRowMenu } from "@/components/TaskRowMenu";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const quadrants: {
  key: Quadrant;
  label: string;
  sublabel: string;
  accent: string;
  bg: string;
  dot: string;
  border: string;
}[] = [
  { key: "DO",       label: "Do First",  sublabel: "Important & Urgent",     accent: "text-red-600",    bg: "bg-red-50",    dot: "bg-red-500",    border: "border-red-200" },
  { key: "SCHEDULE", label: "Schedule",   sublabel: "Important & Not Urgent", accent: "text-blue-600",   bg: "bg-blue-50",   dot: "bg-blue-500",   border: "border-blue-200" },
  { key: "DELEGATE", label: "Delegate",   sublabel: "Urgent & Not Important", accent: "text-amber-600",  bg: "bg-amber-50",  dot: "bg-amber-500",  border: "border-amber-200" },
  { key: "DELETE",   label: "Eliminate",  sublabel: "Not Important or Urgent",accent: "text-gray-500",   bg: "bg-gray-50",   dot: "bg-gray-400",   border: "border-gray-200" },
];

const quadrantFlags: Record<Quadrant, { urgent: boolean; important: boolean }> = {
  DO:       { urgent: true,  important: true },
  SCHEDULE: { urgent: false, important: true },
  DELEGATE: { urgent: true,  important: false },
  DELETE:   { urgent: false, important: false },
};

export default function MatrixPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newQuadrant, setNewQuadrant] = useState<Quadrant | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showInProgress, setShowInProgress] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(["__all__"]));

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (id === "__all__") {
        if (next.has("__all__")) { next.delete("__all__"); } else { next.clear(); next.add("__all__"); }
      } else {
        next.delete("__all__");
        if (next.has(id)) next.delete(id); else next.add(id);
        if (next.size === 0) next.add("__all__");
      }
      return next;
    });
  };

  const allGroupsSelected = selectedGroups.has("__all__");

  const getTaskDateTime = (task: Task): Date | null => {
    if (!task.dueDate) return null;
    if (task.dueTime) return new Date(`${task.dueDate}T${task.dueTime}`);
    return new Date(`${task.dueDate}T00:00:00`);
  };

  const formatDateTime = (task: Task): string | null => {
    if (!task.dueDate) return null;
    const d = getTaskDateTime(task)!;
    if (!task.dueTime) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} • ${time}`;
  };

  const byQuadrant = (q: Quadrant) =>
    tasks
      .filter((t) => {
        if (getQuadrant(t) !== q) return false;
        if (t.completed && !showCompleted) return false;
        if (!t.completed && !showInProgress) return false;
        if (!allGroupsSelected) {
          const gId = t.groupId || "__general__";
          if (!selectedGroups.has(gId)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const aDt = getTaskDateTime(a);
        const bDt = getTaskDateTime(b);
        if (aDt && bDt) return aDt.getTime() - bDt.getTime();
        if (aDt && !bDt) return -1;
        if (!aDt && bDt) return 1;
        return a.order - b.order;
      });

  const duplicateTask = (t: Task) => {
    if (!user) return;
    createTask(user.uid, {
      title: `${t.title} (copy)`,
      notes: t.notes || "",
      urgent: t.urgent,
      important: t.important,
      dueDate: t.dueDate || null,
      dueTime: t.dueTime || null,
      groupId: t.groupId || null,
      completed: false,
      order: tasks.length,
    } as any);
  };

  const openNewInQuadrant = (q: Quadrant) => { setEditTask(null); setNewQuadrant(q); setTaskModal(true); };
  const openEdit = (t: Task) => { setEditTask(t); setNewQuadrant(null); setTaskModal(true); };

  const defaultUrgent = newQuadrant === "DO" || newQuadrant === "DELEGATE";
  const defaultImportant = newQuadrant === "DO" || newQuadrant === "SCHEDULE";

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !user) return;
    const destQuadrant = result.destination.droppableId as Quadrant;
    const sourceQuadrant = result.source.droppableId as Quadrant;
    if (destQuadrant === sourceQuadrant) return;

    const task = tasks.find((t) => t.id === result.draggableId);
    if (!task) return;

    const flags = quadrantFlags[destQuadrant];
    updateTask(user.uid, task.id, { urgent: flags.urgent, important: flags.important });
  };

  return (
    <AppShell>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="h-full p-6 sm:p-8 lg:p-12 relative">
          {/* Filter toggle */}
          <button
            className="absolute top-3 right-3 z-10 flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-hover)] transition-colors sm:top-4 sm:right-4"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <SlidersHorizontal size={13} />
            Filters
            {(!showInProgress || !showCompleted || !allGroupsSelected) && (
              <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] text-white font-semibold">!</span>
            )}
          </button>

          {/* Filter sidebar */}
          <div className={`fixed top-0 right-0 z-40 h-full w-72 border-l border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] transition-transform duration-200 ${filterOpen ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filters</h3>
              <button onClick={() => setFilterOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              {/* Status */}
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Status</p>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={showInProgress} onChange={() => setShowInProgress(!showInProgress)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">In progress</span>
                </label>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted(!showCompleted)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">Completed</span>
                </label>
              </div>
              {/* Lists */}
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Lists</p>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={allGroupsSelected} onChange={() => toggleGroup("__all__")} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">All lists</span>
                </label>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={allGroupsSelected || selectedGroups.has("__general__")} onChange={() => toggleGroup("__general__")} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">General Tasks</span>
                </label>
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={allGroupsSelected || selectedGroups.has(g.id)} onChange={() => toggleGroup(g.id)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                    <span className="text-sm text-[var(--text-primary)]">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {/* Backdrop */}
          {filterOpen && <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setFilterOpen(false)} />}

          <div className="grid h-full grid-cols-1 auto-rows-fr gap-4 md:grid-cols-2 md:grid-rows-2 md:gap-5">
            {quadrants.map(({ key, label, sublabel, accent, bg, dot, border }) => {
              const items = byQuadrant(key);
              return (
                <div key={key} className={`flex flex-col rounded-[var(--radius-lg)] ${bg} ${border} border overflow-hidden`}>
                  {/* Quadrant header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      <div>
                        <h3 className={`text-sm font-semibold ${accent}`}>{label}</h3>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{sublabel}</p>
                      </div>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-white/60 px-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                        {items.length}
                      </span>
                    </div>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-white/60 hover:text-[var(--text-secondary)] transition-colors"
                      onClick={() => openNewInQuadrant(key)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Tasks - droppable */}
                  <Droppable droppableId={key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-auto px-3 pb-3 space-y-1 transition-colors ${snapshot.isDraggingOver ? "bg-white/30" : ""}`}
                      >
                        {items.map((t, index) => (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`group flex items-center gap-2 rounded-[var(--radius-md)] bg-white/70 px-3 py-1.5 cursor-grab hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:shadow-[var(--shadow-sm)] ${snapshot.isDragging ? "shadow-[var(--shadow-lg)] bg-white rotate-1" : ""}`}
                                onClick={() => openEdit(t)}
                              >
                                <button
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                                  onClick={(e) => { e.stopPropagation(); user && updateTask(user.uid, t.id, { completed: !t.completed }); }}
                                >
                                  {t.completed && <div className="h-2 w-2 rounded-[1px] bg-[var(--accent)]" />}
                                </button>
                                <span className={`text-xs transition-colors truncate ${t.completed ? "line-through text-[var(--text-tertiary)]" : "text-[var(--text-primary)] group-hover:text-[var(--accent)]"}`}>
                                  {t.title}
                                </span>
                                <span className="ml-auto shrink-0 flex items-center gap-2">
                                  {t.dueDate && (
                                    <span className="text-[11px] text-[var(--text-tertiary)]">
                                      {formatDateTime(t)}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[var(--text-tertiary)] opacity-60">
                                    {t.groupId ? (groups.find(g => g.id === t.groupId)?.name ?? "General Tasks") : "General Tasks"}
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TaskRowMenu
                                      completed={t.completed}
                                      onEdit={() => openEdit(t)}
                                      onDuplicate={() => duplicateTask(t)}
                                      onToggleComplete={() => user && updateTask(user.uid, t.id, { completed: !t.completed })}
                                      onDelete={() => user && deleteTask(user.uid, t.id)}
                                    />
                                  </div>
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {items.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-full min-h-[60px]">
                            <button
                              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                              onClick={() => openNewInQuadrant(key)}
                            >
                              + Add a task
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <TaskModal
        open={taskModal}
        onOpenChange={(v) => { setTaskModal(v); if (!v) setNewQuadrant(null); }}
        task={editTask}
        defaultUrgent={newQuadrant ? defaultUrgent : undefined}
        defaultImportant={newQuadrant ? defaultImportant : undefined}
      />
    </AppShell>
  );
}
