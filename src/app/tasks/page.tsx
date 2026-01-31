"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { createTask, updateTask, deleteTask } from "@/lib/firestore";
import { TaskModal } from "@/components/TaskModal";
import { GroupModal } from "@/components/GroupModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getQuadrant } from "@/lib/types";
import type { Task, TaskGroup } from "@/lib/types";
import { Plus, MoreVertical, Calendar, FolderPlus, GripVertical } from "lucide-react";
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

  const sortByDateTime = (a: Task, b: Task) => {
    const aDt = getTaskDateTime(a);
    const bDt = getTaskDateTime(b);
    if (aDt && bDt) return aDt.getTime() - bDt.getTime();
    if (aDt && !bDt) return -1;
    if (!aDt && bDt) return 1;
    return a.order - b.order;
  };

  const ungrouped = tasks.filter((t) => !t.groupId).sort(sortByDateTime);
  const groupMap = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.groupId) {
      const arr = groupMap.get(t.groupId) || [];
      arr.push(t);
      groupMap.set(t.groupId, arr);
    }
  }
  for (const [groupId, arr] of groupMap.entries()) {
    groupMap.set(groupId, arr.sort(sortByDateTime));
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

  const cards: { id: string | null; name: string; tasks: Task[] }[] = [
    { id: null, name: "General Tasks", tasks: ungrouped },
    ...groups.map((g) => ({ id: g.id, name: g.name, tasks: groupMap.get(g.id) || [] })),
  ];

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !user) return;
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
        <div className="h-full flex flex-col py-12 px-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 w-full">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">All Tasks</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditGroup(null); setGroupModal(true); }}>
                <FolderPlus size={14} /> New list
              </Button>
              <Button size="sm" onClick={() => openNewInGroup(null)}>
                <Plus size={14} /> Add task
              </Button>
            </div>
          </div>

          {/* Cards grid */}
          <div className="flex-1 overflow-x-auto w-full">
            <div className="flex gap-5 pb-6 h-full">
              {cards.map((c) => {
                const droppableId = c.id ?? "general";
                return (
                  <div key={droppableId} className="w-[25rem] shrink-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
                    {/* Card header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-light)]">
                      <div className="flex items-center gap-2">
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
                                    className={`group/row flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-5 py-4 transition-colors hover:bg-[var(--bg-hover)] ${snapshot.isDragging ? "shadow-[var(--shadow-lg)] bg-[var(--bg-card)] rotate-1" : ""}`}
                                    onClick={() => openEdit(t)}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="flex items-center text-[var(--text-tertiary)] opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab"
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
                                      {formatDueDateTime(t) && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <Calendar size={11} className="text-[var(--text-tertiary)]" />
                                          <span className="text-[11px] text-[var(--text-tertiary)]">{formatDueDateTime(t)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant={quadrantVariant(t)} className="opacity-80 group-hover/row:opacity-100">
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
