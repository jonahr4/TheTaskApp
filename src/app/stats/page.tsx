"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { useStats } from "@/hooks/useStats";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Flame, Trophy, TrendingUp, CheckCircle2, Clock, Calendar, Target, Zap } from "lucide-react";

type StatsFilter = "active" | "completed" | "all";

export default function StatsPage() {
    const { user } = useAuth();
    const { tasks: allTasks, loading: tasksLoading } = useTasks(user?.uid);
    const { groups, loading: groupsLoading } = useTaskGroups(user?.uid);
    const [filter, setFilter] = useState<StatsFilter>("all");

    // Filter tasks based on selected filter
    const tasks = useMemo(() => {
        switch (filter) {
            case "active":
                return allTasks.filter((t) => !t.completed);
            case "completed":
                return allTasks.filter((t) => t.completed);
            case "all":
            default:
                return allTasks;
        }
    }, [allTasks, filter]);

    const {
        stackedData,
        quadrantStats,
        heatmapData,
        maxHeatmapCount,
        streakStats,
        quickStats,
        recentCompletions,
        groupColorMap,
    } = useStats(tasks, groups);

    const loading = tasksLoading || groupsLoading;

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    const formatAvgTime = (hours: number | null) => {
        if (hours === null) return "N/A";
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours < 24) return `${Math.round(hours)}h`;
        return `${Math.round(hours / 24)}d`;
    };

    const filterLabels: Record<StatsFilter, string> = {
        active: "Active",
        completed: "Completed",
        all: "All Time",
    };

    if (loading) {
        return (
            <AppShell>
                <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                        <span className="text-sm text-[var(--text-tertiary)]">Loading stats...</span>
                    </div>
                </div>
            </AppShell>
        );
    }

    if (allTasks.length === 0) {
        return (
            <AppShell>
                <div className="flex h-full flex-col items-center justify-center py-20">
                    <div className="rounded-full bg-[var(--accent-light)] p-6 mb-6">
                        <Target size={48} className="text-[var(--accent)]" />
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No stats yet</h2>
                    <p className="text-sm text-[var(--text-secondary)] max-w-sm text-center">
                        Create some tasks and complete them to see your productivity insights here.
                    </p>
                </div>
            </AppShell>
        );
    }

    const groupIds = Object.keys(groupColorMap);

    return (
        <AppShell>
            <div className="py-8 px-4 sm:px-6 md:py-12 md:px-12 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Your Stats</h1>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {filter === "all"
                                ? "Insights into all your tasks"
                                : filter === "active"
                                    ? "Insights into your active tasks"
                                    : "Insights into your completed tasks"}
                        </p>
                    </div>
                    {/* Filter Toggle */}
                    <div className="flex items-center rounded-[var(--radius-full)] bg-[var(--bg)] p-1 shadow-[var(--shadow-sm)] border border-[var(--border-light)]">
                        {(["active", "completed", "all"] as StatsFilter[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-[var(--radius-full)] transition-all duration-150 ${filter === f
                                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    }`}
                            >
                                {filterLabels[f]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filtered Empty State */}
                {tasks.length === 0 && allTasks.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-16 mb-8 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)]">
                        <div className="rounded-full bg-[var(--accent-light)] p-4 mb-4">
                            {filter === "active" ? (
                                <CheckCircle2 size={32} className="text-[var(--accent)]" />
                            ) : (
                                <Target size={32} className="text-[var(--accent)]" />
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                            {filter === "active" ? "All caught up!" : "No completed tasks yet"}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs">
                            {filter === "active"
                                ? "You have no active tasks. Great job completing everything!"
                                : "Start completing tasks to see your achievements here."}
                        </p>
                        <button
                            onClick={() => setFilter("all")}
                            className="mt-4 text-sm font-medium text-[var(--accent)] hover:underline"
                        >
                            View all stats
                        </button>
                    </div>
                )}

                {tasks.length > 0 && (
                    <>
                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                            <StatCard
                                icon={<CheckCircle2 size={20} />}
                                label="Completed"
                                value={quickStats.completedTasks}
                                subValue={`of ${quickStats.totalTasks} tasks`}
                                color="text-green-500"
                                bgColor="bg-green-500/10"
                            />
                            <StatCard
                                icon={<TrendingUp size={20} />}
                                label="Completion Rate"
                                value={`${Math.round(quickStats.completionRate)}%`}
                                subValue={`${quickStats.tasksCompletedThisWeek} this week`}
                                color="text-blue-500"
                                bgColor="bg-blue-500/10"
                            />
                            <StatCard
                                icon={<Flame size={20} />}
                                label="Current Streak"
                                value={`${streakStats.current}`}
                                subValue={`Best: ${streakStats.longest} days`}
                                color="text-orange-500"
                                bgColor="bg-orange-500/10"
                            />
                            <StatCard
                                icon={<Clock size={20} />}
                                label="Avg. Time"
                                value={formatAvgTime(quickStats.avgCompletionTime)}
                                subValue="to complete"
                                color="text-purple-500"
                                bgColor="bg-purple-500/10"
                            />
                        </div>

                        {/* Main Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            {/* Tasks Over Time - Takes 2 columns */}
                            <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)]">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Tasks Created Over Time</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mb-4">Last 30 days, by list</p>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stackedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis
                                                dataKey="displayDate"
                                                tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                                                tickLine={false}
                                                axisLine={false}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                                                tickLine={false}
                                                axisLine={false}
                                                allowDecimals={false}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "var(--bg-card)",
                                                    border: "1px solid var(--border-light)",
                                                    borderRadius: "var(--radius-md)",
                                                    fontSize: "12px",
                                                }}
                                            />
                                            {groupIds.map((gid) => (
                                                <Area
                                                    key={gid}
                                                    type="monotone"
                                                    dataKey={gid}
                                                    stackId="1"
                                                    stroke={groupColorMap[gid]?.color || "#64748b"}
                                                    fill={groupColorMap[gid]?.color || "#64748b"}
                                                    fillOpacity={0.6}
                                                    name={groupColorMap[gid]?.name || "General"}
                                                />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Quadrant Distribution */}
                            <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)]">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Priority Matrix</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mb-4">Active tasks by quadrant</p>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={quadrantStats.filter((q) => q.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={70}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {quadrantStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "var(--bg-card)",
                                                    border: "1px solid var(--border-light)",
                                                    borderRadius: "var(--radius-md)",
                                                    fontSize: "12px",
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {quadrantStats.map((q) => (
                                        <div key={q.name} className="flex items-center gap-2 text-xs">
                                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                                            <span className="text-[var(--text-secondary)] truncate">{q.name}</span>
                                            <span className="ml-auto font-medium text-[var(--text-primary)]">{q.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Productivity Heatmap */}
                            <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)]">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Productivity Heatmap</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mb-4">When you complete tasks</p>
                                <div className="overflow-x-auto">
                                    <div className="min-w-[500px]">
                                        {/* Hour labels */}
                                        <div className="flex mb-1 ml-10">
                                            {[0, 6, 12, 18, 23].map((h) => (
                                                <div
                                                    key={h}
                                                    className="text-[10px] text-[var(--text-tertiary)]"
                                                    style={{ width: h === 23 ? "auto" : "25%", textAlign: h === 23 ? "right" : "left" }}
                                                >
                                                    {h === 0 ? "12am" : h === 6 ? "6am" : h === 12 ? "12pm" : h === 18 ? "6pm" : "11pm"}
                                                </div>
                                            ))}
                                        </div>
                                        {/* Grid rows */}
                                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dayIdx) => (
                                            <div key={day} className="flex items-center gap-1 mb-1">
                                                <span className="w-9 text-[10px] text-[var(--text-tertiary)] shrink-0">{day}</span>
                                                <div className="flex gap-[2px] flex-1">
                                                    {Array.from({ length: 24 }, (_, hour) => {
                                                        const cell = heatmapData.find((c) => c.day === dayIdx && c.hour === hour);
                                                        const count = cell?.count || 0;
                                                        const intensity = maxHeatmapCount > 0 ? count / maxHeatmapCount : 0;
                                                        return (
                                                            <div
                                                                key={hour}
                                                                className="flex-1 aspect-square rounded-sm transition-colors"
                                                                style={{
                                                                    backgroundColor:
                                                                        count === 0
                                                                            ? "var(--bg)"
                                                                            : `rgba(79, 70, 229, ${0.2 + intensity * 0.8})`,
                                                                }}
                                                                title={`${day} ${hour}:00 - ${count} task${count !== 1 ? "s" : ""}`}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-3">
                                    <span className="text-[10px] text-[var(--text-tertiary)]">Less</span>
                                    <div className="flex gap-[2px]">
                                        {[0, 0.25, 0.5, 0.75, 1].map((i) => (
                                            <div
                                                key={i}
                                                className="w-3 h-3 rounded-sm"
                                                style={{
                                                    backgroundColor: i === 0 ? "var(--bg)" : `rgba(79, 70, 229, ${0.2 + i * 0.8})`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-[var(--text-tertiary)]">More</span>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)]">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Recent Completions</h3>
                                <p className="text-xs text-[var(--text-tertiary)] mb-4">Your latest achievements</p>
                                {recentCompletions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <Zap size={24} className="text-[var(--text-tertiary)] mb-2" />
                                        <p className="text-xs text-[var(--text-tertiary)]">Complete tasks to see them here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentCompletions.map((c) => (
                                            <div key={c.id} className="flex items-start gap-3 group">
                                                <div
                                                    className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: c.group.color }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-[var(--text-primary)] truncate">{c.title}</p>
                                                    <p className="text-[10px] text-[var(--text-tertiary)]">
                                                        {formatTimeAgo(c.completedAt)} · {c.group.name}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extra Insights Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                            <InsightCard
                                icon={<Calendar size={18} />}
                                label="Most Productive Day"
                                value={quickStats.mostProductiveDay}
                                color="text-indigo-500"
                            />
                            <InsightCard
                                icon={<Target size={18} />}
                                label="Most Used List"
                                value={quickStats.mostUsedGroup?.name || "General"}
                                valueColor={quickStats.mostUsedGroup?.color}
                                color="text-pink-500"
                            />
                            <InsightCard
                                icon={<Trophy size={18} />}
                                label="Tasks This Week"
                                value={`${quickStats.tasksThisWeek}`}
                                color="text-amber-500"
                            />
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
}

function StatCard({
    icon,
    label,
    value,
    subValue,
    color,
    bgColor,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subValue: string;
    color: string;
    bgColor: string;
}) {
    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
            <div className={`inline-flex items-center justify-center rounded-[var(--radius-md)] p-2 ${bgColor} ${color} mb-3`}>
                {icon}
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] mb-0.5">{value}</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">{label}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">{subValue}</p>
        </div>
    );
}

function InsightCard({
    icon,
    label,
    value,
    color,
    valueColor,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
            <div className={`${color}`}>{icon}</div>
            <div>
                <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</p>
                <p
                    className="text-sm font-semibold"
                    style={{ color: valueColor || "var(--text-primary)" }}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}
