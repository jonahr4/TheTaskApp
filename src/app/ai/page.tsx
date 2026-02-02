"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask } from "@/lib/firestore";
import { Sparkles, Wand2 } from "lucide-react";

type AiParseResult = {
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  reminder: boolean;
  urgent: boolean;
  important: boolean;
  timeSource: "explicit" | "guessed" | "none";
};

export default function AiPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiParseResult | null>(null);
  const [success, setSuccess] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const handleParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: input.trim(), today, timezone }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error(`${data?.error || "AI parse failed."}${detail}`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI parse failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !result?.title.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createTask(user.uid, {
        title: result.title.trim(),
        notes: result.notes?.trim() || "",
        urgent: result.urgent,
        important: result.important,
        reminder: result.reminder,
        dueDate: result.dueDate || null,
        dueTime: result.dueTime || null,
        groupId: null,
        autoUrgentDays: null,
        completed: false,
        order: tasks.length,
      });
      setSuccess("Task created.");
      setResult(null);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl py-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
            <Sparkles size={16} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">AI Reminder</h1>
            <p className="text-sm text-[var(--text-tertiary)]">Type a reminder in plain English and turn it into a task.</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Reminder text</label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Remind me next Friday to send the design update."
              rows={4}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleParse} disabled={!input.trim() || loading}>
              <Wand2 size={16} className="mr-2" />
              {loading ? "Thinking..." : "Parse with AI"}
            </Button>
            <span className="text-xs text-[var(--text-tertiary)]">Timezone: {timezone}</span>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </div>

        {result && (
          <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI result</h2>
              {result.timeSource === "guessed" && (
                <span className="text-[11px] rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                  AI picked a time
                </span>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Title</label>
              <Input
                value={result.title}
                onChange={(e) => setResult({ ...result, title: e.target.value })}
                placeholder="Task title"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Notes</label>
              <Textarea
                value={result.notes}
                onChange={(e) => setResult({ ...result, notes: e.target.value })}
                placeholder="Extra details"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Due date</label>
                <Input
                  type="date"
                  value={result.dueDate || ""}
                  onChange={(e) => setResult({ ...result, dueDate: e.target.value || null })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Time</label>
                <Input
                  type="time"
                  value={result.dueTime || ""}
                  onChange={(e) => setResult({ ...result, dueTime: e.target.value || null })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={result.reminder}
                  onChange={(e) => setResult({ ...result, reminder: e.target.checked })}
                />
                Reminder
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={result.urgent}
                  onChange={(e) => setResult({ ...result, urgent: e.target.checked })}
                />
                Urgent
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={result.important}
                  onChange={(e) => setResult({ ...result, important: e.target.checked })}
                />
                Important
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!result.title.trim() || saving}>
                {saving ? "Creating..." : "Create task"}
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
