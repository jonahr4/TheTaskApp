import { parseDateQuery, matchesDateQuery, searchTasks } from "@/lib/search";
import { mockTask, mockGroup } from "../helpers/mockTask";

describe("parseDateQuery", () => {
    it("parses a bare month name", () => {
        expect(parseDateQuery("sep")).toEqual({ month: 8, day: undefined });
        expect(parseDateQuery("September")).toEqual({ month: 8, day: undefined });
    });

    it("parses a month name with a day", () => {
        expect(parseDateQuery("sept 5")).toEqual({ month: 8, day: 5 });
        expect(parseDateQuery("september 12")).toEqual({ month: 8, day: 12 });
    });

    it("parses numeric dates", () => {
        expect(parseDateQuery("12/5")).toEqual({ month: 11, day: 5 });
        expect(parseDateQuery("12-5")).toEqual({ month: 11, day: 5 });
    });

    it("parses ISO dates", () => {
        expect(parseDateQuery("2025-12-05")).toEqual({ month: 11, day: 5 });
    });

    it("returns null for plain text", () => {
        expect(parseDateQuery("groceries")).toBeNull();
        expect(parseDateQuery("")).toBeNull();
    });
});

describe("matchesDateQuery", () => {
    it("matches month-only queries", () => {
        expect(matchesDateQuery("2026-09-24", { month: 8 })).toBe(true);
        expect(matchesDateQuery("2026-10-24", { month: 8 })).toBe(false);
    });

    it("matches month + day queries", () => {
        expect(matchesDateQuery("2026-09-24", { month: 8, day: 24 })).toBe(true);
        expect(matchesDateQuery("2026-09-25", { month: 8, day: 24 })).toBe(false);
    });

    it("returns false for tasks without a due date", () => {
        expect(matchesDateQuery(null, { month: 8 })).toBe(false);
    });
});

describe("searchTasks", () => {
    const groups = [mockGroup({ id: "g1", name: "School" })];
    const tasks = [
        mockTask({ id: "t1", title: "Study for CS 412 quiz", dueDate: "2026-09-24", groupId: "g1" }),
        mockTask({ id: "t2", title: "Buy groceries", notes: "milk and eggs", dueDate: null }),
        mockTask({ id: "t3", title: "Dentist appointment", dueDate: "2026-10-15" }),
    ];

    it("returns [] for an empty query", () => {
        expect(searchTasks(tasks, groups, "")).toEqual([]);
    });

    it("finds tasks by fuzzy title match", () => {
        const results = searchTasks(tasks, groups, "groceri");
        expect(results.map((t) => t.id)).toContain("t2");
    });

    it("finds tasks by notes", () => {
        const results = searchTasks(tasks, groups, "milk");
        expect(results.map((t) => t.id)).toContain("t2");
    });

    it("finds tasks by group name", () => {
        const results = searchTasks(tasks, groups, "school");
        expect(results.map((t) => t.id)).toContain("t1");
    });

    it("finds tasks by date query", () => {
        const results = searchTasks(tasks, groups, "sep 24");
        expect(results.map((t) => t.id)).toContain("t1");
        expect(results.map((t) => t.id)).not.toContain("t3");
    });

    it("dedupes tasks matching multiple ways", () => {
        const results = searchTasks(tasks, groups, "study");
        const ids = results.map((t) => t.id);
        expect(ids.filter((id) => id === "t1").length).toBe(1);
    });

    it("can exclude completed tasks", () => {
        const done = mockTask({ id: "t4", title: "Study hall", completed: true });
        expect(searchTasks([...tasks, done], groups, "study", { includeCompleted: false }).map((t) => t.id)).not.toContain("t4");
        expect(searchTasks([...tasks, done], groups, "study").map((t) => t.id)).toContain("t4");
    });
});
