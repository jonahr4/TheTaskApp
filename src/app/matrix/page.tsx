"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask, updateTask, deleteTask } from "@/lib/firestore";
import { TaskModal } from "@/components/TaskModal";
import { getQuadrant, type Task, type Quadrant } from "@/lib/types";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { Plus, SlidersHorizontal, X, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
    { key: "DO", label: "Important & Urgent", sublabel: "Do First", accent: "text-red-600", bg: "bg-red-50", dot: "bg-red-500", border: "border-red-200" },
    { key: "SCHEDULE", label: "Important & Not Urgent", sublabel: "Schedule", accent: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500", border: "border-blue-200" },
    { key: "DELEGATE", label: "Urgent & Not Important", sublabel: "Delegate", accent: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500", border: "border-amber-200" },
    { key: "DELETE", label: "Not Important or Urgent", sublabel: "Eliminate", accent: "text-gray-500", bg: "bg-gray-50", dot: "bg-gray-400", border: "border-gray-200" },
  ];

const quadrantFlags: Record<Quadrant, { urgent: boolean; important: boolean }> = {
  DO: { urgent: true, important: true },
  SCHEDULE: { urgent: false, important: true },
  DELEGATE: { urgent: true, important: false },
  DELETE: { urgent: false, important: false },
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
  const [sortBy, setSortBy] = useState<"dueDate" | "createdAt" | "updatedAt" | "alpha" | "priority">("dueDate");
  const [persistReady, setPersistReady] = useState(false);
  const [uncategorizedOpen, setUncategorizedOpen] = useState(false);

  const allGroupIds = ["__general__", ...groups.map((g) => g.id)];

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      if (id === "__all__") {
        if (prev.has("__all__")) return new Set<string>();
        return new Set(["__all__"]);
      }
      if (prev.has("__all__")) {
        const next = new Set(allGroupIds.filter((g) => g !== id));
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === allGroupIds.length && allGroupIds.every((g) => next.has(g))) {
        return new Set(["__all__"]);
      }
      return next;
    });
  };

  const allGroupsSelected = selectedGroups.has("__all__");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("taskapp.matrix.filters");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.showCompleted === "boolean") setShowCompleted(parsed.showCompleted);
        if (typeof parsed.showInProgress === "boolean") setShowInProgress(parsed.showInProgress);
        if (Array.isArray(parsed.selectedGroups)) setSelectedGroups(new Set(parsed.selectedGroups));
        if (parsed.sortBy === "dueDate" || parsed.sortBy === "createdAt" || parsed.sortBy === "updatedAt" || parsed.sortBy === "alpha" || parsed.sortBy === "priority") {
          setSortBy(parsed.sortBy);
        }
      }
    } catch {
      // ignore storage errors
    } finally {
      setPersistReady(true);
    }
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const payload = {
      showCompleted,
      showInProgress,
      selectedGroups: Array.from(selectedGroups),
      sortBy,
    };
    try {
      localStorage.setItem("taskapp.matrix.filters", JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [persistReady, showCompleted, showInProgress, selectedGroups, sortBy]);

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
        if (sortBy === "alpha") return a.title.localeCompare(b.title);
        if (sortBy === "createdAt") return (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
        if (sortBy === "updatedAt") return (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0);
        if (sortBy === "priority") {
          const pOrder: Record<Quadrant, number> = { DO: 0, SCHEDULE: 1, DELEGATE: 2, DELETE: 3 };
          const aQ = getQuadrant(a);
          const bQ = getQuadrant(b);
          if (aQ === null && bQ !== null) return 1;
          if (aQ !== null && bQ === null) return -1;
          if (aQ !== null && bQ !== null) {
            const diff = pOrder[aQ] - pOrder[bQ];
            if (diff !== 0) return diff;
          }
        }
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

    const destId = result.destination.droppableId;
    const sourceId = result.source.droppableId;

    if (destId === sourceId) return;

    const task = tasks.find((t) => t.id === result.draggableId);
    if (!task) return;

    // Dropping into uncategorized removes priority
    if (destId === "__uncategorized__") {
      updateTask(user.uid, task.id, { urgent: null, important: null });
      return;
    }

    const flags = quadrantFlags[destId as Quadrant];
    updateTask(user.uid, task.id, { urgent: flags.urgent, important: flags.important });
  };

  // Uncategorized tasks (no priority set)
  const uncategorizedTasks = tasks
    .filter((t) => {
      if (getQuadrant(t) !== null) return false; // Has priority
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
      return a.order - b.order;
    });

  return (
    <AppShell>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="h-full p-6 sm:p-8 lg:p-12 relative">
          {/* Top bar: list pills + filter button */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-2 overflow-x-auto flex-1 pb-0.5">
              <button
                onClick={() => toggleGroup("__all__")}
                className={`px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium whitespace-nowrap transition-all ${allGroupsSelected ? "bg-[var(--accent)] text-white border border-transparent shadow-[var(--shadow-sm)]" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]"}`}
              >
                All
              </button>
              <button
                onClick={() => toggleGroup("__general__")}
                className={`px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${allGroupsSelected || selectedGroups.has("__general__") ? "bg-[var(--accent)] text-white border border-transparent shadow-[var(--shadow-sm)]" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]"}`}
              >
                <span className="h-2 w-2 rounded-full shrink-0 bg-slate-400" />
                General Tasks
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  className={`px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${allGroupsSelected || selectedGroups.has(g.id) ? "bg-[var(--accent)] text-white border border-transparent shadow-[var(--shadow-sm)]" : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]"}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color || "#6366f1" }} />
                  {g.name}
                </button>
              ))}
            </div>
            <button
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <SlidersHorizontal size={13} />
              Filters
              {(!showInProgress || !showCompleted) && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] text-white font-semibold">!</span>
              )}
            </button>
          </div>

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
              {/* Sort */}
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Sort by</p>
                {([["dueDate", "Due date"], ["createdAt", "Date created"], ["updatedAt", "Last updated"], ["alpha", "Alphabetical"], ["priority", "Priority"]] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                    <input type="radio" name="sortBy" checked={sortBy === value} onChange={() => setSortBy(value)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                    <span className="text-sm text-[var(--text-primary)]">{label}</span>
                  </label>
                ))}
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

          <div className="flex h-[calc(100%-3rem)] gap-4">
            {/* Matrix grid */}
            <div className="flex-1 grid grid-cols-1 auto-rows-fr gap-4 md:grid-cols-2 md:grid-rows-2 md:gap-5">
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

            {/* Toggle arrow - shown when panel is closed */}
            {!uncategorizedOpen && (
              <button
                onClick={() => setUncategorizedOpen(true)}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex h-8 w-5 items-center justify-center rounded-l-md bg-gray-100 border border-r-0 border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
              >
                <ChevronLeft size={14} />
                {uncategorizedTasks.length > 0 && (
                  <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-500 px-1 text-[9px] text-white font-semibold">
                    {uncategorizedTasks.length}
                  </span>
                )}
              </button>
            )}

            {/* Uncategorized panel - on the right */}
            <div className={`relative flex-shrink-0 transition-all duration-300 ${uncategorizedOpen ? "w-[20%] min-w-[200px]" : "w-0"}`}>
              {uncategorizedOpen && (
                <div className="h-full flex flex-col rounded-[var(--radius-lg)] bg-gray-50 border border-gray-200 overflow-hidden">
                  {/* Header with close arrow */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Uncategorized</h3>
                        <p className="text-[10px] text-gray-500">Drag to categorize</p>
                      </div>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-white/60 px-1.5 text-[11px] font-medium text-gray-600">
                        {uncategorizedTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setUncategorizedOpen(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Tasks - droppable */}
                  <Droppable droppableId="__uncategorized__">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-auto px-3 pb-3 space-y-1 transition-colors ${snapshot.isDraggingOver ? "bg-gray-100/50" : ""}`}
                      >
                        {uncategorizedTasks.map((t, index) => (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group flex items-center gap-2 rounded-[var(--radius-md)] bg-white/70 px-3 py-1.5 cursor-pointer hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:shadow-[var(--shadow-sm)] ${snapshot.isDragging ? "shadow-[var(--shadow-lg)] bg-white rotate-1" : ""}`}
                                onClick={() => openEdit(t)}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center text-gray-400 cursor-grab"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical size={12} />
                                </div>
                                <button
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-gray-300 hover:border-gray-500 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); user && updateTask(user.uid, t.id, { completed: !t.completed }); }}
                                >
                                  {t.completed && <div className="h-2 w-2 rounded-[1px] bg-gray-500" />}
                                </button>
                                <span className={`text-xs transition-colors truncate flex-1 ${t.completed ? "line-through text-gray-400" : "text-gray-800 group-hover:text-gray-600"}`}>
                                  {t.title}
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
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {uncategorizedTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-full min-h-[60px]">
                            <p className="text-xs text-gray-400">No uncategorized tasks</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )}
            </div>
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
