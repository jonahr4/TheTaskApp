import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-transparent resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
export { Textarea };
