import { db } from "./config";
import type { FeedbackFormConfig, XPLogSource, ExamRegistrationStatus } from "@talentbank/shared";
import { XP_REWARDS, computeLevel, xpCapForLevel } from "@talentbank/shared";
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
  orderBy,
  onSnapshot,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// ─── XP SYSTEM ────────────────────────────────────────────────────────────────
// XP_REWARDS, computeLevel, xpCapForLevel are imported from @talentbank/shared
export { XP_REWARDS, computeLevel, xpCapForLevel } from "@talentbank/shared";

async function writeXPLog(uid: string, amount: number, source: XPLogSource, label: string): Promise<void> {
  await addDoc(collection(db, "users", uid, "xpLogs"), { amount, source, label, createdAt: Timestamp.now() });
}

async function awardXP(uid: string, amount: number, source: XPLogSource, label: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const current = (snap.data()?.xp ?? 0) as number;
  const newXp = current + amount;
  await setDoc(userRef, { xp: newXp, level: computeLevel(newXp) }, { merge: true });
  await writeXPLog(uid, amount, source, label);
}

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

export const updateEventFeedbackForm = async (
  eventId: string,
  feedbackForm: FeedbackFormConfig,
): Promise<void> => {
  await updateDoc(doc(db, "events", eventId), { feedbackForm });
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

// Replaces joinEvent — generates unique checkinCode for QR display
// Also writes uid to participants[] so events are queryable with array-contains
export const joinEventWithCode = async (
  eventId: string,
  user: any,
  registrationData?: Record<string, string | boolean>,
): Promise<string> => {
  const checkinCode = crypto.randomUUID();
  const shortCode   = Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0");
  const participant: any = {
    uid:         user.uid,
    email:       user.email,
    name:        user.displayName ?? user.name ?? "",
    status:      "registered",
    checkinCode,
    shortCode,
  };
  if (registrationData && Object.keys(registrationData).length > 0) {
    participant.registrationData = registrationData;
  }
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const existingParticipants: string[] = eventSnap.data()?.participants ?? [];
  await updateDoc(doc(db, "events", eventId), {
    participants: arrayUnion(user.uid),
    pendingParticipants: arrayUnion(participant),
  });
  if (!existingParticipants.includes(user.uid)) {
    await awardXP(user.uid, XP_REWARDS.register, 'register', `Registered for ${eventSnap.data()?.title ?? 'event'}`);
  }
  return checkinCode;
};

// Admin scans student QR → marks status as checked_in
export const markCheckedIn = async (eventId: string, checkinCode: string): Promise<boolean> => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const participants = data?.pendingParticipants ?? [];
  const idx = participants.findIndex(
    (p: any) => p.checkinCode === checkinCode || p.shortCode === checkinCode,
  );
  if (idx === -1) return false;
  const wasAlreadyCheckedIn = participants[idx].status === "checked_in";
  const updated = participants.map((p: any, i: number) =>
    i === idx ? { ...p, status: "checked_in", checkedInAt: Timestamp.now() } : p,
  );
  await updateDoc(doc(db, "events", eventId), { pendingParticipants: updated });
  if (!wasAlreadyCheckedIn && participants[idx].uid) {
    await awardXP(participants[idx].uid, XP_REWARDS.checkin, 'checkin', 'Checked in at event');
  }
  return true;
};

// Student submits photo + feedback after event
export const submitEventWork = async (
  eventId: string,
  uid: string,
  photoUrl: string,
  feedback: string,
): Promise<void> => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const participants: any[] = data?.pendingParticipants ?? [];
  const participant = participants.find((p: any) => p.uid === uid);
  const wasCheckedIn = participant?.status === "checked_in";
  const updated = participants.map((p: any) =>
    p.uid === uid
      ? {
          ...p,
          status: "submitted",
          submission: { photoUrl, feedback, submittedAt: Timestamp.now() },
        }
      : p,
  );
  await updateDoc(doc(db, "events", eventId), { pendingParticipants: updated });
  if (wasCheckedIn) {
    await awardXP(uid, XP_REWARDS.submit, 'submit', 'Submitted event work');
  }
};

export const leaveEvent = async (eventId: string, user: any) => {
  const eventSnap = await getDoc(doc(db, "events", eventId));
  const data = eventSnap.data();
  const updated = (data?.pendingParticipants ?? []).filter(
    (p: any) => p.uid !== user.uid,
  );
  await updateDoc(doc(db, "events", eventId), {
    participants: arrayRemove(user.uid),
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
  const participants: any[] = data?.pendingParticipants ?? [];
  const participant = participants.find((p: any) => p.uid === uid);
  const wasAlreadyApproved = participant?.status === "approved";
  const updated = participants.map((p: any) =>
    p.uid === uid ? { ...p, status } : p,
  );
  await updateDoc(doc(db, "events", eventId), {
    pendingParticipants: updated,
  });
  if (status === "approved" && !wasAlreadyApproved) {
    await awardXP(uid, XP_REWARDS.approve, 'approve', 'Submission approved');
  }
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
    badgeImageUrl: badgeDesign.badgeImageUrl ?? null,
    xpValue: XP_REWARDS.approve,
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
      badgeImageUrl: badgeDesign.badgeImageUrl ?? null,
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

export const updateBadgeVoucher = async (
  badgeId: string,
  voucherObjectId: string,
  voucherTxHash: string,
): Promise<void> => {
  await updateDoc(doc(db, "badges", badgeId), {
    "onChain.voucherObjectId": voucherObjectId,
    "onChain.voucherTxHash": voucherTxHash,
    "onChain.voucherIssuedAt": Timestamp.now(),
  });
};

export const updateBadgeOnChain = async (
  badgeId: string,
  txHash: string,
  objectId: string,
): Promise<void> => {
  await updateDoc(doc(db, "badges", badgeId), {
    onChain: { txHash, objectId, mintedAt: Timestamp.now() },
  });
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

// ─── ADMIN MANAGEMENT ─────────────────────────────────
export type AdminStatus = "pending" | "approved" | "rejected";
export type AdminRole = "admin" | "super_admin";

export interface AdminDoc {
  uid: string;
  email: string;
  displayName: string;
  clubSociety: string;
  status: AdminStatus;
  role: AdminRole;
  createdAt: any;
  approvedAt?: any;
  approvedBy?: string;
}

export const getAdminDoc = async (uid: string): Promise<AdminDoc | null> => {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists() ? (snap.data() as AdminDoc) : null;
};

export const createAdminRequest = async (
  uid: string,
  email: string,
  displayName: string,
  clubSociety: string,
  role: AdminRole = "admin",
) => {
  await setDoc(doc(db, "admins", uid), {
    uid,
    email,
    displayName,
    clubSociety,
    status: role === "super_admin" ? "approved" : "pending",
    role,
    createdAt: Timestamp.now(),
  });
};

export const getPendingAdmins = async (): Promise<AdminDoc[]> => {
  const q = query(collection(db, "admins"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AdminDoc);
};

export const updateAdminStatus = async (
  uid: string,
  status: AdminStatus,
  approvedBy?: string,
) => {
  const data: any = { status };
  if (status === "approved") {
    data.approvedAt = Timestamp.now();
    data.approvedBy = approvedBy ?? null;
  }
  await updateDoc(doc(db, "admins", uid), data);
};

// ─── CERT EXAMS ───────────────────────────────────────────────────────────────

export const getCertExams = async () => {
  const snap = await getDocs(collection(db, "certExams"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getCertExam = async (id: string) => {
  const snap = await getDoc(doc(db, "certExams", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createCertExam = async (data: any) => {
  return await addDoc(collection(db, "certExams"), {
    ...data,
    registeredCount: 0,
    createdAt: Timestamp.now(),
  });
};

export const updateCertExam = async (id: string, data: any) => {
  await updateDoc(doc(db, "certExams", id), data);
};

export const deleteCertExam = async (id: string) => {
  await deleteDoc(doc(db, "certExams", id));
};

// ─── EXAM REGISTRATIONS ───────────────────────────────────────────────────────

export const getUserExamRegistrations = async (userId: string) => {
  const q = query(collection(db, "examRegistrations"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getExamRegistrations = async (examId: string) => {
  const q = query(collection(db, "examRegistrations"), where("examId", "==", examId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const registerForExam = async (
  examId: string,
  user: { uid: string; xp: number; displayName?: string; email?: string },
  exam: { requiredXP: number; registeredCount: number; maxSlots: number },
): Promise<void> => {
  if (user.xp < exam.requiredXP) throw new Error('INSUFFICIENT_XP');
  if (exam.registeredCount >= exam.maxSlots) throw new Error('EXAM_FULL');

  const existing = await getUserExamRegistrations(user.uid);
  const duplicate = existing.find((r: any) => r.examId === examId);
  if (duplicate) throw new Error('ALREADY_REGISTERED');

  await addDoc(collection(db, "examRegistrations"), {
    userId: user.uid,
    userName: user.displayName ?? '',
    userEmail: user.email ?? '',
    examId,
    registeredAt: Timestamp.now(),
    status: 'registered',
  });
  await updateDoc(doc(db, "certExams", examId), { registeredCount: increment(1) });
  // Deduct XP from user (spend mechanic)
  await updateDoc(doc(db, "users", user.uid), { xp: increment(-exam.requiredXP) });
  // Log the XP spend
  await addDoc(collection(db, "users", user.uid, "xpLogs"), {
    amount: -exam.requiredXP,
    source: 'exam_redeem',
    label: 'Redeemed XP for cert exam registration',
    createdAt: Timestamp.now(),
  });
};

export const updateExamRegistrationStatus = async (
  regId: string,
  status: ExamRegistrationStatus,
  certPdfUrl?: string | null,
) => {
  const data: any = { status };
  if (certPdfUrl !== undefined) data.certPdfUrl = certPdfUrl;
  await updateDoc(doc(db, "examRegistrations", regId), data);
};

// ─── XP LOGS ─────────────────────────────────────────────────────────────────

export const getUserXPLogs = async (userId: string) => {
  const q = query(
    collection(db, "users", userId, "xpLogs"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── CERT MARKET ─────────────────────────────────────────────────────────────

export const getCerts = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, "certs"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c: any) => !c.archived);
};

export const saveCert = async (uid: string, certId: string): Promise<void> => {
  await setDoc(doc(db, "users", uid, "savedCerts", certId), {
    certId,
    savedAt: Timestamp.now(),
  });
};

export const unsaveCert = async (uid: string, certId: string): Promise<void> => {
  await deleteDoc(doc(db, "users", uid, "savedCerts", certId));
};

export const listenSavedCerts = (uid: string, callback: (certIds: string[]) => void) => {
  return onSnapshot(collection(db, "users", uid, "savedCerts"), (snap) => {
    callback(snap.docs.map((d) => d.id));
  });
};

export const enrollInCert = async (uid: string, cert: any): Promise<void> => {
  await setDoc(doc(db, "users", uid, "enrollments", cert.id), {
    certId: cert.id,
    status: "enrolled",
    progress: 0,
    enrolledAt: Timestamp.now(),
    completedAt: null,
    certificateUrl: null,
  });
  await updateDoc(doc(db, "certs", cert.id), { enrollCount: increment(1) });
  await addDoc(collection(db, "badges"), {
    eventId: `cert-${cert.id}`,
    eventTitle: cert.title,
    userId: uid,
    userName: "",
    userEmail: "",
    shape: "diamond",
    color: "#a855f7",
    emoji: "🎓",
    xpValue: 50,
    awardedAt: Timestamp.now(),
  });
};

export const listenEnrollments = (uid: string, callback: (enrollments: any[]) => void) => {
  return onSnapshot(collection(db, "users", uid, "enrollments"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const updateCertPreferences = async (uid: string, cert: any): Promise<void> => {
  await setDoc(
    doc(db, "users", uid, "certPreferences", "data"),
    {
      categories: { [cert.category]: increment(1) },
      levels: { [cert.level]: increment(1) },
      priceRange: cert.price === 0 ? "free" : "paid",
      lastUpdated: Timestamp.now(),
    },
    { merge: true },
  );
};

export const getCertPreferences = async (uid: string): Promise<any | null> => {
  const snap = await getDoc(doc(db, "users", uid, "certPreferences", "data"));
  return snap.exists() ? snap.data() : null;
};

export const createCert = async (data: any) => {
  return await addDoc(collection(db, "certs"), {
    ...data,
    enrollCount: 0,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const updateCert = async (id: string, data: any) => {
  await updateDoc(doc(db, "certs", id), { ...data, updatedAt: Timestamp.now() });
};

export const archiveCert = async (id: string) => {
  await updateDoc(doc(db, "certs", id), { archived: true, updatedAt: Timestamp.now() });
};

export const updateCertEnrollment = async (
  uid: string,
  certId: string,
  data: Partial<{ status: string; progress: number; certificateUrl: string | null; completedAt: any }>,
) => {
  await updateDoc(doc(db, "users", uid, "enrollments", certId), data);
};
