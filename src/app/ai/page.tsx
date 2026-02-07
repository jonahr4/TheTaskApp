"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask } from "@/lib/firestore";
import { Sparkles, Wand2, X, Plus } from "lucide-react";
import { useTaskGroups } from "@/hooks/useTaskGroups";

type AiTask = {
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: "DO" | "SCHEDULE" | "DELEGATE" | "DELETE";
  group: string | null;
  groupId: string | null;
  timeSource: "explicit" | "guessed" | "none";
};

type AiParseResult = {
  tasks: AiTask[];
};

export default function AiPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);
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
        body: JSON.stringify({ text: input.trim(), today, timezone, groups: groups.map((g) => g.name) }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error(`${data?.error || "AI parse failed."}${detail}`);
      }
      const mappedTasks = (data?.tasks || []).map((t: AiTask) => {
        const match = t.group
          ? groups.find((g) => g.name.toLowerCase() === t.group!.toLowerCase())
          : null;
        return {
          ...t,
          groupId: match ? match.id : null,
        };
      });
      setResult({ tasks: mappedTasks });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI parse failed.");
    } finally {
      setLoading(false);
    }
  };

  const priorityFlags = (p: AiTask["priority"]) => {
    if (p === "SCHEDULE") return { urgent: false, important: true };
    if (p === "DELEGATE") return { urgent: true, important: false };
    if (p === "DELETE") return { urgent: false, important: false };
    return { urgent: true, important: true };
  };

  const handleCreate = async () => {
    if (!user || !result?.tasks.length) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      let created = 0;
      for (let i = 0; i < result.tasks.length; i += 1) {
        const t = result.tasks[i];
        if (!t.title.trim()) continue;
        const flags = priorityFlags(t.priority);
        await createTask(user.uid, {
          title: t.title.trim(),
          notes: t.notes?.trim() || "",
          urgent: flags.urgent,
          important: flags.important,
          dueDate: t.dueDate || null,
          dueTime: t.dueTime || null,
          groupId: t.groupId || null,
          autoUrgentDays: null,
          completed: false,
          order: tasks.length + created,
        });
        created += 1;
      }
      setSuccess(created > 1 ? `${created} tasks created.` : "Task created.");
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
          <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)]/90 p-4 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI result</h2>
              {result.tasks.some((t) => t.timeSource === "guessed") && (
                <span className="text-[11px] rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                  AI picked a time
                </span>
              )}
            </div>

            <div className="space-y-4">
              {result.tasks.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)]/70 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Task {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      {t.timeSource === "guessed" && (
                        <span className="text-[10px] rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                          Time guessed
                        </span>
                      )}
                      {result.tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = result.tasks.filter((_, i) => i !== idx);
                            setResult({ tasks: next });
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                          aria-label="Remove task"
                          title="Remove task"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Title</label>
                    <Input
                      value={t.title}
                      onChange={(e) => {
                        const next = [...result.tasks];
                        next[idx] = { ...t, title: e.target.value };
                        setResult({ tasks: next });
                      }}
                      placeholder="Task title"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Notes</label>
                    <Textarea
                      value={t.notes}
                      onChange={(e) => {
                        const next = [...result.tasks];
                        next[idx] = { ...t, notes: e.target.value };
                        setResult({ tasks: next });
                      }}
                      placeholder="Extra details"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Due date</label>
                      <Input
                        type="date"
                        value={t.dueDate || ""}
                        onChange={(e) => {
                          const next = [...result.tasks];
                          next[idx] = { ...t, dueDate: e.target.value || null };
                          setResult({ tasks: next });
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Time</label>
                      <Input
                        type="time"
                        value={t.dueTime || ""}
                        onChange={(e) => {
                          const next = [...result.tasks];
                          next[idx] = { ...t, dueTime: e.target.value || null };
                          setResult({ tasks: next });
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Priority</label>
                      <select
                        value={t.priority}
                        onChange={(e) => {
                          const next = [...result.tasks];
                          next[idx] = { ...t, priority: e.target.value as AiTask["priority"] };
                          setResult({ tasks: next });
                        }}
                        className="flex h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)]"
                      >
                        <option value="DO">Do First</option>
                        <option value="SCHEDULE">Schedule</option>
                        <option value="DELEGATE">Delegate</option>
                        <option value="DELETE">Eliminate</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Task group</label>
                      <select
                        value={t.groupId || ""}
                        onChange={(e) => {
                          const next = [...result.tasks];
                          next[idx] = { ...t, groupId: e.target.value || null };
                          setResult({ tasks: next });
                        }}
                        className="flex h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)]"
                      >
                        <option value="">General Tasks</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (result.tasks.length >= 3) return;
                  setResult({
                    tasks: [
                      ...result.tasks,
                      {
                        title: "",
                        notes: "",
                        dueDate: null,
                        dueTime: null,
                        priority: "DO",
                        group: null,
                        groupId: null,
                        timeSource: "none",
                      },
                    ],
                  });
                }}
                disabled={result.tasks.length >= 3}
              >
                <Plus size={16} className="mr-2" />
                Add task
              </Button>
              <Button onClick={handleCreate} disabled={!result.tasks.some((t) => t.title.trim()) || saving}>
                {saving ? "Creating..." : result.tasks.length > 1 ? "Create tasks" : "Create task"}
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
