"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogBody } from "./ui/dialog";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { getOrCreateCalendarToken } from "@/lib/firestore";
import { Link2, Check, Copy, Calendar } from "lucide-react";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
};

export function CalendarFeedModal({ open, onOpenChange }: Props) {
    const { user } = useAuth();
    const { groups } = useTaskGroups(user?.uid);
    const [token, setToken] = useState<string | null>(null);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [groupFeedUrl, setGroupFeedUrl] = useState<string | null>(null);
    const [allCopied, setAllCopied] = useState(false);
    const [groupCopied, setGroupCopied] = useState(false);

    useEffect(() => {
        if (open && user && !token) {
            getOrCreateCalendarToken(user.uid).then(setToken);
        }
    }, [open, user, token]);

    useEffect(() => {
        if (!open) {
            setSelectedGroups(new Set());
            setGroupFeedUrl(null);
        }
    }, [open]);

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const allTasksUrl = token ? `${baseUrl}/api/ical/${token}` : null;

    const toggleGroup = (groupId: string) => {
        setSelectedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
        setGroupFeedUrl(null);
    };

    const generateGroupFeed = () => {
        if (!token || selectedGroups.size === 0) return;
        const groupsParam = Array.from(selectedGroups).join(",");
        const url = `${baseUrl}/api/ical/${token}?groups=${encodeURIComponent(groupsParam)}`;
        setGroupFeedUrl(url);
    };

    const copyUrl = (url: string, type: "all" | "group") => {
        navigator.clipboard.writeText(url);
        if (type === "all") {
            setAllCopied(true);
            setTimeout(() => setAllCopied(false), 2000);
        } else {
            setGroupCopied(true);
            setTimeout(() => setGroupCopied(false), 2000);
        }
    };

    // Include "General Tasks" as a pseudo-group with empty string ID
    const allGroups = [
        { id: "", name: "General Tasks", color: "#64748b" },
        ...groups.map((g) => ({ id: g.id, name: g.name, color: g.color || "#6366f1" })),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange} size="xl">
            <DialogHeader>
                <DialogTitle>
                    <span className="flex items-center gap-2">
                        <Calendar size={18} />
                        Calendar Feed
                    </span>
                </DialogTitle>
            </DialogHeader>
            <DialogBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: All Tasks */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">All Tasks</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Subscribe to this feed to see all your tasks with due dates in your calendar app.
                        </p>
                        {allTasksUrl && (
                            <div className="rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] p-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={allTasksUrl}
                                        className="flex-1 min-w-0 rounded bg-transparent text-xs text-[var(--text-primary)] outline-none truncate"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        onClick={() => copyUrl(allTasksUrl, "all")}
                                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                                    >
                                        {allCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Per-Group Feeds */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Per-Group Feeds</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Create separate feeds for specific groups. This lets you assign different colors to each group in your calendar app.
                        </p>

                        <div className="rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] p-3 max-h-40 overflow-y-auto space-y-1">
                            {allGroups.map((g) => (
                                <label
                                    key={g.id}
                                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedGroups.has(g.id)}
                                        onChange={() => toggleGroup(g.id)}
                                        className="accent-[var(--accent)] h-3.5 w-3.5"
                                    />
                                    <span
                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: g.color }}
                                    />
                                    <span className="text-sm text-[var(--text-primary)] truncate">{g.name}</span>
                                </label>
                            ))}
                        </div>

                        <Button
                            size="sm"
                            onClick={generateGroupFeed}
                            disabled={selectedGroups.size === 0}
                            className="w-full"
                        >
                            <Link2 size={14} />
                            Generate Feed
                        </Button>

                        {groupFeedUrl && (
                            <div className="rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg)] p-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={groupFeedUrl}
                                        className="flex-1 min-w-0 rounded bg-transparent text-xs text-[var(--text-primary)] outline-none truncate"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        onClick={() => copyUrl(groupFeedUrl, "group")}
                                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                                    >
                                        {groupCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogBody>
        </Dialog>
    );
}
