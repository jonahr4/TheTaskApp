"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Copy, CheckCircle2, Circle, Trash2, Archive } from "lucide-react";

type Props = {
  completed: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onArchive?: () => void;
};

export function TaskRowMenu({ completed, onEdit, onDuplicate, onToggleComplete, onDelete, onArchive }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = [
    { label: "Edit", icon: Pencil, action: onEdit },
    { label: "Duplicate", icon: Copy, action: onDuplicate },
    { label: completed ? "Mark incomplete" : "Mark complete", icon: completed ? Circle : CheckCircle2, action: onToggleComplete },
    ...(onArchive ? [{ label: "Archive", icon: Archive, action: onArchive }] : []),
    { label: "Delete", icon: Trash2, action: onDelete, destructive: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] py-1 shadow-[var(--shadow-lg)]">
          {items.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors ${item.destructive
                  ? "text-red-500 hover:bg-red-50"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              onClick={(e) => { e.stopPropagation(); item.action(); setOpen(false); }}
            >
              <item.icon size={13} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
