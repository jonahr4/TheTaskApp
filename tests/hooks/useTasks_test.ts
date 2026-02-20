const mockUnsub = jest.fn();
const mockOnSnapshot = jest.fn((_query: unknown, cb: (snap: unknown) => void) => {
    // Simulate an immediate snapshot
    cb({
        docs: [
            {
                id: "task-1",
                data: () => ({ title: "Mock Task", completed: false }),
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
import { useTasks } from "@/hooks/useTasks";

describe("useTasks", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns tasks from snapshot", () => {
        const { result } = renderHook(() => useTasks("user-1"));

        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].id).toBe("task-1");
        expect(result.current.loading).toBe(false);
    });

    it("does not subscribe when uid is undefined", () => {
        renderHook(() => useTasks(undefined));

        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it("unsubscribes on unmount", () => {
        const { unmount } = renderHook(() => useTasks("user-1"));
        unmount();

        expect(mockUnsub).toHaveBeenCalled();
    });
});
