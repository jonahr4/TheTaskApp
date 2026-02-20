jest.mock("@/lib/types", () => {
    const actual = jest.requireActual("@/lib/types");
    return actual;
});

import { renderHook } from "@testing-library/react";
import { useStats } from "@/hooks/useStats";
import { mockTask, mockGroup, fakeTimestamp } from "../helpers/mockTask";

describe("useStats", () => {
    const groups = [
        mockGroup({ id: "g1", name: "Work", color: "#6366f1" }),
        mockGroup({ id: "g2", name: "Personal", color: "#10b981" }),
    ];

    describe("quadrantStats", () => {
        it("counts incomplete tasks by quadrant", () => {
            const tasks = [
                mockTask({ id: "1", urgent: true, important: true, completed: false }),
                mockTask({ id: "2", urgent: true, important: true, completed: false }),
                mockTask({ id: "3", urgent: false, important: true, completed: false }),
                mockTask({ id: "4", urgent: true, important: false, completed: false }),
                mockTask({ id: "5", urgent: false, important: false, completed: false }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            const qs = result.current.quadrantStats;

            expect(qs.find((q) => q.name === "Do First")?.value).toBe(2);
            expect(qs.find((q) => q.name === "Schedule")?.value).toBe(1);
            expect(qs.find((q) => q.name === "Delegate")?.value).toBe(1);
            expect(qs.find((q) => q.name === "Eliminate")?.value).toBe(1);
        });

        it("excludes completed tasks from quadrant counts", () => {
            const tasks = [
                mockTask({ id: "1", urgent: true, important: true, completed: true }),
                mockTask({ id: "2", urgent: true, important: true, completed: false }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            const doFirst = result.current.quadrantStats.find(
                (q) => q.name === "Do First"
            );
            expect(doFirst?.value).toBe(1);
        });

        it("handles tasks with null priority", () => {
            const tasks = [
                mockTask({ id: "1", urgent: null, important: null, completed: false }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            const total = result.current.quadrantStats.reduce(
                (sum, q) => sum + q.value,
                0
            );
            expect(total).toBe(0);
        });
    });

    describe("quickStats", () => {
        it("calculates completion rate correctly", () => {
            const tasks = [
                mockTask({ id: "1", completed: true }),
                mockTask({ id: "2", completed: true }),
                mockTask({ id: "3", completed: false }),
                mockTask({ id: "4", completed: false }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            expect(result.current.quickStats.completionRate).toBe(50);
        });

        it("returns 0 completion rate for empty tasks", () => {
            const { result } = renderHook(() => useStats([], groups));
            expect(result.current.quickStats.completionRate).toBe(0);
        });

        it("counts total and completed tasks", () => {
            const tasks = [
                mockTask({ id: "1", completed: true }),
                mockTask({ id: "2", completed: false }),
                mockTask({ id: "3", completed: false }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            expect(result.current.quickStats.totalTasks).toBe(3);
            expect(result.current.quickStats.completedTasks).toBe(1);
        });
    });

    describe("streakStats", () => {
        it("returns zeros for empty tasks", () => {
            const { result } = renderHook(() => useStats([], groups));
            expect(result.current.streakStats.current).toBe(0);
            expect(result.current.streakStats.longest).toBe(0);
            expect(result.current.streakStats.lastActiveDate).toBeNull();
        });

        it("returns correct longest streak for consecutive completions", () => {
            const tasks = [
                mockTask({
                    id: "1",
                    completed: true,
                    updatedAt: fakeTimestamp(new Date("2026-02-15T10:00:00")),
                }),
                mockTask({
                    id: "2",
                    completed: true,
                    updatedAt: fakeTimestamp(new Date("2026-02-16T10:00:00")),
                }),
                mockTask({
                    id: "3",
                    completed: true,
                    updatedAt: fakeTimestamp(new Date("2026-02-17T10:00:00")),
                }),
            ];

            const { result } = renderHook(() => useStats(tasks, groups));
            expect(result.current.streakStats.longest).toBeGreaterThanOrEqual(3);
        });
    });

    describe("groupColorMap", () => {
        it("maps groups by id and includes General default", () => {
            const { result } = renderHook(() => useStats([], groups));
            const map = result.current.groupColorMap;

            expect(map[""]).toEqual({ name: "General", color: "#64748b" });
            expect(map["g1"]).toEqual({ name: "Work", color: "#6366f1" });
            expect(map["g2"]).toEqual({ name: "Personal", color: "#10b981" });
        });
    });
});
