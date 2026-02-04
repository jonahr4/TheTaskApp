"use client";

import { useMemo } from "react";
import type { Task, TaskGroup } from "@/lib/types";
import { getQuadrant } from "@/lib/types";

export type DailyStats = {
    date: string;
    created: number;
    completed: number;
    byGroup: Record<string, number>;
};

export type QuadrantStats = {
    name: string;
    value: number;
    color: string;
};

export type HeatmapCell = {
    day: number; // 0-6 (Sun-Sat)
    hour: number; // 0-23
    count: number;
};

export type StreakStats = {
    current: number;
    longest: number;
    lastActiveDate: string | null;
};

export type QuickStats = {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgTasksPerDay: number;
    mostProductiveDay: string;
    mostUsedGroup: { name: string; color: string; count: number } | null;
    avgCompletionTime: number | null; // in hours
    tasksThisWeek: number;
    tasksCompletedThisWeek: number;
};

const QUADRANT_COLORS: Record<string, string> = {
    DO: "#ef4444",
    SCHEDULE: "#3b82f6",
    DELEGATE: "#f59e0b",
    DELETE: "#6b7280",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useStats(tasks: Task[], groups: TaskGroup[]) {
    const groupColorMap = useMemo(() => {
        const map: Record<string, { name: string; color: string }> = {
            "": { name: "General", color: "#64748b" },
        };
        groups.forEach((g) => {
            map[g.id] = { name: g.name, color: g.color || "#6366f1" };
        });
        return map;
    }, [groups]);

    // Time series data for last 30 days
    const dailyStats = useMemo(() => {
        const now = new Date();
        const days: DailyStats[] = [];

        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            days.push({ date: dateStr, created: 0, completed: 0, byGroup: {} });
        }

        const dateMap = new Map(days.map((d) => [d.date, d]));

        tasks.forEach((t) => {
            // Created date
            if (t.createdAt) {
                const createdDate = t.createdAt.toDate().toISOString().split("T")[0];
                const day = dateMap.get(createdDate);
                if (day) {
                    day.created++;
                    const groupId = t.groupId || "";
                    day.byGroup[groupId] = (day.byGroup[groupId] || 0) + 1;
                }
            }
            // Completed date (use updatedAt if completed)
            if (t.completed && t.updatedAt) {
                const completedDate = t.updatedAt.toDate().toISOString().split("T")[0];
                const day = dateMap.get(completedDate);
                if (day) day.completed++;
            }
        });

        return days;
    }, [tasks]);

    // For stacked area chart: transform by group
    const stackedData = useMemo(() => {
        return dailyStats.map((d) => {
            const row: Record<string, number | string> = {
                date: d.date,
                displayDate: new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            };
            Object.keys(groupColorMap).forEach((gid) => {
                row[gid] = d.byGroup[gid] || 0;
            });
            return row;
        });
    }, [dailyStats, groupColorMap]);

    // Quadrant distribution
    const quadrantStats = useMemo((): QuadrantStats[] => {
        const counts: Record<string, number> = { DO: 0, SCHEDULE: 0, DELEGATE: 0, DELETE: 0 };
        tasks.filter((t) => !t.completed).forEach((t) => {
            counts[getQuadrant(t)]++;
        });
        return [
            { name: "Do First", value: counts.DO, color: QUADRANT_COLORS.DO },
            { name: "Schedule", value: counts.SCHEDULE, color: QUADRANT_COLORS.SCHEDULE },
            { name: "Delegate", value: counts.DELEGATE, color: QUADRANT_COLORS.DELEGATE },
            { name: "Eliminate", value: counts.DELETE, color: QUADRANT_COLORS.DELETE },
        ];
    }, [tasks]);

    // Productivity heatmap
    const heatmapData = useMemo((): HeatmapCell[] => {
        const grid: number[][] = Array(7)
            .fill(null)
            .map(() => Array(24).fill(0));

        tasks.forEach((t) => {
            if (t.completed && t.updatedAt) {
                const d = t.updatedAt.toDate();
                grid[d.getDay()][d.getHours()]++;
            }
        });

        const cells: HeatmapCell[] = [];
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                cells.push({ day, hour, count: grid[day][hour] });
            }
        }
        return cells;
    }, [tasks]);

    const maxHeatmapCount = useMemo(() => {
        return Math.max(1, ...heatmapData.map((c) => c.count));
    }, [heatmapData]);

    // Streak calculations
    const streakStats = useMemo((): StreakStats => {
        const completedDates = new Set<string>();
        tasks.forEach((t) => {
            if (t.completed && t.updatedAt) {
                completedDates.add(t.updatedAt.toDate().toISOString().split("T")[0]);
            }
        });

        const sortedDates = Array.from(completedDates).sort().reverse();
        if (sortedDates.length === 0) {
            return { current: 0, longest: 0, lastActiveDate: null };
        }

        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        let current = 0;
        let longest = 0;
        let tempStreak = 0;
        let lastDate: Date | null = null;

        // Calculate streaks
        sortedDates.forEach((dateStr) => {
            const d = new Date(dateStr + "T12:00:00");
            if (!lastDate) {
                tempStreak = 1;
            } else {
                const diff = (lastDate.getTime() - d.getTime()) / 86400000;
                if (Math.abs(diff - 1) < 0.1) {
                    tempStreak++;
                } else {
                    longest = Math.max(longest, tempStreak);
                    tempStreak = 1;
                }
            }
            lastDate = d;
        });
        longest = Math.max(longest, tempStreak);

        // Current streak (from today or yesterday backwards)
        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
            current = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const prevD = new Date(sortedDates[i - 1] + "T12:00:00");
                const currD = new Date(sortedDates[i] + "T12:00:00");
                const diff = (prevD.getTime() - currD.getTime()) / 86400000;
                if (Math.abs(diff - 1) < 0.1) {
                    current++;
                } else {
                    break;
                }
            }
        }

        return { current, longest, lastActiveDate: sortedDates[0] || null };
    }, [tasks]);

    // Quick stats
    const quickStats = useMemo((): QuickStats => {
        const completed = tasks.filter((t) => t.completed);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const weekAgoStr = weekAgo.toISOString().split("T")[0];

        const tasksThisWeek = tasks.filter(
            (t) => t.createdAt && t.createdAt.toDate().toISOString().split("T")[0] >= weekAgoStr
        ).length;

        const tasksCompletedThisWeek = completed.filter(
            (t) => t.updatedAt && t.updatedAt.toDate().toISOString().split("T")[0] >= weekAgoStr
        ).length;

        // Most productive day
        const dayCount: Record<number, number> = {};
        completed.forEach((t) => {
            if (t.updatedAt) {
                const day = t.updatedAt.toDate().getDay();
                dayCount[day] = (dayCount[day] || 0) + 1;
            }
        });
        const topDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
        const mostProductiveDay = topDay ? DAY_NAMES[parseInt(topDay[0])] : "N/A";

        // Most used group
        const groupCount: Record<string, number> = {};
        tasks.forEach((t) => {
            const gid = t.groupId || "";
            groupCount[gid] = (groupCount[gid] || 0) + 1;
        });
        const topGroupEntry = Object.entries(groupCount).sort((a, b) => b[1] - a[1])[0];
        const mostUsedGroup = topGroupEntry
            ? {
                name: groupColorMap[topGroupEntry[0]]?.name || "General",
                color: groupColorMap[topGroupEntry[0]]?.color || "#64748b",
                count: topGroupEntry[1],
            }
            : null;

        // Average completion time
        let totalTime = 0;
        let timeCount = 0;
        completed.forEach((t) => {
            if (t.createdAt && t.updatedAt) {
                const diff = t.updatedAt.toMillis() - t.createdAt.toMillis();
                if (diff > 0) {
                    totalTime += diff;
                    timeCount++;
                }
            }
        });
        const avgCompletionTime = timeCount > 0 ? totalTime / timeCount / (1000 * 60 * 60) : null;

        // Average tasks per day (over last 30 days)
        const daysWithTasks = new Set<string>();
        tasks.forEach((t) => {
            if (t.createdAt) {
                daysWithTasks.add(t.createdAt.toDate().toISOString().split("T")[0]);
            }
        });
        const avgTasksPerDay = daysWithTasks.size > 0 ? tasks.length / Math.min(30, daysWithTasks.size) : 0;

        return {
            totalTasks: tasks.length,
            completedTasks: completed.length,
            completionRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0,
            avgTasksPerDay: Math.round(avgTasksPerDay * 10) / 10,
            mostProductiveDay,
            mostUsedGroup,
            avgCompletionTime: avgCompletionTime ? Math.round(avgCompletionTime * 10) / 10 : null,
            tasksThisWeek,
            tasksCompletedThisWeek,
        };
    }, [tasks, groupColorMap]);

    // Recent completions
    const recentCompletions = useMemo(() => {
        return tasks
            .filter((t) => t.completed && t.updatedAt)
            .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
            .slice(0, 8)
            .map((t) => ({
                id: t.id,
                title: t.title,
                completedAt: t.updatedAt!.toDate(),
                group: groupColorMap[t.groupId || ""] || { name: "General", color: "#64748b" },
            }));
    }, [tasks, groupColorMap]);

    return {
        dailyStats,
        stackedData,
        quadrantStats,
        heatmapData,
        maxHeatmapCount,
        streakStats,
        quickStats,
        recentCompletions,
        groupColorMap,
    };
}
