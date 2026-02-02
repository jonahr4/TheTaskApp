"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Sparkles, Calendar, Grid3X3, Check } from "lucide-react";

export default function LoginPage() {
  const { user, loading, signIn, signInEmail, signUpEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/tasks");
  }, [user, loading, router]);

  if (loading) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpEmail(email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError(err?.message || "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border-light)] bg-[var(--bg-card)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)]">
              <CheckSquare size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">TaskApp</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-[var(--text-secondary)]">
            <a href="#features" className="hover:text-[var(--text-primary)] transition-colors">Features</a>
            <a href="#demo" className="hover:text-[var(--text-primary)] transition-colors">Live Demo</a>
            <a href="#auth" className="hover:text-[var(--text-primary)] transition-colors">Sign up</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsSignUp(false); setError(null); }}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(null); }}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-sm)] hover:opacity-90 transition-all"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.15),_transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
              <Sparkles size={12} className="text-[var(--accent)]" />
              AI reminders + matrix + calendar
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your tasks, priorities, and schedule — in one place.
            </h1>
            <p className="mt-4 max-w-xl text-base text-[var(--text-secondary)] sm:text-lg">
              Type reminders in plain English, see priorities in the matrix, and track everything on a calendar.
              TaskApp makes planning fast and visual.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => { setIsSignUp(true); setError(null); document.getElementById("auth")?.scrollIntoView({ behavior: "smooth" }); }}
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] hover:opacity-90 transition-all"
              >
                Start free
              </button>
              <a href="#demo" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                See how it works
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-2"><Calendar size={12} /> Calendar view</span>
              <span className="inline-flex items-center gap-2"><Grid3X3 size={12} /> Eisenhower matrix</span>
              <span className="inline-flex items-center gap-2"><Sparkles size={12} /> AI task parsing</span>
            </div>
          </div>

          {/* Auth card */}
          <div id="auth" className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-md)]">
            <h2 className="text-sm font-semibold">{isSignUp ? "Create account" : "Sign in"}</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {isSignUp ? "Start organizing in seconds." : "Welcome back."}
            </p>
            <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button size="lg" className="w-full" type="submit" disabled={submitting}>
                {isSignUp ? "Create account" : "Sign in"}
              </Button>
            </form>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="mt-2 w-full text-center text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "No account? Create one"}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-light)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--bg-card)] px-3 text-[11px] text-[var(--text-tertiary)]">or</span>
              </div>
            </div>

            <Button size="lg" variant="outline" className="w-full gap-3" onClick={signIn}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </Button>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section id="features" className="px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-[var(--accent)]" />
              AI Reminder Parsing
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Type “remind me Friday” and TaskApp schedules it with priority and group.
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Grid3X3 size={16} className="text-[var(--accent)]" />
              Eisenhower Matrix
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Drag tasks between quadrants to prioritize instantly.
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar size={16} className="text-[var(--accent)]" />
              Calendar + iCal
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Visualize tasks on a calendar and subscribe to your feed.
            </p>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="px-6 pb-16 pt-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">See how TaskApp feels</h2>
            <p className="text-sm text-[var(--text-secondary)]">A glimpse of your day, prioritized and organized.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Today’s tasks</h3>
                <span className="text-xs text-[var(--text-tertiary)]">All Tasks</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { title: "Buy groceries for appartment", time: "Tomorrow • 3:00 PM", variant: "schedule" as const },
                  { title: "Midterm CS 505", time: "Mar 18 • 9:00 AM", variant: "do" as const },
                  { title: "Pick up steak", time: "Tomorrow • 8:00 PM", variant: "delegate" as const },
                ].map((t) => (
                  <div key={t.title} className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] px-3 py-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)]">
                        <Check size={10} className="text-transparent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{t.time}</p>
                      </div>
                    </div>
                    <Badge variant={t.variant}>{t.variant === "do" ? "Do First" : t.variant === "schedule" ? "Schedule" : "Delegate"}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Matrix snapshot</h3>
                <span className="text-xs text-[var(--text-tertiary)]">This week</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Do First", color: "bg-red-50 border-red-200 text-red-700", items: ["Midterm CS 505"] },
                  { label: "Schedule", color: "bg-blue-50 border-blue-200 text-blue-700", items: ["Buy groceries for appartment"] },
                  { label: "Delegate", color: "bg-amber-50 border-amber-200 text-amber-700", items: ["Pick up steak"] },
                  { label: "Eliminate", color: "bg-gray-50 border-gray-200 text-gray-600", items: ["—"] },
                ].map((q) => (
                  <div key={q.label} className={`rounded-[var(--radius-md)] border p-2 ${q.color}`}>
                    <p className="font-semibold">{q.label}</p>
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {q.items.map((i) => (
                        <li key={i} className="truncate">{i}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
