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

import { Allegation, AppUser, Case, CaseStatus, CorrectiveAction, Person, RoleId } from '../../src/domain/caseTypes';
import { can, implicatedUserIdsFromPersons } from '../../src/domain/permissions';
import { checkTransition, deriveOverallFinding } from '../../src/domain/workflow';

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
// Remaining Phase 3 backlog (same pattern as above — not yet implemented):
//   addAllegation, setAllegationFinding, addPerson, addEvidence (+ Storage
//   upload URL issuance), addTask, addInterview, addInvestigationNote,
//   addCommunication, addCorrectiveAction, recordRiskAssessment,
//   declareConflictOfInterest, getCaseForReporter (verifies case number +
//   access code server-side and returns a reporter-safe view — this is the
//   one reporters actually need, since they hold no Firebase Auth token at
//   all), getReporterIdentity (with mandatory audit logging).
// ---------------------------------------------------------------------------
