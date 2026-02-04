"use client";

import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { createTask, updateTask, deleteTask, updateGroup } from "@/lib/firestore";
import { TaskModal } from "@/components/TaskModal";
import { GroupModal } from "@/components/GroupModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getQuadrant } from "@/lib/types";
import type { Task, TaskGroup, Quadrant } from "@/lib/types";
import { Plus, MoreVertical, Calendar, FolderPlus, GripVertical, SlidersHorizontal, X, ChevronDown, ChevronRight } from "lucide-react";
import { TaskRowMenu } from "@/components/TaskRowMenu";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

function getTaskDateTime(task: Task): Date | null {
  if (!task.dueDate) return null;
  if (task.dueTime) return new Date(`${task.dueDate}T${task.dueTime}`);
  return new Date(`${task.dueDate}T00:00:00`);
}

function formatDueDateTime(task: Task): string | null {
  if (!task.dueDate) return null;
  const d = getTaskDateTime(task)!;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const base =
    diff === 0
      ? "Today"
      : diff === 1
        ? "Tomorrow"
        : diff === -1
          ? "Yesterday"
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (!task.dueTime) return base;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${base} • ${time}`;
}

export default function TasksPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);

  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState<TaskGroup | null>(null);
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"dueDate" | "createdAt" | "updatedAt" | "alpha" | "priority">("dueDate");
  const [showCompleted, setShowCompleted] = useState(true);
  const [showInProgress, setShowInProgress] = useState(true);
  const [showPriority, setShowPriority] = useState(true);
  const [showDueDate, setShowDueDate] = useState(true);
  const [showDragHandles, setShowDragHandles] = useState(true);
  const [taskWidth, setTaskWidth] = useState(400);
  const [generalOrder, setGeneralOrder] = useState(0);
  const [groupOrderOpen, setGroupOrderOpen] = useState(false);
  const [persistReady, setPersistReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("taskapp.tasks.filters");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sortBy === "dueDate" || parsed.sortBy === "createdAt" || parsed.sortBy === "updatedAt" || parsed.sortBy === "alpha" || parsed.sortBy === "priority") {
          setSortBy(parsed.sortBy);
        }
        if (typeof parsed.showCompleted === "boolean") setShowCompleted(parsed.showCompleted);
        if (typeof parsed.showInProgress === "boolean") setShowInProgress(parsed.showInProgress);
        if (typeof parsed.showPriority === "boolean") setShowPriority(parsed.showPriority);
        if (typeof parsed.showDueDate === "boolean") setShowDueDate(parsed.showDueDate);
        if (typeof parsed.showDragHandles === "boolean") setShowDragHandles(parsed.showDragHandles);
        if (typeof parsed.taskWidth === "number" && parsed.taskWidth >= 225 && parsed.taskWidth <= 600) {
          setTaskWidth(parsed.taskWidth);
        }
        if (typeof parsed.generalOrder === "number") setGeneralOrder(parsed.generalOrder);
      }
    } catch {
      // ignore storage errors
    } finally {
      setPersistReady(true);
    }
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const payload = { sortBy, showCompleted, showInProgress, showPriority, showDueDate, showDragHandles, taskWidth, generalOrder };
    try {
      localStorage.setItem("taskapp.tasks.filters", JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [persistReady, sortBy, showCompleted, showInProgress, showPriority, showDueDate, showDragHandles, taskWidth, generalOrder]);

  const sortTasks = (a: Task, b: Task) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sortBy === "alpha") return a.title.localeCompare(b.title);
    if (sortBy === "createdAt") return (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
    if (sortBy === "updatedAt") return (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0);
    if (sortBy === "priority") {
      const pOrder: Record<Quadrant, number> = { DO: 0, SCHEDULE: 1, DELEGATE: 2, DELETE: 3 };
      const diff = pOrder[getQuadrant(a)] - pOrder[getQuadrant(b)];
      if (diff !== 0) return diff;
    }
    const aDt = getTaskDateTime(a);
    const bDt = getTaskDateTime(b);
    if (aDt && bDt) return aDt.getTime() - bDt.getTime();
    if (aDt && !bDt) return -1;
    if (!aDt && bDt) return 1;
    return a.order - b.order;
  };

  const filterTask = (t: Task) => {
    if (t.completed && !showCompleted) return false;
    if (!t.completed && !showInProgress) return false;
    return true;
  };

  const ungrouped = tasks.filter((t) => !t.groupId && filterTask(t)).sort(sortTasks);
  const groupMap = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.groupId && filterTask(t)) {
      const arr = groupMap.get(t.groupId) || [];
      arr.push(t);
      groupMap.set(t.groupId, arr);
    }
  }
  for (const [groupId, arr] of groupMap.entries()) {
    groupMap.set(groupId, arr.sort(sortTasks));
  }

  const openEdit = (t: Task) => { setEditTask(t); setNewTaskGroupId(null); setTaskModal(true); };
  const openNewInGroup = (groupId: string | null) => { setEditTask(null); setNewTaskGroupId(groupId); setTaskModal(true); };

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

  const quadrantVariant = (t: Task) => getQuadrant(t).toLowerCase() as "do" | "schedule" | "delegate" | "delete";

  // Sortable groups list including General (id: null)
  const sortedGroups = [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Build ordered list for sidebar: General + all groups, sorted by their order
  const allGroupsForReorder: { id: string | null; name: string; color: string; order: number }[] = [
    { id: null, name: "General Tasks", color: "#64748b", order: generalOrder },
    ...sortedGroups.map((g) => ({ id: g.id, name: g.name, color: g.color || "#6366f1", order: g.order ?? 0 })),
  ].sort((a, b) => a.order - b.order);

  const cards: { id: string | null; name: string; color: string; tasks: Task[]; order: number }[] = [
    { id: null, name: "General Tasks", color: "#64748b", tasks: ungrouped, order: generalOrder },
    ...sortedGroups.map((g) => ({ id: g.id, name: g.name, color: g.color || "#6366f1", tasks: groupMap.get(g.id) || [], order: g.order ?? 0 })),
  ].sort((a, b) => a.order - b.order);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !user) return;

    // Handle group reorder in sidebar
    if (result.type === "GROUP_REORDER") {
      const sourceIndex = result.source.index;
      const destIndex = result.destination.index;
      if (sourceIndex === destIndex) return;

      // Create a copy of the ordered list
      const reorderedList = [...allGroupsForReorder];
      const [movedItem] = reorderedList.splice(sourceIndex, 1);
      reorderedList.splice(destIndex, 0, movedItem);

      // Update order values for all items
      reorderedList.forEach((item, index) => {
        if (item.id === null) {
          // Update General Tasks order in state (persisted to localStorage)
          setGeneralOrder(index);
        } else {
          // Update group order in Firestore
          updateGroup(user.uid, item.id, { order: index });
        }
      });
      return;
    }

    const destGroupId = result.destination.droppableId === "general" ? "" : result.destination.droppableId;
    const sourceGroupId = result.source.droppableId === "general" ? "" : result.source.droppableId;

    const task = tasks.find((t) => t.id === result.draggableId);
    if (!task) return;

    // Update groupId if moved between groups
    if (destGroupId !== sourceGroupId) {
      updateTask(user.uid, task.id, { groupId: destGroupId, order: result.destination.index });
    } else if (result.source.index !== result.destination.index) {
      updateTask(user.uid, task.id, { order: result.destination.index });
    }
  };

  return (
    <AppShell>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="h-full flex flex-col py-8 px-4 sm:px-6 md:py-12 md:px-12">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">All Tasks</h2>
              <Button size="sm" variant="ghost" onClick={() => { setEditGroup(null); setGroupModal(true); }}>
                <FolderPlus size={14} /> New list
              </Button>
              <Button size="sm" onClick={() => openNewInGroup(null)}>
                <Plus size={14} /> Add task
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
          </div>

          {/* Filters sidebar */}
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
                    <input type="radio" name="taskSortBy" checked={sortBy === value} onChange={() => setSortBy(value)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                    <span className="text-sm text-[var(--text-primary)]">{label}</span>
                  </label>
                ))}
              </div>
              {/* Display */}
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Display</p>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={showPriority} onChange={() => setShowPriority(!showPriority)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">Priority Badge</span>
                </label>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={showDueDate} onChange={() => setShowDueDate(!showDueDate)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">Due Date</span>
                </label>
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={showDragHandles} onChange={() => setShowDragHandles(!showDragHandles)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">Drag Handles</span>
                </label>
              </div>

              {/* Task Width Slider */}
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Task Width</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-tertiary)]">S</span>
                  <input
                    type="range"
                    min={225}
                    max={600}
                    step={25}
                    value={taskWidth}
                    onChange={(e) => setTaskWidth(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--border)] cursor-pointer accent-[var(--accent)]"
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)]">L</span>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1 text-center">{taskWidth}px</p>
              </div>

              {/* Group Order */}
              <div>
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setGroupOrderOpen(!groupOrderOpen)}
                >
                  {groupOrderOpen ? <ChevronDown size={12} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                  <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Group Order</p>
                </button>
                {groupOrderOpen && (
                  <div className="mt-2">
                    <Droppable droppableId="group-reorder" type="GROUP_REORDER">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] p-1 transition-colors ${snapshot.isDraggingOver ? "bg-[var(--accent-light)]" : ""}`}
                        >
                          {allGroupsForReorder.map((g, index) => (
                            <Draggable key={g.id ?? "general"} draggableId={g.id ?? "general-group"} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 transition-all ${snapshot.isDragging ? "bg-[var(--bg-card)] shadow-[var(--shadow-md)]" : "hover:bg-[var(--bg-hover)]"}`}
                                >
                                  <span className="text-[10px] font-medium text-[var(--text-tertiary)] w-4 text-center">{index + 1}</span>
                                  <div
                                    {...provided.dragHandleProps}
                                    className="flex items-center text-[var(--text-tertiary)] cursor-grab"
                                  >
                                    <GripVertical size={12} />
                                  </div>
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: g.color || "#6366f1" }}
                                  />
                                  <span className="text-xs text-[var(--text-primary)] truncate flex-1">{g.name}</span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}
              </div>
            </div>
          </div>
          {filterOpen && <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setFilterOpen(false)} />}

          {/* Cards grid */}
          <div className="flex-1 overflow-x-visible md:overflow-x-auto w-full">
            <div className="flex flex-col md:flex-row gap-5 pb-6 h-full">
              {cards.map((c) => {
                const droppableId = c.id ?? "general";
                return (
                  <div key={droppableId} className="w-full shrink-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]" style={{ width: `${taskWidth}px`, minWidth: `${taskWidth}px` }}>
                    {/* Card header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-light)]">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform"
                          style={{ backgroundColor: c.color }}
                          onClick={() => {
                            if (c.id) { const g = groups.find((g) => g.id === c.id); if (g) { setEditGroup(g); setGroupModal(true); } }
                          }}
                        />
                        <h3
                          className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent)] transition-colors"
                          onClick={() => {
                            if (c.id) { const g = groups.find((g) => g.id === c.id); if (g) { setEditGroup(g); setGroupModal(true); } }
                          }}
                        >
                          {c.name}
                        </h3>
                        {c.tasks.length > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg)] px-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                            {c.tasks.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                          onClick={() => openNewInGroup(c.id)}
                        >
                          <Plus size={15} />
                        </button>
                        {c.id && (
                          <button
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                            onClick={() => { const g = groups.find((g) => g.id === c.id); if (g) { setEditGroup(g); setGroupModal(true); } }}
                          >
                            <MoreVertical size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tasks - droppable */}
                    <Droppable droppableId={droppableId}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-4 min-h-[60px] flex-1 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? "bg-[var(--accent-light)]" : ""}`}
                        >
                          {c.tasks.length > 0 ? (
                            c.tasks.map((t, index) => (
                              <Draggable key={t.id} draggableId={t.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`group/row flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-5 py-4 transition-all duration-300 hover:bg-[var(--bg-hover)] ${snapshot.isDragging ? "shadow-[var(--shadow-lg)] bg-[var(--bg-card)] rotate-1" : ""}`}
                                    onClick={() => openEdit(t)}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className={`flex items-center text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab ${!showDragHandles ? "hidden" : ""}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical size={14} />
                                    </div>
                                    <button
                                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-light)]"
                                      onClick={(e) => { e.stopPropagation(); user && updateTask(user.uid, t.id, { completed: !t.completed }); }}
                                    >
                                      {t.completed && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <span className={t.completed ? "text-sm line-through text-[var(--text-tertiary)]" : "text-sm text-[var(--text-primary)]"}>
                                        {t.title}
                                      </span>
                                      {showDueDate && formatDueDateTime(t) && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <Calendar size={11} className="text-[var(--text-tertiary)]" />
                                          <span className="text-[11px] text-[var(--text-tertiary)]">{formatDueDateTime(t)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant={quadrantVariant(t)} className={`opacity-80 group-hover/row:opacity-100 ${!showPriority ? "hidden" : ""}`}>
                                      {getQuadrant(t)}
                                    </Badge>
                                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
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
                            ))
                          ) : !snapshot.isDraggingOver ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <p className="text-xs text-[var(--text-tertiary)]">No tasks yet</p>
                              <button
                                className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline"
                                onClick={() => openNewInGroup(c.id)}
                              >
                                Add a task
                              </button>
                            </div>
                          ) : null}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DragDropContext>

      <TaskModal open={taskModal} onOpenChange={setTaskModal} task={editTask} defaultGroupId={newTaskGroupId} />
      <GroupModal open={groupModal} onOpenChange={setGroupModal} group={editGroup} />
    </AppShell>
  );
}
