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
});
