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
      // Timed event: 15-minute block
      const start = new Date(new Date(`${t.dueDate}T${t.dueTime}`).getTime() -  30 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      cal.createEvent({
        id: doc.id,
        summary: `${t.title}- ${groupName}`,
        description: descParts.join("\n"),
        start,
        end,
        status: t.completed ? ICalEventStatus.CONFIRMED : undefined,
      });
    } else {
      // All-day event
      cal.createEvent({
        id: doc.id,
        summary: `${t.title}- ${groupName}`,
        description: descParts.join("\n"),
        allDay: true,
        start: new Date(`${t.dueDate}T00:00:00`),
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
