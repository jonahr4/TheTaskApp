"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { TaskModal } from "@/components/TaskModal";
import type { Task, Quadrant } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
import { useTaskGroups } from "@/hooks/useTaskGroups";
import { SlidersHorizontal, X } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const quadrantColors: Record<string, string> = {
  DO: "#ef4444",
  SCHEDULE: "#3b82f6",
  DELEGATE: "#f59e0b",
  DELETE: "#9ca3af",
};

const quadrantLabels: { key: Quadrant; label: string; color: string }[] = [
  { key: "DO", label: "Do First", color: "#ef4444" },
  { key: "SCHEDULE", label: "Schedule", color: "#3b82f6" },
  { key: "DELEGATE", label: "Delegate", color: "#f59e0b" },
  { key: "DELETE", label: "Eliminate", color: "#9ca3af" },
];

export default function CalendarPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const { groups } = useTaskGroups(user?.uid);
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showInProgress, setShowInProgress] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(["__all__"]));
  const [selectedQuadrants, setSelectedQuadrants] = useState<Set<Quadrant>>(new Set(["DO", "SCHEDULE", "DELEGATE", "DELETE"]));

  const allGroupsSelected = selectedGroups.has("__all__");
  const allQuadrantsSelected = selectedQuadrants.size === 4;

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (id === "__all__") {
        if (next.has("__all__")) { next.delete("__all__"); } else { next.clear(); next.add("__all__"); }
      } else {
        next.delete("__all__");
        if (next.has(id)) next.delete(id); else next.add(id);
        if (next.size === 0) next.add("__all__");
      }
      return next;
    });
  };

  const toggleQuadrant = (q: Quadrant) => {
    setSelectedQuadrants((prev) => {
      const next = new Set(prev);
      if (next.has(q)) { next.delete(q); } else { next.add(q); }
      if (next.size === 0) return new Set<Quadrant>(["DO", "SCHEDULE", "DELEGATE", "DELETE"]);
      return next;
    });
  };

  const hasActiveFilters = !showInProgress || !showCompleted || !allGroupsSelected || !allQuadrantsSelected;

  const events = tasks
    .filter((t) => {
      if (!t.dueDate) return false;
      if (t.completed && !showCompleted) return false;
      if (!t.completed && !showInProgress) return false;
      if (!allGroupsSelected) {
        const gId = t.groupId || "__general__";
        if (!selectedGroups.has(gId)) return false;
      }
      if (!selectedQuadrants.has(getQuadrant(t))) return false;
      return true;
    })
    .map((t) => {
      const adjustedTime = t.dueTime && t.dueTime >= "23:30" ? "23:00" : t.dueTime;
      const start = adjustedTime ? `${t.dueDate}T${adjustedTime}` : t.dueDate!;
      return {
        id: t.id,
        title: t.title,
        start,
        allDay: !t.dueTime,
        backgroundColor: t.completed ? "#d1d5db" : quadrantColors[getQuadrant(t)],
        borderColor: "transparent",
        textColor: "#ffffff",
      };
    });

  return (
    <AppShell>
      <div className="h-full p-6 sm:p-8 lg:p-12 relative">
        {/* Filter toggle */}
        <button
          className="absolute top-3 right-3 z-10 flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-light)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-hover)] transition-colors sm:top-4 sm:right-4"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <SlidersHorizontal size={13} />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] text-white font-semibold">!</span>
          )}
        </button>

        {/* Filter sidebar */}
        <div className={`fixed top-0 right-0 z-40 h-full w-72 border-l border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] transition-transform duration-200 ${filterOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filters</h3>
            <button onClick={() => setFilterOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-5">
            {/* Status */}
            <div>
              <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Status</p>
              <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input type="checkbox" checked={showInProgress} onChange={() => setShowInProgress(!showInProgress)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                <span className="text-sm text-[var(--text-primary)]">In progress</span>
              </label>
              <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted(!showCompleted)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                <span className="text-sm text-[var(--text-primary)]">Completed</span>
              </label>
            </div>
            {/* Quadrants */}
            <div>
              <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Quadrant</p>
              {quadrantLabels.map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={selectedQuadrants.has(key)} onChange={() => toggleQuadrant(key)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-[var(--text-primary)]">{label}</span>
                </label>
              ))}
            </div>
            {/* Lists */}
            <div>
              <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Lists</p>
              <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input type="checkbox" checked={allGroupsSelected} onChange={() => toggleGroup("__all__")} className="accent-[var(--accent)] h-3.5 w-3.5" />
                <span className="text-sm text-[var(--text-primary)]">All lists</span>
              </label>
              <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input type="checkbox" checked={allGroupsSelected || selectedGroups.has("__general__")} onChange={() => toggleGroup("__general__")} className="accent-[var(--accent)] h-3.5 w-3.5" />
                <span className="text-sm text-[var(--text-primary)]">General Tasks</span>
              </label>
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={allGroupsSelected || selectedGroups.has(g.id)} onChange={() => toggleGroup(g.id)} className="accent-[var(--accent)] h-3.5 w-3.5" />
                  <span className="text-sm text-[var(--text-primary)]">{g.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {/* Backdrop */}
        {filterOpen && <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setFilterOpen(false)} />}

        <div className="h-full rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 sm:p-6 lg:p-8 shadow-[var(--shadow-sm)]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            events={events}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,dayGridMonth",
            }}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
            height="100%"
            eventClick={(info) => {
              const t = tasks.find((t) => t.id === info.event.id);
              if (t) { setEditTask(t); setTaskModal(true); }
            }}
          />
        </div>
      </div>
      <TaskModal open={taskModal} onOpenChange={setTaskModal} task={editTask} />
    </AppShell>
  );
}
