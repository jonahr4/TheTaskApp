// Mock firebase/firestore before any imports
jest.mock("firebase/firestore", () => ({
    collection: jest.fn((_db, ...pathSegments: string[]) => ({
        path: pathSegments.join("/"),
    })),
    doc: jest.fn((_db, ...pathSegments: string[]) => ({
        path: pathSegments.join("/"),
    })),
    addDoc: jest.fn(() => Promise.resolve({ id: "new-doc-id" })),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    getDoc: jest.fn(),
    setDoc: jest.fn(() => Promise.resolve()),
    serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
    query: jest.fn((...args: unknown[]) => args),
    orderBy: jest.fn((...args: unknown[]) => ({ orderBy: args })),
}));

jest.mock("@/lib/firebase", () => ({
    db: "MOCK_DB",
}));

import {
    addDoc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import {
    createTask,
    updateTask,
    deleteTask,
    createGroup,
    updateGroup,
    deleteGroup,
} from "@/lib/firestore";

describe("firestore — tasks", () => {
    beforeEach(() => jest.clearAllMocks());

    it("createTask calls addDoc with data + timestamps", async () => {
        await createTask("user-1", {
            title: "New Task",
            notes: "",
            urgent: false,
            important: true,
            dueDate: null,
            dueTime: null,
            groupId: null,
            autoUrgentDays: null,
            completed: false,
            order: 0,
        });

        expect(addDoc).toHaveBeenCalledTimes(1);
        const callArgs = (addDoc as jest.Mock).mock.calls[0][1];
        expect(callArgs.title).toBe("New Task");
        expect(callArgs.createdAt).toBe("SERVER_TIMESTAMP");
        expect(callArgs.updatedAt).toBe("SERVER_TIMESTAMP");
    });

    it("updateTask calls updateDoc with data + updatedAt", async () => {
        await updateTask("user-1", "task-99", { title: "Updated" });

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
        expect(callArgs.title).toBe("Updated");
        expect(callArgs.updatedAt).toBe("SERVER_TIMESTAMP");
    });

    it("deleteTask calls deleteDoc", async () => {
        await deleteTask("user-1", "task-99");
        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
});

describe("firestore — groups", () => {
    beforeEach(() => jest.clearAllMocks());

    it("createGroup calls addDoc with data + createdAt", async () => {
        await createGroup("user-1", {
            name: "Work",
            color: "#ff0000",
            order: 0,
        });

        expect(addDoc).toHaveBeenCalledTimes(1);
        const callArgs = (addDoc as jest.Mock).mock.calls[0][1];
        expect(callArgs.name).toBe("Work");
        expect(callArgs.createdAt).toBe("SERVER_TIMESTAMP");
    });

    it("updateGroup calls updateDoc with data", async () => {
        await updateGroup("user-1", "group-1", { name: "Personal" });

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
        expect(callArgs.name).toBe("Personal");
    });

    it("deleteGroup calls deleteDoc", async () => {
        await deleteGroup("user-1", "group-1");
        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
});
