jest.mock("next/server", () => ({
    NextResponse: {
        json: jest.fn((data: unknown, init?: { status?: number }) => ({ data, status: init?.status ?? 200 })),
    },
}));

import {
    firstJsonObject,
    normalizeTask,
    normalizeResult,
} from "@/app/api/ai/parse/route";

describe("firstJsonObject", () => {
    it("extracts JSON from mixed text", () => {
        const text = 'Here is the result: {"tasks": []} some trailing text';
        expect(firstJsonObject(text)).toBe('{"tasks": []}');
    });

    it("returns null when no braces found", () => {
        expect(firstJsonObject("no json here")).toBeNull();
    });

    it("returns null for closing brace before opening brace", () => {
        expect(firstJsonObject("} before {")).toBeNull();
    });

    it("handles nested braces", () => {
        const text = '{"tasks": [{"title": "Test"}]}';
        expect(firstJsonObject(text)).toBe('{"tasks": [{"title": "Test"}]}');
    });

    it("returns null for empty string", () => {
        expect(firstJsonObject("")).toBeNull();
    });
});

describe("normalizeTask", () => {
    it("returns defaults for empty object", () => {
        const task = normalizeTask({});
        expect(task.title).toBe("");
        expect(task.notes).toBe("");
        expect(task.dueDate).toBeNull();
        expect(task.dueTime).toBeNull();
        expect(task.priority).toBe("DO");
        expect(task.group).toBeNull();
        expect(task.timeSource).toBe("none");
    });

    it("preserves valid fields", () => {
        const task = normalizeTask({
            title: "  Buy groceries  ",
            notes: "milk, eggs",
            dueDate: "2026-02-20",
            dueTime: "14:30",
            priority: "SCHEDULE",
            group: "Personal",
            timeSource: "explicit",
        });

        expect(task.title).toBe("Buy groceries");
        expect(task.notes).toBe("milk, eggs");
        expect(task.dueDate).toBe("2026-02-20");
        expect(task.dueTime).toBe("14:30");
        expect(task.priority).toBe("SCHEDULE");
        expect(task.group).toBe("Personal");
        expect(task.timeSource).toBe("explicit");
    });

    it("rejects invalid date format", () => {
        const task = normalizeTask({ dueDate: "Feb 20" });
        expect(task.dueDate).toBeNull();
    });

    it("rejects invalid time format", () => {
        const task = normalizeTask({ dueDate: "2026-02-20", dueTime: "2pm" });
        expect(task.dueTime).toBeNull();
    });

    it("nullifies dueTime when dueDate is null", () => {
        const task = normalizeTask({ dueTime: "14:30" });
        expect(task.dueTime).toBeNull();
    });

    it("defaults priority to DO for unknown values", () => {
        const task = normalizeTask({ priority: "UNKNOWN" as never });
        expect(task.priority).toBe("DO");
    });

    it("sets timeSource to none when no dueDate", () => {
        const task = normalizeTask({ timeSource: "explicit" });
        expect(task.timeSource).toBe("none");
    });

    it("sets timeSource to none when dueDate but no dueTime", () => {
        const task = normalizeTask({
            dueDate: "2026-02-20",
            timeSource: "explicit",
        });
        expect(task.timeSource).toBe("none");
    });

    it("trims group whitespace and nullifies empty group", () => {
        expect(normalizeTask({ group: "  " }).group).toBeNull();
        expect(normalizeTask({ group: "  Work  " }).group).toBe("Work");
    });
});

describe("normalizeResult", () => {
    it("wraps a single task object in an array", () => {
        const result = normalizeResult({ title: "Test" });
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].title).toBe("Test");
    });

    it("passes through a valid tasks array", () => {
        const result = normalizeResult({
            tasks: [{ title: "A" }, { title: "B" }],
        });
        expect(result.tasks).toHaveLength(2);
    });

    it("limits to 3 tasks max", () => {
        const result = normalizeResult({
            tasks: [
                { title: "1" },
                { title: "2" },
                { title: "3" },
                { title: "4" },
            ],
        });
        expect(result.tasks).toHaveLength(3);
    });

    it("returns empty array for null input", () => {
        const result = normalizeResult(null);
        expect(result.tasks).toHaveLength(0);
    });

    it("returns empty array for undefined input", () => {
        const result = normalizeResult(undefined);
        expect(result.tasks).toHaveLength(0);
    });
});
