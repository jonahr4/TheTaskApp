import { cn } from "@/lib/utils";

describe("cn", () => {
    it("merges multiple class strings", () => {
        expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes", () => {
        const isActive = true;
        const isDisabled = false;
        expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe(
            "base active"
        );
    });

    it("deduplicates conflicting Tailwind classes", () => {
        // tailwind-merge should pick the last padding value
        expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("returns empty string for no inputs", () => {
        expect(cn()).toBe("");
    });

    it("handles undefined and null gracefully", () => {
        expect(cn("a", undefined, null, "b")).toBe("a b");
    });
});
