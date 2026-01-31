"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { TaskModal } from "@/components/TaskModal";
import type { Task } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
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

export default function CalendarPage() {
  const { user } = useAuth();
  const { tasks } = useTasks(user?.uid);
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const events = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      // Cap times at/after 23:30 to 23:00 so events don't get cut off at the bottom
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
      <div className="h-full p-12">
        <div className="h-full rounded-[var(--radius-lg)] border border-[var(--border-light)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-sm)]">
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
