jest.mock("@/lib/firestore", () => ({
    updateTask: jest.fn(() => Promise.resolve()),
}));

import { updateTask } from "@/lib/firestore";
import { renderHook } from "@testing-library/react";
import { useAutoUrgent } from "@/hooks/useAutoUrgent";
import { mockTask, fakeTimestamp } from "../helpers/mockTask";

describe("useAutoUrgent", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("marks a task urgent when the trigger date has passed", () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);

        const tasks = [
            mockTask({
                id: "t1",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        // Trigger date is Feb 20 - 3 days = Feb 17, today is Feb 19, so it should fire
        expect(updateTask).toHaveBeenCalledWith("user-1", "t1", { urgent: true });
    });

    it("does NOT mark urgent when trigger date is in the future", () => {
        const today = new Date("2026-02-10T12:00:00");
        jest.setSystemTime(today);

        const tasks = [
            mockTask({
                id: "t2",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-05")),
                updatedAt: fakeTimestamp(new Date("2026-02-05")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        // Trigger date is Feb 17, today is Feb 10, should NOT fire
        expect(updateTask).not.toHaveBeenCalled();
    });

    it("skips completed tasks", () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);

        const tasks = [
            mockTask({
                id: "t3",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: true,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        expect(updateTask).not.toHaveBeenCalled();
    });

    it("skips tasks already marked urgent", () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);

        const tasks = [
            mockTask({
                id: "t4",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: true,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        expect(updateTask).not.toHaveBeenCalled();
    });

    it("does nothing when uid is undefined", () => {
        const tasks = [
            mockTask({
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
            }),
        ];

        renderHook(() => useAutoUrgent(undefined, tasks));

        expect(updateTask).not.toHaveBeenCalled();
    });

    it("logs an error instead of failing silently when the write is rejected", async () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);
        const writeError = new Error("permission-denied");
        (updateTask as jest.Mock).mockRejectedValueOnce(writeError);
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const tasks = [
            mockTask({
                id: "t6",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        // Flush the async check() so the rejected write settles
        await Promise.resolve();
        await Promise.resolve();

        expect(updateTask).toHaveBeenCalledWith("user-1", "t6", { urgent: true });
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("[auto-urgent] failed to mark task t6 urgent:"),
            writeError
        );

        consoleSpy.mockRestore();
    });

    it("warns and skips tasks with an invalid dueDate", async () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        const tasks = [
            mockTask({
                id: "t7",
                dueDate: "not-a-date",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        renderHook(() => useAutoUrgent("user-1", tasks));

        await Promise.resolve();
        await Promise.resolve();

        expect(updateTask).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[auto-urgent] skipping task t7: invalid dueDate "not-a-date"')
        );

        warnSpy.mockRestore();
    });

    it("the repeating check uses the latest tasks, not the ones from mount", async () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);

        const initialTasks = [
            mockTask({
                id: "t8",
                dueDate: "2026-03-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];

        const { rerender } = renderHook(({ tasks }) => useAutoUrgent("user-1", tasks), {
            initialProps: { tasks: initialTasks },
        });

        // Mount-time check: trigger date (Mar 17) is in the future, no write
        await Promise.resolve();
        expect(updateTask).not.toHaveBeenCalled();

        // Tasks update (e.g. user edits the due date closer); the 5-minute
        // interval must see the new tasks without a remount.
        const updatedTasks = [
            mockTask({
                id: "t8",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];
        rerender({ tasks: updatedTasks });

        jest.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
        await Promise.resolve();

        expect(updateTask).toHaveBeenCalledWith("user-1", "t8", { urgent: true });
    });

    it("checks immediately when tasks change, without waiting for the interval", async () => {
        const today = new Date("2026-02-19T12:00:00");
        jest.setSystemTime(today);

        // Mount with no eligible tasks (e.g. Firestore snapshot not yet loaded).
        const { rerender } = renderHook(({ tasks }) => useAutoUrgent("user-1", tasks), {
            initialProps: { tasks: [] as ReturnType<typeof mockTask>[] },
        });
        await Promise.resolve();
        expect(updateTask).not.toHaveBeenCalled();

        // A newly eligible task arrives; it must be checked right away,
        // not up to 5 minutes later when the interval fires.
        const eligible = [
            mockTask({
                id: "t9",
                dueDate: "2026-02-20",
                autoUrgentDays: 3,
                urgent: false,
                completed: false,
                createdAt: fakeTimestamp(new Date("2026-02-10")),
                updatedAt: fakeTimestamp(new Date("2026-02-10")),
            }),
        ];
        rerender({ tasks: eligible });
        await Promise.resolve();
        await Promise.resolve();

        // No timer advanced: this only passes if the effect re-ran on the
        // tasks change instead of waiting for the 5-minute interval.
        expect(updateTask).toHaveBeenCalledWith("user-1", "t9", { urgent: true });
    });
});
