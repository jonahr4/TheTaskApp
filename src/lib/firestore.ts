import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Task, TaskGroup } from "./types";

// --- Tasks ---

function tasksCol(uid: string) {
  return collection(db, "users", uid, "tasks");
}

export function tasksQuery(uid: string) {
  return query(tasksCol(uid), orderBy("order", "asc"));
}

export async function createTask(
  uid: string,
  data: Omit<Task, "id" | "createdAt" | "updatedAt">
) {
  return addDoc(tasksCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(
  uid: string,
  taskId: string,
  data: Partial<Omit<Task, "id" | "createdAt">>
) {
  return updateDoc(doc(db, "users", uid, "tasks", taskId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(uid: string, taskId: string) {
  return deleteDoc(doc(db, "users", uid, "tasks", taskId));
}

// --- Task Groups ---

function groupsCol(uid: string) {
  return collection(db, "users", uid, "taskGroups");
}

export function groupsQuery(uid: string) {
  return query(groupsCol(uid), orderBy("order", "asc"));
}

export async function createGroup(
  uid: string,
  data: Omit<TaskGroup, "id" | "createdAt">
) {
  return addDoc(groupsCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateGroup(
  uid: string,
  groupId: string,
  data: Partial<Omit<TaskGroup, "id" | "createdAt">>
) {
  return updateDoc(doc(db, "users", uid, "taskGroups", groupId), data);
}

export async function deleteGroup(uid: string, groupId: string) {
  return deleteDoc(doc(db, "users", uid, "taskGroups", groupId));
}

// --- Calendar Token ---

export async function getOrCreateCalendarToken(uid: string): Promise<string> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().calendarToken) {
    return snap.data().calendarToken as string;
  }
  const token = crypto.randomUUID();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await setDoc(ref, { calendarToken: token, uid, timezone }, { merge: true });
  return token;
}
