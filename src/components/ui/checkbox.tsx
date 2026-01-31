"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function Checkbox({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all duration-150 cursor-pointer",
        checked
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] hover:border-[var(--accent)]",
        className
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}
