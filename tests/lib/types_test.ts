import { getQuadrant } from "@/lib/types";
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
