"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CheckSquare, Grid3X3, Calendar, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/matrix", label: "Matrix", icon: Grid3X3 },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <span className="text-sm text-[var(--text-tertiary)]">Loading...</span>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-card)] px-12">
        {/* Logo left */}
        <div className="flex items-center gap-2 w-48">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)]">
            <CheckSquare size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">TaskApp</span>
        </div>

        {/* Center tabs */}
        <nav className="flex items-center rounded-[var(--radius-full)] bg-[var(--bg)] p-1.5 shadow-[var(--shadow-sm)] border border-[var(--border-light)] gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-full)] px-7 py-2.5 text-sm font-medium transition-all duration-150",
                pathname === href
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User menu right */}
        <div className="flex items-center justify-end w-48">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-[var(--radius-full)] py-1 pl-1 pr-3 hover:bg-[var(--bg-hover)] transition-colors"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  {user.displayName?.[0] || user.email?.[0] || "?"}
                </div>
              )}
              <span className="text-sm text-[var(--text-secondary)] max-w-[100px] truncate hidden sm:block">
                {user.displayName?.split(" ")[0] || "Account"}
              </span>
              <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]">
                  <div className="border-b border-[var(--border-light)] px-4 py-3">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.displayName || "User"}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); logOut(); }}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 md:px-10">{children}</main>
    </div>
  );
}
