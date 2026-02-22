"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask } from "@/lib/firestore";
import { Sparkles, Send, X, Check, CheckCheck, Loader2 } from "lucide-react";
import { useTaskGroups } from "@/hooks/useTaskGroups";

/* ─── types ─── */

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

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant-text"; text: string }
  | { role: "assistant-tasks"; text: string; tasks: AiTask[]; addedIndices: Set<number> }
  | { role: "system"; text: string };

/* ─── helpers ─── */

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const priorityFlags = (p: AiTask["priority"]) => {
  if (p === "SCHEDULE") return { urgent: false, important: true };
  if (p === "DELEGATE") return { urgent: true, important: false };
  if (p === "DELETE") return { urgent: false, important: false };
  return { urgent: true, important: true };
};

/* ─── component ─── */

export default function AiPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "system", text: "Ask me anything about your tasks, or describe a new reminder to create." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // Auto-scroll when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);

    try {
      const existingTasks = tasks.map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        group: t.groupId ? groups.find((g) => g.id === t.groupId)?.name || null : null,
        completed: t.completed,
        notes: t.notes || "",
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          today,
          timezone,
          groups: groups.map((g) => g.name),
          existingTasks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error(`${data?.error || "AI request failed."}${detail}`);
      }

      if (data.type === "tasks") {
        const mappedTasks: AiTask[] = (data.tasks || []).map((t: AiTask) => {
          const match = t.group
            ? groups.find((g) => g.name.toLowerCase() === t.group!.toLowerCase())
            : null;
          return { ...t, groupId: match ? match.id : null };
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant-tasks", text: data.message || "", tasks: mappedTasks, addedIndices: new Set() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant-text", text: data.message || "I'm not sure how to answer that." },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: err instanceof Error ? err.message : "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, tasks, groups, today, timezone]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const updateTaskInMessage = (msgIdx: number, taskIdx: number, patch: Partial<AiTask>) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== msgIdx || m.role !== "assistant-tasks") return m;
        const updated = [...m.tasks];
        updated[taskIdx] = { ...updated[taskIdx], ...patch };
        return { ...m, tasks: updated };
      })
    );
  };

  const removeTaskInMessage = (msgIdx: number, taskIdx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== msgIdx || m.role !== "assistant-tasks") return m;
        return { ...m, tasks: m.tasks.filter((_, ti) => ti !== taskIdx) };
      })
    );
  };

  const handleAddTask = async (msgIdx: number, taskIdx: number) => {
    if (!user) return;
    const msg = messages[msgIdx];
    if (msg.role !== "assistant-tasks") return;
    const t = msg.tasks[taskIdx];
    if (!t.title.trim()) return;

    const key = `${msgIdx}-${taskIdx}`;
    setSavingIdx(key);

    try {
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
        order: tasks.length,
      });

      // Mark as added
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i !== msgIdx || m.role !== "assistant-tasks") return m;
          const newAdded = new Set(m.addedIndices);
          newAdded.add(taskIdx);
          return { ...m, addedIndices: newAdded };
        })
      );
    } catch {
      // silently fail for now
    } finally {
      setSavingIdx(null);
    }
  };

  const handleAddAll = async (msgIdx: number) => {
    const msg = messages[msgIdx];
    if (msg.role !== "assistant-tasks" || !user) return;

    for (let i = 0; i < msg.tasks.length; i++) {
      if (!msg.addedIndices.has(i) && msg.tasks[i].title.trim()) {
        await handleAddTask(msgIdx, i);
      }
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">AI Assistant</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Ask about your tasks or create new ones.</p>
            </div>
          </div>
          {messages.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => {
                setMessages([{ role: "system", text: "Ask me anything about your tasks, or describe a new reminder to create." }]);
                setInput("");
              }}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X size={14} className="mr-1.5" />
              Clear chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4 chat-scroll">
          {messages.map((msg, msgIdx) => {
            if (msg.role === "user") {
              return (
                <div key={msgIdx} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm text-white shadow-[var(--shadow-sm)]">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (msg.role === "assistant-text") {
              return (
                <div key={msgIdx} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-[var(--shadow-sm)] whitespace-pre-wrap leading-relaxed">
                    {renderBold(msg.text)}
                  </div>
                </div>
              );
            }

            if (msg.role === "assistant-tasks") {
              const allAdded = msg.tasks.length > 0 && msg.tasks.every((_, i) => msg.addedIndices.has(i));
              return (
                <div key={msgIdx} className="flex justify-start">
                  <div className="w-full max-w-[90%] space-y-3">
                    {msg.text && (
                      <div className="rounded-2xl rounded-bl-md border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
                        {renderBold(msg.text)}
                      </div>
                    )}

                    {msg.tasks.map((t, taskIdx) => {
                      const isAdded = msg.addedIndices.has(taskIdx);
                      const isSaving = savingIdx === `${msgIdx}-${taskIdx}`;
                      return (
                        <div
                          key={taskIdx}
                          className={`rounded-[var(--radius-lg)] border bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] space-y-3 transition-all ${isAdded
                            ? "border-emerald-300 bg-emerald-50/30"
                            : "border-[var(--border-light)]"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              {isAdded ? "✓ Added" : `Task ${taskIdx + 1}`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {t.timeSource === "guessed" && !isAdded && (
                                <span className="text-[10px] rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                                  Time guessed
                                </span>
                              )}
                              {!isAdded && msg.tasks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTaskInMessage(msgIdx, taskIdx)}
                                  className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
                                  title="Remove"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {isAdded ? (
                            <p className="text-sm text-[var(--text-secondary)]">{t.title}</p>
                          ) : (
                            <>
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Title</label>
                                <Input
                                  value={t.title}
                                  onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { title: e.target.value })}
                                  placeholder="Task title"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</label>
                                <Textarea
                                  value={t.notes}
                                  onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { notes: e.target.value })}
                                  placeholder="Extra details"
                                  rows={2}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Due date</label>
                                  <Input
                                    type="date"
                                    value={t.dueDate || ""}
                                    onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { dueDate: e.target.value || null })}
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Time</label>
                                  <Input
                                    type="time"
                                    value={t.dueTime || ""}
                                    onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { dueTime: e.target.value || null })}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Priority</label>
                                  <select
                                    value={t.priority}
                                    onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { priority: e.target.value as AiTask["priority"] })}
                                    className="flex h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)]"
                                  >
                                    <option value="DO">Do First</option>
                                    <option value="SCHEDULE">Schedule</option>
                                    <option value="DELEGATE">Delegate</option>
                                    <option value="DELETE">Eliminate</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Group</label>
                                  <select
                                    value={t.groupId || ""}
                                    onChange={(e) => updateTaskInMessage(msgIdx, taskIdx, { groupId: e.target.value || null })}
                                    className="flex h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)]"
                                  >
                                    <option value="">General Tasks</option>
                                    {groups.map((g) => (
                                      <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="flex justify-end pt-1">
                                <Button
                                  onClick={() => handleAddTask(msgIdx, taskIdx)}
                                  disabled={!t.title.trim() || isSaving}
                                  className="h-8 text-xs px-4"
                                >
                                  {isSaving ? (
                                    <><Loader2 size={12} className="mr-1.5 animate-spin" /> Adding...</>
                                  ) : (
                                    <><Check size={12} className="mr-1.5" /> Add task</>
                                  )}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {msg.tasks.length > 1 && !allAdded && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleAddAll(msgIdx)}
                          disabled={!msg.tasks.some((t, i) => !msg.addedIndices.has(i) && t.title.trim())}
                          className="h-8 text-xs px-4"
                        >
                          <CheckCheck size={12} className="mr-1.5" /> Add all tasks
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // system message
            return (
              <div key={msgIdx} className="flex justify-center">
                <p className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-hover)] rounded-full px-4 py-1.5">
                  {msg.text}
                </p>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[var(--border-light)] bg-[var(--bg-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-3 mt-2">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your tasks or describe a new reminder..."
              rows={1}
              className="min-h-[40px] max-h-[120px] resize-none flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="h-10 w-10 shrink-0 p-0"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
