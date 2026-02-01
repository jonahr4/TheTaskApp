import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up user by calendarToken
  const usersSnap = await adminDb
    .collection("users")
    .where("calendarToken", "==", token)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const userDoc = usersSnap.docs[0];
  const uid = userDoc.data().uid || userDoc.id;
  const userTimezone = userDoc.data().timezone || "America/New_York";

  // Fetch tasks
  const tasksSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("tasks")
    .orderBy("order", "asc")
    .get();

  // Fetch groups for naming
  const groupsSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("taskGroups")
    .get();

  const groupNames = new Map<string, string>();
  groupsSnap.forEach((doc) => {
    groupNames.set(doc.id, doc.data().name);
  });

  // Build calendar
  const cal = ical({
    name: "TaskApp",
    method: ICalCalendarMethod.PUBLISH,
    prodId: { company: "TaskApp", product: "TaskApp Calendar" },
    ttl: 900, // suggest 15-minute refresh
    timezone: userTimezone,
  });

  tasksSnap.forEach((doc) => {
    const t = doc.data();
    if (!t.dueDate) return; // skip tasks without due date

    const quadrant = getQuadrant(t.urgent, t.important);
    const groupName = t.groupId ? (groupNames.get(t.groupId) ?? "General Tasks") : "General Tasks";

    const descParts: string[] = [];
    if (t.notes) descParts.push(t.notes);
    descParts.push(`Due: ${t.dueDate}${t.dueTime ? " at " + t.dueTime : ""}`);
    descParts.push(`Priority: ${quadrant}`);
    descParts.push(`List: ${groupName}`);
    if (t.completed) descParts.push("Status: Completed");

    if (t.dueTime) {
      // Timed event: 30-minute block ending at due time
      // Parse as minutes to avoid timezone issues with Date
      const [h, m] = t.dueTime.split(":").map(Number);
      const dueMinutes = h * 60 + m;
      const startMinutes = dueMinutes - 30;
      const startH = Math.floor((startMinutes + 1440) % 1440 / 60);
      const startM = ((startMinutes % 60) + 60) % 60;
      const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
      cal.createEvent({
        id: doc.id,
        summary: `${t.title}- ${groupName}`,
        description: descParts.join("\n"),
        start: `${t.dueDate}T${startTime}:00`,
        end: `${t.dueDate}T${t.dueTime}:00`,
        timezone: userTimezone,
        status: t.completed ? ICalEventStatus.CONFIRMED : undefined,
      });
    } else {
      // All-day event
      cal.createEvent({
        id: doc.id,
        summary: `${t.title}- ${groupName}`,
        description: descParts.join("\n"),
        allDay: true,
        start: `${t.dueDate}T00:00:00`,
        timezone: userTimezone,
        status: t.completed ? ICalEventStatus.CONFIRMED : undefined,
      });
    }
  });

  return new NextResponse(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="taskapp.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function getQuadrant(urgent: boolean, important: boolean): string {
  if (urgent && important) return "Do First";
  if (!urgent && important) return "Schedule";
  if (urgent && !important) return "Delegate";
  return "Eliminate";
}
