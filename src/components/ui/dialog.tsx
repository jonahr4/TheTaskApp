"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type DialogCtx = { open: boolean; onClose: () => void };
const Ctx = createContext<DialogCtx>({ open: false, onClose: () => { } });

export function Dialog({
  open,
  onOpenChange,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizeClasses = {
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-2xl",
  };
  return (
    <Ctx.Provider value={{ open, onClose: () => onOpenChange(false) }}>
      {/* Mobile: bottom sheet that slides up (like the iOS app). Desktop: centered dialog. */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-10">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          style={{ animation: "fade-in 0.2s ease" }}
          onClick={() => onOpenChange(false)}
        />
        <div
          className={cn(
            "relative z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-xl)]",
            "rounded-t-[24px] sm:rounded-[var(--radius-lg)]",
            sizeClasses[size]
          )}
          style={{ animation: "sheet-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)" }}
        >
          {/* Drag handle — mobile sheet chrome, matches the iOS app */}
          <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
          </div>
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  const { onClose } = useContext(Ctx);
  return (
    <div className={cn("flex shrink-0 items-center justify-between px-6 pt-6 pb-0 sm:px-10 sm:pt-8", className)}>
      <div>{children}</div>
      <button
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-[var(--text-primary)]">{children}</h2>;
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-7", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border-light)] px-6 py-5 sm:px-10 sm:py-7", className)}>
      {children}
    </div>
  );
}
