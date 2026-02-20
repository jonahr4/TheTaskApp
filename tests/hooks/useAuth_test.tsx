jest.mock("firebase/auth", () => ({
    onAuthStateChanged: jest.fn((_auth: unknown, cb: (u: null) => void) => {
        cb(null);
        return jest.fn();
    }),
    signInWithPopup: jest.fn(() => Promise.resolve()),
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/firebase", () => ({
    auth: "MOCK_AUTH",
    googleProvider: "MOCK_GOOGLE_PROVIDER",
}));

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import {
    signInWithPopup,
    signOut,
} from "firebase/auth";

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
    beforeEach(() => jest.clearAllMocks());

    it("provides default context with null user", () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it("signIn calls signInWithPopup", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.signIn();
        });

        expect(signInWithPopup).toHaveBeenCalledWith("MOCK_AUTH", "MOCK_GOOGLE_PROVIDER");
    });

    it("logOut calls signOut", async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.logOut();
        });

        expect(signOut).toHaveBeenCalledWith("MOCK_AUTH");
    });
});
