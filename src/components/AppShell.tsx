"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CheckSquare, Grid3X3, Calendar, LogOut, ChevronDown, Link2, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getOrCreateCalendarToken } from "@/lib/firestore";

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
  const [navOpen, setNavOpen] = useState(false);
  const [calUrl, setCalUrl] = useState<string | null>(null);
  const [calCopied, setCalCopied] = useState(false);

  const handleCalendarLink = async () => {
    if (!user) return;
    const token = await getOrCreateCalendarToken(user.uid);
    const url = `${window.location.origin}/api/ical/${token}`;
    setCalUrl(url);
  };

  const copyCalUrl = () => {
    if (!calUrl) return;
    navigator.clipboard.writeText(calUrl);
    setCalCopied(true);
    setTimeout(() => setCalCopied(false), 2000);
  };
  const currentNav = navItems.find((n) => n.href === pathname) || navItems[0];

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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-card)] px-4 sm:px-6 lg:px-12">
        {/* Logo left */}
        <div className="flex items-center gap-2 w-48">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)]">
            <CheckSquare size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">TaskApp</span>
        </div>

        {/* Center tabs - desktop */}
        <nav className="hidden sm:flex items-center rounded-[var(--radius-full)] bg-[var(--bg)] p-1 shadow-[var(--shadow-sm)] border border-[var(--border-light)] gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-full)] px-6 py-2 text-sm font-medium transition-all duration-150",
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

        {/* Center tabs - mobile dropdown */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-sm)] border border-[var(--border-light)]"
          >
            <currentNav.icon size={14} />
            {currentNav.label}
            <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
          </button>
          {navOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNavOpen(false)} />
              <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1 w-40 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] p-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setNavOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
                      pathname === href
                        ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

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
                      onClick={handleCalendarLink}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Link2 size={14} />
                      Calendar feed
                    </button>
                    {calUrl && (
                      <div className="mx-2 my-1 rounded-[var(--radius-sm)] border border-[var(--border-light)] bg-[var(--bg)] p-2">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Subscribe in Apple/Google Calendar:</p>
                        <div className="flex items-center gap-1">
                          <input
                            readOnly
                            value={calUrl}
                            className="flex-1 min-w-0 rounded bg-transparent text-[11px] text-[var(--text-primary)] outline-none truncate"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            onClick={copyCalUrl}
                            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            {calCopied ? <Check size={12} className="text-green-500" /> : <Link2 size={12} />}
                          </button>
                        </div>
                      </div>
                    )}
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
      <main className="flex-1 overflow-auto px-4 sm:px-6 md:px-10">{children}</main>
    </div>
  );
}
