import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "outline" | "do" | "schedule" | "delegate" | "delete";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        variant === "default" && "bg-[var(--accent)] text-white",
        variant === "outline" && "border border-[var(--border)] text-[var(--text-secondary)]",
        variant === "do" && "bg-red-500/10 text-red-600",
        variant === "schedule" && "bg-blue-500/10 text-blue-600",
        variant === "delegate" && "bg-amber-500/10 text-amber-600",
        variant === "delete" && "bg-gray-500/10 text-gray-500",
        className
      )}
    >
      {children}
    </span>
  );
}
