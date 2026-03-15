"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { updateTask, updateGroup } from "@/lib/firestore";
import { Badge } from "@/components/ui/badge";
import { getQuadrant } from "@/lib/types";
import type { Task, TaskGroup, Quadrant } from "@/lib/types";
import { ArchiveRestore, Calendar } from "lucide-react";

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

export default function ArchivesPage() {
    const { user } = useAuth();
    // Fetch everything initially, then we manually filter in the component
    const { tasks: allTasks } = useTasks(user?.uid, true);
    const { groups: allGroups } = useTaskGroups(user?.uid, true);

    const tasks = allTasks.filter((t) => t.archived);
    const archivedGroups = allGroups.filter((g) => g.archived);
    // Unarchived groups that contain archived tasks
    const unarchivedGroups = allGroups.filter((g) => !g.archived);

    // Group our archived tasks
    const ungrouped = tasks.filter((t) => !t.groupId);
    const groupMap = new Map<string, Task[]>();
    for (const t of tasks) {
        if (t.groupId) {
            const arr = groupMap.get(t.groupId) || [];
            arr.push(t);
            groupMap.set(t.groupId, arr);
        }
    }

    const quadrantVariant = (t: Task) => {
        const q = getQuadrant(t);
        return q ? q.toLowerCase() as "do" | "schedule" | "delegate" | "delete" : null;
    };

    const tasksForArchivedGroups = archivedGroups.map(g => ({
        group: g,
        tasks: groupMap.get(g.id) || []
    }));

    const tasksForUnarchivedGroups = unarchivedGroups.map(g => ({
        group: g,
        tasks: groupMap.get(g.id) || []
    })).filter(g => g.tasks.length > 0);

    const cards = [
        { id: null, name: "General Tasks", isGroupArchived: false, color: "#64748b", tasks: ungrouped },
        ...tasksForArchivedGroups.map(item => ({
            id: item.group.id,
            name: item.group.name,
            color: item.group.color || "#6366f1",
            isGroupArchived: true,
            tasks: item.tasks,
        })),
        ...tasksForUnarchivedGroups.map(item => ({
            id: item.group.id,
            name: item.group.name,
            color: item.group.color || "#6366f1",
            isGroupArchived: false,
            tasks: item.tasks,
        }))
    ];

    const handleUnarchiveGroup = async (groupId: string) => {
        if (!user) return;
        await updateGroup(user.uid, groupId, { archived: false });
    };

    const handleUnarchiveTask = async (taskId: string) => {
        if (!user) return;
        await updateTask(user.uid, taskId, { archived: false });
    };

    return (
        <AppShell>
            <div className="h-full flex flex-col py-8 px-4 sm:px-6 md:py-12 md:px-12">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 w-full">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Archives</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-x-visible md:overflow-x-auto w-full">
                    <div className="flex flex-col md:flex-row gap-5 pb-6 h-full">
                        {cards.map((c) => {
                            if (c.tasks.length === 0 && !c.isGroupArchived && c.id === null) return null;

                            return (
                                <div key={c.id ?? "general"} className="w-full shrink-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] opacity-60 grayscale-[0.2]" style={{ width: `400px`, minWidth: `400px` }}>
                                    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-light)]">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-3 w-3 rounded-full shrink-0"
                                                style={{ backgroundColor: c.color }}
                                            />
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                                                {c.name}
                                            </h3>
                                            {c.tasks.length > 0 && (
                                                <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg)] px-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                                                    {c.tasks.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            {c.isGroupArchived && c.id && (
                                                <button
                                                    className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                                                    onClick={() => handleUnarchiveGroup(c.id!)}
                                                    title="Unarchive Group"
                                                >
                                                    <ArchiveRestore size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 min-h-[60px] flex-1 overflow-y-auto transition-colors">
                                        {c.tasks.length > 0 ? (
                                            c.tasks.map((t) => (
                                                <div
                                                    key={t.id}
                                                    className="group/row flex items-center gap-3 rounded-[var(--radius-md)] px-5 py-4 transition-all duration-300 hover:bg-[var(--bg-hover)]"
                                                >
                                                    <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)]">
                                                        {t.completed && <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />}
                                                    </div>
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
                                                    {getQuadrant(t) && (
                                                        <Badge variant={quadrantVariant(t)!} className="opacity-80">
                                                            {getQuadrant(t)}
                                                        </Badge>
                                                    )}
                                                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex gap-2">
                                                        <button
                                                            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                                                            onClick={() => handleUnarchiveTask(t.id)}
                                                            title="Unarchive Task"
                                                        >
                                                            <ArchiveRestore size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                                <p className="text-xs text-[var(--text-tertiary)]">No archived tasks in this list</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
