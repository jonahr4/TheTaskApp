import type { Task, TaskGroup } from "@/lib/types";

/**
 * Creates a fake Firestore Timestamp for testing.
 */
export function fakeTimestamp(date: Date = new Date()) {
    return {
        toDate: () => date,
        toMillis: () => date.getTime(),
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
    } as unknown as Task["createdAt"];
}

/**
 * Factory for creating a Task with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
export function mockTask(overrides: Partial<Task> = {}): Task {
    const now = new Date();
    return {
        id: "task-1",
        title: "Test Task",
        notes: "",
        urgent: false,
        important: false,
        reminder: false,
        dueDate: null,
        dueTime: null,
        groupId: null,
        autoUrgentDays: null,
        completed: false,
        order: 0,
        createdAt: fakeTimestamp(now),
        updatedAt: fakeTimestamp(now),
        ...overrides,
    };
}

/**
 * Factory for creating a TaskGroup with sensible defaults.
 */
export function mockGroup(overrides: Partial<TaskGroup> = {}): TaskGroup {
    return {
        id: "group-1",
        name: "Work",
        color: "#6366f1",
        order: 0,
        createdAt: fakeTimestamp(new Date()),
        ...overrides,
    };
}
