jest.mock("next/server", () => ({
    NextRequest: jest.fn(),
    NextResponse: {
        json: jest.fn(),
    },
}));

jest.mock("@/lib/firebase-admin", () => ({
    adminDb: {},
}));

jest.mock("ical-generator", () => ({
    __esModule: true,
    default: jest.fn(),
    ICalCalendarMethod: { PUBLISH: "PUBLISH" },
    ICalEventStatus: { CONFIRMED: "CONFIRMED" },
}));

import { getQuadrant } from "@/app/api/ical/[token]/route";

describe("iCal getQuadrant", () => {
    it("returns 'Do First' for urgent + important", () => {
        expect(getQuadrant(true, true)).toBe("Do First");
    });

    it("returns 'Schedule' for not urgent + important", () => {
        expect(getQuadrant(false, true)).toBe("Schedule");
    });

    it("returns 'Delegate' for urgent + not important", () => {
        expect(getQuadrant(true, false)).toBe("Delegate");
    });

    it("returns 'Eliminate' for not urgent + not important", () => {
        expect(getQuadrant(false, false)).toBe("Eliminate");
    });
});
