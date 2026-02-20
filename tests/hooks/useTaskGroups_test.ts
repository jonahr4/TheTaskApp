const mockUnsub = jest.fn();
const mockOnSnapshot = jest.fn((_query: unknown, cb: (snap: unknown) => void) => {
    cb({
        docs: [
            {
                id: "group-1",
                data: () => ({ name: "Work", color: "#6366f1", order: 0 }),
            },
        ],
    });
    return mockUnsub;
});

jest.mock("firebase/firestore", () => ({
    onSnapshot: (q: unknown, cb: (snap: unknown) => void) => mockOnSnapshot(q, cb),
    collection: jest.fn(),
    query: jest.fn((...args: unknown[]) => args),
    orderBy: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
    db: "MOCK_DB",
}));

import { renderHook } from "@testing-library/react";
import { useTaskGroups } from "@/hooks/useTaskGroups";

describe("useTaskGroups", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns groups from snapshot", () => {
        const { result } = renderHook(() => useTaskGroups("user-1"));

        expect(result.current.groups).toHaveLength(1);
        expect(result.current.groups[0].name).toBe("Work");
        expect(result.current.loading).toBe(false);
    });

    it("does not subscribe when uid is undefined", () => {
        renderHook(() => useTaskGroups(undefined));

        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it("unsubscribes on unmount", () => {
        const { unmount } = renderHook(() => useTaskGroups("user-1"));
        unmount();

        expect(mockUnsub).toHaveBeenCalled();
    });
});
