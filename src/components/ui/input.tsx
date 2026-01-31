import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-transparent",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
export { Input };
