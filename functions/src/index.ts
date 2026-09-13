/**
 * ACTIVA Hotline — Cloud Functions (Phase 3)
 *
 * These are the real business-logic authority for sensitive Case mutations,
 * per docs/ARCHITECTURE.md: "the client never decides a sensitive mutation
 * alone". Every callable here re-derives the caller's identity from the
 * verified Firebase Auth ID token (never trusts anything the client sends
 * about who it is), then reuses the EXACT SAME domain logic already proven
 * in `src/domain/permissions.ts` / `src/domain/workflow.ts` and exercised
 * against real data by `scripts/firestoreAdminRepository.ts` — so client,
 * rules, and functions can never quietly disagree about what's allowed.
 *
 * STATUS: written and locally type-checked, NOT deployed. Deploying
 * requires the project's Cloud Billing (Blaze plan) and Cloud
 * Functions/Cloud Build APIs, which are not reachable with the credentials
 * available to this session (Cloud Billing API returned SERVICE_DISABLED,
 * `firebase functions:list` failed) — see docs/FIREBASE-SETUP.md for exactly
 * what is needed to finish this. This is 3 of the ~15 operations listed in
 * `src/data-access/caseRepository.ts`'s `CaseRepository` interface
 * (createCase, assignCase, changeCaseStatus) as a representative, complete
 * implementation of the pattern — the rest (addEvidence, addCorrectiveAction,
 * addCommunication, setAllegationFinding, ...) follow identically and are
 * listed at the bottom of this file as the remaining Phase 3 backlog.
 */

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

import { Allegation, AppUser, Case, CaseStatus, Communication, CorrectiveAction, Person, RoleId } from '../../src/domain/caseTypes';
import { can, implicatedUserIdsFromPersons } from '../../src/domain/permissions';
import { checkTransition, deriveOverallFinding } from '../../src/domain/workflow';
// === AMÉLIORATION AJOUTÉE : réutilise le HASH/SALT existant, jamais réimplémenté ===
// Same salted, iterated-SHA256 verification already used by the legacy
// client-side AlertTrackingView (src/components/AlertTrackingView.tsx) —
// imported, not re-derived, so client and server can never disagree about
// what a valid access code hash looks like. Works in this Node 20 runtime
// because `crypto.subtle`/`crypto.getRandomValues` are Node's built-in
// global WebCrypto implementation, not a browser-only API.
import { verifyPassword } from '../../src/services/crypto';

initializeApp();
const db = getFirestore();

/** Builds the AppUser the domain layer expects from a verified callable request's auth context. */
function requireAppUser(request: CallableRequest): AppUser {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const token = request.auth.token as { role?: RoleId; countries?: string[]; entities?: string[] };
  if (!token.role) {
    throw new HttpsError('permission-denied', 'This account has no ACTIVA Hotline role assigned.');
  }
  return {
    userId: request.auth.uid,
    name: (token as { name?: string }).name ?? request.auth.token.email ?? request.auth.uid,
    email: request.auth.token.email ?? '',
    roleId: token.role,
    countries: token.countries ?? [],
    entities: token.entities ?? [],
    active: true,
    mfaEnabled: false,
    createdAt: new Date(0).toISOString(),
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function nextCaseSequence(): Promise<number> {
  const counterRef = db.collection('counters').doc('cases');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? (snap.data()?.value as number) : 0) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

async function appendAudit(entry: { actorId: string; action: string; caseId?: string; previousValue?: unknown; newValue?: unknown; reason?: string }) {
  const id = newId('audv2');
  await db.collection('audit_logs').doc(id).set({ ...entry, id, timestamp: new Date().toISOString() });
}

async function appendTimeline(caseId: string, label: string, actor: string, details?: string) {
  const eventId = newId('tl');
  await db.collection('cases').doc(caseId).collection('timeline').doc(eventId).set({
    eventId,
    caseId,
    label,
    actor,
    timestamp: new Date().toISOString(),
    details: details ?? null,
  });
}

// ---------------------------------------------------------------------------
// createCase
// ---------------------------------------------------------------------------

export const createCase = onCall(async (request) => {
  const user = requireAppUser(request);
  if (!can(user, 'cases.create')) {
    throw new HttpsError('permission-denied', 'This role cannot create cases.');
  }

  const data = request.data as Pick<Case, 'category' | 'subcategory' | 'country' | 'entity' | 'reportingMode' | 'description' | 'confidentialityLevel'>;
  if (!data?.category || !data?.country || !data?.entity || !data?.description) {
    throw new HttpsError('invalid-argument', 'category, country, entity and description are required.');
  }

  const seq = await nextCaseSequence();
  const caseId = newId('case');
  const nowIso = new Date().toISOString();
  const kase: Case = {
    caseId,
    caseNumber: `CASE-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`,
    status: 'new',
    category: data.category,
    subcategory: data.subcategory ?? '',
    country: data.country,
    entity: data.entity,
    reportingMode: data.reportingMode ?? 'anonymous',
    priority: 'low', // set by a subsequent risk-assessment call — never fabricated here
    riskScore: 0,
    confidentialityLevel: data.confidentialityLevel ?? 'confidential',
    additionalInvestigators: [],
    slaStatus: 'ok',
    receivedAt: nowIso,
    incidentDateUnknown: true,
    description: data.description,
    legalHold: false,
    implicatedUserIds: [],
    createdAt: nowIso,
    createdBy: user.userId,
    updatedAt: nowIso,
    updatedBy: user.userId,
  };

  await db.collection('cases').doc(caseId).set(kase);
  await appendTimeline(caseId, 'CASE_CREATED', user.userId);
  await appendAudit({ actorId: user.userId, action: 'CASE_CREATED', caseId, newValue: kase.status });

  return { caseId, caseNumber: kase.caseNumber };
});

// ---------------------------------------------------------------------------
// assignCase
// ---------------------------------------------------------------------------

export const assignCase = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, assignee, additionalInvestigators } = request.data as { caseId: string; assignee: string; additionalInvestigators?: string[] };
  if (!caseId || !assignee) throw new HttpsError('invalid-argument', 'caseId and assignee are required.');

  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Case ${caseId} not found.`);
  const kase = snap.data() as Case;

  const personsSnap = await ref.collection('persons').get();
  const implicated = implicatedUserIdsFromPersons(personsSnap.docs.map((d) => d.data() as Person));
  if (!can(user, 'cases.assign', { case: kase, implicatedUserIds: implicated })) {
    throw new HttpsError('permission-denied', 'Not authorized to assign this case.');
  }

  const previous = { assignee: kase.assignee, additionalInvestigators: kase.additionalInvestigators };
  await ref.update({
    assignee,
    additionalInvestigators: additionalInvestigators ?? [],
    updatedAt: new Date().toISOString(),
    updatedBy: user.userId,
  });
  await appendTimeline(caseId, 'ASSIGNED', user.userId, `Assignee: ${assignee}`);
  await appendAudit({ actorId: user.userId, action: 'CASE_ASSIGNED', caseId, previousValue: previous, newValue: { assignee, additionalInvestigators } });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// changeCaseStatus
// ---------------------------------------------------------------------------

export const changeCaseStatus = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, to, reason } = request.data as { caseId: string; to: CaseStatus; reason?: string };
  if (!caseId || !to) throw new HttpsError('invalid-argument', 'caseId and to are required.');

  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Case ${caseId} not found.`);
  const kase = snap.data() as Case;

  const personsSnap = await ref.collection('persons').get();
  const implicated = implicatedUserIdsFromPersons(personsSnap.docs.map((d) => d.data() as Person));
  const requiredPermission = to === 'closed' ? 'cases.close' : 'cases.edit';
  if (!can(user, requiredPermission, { case: kase, implicatedUserIds: implicated })) {
    throw new HttpsError('permission-denied', 'Not authorized to change this case status.');
  }

  const [allegationsSnap, actionsSnap] = await Promise.all([
    ref.collection('allegations').get(),
    ref.collection('corrective_actions').get(),
  ]);
  const allegations = allegationsSnap.docs.map((d) => d.data() as Allegation);
  const correctiveActions = actionsSnap.docs.map((d) => d.data() as CorrectiveAction);

  const result = checkTransition(kase.status, to, { allegations, correctiveActions });
  if (!result.allowed) {
    await appendAudit({ actorId: user.userId, action: 'STATUS_CHANGE_REJECTED', caseId, previousValue: kase.status, newValue: to, reason: result.reason });
    throw new HttpsError('failed-precondition', result.reason ?? 'Transition not allowed.');
  }

  const previousStatus = kase.status;
  await ref.update({
    status: to,
    updatedAt: new Date().toISOString(),
    updatedBy: user.userId,
    ...(to === 'closed' ? { closedAt: new Date().toISOString(), closedBy: user.userId } : {}),
    ...(to === 'archived' ? { archivedAt: new Date().toISOString() } : {}),
    ...(to === 'closed' ? { overallFinding: deriveOverallFinding(allegations) ?? FieldValue.delete() } : {}),
  });
  await appendTimeline(caseId, `STATUS_${previousStatus}_TO_${to}`.toUpperCase(), user.userId, reason);
  await appendAudit({ actorId: user.userId, action: 'STATUS_CHANGED', caseId, previousValue: previousStatus, newValue: to, reason });

  return { ok: true, status: to };
});

// ---------------------------------------------------------------------------
// getCaseForReporter
// === AMÉLIORATION AJOUTÉE ===
// The one operation reporters actually need — they hold no Firebase Auth
// token in this design (see docs/DATABASE.md), so this deliberately does
// NOT call requireAppUser(): access is granted purely by knowing the real
// caseNumber + accessCode pair, verified server-side against
// `reporter_credentials/{caseId}` (never exposed to any client directly —
// `firestore.rules` closes that collection entirely). This finally moves
// password verification and rate limiting to a trusted backend, which is
// exactly what src/services/rateLimiter.ts's own header comment says is
// still missing ("true rate limiting must ultimately be enforced
// server-side"): the client-side limiter in that file is a real, useful
// throttle for the legacy demo, but it is not this function's authority —
// this one tracks attempts in Firestore (`rate_limits/{caseNumber}`),
// which a client cannot reset by clearing localStorage or switching
// browsers. Same thresholds as the client limiter (5 attempts / 5 minute
// lockout) so the UX doesn't change, only where it's actually enforced.
//
// Never distinguishes "no such case" from "wrong access code" in its
// response — same discipline as the Phase 4b CaseLookup finding
// (docs/SECURITY.md): existence is never leaked to an unauthorized caller.
// ---------------------------------------------------------------------------

const REPORTER_RATE_LIMIT_MAX_ATTEMPTS = 5; // mirrors src/services/rateLimiter.ts MAX_ATTEMPTS
const REPORTER_RATE_LIMIT_LOCKOUT_MS = 5 * 60 * 1000; // mirrors src/services/rateLimiter.ts LOCKOUT_MS

async function assertReporterNotRateLimited(key: string): Promise<void> {
  const snap = await db.collection('rate_limits').doc(key).get();
  const data = snap.exists ? (snap.data() as { lockedUntil?: number }) : undefined;
  if (data?.lockedUntil && data.lockedUntil > Date.now()) {
    const remainingSeconds = Math.ceil((data.lockedUntil - Date.now()) / 1000);
    throw new HttpsError('resource-exhausted', `Too many failed attempts. Try again in ${remainingSeconds}s.`);
  }
}

async function recordReporterAttempt(key: string, success: boolean): Promise<void> {
  const ref = db.collection('rate_limits').doc(key);
  if (success) {
    await ref.delete().catch(() => undefined); // clears the counter, mirrors clearAttempts()
    return;
  }
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? (snap.data() as { count?: number; lockedUntil?: number }) : {};
    let count = data.count ?? 0;
    if (data.lockedUntil && data.lockedUntil <= now) count = 0; // previous lock expired, start fresh
    count += 1;
    const update: { count: number; lockedUntil?: number } = { count };
    if (count >= REPORTER_RATE_LIMIT_MAX_ATTEMPTS) update.lockedUntil = now + REPORTER_RATE_LIMIT_LOCKOUT_MS;
    tx.set(ref, update, { merge: true });
  });
}

export const getCaseForReporter = onCall(async (request) => {
  const { caseNumber, accessCode } = request.data as { caseNumber?: string; accessCode?: string };
  if (!caseNumber || !accessCode) {
    throw new HttpsError('invalid-argument', 'caseNumber and accessCode are required.');
  }
  const key = caseNumber.trim().toUpperCase();
  const invalid = () => new HttpsError('permission-denied', 'Invalid case number or access code.');

  await assertReporterNotRateLimited(key);

  const querySnap = await db.collection('cases').where('caseNumber', '==', key).limit(1).get();
  if (querySnap.empty) {
    await recordReporterAttempt(key, false);
    throw invalid();
  }
  const caseDoc = querySnap.docs[0];
  const kase = caseDoc.data() as Case;

  const credsSnap = await db.collection('reporter_credentials').doc(caseDoc.id).get();
  if (!credsSnap.exists) {
    await recordReporterAttempt(key, false);
    throw invalid();
  }
  const creds = credsSnap.data() as { accessCodeHash: string; accessCodeSalt: string };
  const passwordOk = await verifyPassword(accessCode, creds.accessCodeSalt, creds.accessCodeHash);
  if (!passwordOk) {
    await recordReporterAttempt(key, false);
    throw invalid();
  }

  await recordReporterAttempt(key, true);

  const commsSnap = await caseDoc.ref.collection('communications').orderBy('createdAt', 'asc').get();
  const communications = commsSnap.docs.map((d) => d.data() as Communication);

  await appendAudit({ actorId: 'reporter', action: 'CASE_ACCESSED_BY_REPORTER', caseId: caseDoc.id });

  // Deliberately narrow, reporter-safe view — mirrors exactly what the
  // legacy AlertTrackingView already shows a reporter (status, description,
  // communications), never allegations/persons/evidence/investigation_notes/
  // assignee identity/confidentialityLevel, none of which a reporter is
  // meant to see (see docs/DATABASE.md).
  return {
    caseNumber: kase.caseNumber,
    status: kase.status,
    receivedAt: kase.receivedAt,
    description: kase.description,
    communications,
  };
});

// ---------------------------------------------------------------------------
// Remaining Phase 3 backlog (same pattern as above — not yet implemented):
//   addAllegation, setAllegationFinding, addPerson, addEvidence (+ Storage
//   upload URL issuance), addTask, addInterview, addInvestigationNote,
//   addCommunication, addCorrectiveAction, recordRiskAssessment,
//   declareConflictOfInterest, getReporterIdentity (with mandatory audit
//   logging).
// ---------------------------------------------------------------------------
