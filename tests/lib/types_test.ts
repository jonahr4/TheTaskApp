import { getQuadrant, QUADRANT_META, type Quadrant } from "@/lib/types";
import { mockTask } from "../helpers/mockTask";

describe("getQuadrant", () => {
    it("returns 'DO' when urgent and important", () => {
        const task = mockTask({ urgent: true, important: true });
        expect(getQuadrant(task)).toBe("DO");
    });

    it("returns 'SCHEDULE' when not urgent but important", () => {
        const task = mockTask({ urgent: false, important: true });
        expect(getQuadrant(task)).toBe("SCHEDULE");
    });

    it("returns 'DELEGATE' when urgent but not important", () => {
        const task = mockTask({ urgent: true, important: false });
        expect(getQuadrant(task)).toBe("DELEGATE");
    });

    it("returns 'DELETE' when not urgent and not important", () => {
        const task = mockTask({ urgent: false, important: false });
        expect(getQuadrant(task)).toBe("DELETE");
    });

    it("returns null when urgent is null", () => {
        const task = mockTask({ urgent: null, important: true });
        expect(getQuadrant(task)).toBeNull();
    });

    it("returns null when important is null", () => {
        const task = mockTask({ urgent: true, important: null });
        expect(getQuadrant(task)).toBeNull();
    });

    it("returns null when both are null", () => {
        const task = mockTask({ urgent: null, important: null });
        expect(getQuadrant(task)).toBeNull();
    });
});

describe("QUADRANT_META", () => {
    const quadrants: Quadrant[] = ["DO", "SCHEDULE", "DELEGATE", "DELETE"];

    it("has an entry for every quadrant", () => {
        for (const q of quadrants) {
            expect(QUADRANT_META[q]).toBeDefined();
            expect(QUADRANT_META[q].label).toBeTruthy();
            expect(QUADRANT_META[q].sublabel).toBeTruthy();
        }
    });

    it("carries light and dark color variants (mobile parity)", () => {
        for (const q of quadrants) {
            const meta = QUADRANT_META[q];
            expect(meta.color).toMatch(/^#/);
            expect(meta.bg).toMatch(/^#/);
            expect(meta.border).toMatch(/^#/);
            expect(meta.darkColor).toMatch(/^#/);
            expect(meta.darkBg).toMatch(/^#/);
            expect(meta.darkBorder).toMatch(/^#/);
            expect(meta.darkBg).not.toBe(meta.bg);
        }
    });

    it("matches the mobile app's palette values", () => {
        expect(QUADRANT_META.DO.darkBg).toBe("#2d1515");
        expect(QUADRANT_META.SCHEDULE.darkColor).toBe("#60a5fa");
        expect(QUADRANT_META.DELEGATE.color).toBe("#d97706");
        expect(QUADRANT_META.DELETE.darkBorder).toBe("#3a3d42");
    });

    it("encodes the same urgent/important flags as getQuadrant", () => {
        const cases: { urgent: boolean; important: boolean; q: Quadrant }[] = [
            { urgent: true, important: true, q: "DO" },
            { urgent: false, important: true, q: "SCHEDULE" },
            { urgent: true, important: false, q: "DELEGATE" },
            { urgent: false, important: false, q: "DELETE" },
        ];
        for (const { urgent, important, q } of cases) {
            expect(getQuadrant(mockTask({ urgent, important }))).toBe(q);
            expect(QUADRANT_META[q].urgent).toBe(urgent);
            expect(QUADRANT_META[q].important).toBe(important);
        }
    });

    it("accepts the mobile-parity optional fields additively", () => {
        const t = mockTask({ location: "NYC", createdFrom: "matrix", archived: true, reminder: true });
        expect(t.location).toBe("NYC");
        expect(t.createdFrom).toBe("matrix");
        expect(t.archived).toBe(true);
        expect(t.reminder).toBe(true);
        // Old-shaped tasks (no new fields) still typecheck
        const legacy = mockTask({});
        expect(legacy.location).toBeUndefined();
        expect(legacy.createdFrom).toBeUndefined();
    });
});
