"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type DialogCtx = { open: boolean; onClose: () => void };
const Ctx = createContext<DialogCtx>({ open: false, onClose: () => {} });

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <Ctx.Provider value={{ open, onClose: () => onOpenChange(false) }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-10">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={() => onOpenChange(false)}
        />
        <div className="relative z-50 h-full w-full max-w-none rounded-none border border-[var(--border-light)] bg-[var(--bg-card)] p-0 shadow-[var(--shadow-lg)] sm:h-auto sm:max-w-md sm:rounded-[var(--radius-lg)]">
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  const { onClose } = useContext(Ctx);
  return (
    <div className={cn("flex items-center justify-between px-6 pt-6 pb-0 sm:px-10 sm:pt-8", className)}>
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
  return <div className={cn("px-6 py-6 sm:px-10 sm:py-7", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-3 border-t border-[var(--border-light)] px-6 py-5 sm:px-10 sm:py-7", className)}>
      {children}
    </div>
  );
}
