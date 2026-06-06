import { db } from "./config";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// ─── EVENTS ───────────────────────────────────────────
export const createEvent = async (data: any) => {
  return await addDoc(collection(db, "events"), {
    ...data,
    createdAt: Timestamp.now(),
    participants: [],
    pendingParticipants: [],
  });
};

export const getEvents = async () => {
  const snap = await getDocs(collection(db, "events"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getEvent = async (id: string) => {
  const snap = await getDoc(doc(db, "events", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateEvent = async (id: string, data: any) => {
  await updateDoc(doc(db, "events", id), data);
};

export const deleteEvent = async (id: string) => {
  await deleteDoc(doc(db, "events", id));
};

// ─── JOIN / LEAVE ──────────────────────────────────────
export const joinEvent = async (eventId: string, user: any) => {
  await updateDoc(doc(db, "events", eventId), {
    pendingParticipants: arrayUnion({
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      status: "pending",
    }),
  });
};

export const leaveEvent = async (eventId: string, user: any) => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const updated = (data?.pendingParticipants ?? []).filter(
    (p: any) => p.uid !== user.uid,
  );
  await updateDoc(doc(db, "events", eventId), {
    pendingParticipants: updated,
  });
};

// ─── ATTENDANCE ────────────────────────────────────────
export const updateParticipantStatus = async (
  eventId: string,
  uid: string,
  status: "approved" | "rejected",
) => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const updated = (data?.pendingParticipants ?? []).map((p: any) =>
    p.uid === uid ? { ...p, status } : p,
  );
  await updateDoc(doc(db, "events", eventId), {
    pendingParticipants: updated,
  });
};

export const approveAll = async (eventId: string) => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const updated = (data?.pendingParticipants ?? []).map((p: any) =>
    p.status !== "rejected" ? { ...p, status: "approved" } : p,
  );
  await updateDoc(doc(db, "events", eventId), {
    pendingParticipants: updated,
  });
};

// ─── BADGES ───────────────────────────────────────────
export const awardBadge = async (
  eventId: string,
  eventTitle: string,
  user: any,
  badgeDesign: any,
) => {
  await addDoc(collection(db, "badges"), {
    eventId,
    eventTitle,
    userId: user.uid,
    userName: user.name ?? user.userName ?? "",
    userEmail: user.email,
    shape: badgeDesign.shape,
    color: badgeDesign.color,
    emoji: badgeDesign.emoji ?? null,
    logoUrl: badgeDesign.logoUrl ?? null,
    awardedAt: Timestamp.now(),
  });
};

export const updateBadge = async (
  eventId: string,
  userId: string,
  badgeDesign: any,
) => {
  const snap = await getDocs(collection(db, "badges"));
  const matches = snap.docs.filter(
    (d) => d.data().eventId === eventId && d.data().userId === userId,
  );
  for (const match of matches) {
    await updateDoc(doc(db, "badges", match.id), {
      shape: badgeDesign.shape,
      color: badgeDesign.color,
      emoji: badgeDesign.emoji,
    });
  }
};

export const revokeBadge = async (eventId: string, userId: string) => {
  const q = query(
    collection(db, "badges"),
    where("eventId", "==", eventId),
    where("userId", "==", userId),
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => deleteDoc(doc(db, "badges", d.id)));
};

export const getUserBadges = async (userId: string) => {
  const snap = await getDocs(collection(db, "badges"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d: any) => d.userId === userId);
};

// ─── USER PROFILE ─────────────────────────────────────
export const saveUserProfile = async (uid: string, data: any) => {
  await setDoc(doc(db, "users", uid), { uid, ...data }, { merge: true });
};

export const getUserProfile = async (uid: string) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

// ─── FEEDBACK ─────────────────────────────────────────
export const submitFeedback = async (
  eventId: string,
  userId: string,
  feedback: string,
) => {
  await addDoc(collection(db, "feedback"), {
    eventId,
    userId,
    feedback,
    submittedAt: Timestamp.now(),
  });
};
