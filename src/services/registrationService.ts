import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { EventRegistrationWithStatus, EventRegistrationStatus } from '../types/event';

const REGISTRATIONS_SUBCOLLECTION = 'registrations';
const PRIVATE_DETAILS_DOC = 'details';

/**
 * Get one registration for a user and event (with status).
 */
export async function getMyRegistration(
  eventId: string,
  userId: string
): Promise<EventRegistrationWithStatus | null> {
  const regRef = doc(db, 'events', eventId, REGISTRATIONS_SUBCOLLECTION, userId);
  const snap = await getDoc(regRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    userId: snap.id,
    eventId,
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    work: data.work ?? '',
    registeredAt: data.registeredAt,
    status: (data.status as EventRegistrationStatus) ?? 'approved', // legacy: no status = approved
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    approvedAt: data.approvedAt ?? null,
    approvedByAdminId: data.approvedByAdminId ?? null,
    rejectionReason: data.rejectionReason ?? null,
    emailSentAt: data.emailSentAt ?? null,
    checkedIn: data.checkedIn,
    checkedInAt: data.checkedInAt,
    checkedInBy: data.checkedInBy,
    profileImage: data.profileImage ?? null,
    position: data.position,
  };
}

/**
 * Create a registration in PENDING state (or re-pend if cancelled/rejected).
 * One registration per user per event; idempotent for existing pending/approved.
 */
export async function createPending(
  eventId: string,
  userId: string,
  data: { name: string; email: string; phone: string; work: string; profileImage?: string | null; position?: string }
): Promise<{ alreadyRegistered: boolean }> {
  const regRef = doc(db, 'events', eventId, REGISTRATIONS_SUBCOLLECTION, userId);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(regRef);
    if (existing.exists()) {
      const d = existing.data();
      const status = (d.status as EventRegistrationStatus) ?? 'approved';
      if (status === 'pending' || status === 'approved') {
        // Already registered; do nothing
        return;
      }
      // cancelled or rejected: allow re-register as pending
    }

    const now = serverTimestamp();
    tx.set(regRef, {
      ...data,
      status: 'pending',
      registeredAt: now,
      createdAt: now,
      updatedAt: now,
      checkedIn: false,
    });
  });

  const after = await getDoc(regRef);
  const status = after.data()?.status ?? 'approved';
  return { alreadyRegistered: status === 'approved' };
}

/**
 * Set registration to approved and set approvedAt / approvedByAdminId.
 * Idempotent: if already approved, no-op (does not re-send email; that's handled by the API).
 */
export async function approve(
  eventId: string,
  userId: string,
  adminId: string
): Promise<void> {
  const regRef = doc(db, 'events', eventId, REGISTRATIONS_SUBCOLLECTION, userId);
  const snap = await getDoc(regRef);
  if (!snap.exists()) throw new Error('Registration not found');
  const current = snap.data();
  const status = (current.status as EventRegistrationStatus) ?? 'approved';
  if (status === 'approved') return; // idempotent

  await updateDoc(regRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedByAdminId: adminId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Set registration to rejected with optional reason.
 */
export async function reject(
  eventId: string,
  userId: string,
  adminId: string,
  reason?: string | null
): Promise<void> {
  const regRef = doc(db, 'events', eventId, REGISTRATIONS_SUBCOLLECTION, userId);
  await updateDoc(regRef, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
    rejectionReason: reason ?? null,
    approvedByAdminId: adminId, // optional: store who rejected
  });
}

/**
 * List registrations for one event, optionally filtered by status.
 * Legacy docs without status are treated as 'approved'.
 */
export async function listEventRegistrations(
  eventId: string,
  options?: { status?: EventRegistrationStatus }
): Promise<EventRegistrationWithStatus[]> {
  const ref = collection(db, 'events', eventId, REGISTRATIONS_SUBCOLLECTION);
  let snapshot;
  if (options?.status === 'pending') {
    const q = query(ref, where('status', '==', 'pending'), orderBy('registeredAt', 'desc'));
    snapshot = await getDocs(q);
  } else if (options?.status === 'rejected') {
    const q = query(ref, where('status', '==', 'rejected'), orderBy('registeredAt', 'desc'));
    snapshot = await getDocs(q);
  } else {
    const q = query(ref, orderBy('registeredAt', 'desc'));
    snapshot = await getDocs(q);
  }
  const mapDoc = (d: any) => {
    const data = d.data();
    const status = (data.status as EventRegistrationStatus) ?? 'approved';
    return {
      userId: d.id,
      eventId,
      name: data.name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      work: data.work ?? '',
      registeredAt: data.registeredAt,
      status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      approvedAt: data.approvedAt ?? null,
      approvedByAdminId: data.approvedByAdminId ?? null,
      rejectionReason: data.rejectionReason ?? null,
      emailSentAt: data.emailSentAt ?? null,
      checkedIn: data.checkedIn,
      checkedInAt: data.checkedInAt,
      checkedInBy: data.checkedInBy,
      profileImage: data.profileImage ?? null,
      position: data.position,
    };
  };
  let list = snapshot.docs.map((d) => mapDoc(d));
  if (options?.status === 'approved') {
    list = list.filter((r) => r.status === 'approved');
  }
  return list;
}

/**
 * List pending (or other status) registrations across all events.
 * Returns rows with eventId; caller can join event names/dates.
 */
export async function listPendingRegistrations(filters: {
  status?: EventRegistrationStatus;
  eventId?: string;
  limit?: number;
}): Promise<Array<EventRegistrationWithStatus & { eventId: string }>> {
  const { status = 'pending', eventId, limit = 500 } = filters;
  if (eventId) {
    const list = await listEventRegistrations(eventId, { status });
    return list.slice(0, limit).map((r) => ({ ...r, eventId }));
  }
  // All events: get all events then for each get registrations (status = pending)
  const eventsSnap = await getDocs(
    query(collection(db, 'events'), orderBy('createdAt', 'desc'))
  );
  const results: Array<EventRegistrationWithStatus & { eventId: string }> = [];
  for (const eventDoc of eventsSnap.docs) {
    const list = await listEventRegistrations(eventDoc.id, { status });
    for (const r of list) {
      results.push({ ...r, eventId: eventDoc.id });
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  return results;
}
