import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "icon" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
        variant === "default" && "bg-[var(--accent)] text-white rounded-[var(--radius-full)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-sm)]",
        variant === "secondary" && "bg-[var(--accent-light)] text-[var(--accent)] rounded-[var(--radius-full)] hover:bg-[var(--accent-muted)]",
        variant === "outline" && "border border-[var(--border)] bg-[var(--bg-card)] rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]",
        variant === "ghost" && "rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]",
        variant === "destructive" && "bg-[var(--destructive)] text-white rounded-[var(--radius-full)] hover:opacity-90",
        size === "lg" && "h-11 px-6 text-sm gap-2",
        size === "default" && "h-9 px-4 text-sm gap-2",
        size === "sm" && "h-7 px-3 text-xs gap-1.5",
        size === "icon" && "h-8 w-8 rounded-[var(--radius-md)]",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
export { Button };
