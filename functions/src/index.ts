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
 * what is needed to finish this. This now covers every mutation-shaped
 * operation in `src/data-access/caseRepository.ts`'s `CaseRepository`
 * interface. `addEvidence`/`getEvidenceDownloadUrl` additionally depend on
 * Cloud Storage for Firebase, which is a HARDER wall than the undeployed
 * Functions themselves: verified directly against the real project, its
 * default Storage bucket does not exist at all (SERVICE_DISABLED) — see
 * storage.rules' header comment. Every callable follows the same pattern:
 * verify identity from the token (or, for the two reporter-facing
 * callables, verify a caseNumber + accessCode pair instead — reporters
 * hold no Firebase Auth token), call `can()`/`checkTransition()` from the
 * domain layer, write a timeline event and/or audit entry.
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { CallableRequest, HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
// === AMÉLIORATION AJOUTÉE : secret Resend pour notifyEmail (Secret Manager, Blaze) ===
import { defineSecret } from 'firebase-functions/params';

import {
  Allegation,
  AppUser,
  Case,
  CaseStatus,
  ConflictOfInterestDeclaration,
  Communication,
  CorrectiveAction,
  Evidence,
  FindingOutcome,
  Interview,
  Person,
  RiskAssessment,
  RoleId,
  Task,
} from '../../src/domain/caseTypes';
import { can, implicatedUserIdsFromPersons, Permission } from '../../src/domain/permissions';
import { checkTransition, deriveOverallFinding } from '../../src/domain/workflow';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 1 : listCases) ===
import { CaseListFilter, filterVisibleCases } from '../../src/domain/caseVisibility';
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

// === AMÉLIORATION AJOUTÉE ===
// Verified directly against the real project: this bucket does not exist
// yet (Cloud Storage for Firebase is SERVICE_DISABLED on this Spark-plan
// project — see storage.rules' header comment and docs/FIREBASE-SETUP.md).
// Named explicitly (matching the real web app config already committed
// non-secretly in .firebaserc/src/i18n/translations.ts) rather than left
// to getStorage().bucket()'s default-bucket resolution, which requires the
// Admin SDK to already know about a configured bucket.
const STORAGE_BUCKET = 'activa-ethicalert-47246.firebasestorage.app';

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

// === AMÉLIORATION AJOUTÉE : signature élargie (objectType/objectId), sans changer le comportement existant ===
// Widened to accept the same optional fields AuditEventV2 (src/data-access/caseRepository.ts)
// already defines — needed by setAllegationFinding below, which (like
// scripts/firestoreAdminRepository.ts's identical call) records which
// allegation a finding was documented on. Every field stays optional and is
// simply forwarded via the spread below, so createCase/assignCase/
// changeCaseStatus's existing calls are entirely unaffected.
async function appendAudit(entry: { actorId: string; action: string; caseId?: string; objectType?: string; objectId?: string; previousValue?: unknown; newValue?: unknown; reason?: string }) {
  const id = newId('audv2');
  await db.collection('audit_logs').doc(id).set({ ...entry, id, timestamp: new Date().toISOString() });
}

// === AMÉLIORATION AJOUTÉE ===
// Shared by every callable below that mutates something INSIDE an existing
// case (as opposed to createCase, which has no case yet, or assignCase/
// changeCaseStatus, written earlier with the check inlined). Factored out
// here specifically to avoid re-deriving "fetch the case, compute
// implicatedUserIds fresh, call can()" slightly differently in each new
// callable — every one of them must agree on this, always.
async function requireCaseAccess(caseId: string, user: AppUser, permission: Permission): Promise<{ ref: FirebaseFirestore.DocumentReference; kase: Case }> {
  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Case ${caseId} not found.`);
  const kase = snap.data() as Case;

  const personsSnap = await ref.collection('persons').get();
  const implicated = implicatedUserIdsFromPersons(personsSnap.docs.map((d) => d.data() as Person));
  if (!can(user, permission, { case: kase, implicatedUserIds: implicated })) {
    throw new HttpsError('permission-denied', `Not authorized (${permission}) on this case.`);
  }
  return { ref, kase };
}

// === AMÉLIORATION AJOUTÉE : validation ajoutée après une revue de sécurité ===
// Roles that hold ANY case-scoped permission at all (mirrors
// hasCaseReadPermission() in firestore.rules and ROLE_PERMISSIONS in
// permissions.ts — deliberately excludes 'reporter' and 'system_admin',
// which have none, per "System Administrator ≠ Case Access", section 30).
// Used by assignCase below to stop a caller from assigning a case to a
// uid whose role can never legitimately hold one, defense-in-depth on top
// of the firestore.rules fix for the same finding (docs/SECURITY.md):
// even if a rules gap ever reopened, this stops the write at the source.
const CASE_BEARING_ROLES: RoleId[] = ['investigator', 'senior_investigator', 'functional_admin', 'darc_compliance', 'consultation'];

async function assertCaseBearingRole(uid: string): Promise<void> {
  const targetUser = await getAuth().getUser(uid).catch(() => null);
  const role = (targetUser?.customClaims as { role?: RoleId } | undefined)?.role;
  if (!role || !CASE_BEARING_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `${uid} does not hold a role that can be assigned to a case.`);
  }
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
// listCases
// ---------------------------------------------------------------------------

// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 1 : listCases) ===
// La pièce manquante identifiée par l'investigation du bug "les alertes
// externes n'arrivent jamais dans la Boîte de réception de l'opérateur" :
// aucune fonction ne permettait jusqu'ici de lister plusieurs dossiers à la
// fois — `firestore.rules` rejette catégoriquement toute requête `list` sur
// `cases` (la contrainte de provabilité des règles Firestore ne peut pas
// évaluer `isNotImplicated`/`isInScope` sur un champ non filtrable), et
// aucune Cloud Function ne couvrait ce cas avant celle-ci. Réutilise
// `filterVisibleCases` (domain/caseVisibility.ts), la même logique déjà
// partagée par `LocalCaseRepository.listCases` et
// `scripts/firestoreAdminRepository.ts`'s `listCases` — dont ce dernier est
// le patron direct de lecture Admin SDK repris ici (voir son commentaire
// sur le balayage complet, toujours valable ici pour la même raison :
// volume de dossiers réel encore faible).
export const listCases = onCall(async (request) => {
  const user = requireAppUser(request);
  if (!can(user, 'cases.read')) {
    throw new HttpsError('permission-denied', 'This role cannot read cases.');
  }

  const data = (request.data ?? {}) as { filter?: CaseListFilter; limit?: number; offset?: number };
  const filter = data.filter ?? {};
  const limit = typeof data.limit === 'number' ? data.limit : 25;
  const offset = typeof data.offset === 'number' ? data.offset : 0;

  const snap = await db.collection('cases').get();
  const cases = snap.docs.map((doc) => doc.data() as Case);
  const personsByCase = new Map<string, Person[]>();
  for (const kase of cases) {
    const personsSnap = await db.collection('cases').doc(kase.caseId).collection('persons').get();
    personsByCase.set(kase.caseId, personsSnap.docs.map((d) => d.data() as Person));
  }

  return filterVisibleCases(cases, personsByCase, filter, user, limit, offset);
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

  // === AMÉLIORATION AJOUTÉE : chaque cible doit tenir un rôle habilité ===
  // See CASE_BEARING_ROLES' own comment — stops assigning a case to a uid
  // whose role (e.g. 'system_admin') can never legitimately hold one.
  await Promise.all([assignee, ...(additionalInvestigators ?? [])].map(assertCaseBearingRole));

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

  // === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle
  // jamais réellement câblé) === voir caseTypes.ts (Case.functionalReviewSignedOffAt) :
  // sans ce champ, cette fonction ne pouvait JAMAIS clôturer un dossier,
  // quel que soit l'état réel des allégations/mesures correctives.
  const result = checkTransition(kase.status, to, {
    allegations,
    correctiveActions,
    hasFunctionalReviewSignOff: !!kase.functionalReviewSignedOffAt,
  });
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
// recordFunctionalReviewSignOff
// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle) ===
// The one write path that sets Case.functionalReviewSignedOffAt/By, the
// field changeCaseStatus above now actually reads before allowing closure.
// Gated on 'cases.close' (same permission required to close outright —
// signing off is the act that authorizes it), not a new Permission entry.

export const recordFunctionalReviewSignOff = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId } = request.data as { caseId: string };
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId is required.');

  const { ref } = await requireCaseAccess(caseId, user, 'cases.close');
  const now = new Date().toISOString();
  await ref.update({
    functionalReviewSignedOffAt: now,
    functionalReviewSignedOffBy: user.userId,
    updatedAt: now,
    updatedBy: user.userId,
  });
  await appendTimeline(caseId, 'FUNCTIONAL_REVIEW_SIGNED_OFF', user.userId);
  await appendAudit({ actorId: user.userId, action: 'FUNCTIONAL_REVIEW_SIGNED_OFF', caseId });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// addAllegation
// ---------------------------------------------------------------------------

export const addAllegation = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, category, subcategory, description } = request.data as {
    caseId: string;
    category: string;
    subcategory?: string;
    description: string;
  };
  if (!caseId || !category || !description) {
    throw new HttpsError('invalid-argument', 'caseId, category and description are required.');
  }

  await requireCaseAccess(caseId, user, 'cases.edit');

  const allegationId = newId('alg');
  const nowIso = new Date().toISOString();
  const allegation: Allegation = {
    allegationId,
    caseId,
    category,
    subcategory: subcategory ?? '',
    description,
    status: 'open',
    createdAt: nowIso,
    createdBy: user.userId,
    updatedAt: nowIso,
    updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('allegations').doc(allegationId).set(allegation);
  await appendTimeline(caseId, 'ALLEGATION_ADDED', user.userId, category);

  return { allegationId };
});

// ---------------------------------------------------------------------------
// setAllegationFinding
// ---------------------------------------------------------------------------

const VALID_FINDINGS: FindingOutcome[] = [
  'SUBSTANTIATED',
  'PARTIALLY_SUBSTANTIATED',
  'UNSUBSTANTIATED',
  'INCONCLUSIVE',
  'OUT_OF_SCOPE',
  'DUPLICATE',
];

export const setAllegationFinding = onCall(async (request) => {
  const user = requireAppUser(request);
  const { allegationId, finding, rationale } = request.data as { allegationId: string; finding: FindingOutcome; rationale: string };
  if (!allegationId || !finding || !rationale) {
    throw new HttpsError('invalid-argument', 'allegationId, finding and rationale are required.');
  }
  if (!VALID_FINDINGS.includes(finding)) {
    throw new HttpsError('invalid-argument', `finding must be one of: ${VALID_FINDINGS.join(', ')}.`);
  }

  // Only the allegationId is known here (not its caseId), same constraint
  // scripts/firestoreAdminRepository.ts already documents — a collectionGroup
  // query is the only way to locate it.
  const results = await db.collectionGroup('allegations').where('allegationId', '==', allegationId).limit(1).get();
  if (results.empty) throw new HttpsError('not-found', `Allegation ${allegationId} not found.`);
  const doc = results.docs[0];
  const existing = doc.data() as Allegation;

  await requireCaseAccess(existing.caseId, user, 'cases.edit');

  const nowIso = new Date().toISOString();
  const updated: Allegation = {
    ...existing,
    status: 'assessed',
    finding,
    findingRationale: rationale,
    findingDocumentedBy: user.userId,
    findingDocumentedAt: nowIso,
    updatedAt: nowIso,
    updatedBy: user.userId,
  };
  await doc.ref.set(updated);
  await appendTimeline(existing.caseId, 'FINDING_DOCUMENTED', user.userId, finding);
  await appendAudit({ actorId: user.userId, action: 'FINDING_DOCUMENTED', caseId: existing.caseId, objectType: 'allegation', objectId: allegationId, newValue: finding });

  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 3 :
  // FirestoreCaseRepository) === `caseId` ajouté à la réponse : l'appelant
  // (allegationId seul, sans caseId, par signature de CaseRepository) n'a
  // sinon aucun moyen de relire le document à jour ensuite (une
  // collectionGroup query côté client n'est pas autorisée par
  // firestore.rules — même contrainte de « provabilité » que `listCases`,
  // voir son commentaire). Ajout pur, aucun changement de comportement pour
  // le reste de la fonction.
  return { ok: true, caseId: existing.caseId };
});

// ---------------------------------------------------------------------------
// addPerson
// ---------------------------------------------------------------------------

export const addPerson = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, ...input } = request.data as { caseId: string } & Omit<
    Person,
    'personId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
  >;
  if (!caseId || !input?.kind || !input?.name) {
    throw new HttpsError('invalid-argument', 'caseId, kind and name are required.');
  }
  if (input.kind !== 'subject' && input.kind !== 'witness') {
    throw new HttpsError('invalid-argument', "kind must be 'subject' or 'witness'.");
  }

  await requireCaseAccess(caseId, user, 'cases.edit');

  // === AMÉLIORATION AJOUTÉE : privilège renforcé pour lier un compte réel ===
  // A security review (see docs/SECURITY.md) found that `cases.edit` alone —
  // held by every plain investigator — was enough to set `linkedUserId` and
  // thereby add ANY uid to `Case.implicatedUserIds` via the block below,
  // which overrides scope/confidentiality/assignment/global-visibility in
  // both firestore.rules and storage.rules (rule #9). That let an
  // investigator lock a functional_admin or darc_compliance officer out of
  // a case irreversibly (no reversal callable existed either — see
  // removePersonLink below). Recording an ordinary witness or an
  // unlinked subject stays available to any cases.edit holder; only
  // actually linking a real account now requires `cases.assign` (held by
  // `functional_admin`/`darc_compliance` — the two oversight roles trusted
  // to determine who is implicated, not by every case-editing investigator).
  if (input.kind === 'subject' && input.linkedUserId) {
    await requireCaseAccess(caseId, user, 'cases.assign');
  }

  const personId = newId('per');
  const nowIso = new Date().toISOString();
  const person: Person = { ...input, personId, caseId, createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId };
  await db.collection('cases').doc(caseId).collection('persons').doc(personId).set(person);

  // === AMÉLIORATION AJOUTÉE === keep Case.implicatedUserIds in sync — see
  // src/domain/caseTypes.ts and docs/PERMISSIONS.md (rule #9). This is the
  // one write in this whole file that a security rule (firestore.rules'
  // isNotImplicated) actually depends on directly, so it must never be
  // skipped or reordered relative to the person document write above.
  // Now also audited (it wasn't before) — every implication is
  // individually reconstructable from audit_logs, and reversible via
  // removePersonLink below, under the same elevated privilege.
  if (person.kind === 'subject' && person.linkedUserId) {
    await db.collection('cases').doc(caseId).update({ implicatedUserIds: FieldValue.arrayUnion(person.linkedUserId) });
    await appendAudit({
      actorId: user.userId,
      action: 'PERSON_LINKED_TO_USER',
      caseId,
      objectType: 'person',
      objectId: personId,
      newValue: person.linkedUserId,
    });
  }
  await appendTimeline(caseId, 'PERSON_ADDED', user.userId, `${input.kind}: ${input.name}`);

  return { personId };
});

// ---------------------------------------------------------------------------
// removePersonLink
// === AMÉLIORATION AJOUTÉE ===
// The reversal addPerson's linkedUserId write never had: clears a person's
// linkedUserId and pulls the uid back out of Case.implicatedUserIds. Same
// cases.assign gate as the forward operation — whoever can implicate
// someone can also correct a mistaken or malicious implication — and a
// mandatory reason, audited the same way. Before this, an implication was
// permanent through the API (see docs/SECURITY.md).
// ---------------------------------------------------------------------------

export const removePersonLink = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, personId, reason } = request.data as { caseId: string; personId: string; reason: string };
  if (!caseId || !personId || !reason) {
    throw new HttpsError('invalid-argument', 'caseId, personId and reason are required.');
  }

  await requireCaseAccess(caseId, user, 'cases.assign');

  const personRef = db.collection('cases').doc(caseId).collection('persons').doc(personId);
  const personSnap = await personRef.get();
  if (!personSnap.exists) throw new HttpsError('not-found', `Person ${personId} not found.`);
  const person = personSnap.data() as Person;
  if (!person.linkedUserId) {
    throw new HttpsError('failed-precondition', 'This person has no linked user account to unlink.');
  }

  const nowIso = new Date().toISOString();
  const unlinkedUserId = person.linkedUserId;
  await personRef.update({ linkedUserId: FieldValue.delete(), updatedAt: nowIso, updatedBy: user.userId });
  await db.collection('cases').doc(caseId).update({ implicatedUserIds: FieldValue.arrayRemove(unlinkedUserId) });
  await appendAudit({
    actorId: user.userId,
    action: 'PERSON_UNLINKED_FROM_USER',
    caseId,
    objectType: 'person',
    objectId: personId,
    previousValue: unlinkedUserId,
    reason,
  });
  await appendTimeline(caseId, 'PERSON_UNLINKED', user.userId, reason);

  return { ok: true };
});

// ---------------------------------------------------------------------------
// addTask
// ---------------------------------------------------------------------------

export const addTask = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, title, description, owner, priority, dueDate } = request.data as {
    caseId: string;
    title: string;
    description?: string;
    owner: string;
    priority: Task['priority'];
    dueDate: string;
  };
  if (!caseId || !title || !owner || !priority || !dueDate) {
    throw new HttpsError('invalid-argument', 'caseId, title, owner, priority and dueDate are required.');
  }
  await requireCaseAccess(caseId, user, 'cases.edit');

  const taskId = newId('tsk');
  const nowIso = new Date().toISOString();
  const task: Task = { taskId, caseId, title, description, owner, priority, dueDate, status: 'not_started', createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId };
  await db.collection('cases').doc(caseId).collection('tasks').doc(taskId).set(task);

  return { taskId };
});

// ---------------------------------------------------------------------------
// addInterview
// ---------------------------------------------------------------------------

export const addInterview = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, intervieweePersonId, intervieweeLabel, scheduledAt } = request.data as {
    caseId: string;
    intervieweePersonId?: string;
    intervieweeLabel: string;
    scheduledAt?: string;
  };
  if (!caseId || !intervieweeLabel) {
    throw new HttpsError('invalid-argument', 'caseId and intervieweeLabel are required.');
  }
  await requireCaseAccess(caseId, user, 'cases.edit');

  const interviewId = newId('ivw');
  const nowIso = new Date().toISOString();
  const interview: Interview = {
    interviewId,
    caseId,
    intervieweePersonId,
    intervieweeLabel,
    scheduledAt,
    conductedBy: user.userId,
    status: 'planned',
    createdAt: nowIso,
    createdBy: user.userId,
    updatedAt: nowIso,
    updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('interviews').doc(interviewId).set(interview);

  return { interviewId };
});

// ---------------------------------------------------------------------------
// addInvestigationNote
// ---------------------------------------------------------------------------

export const addInvestigationNote = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, content } = request.data as { caseId: string; content: string };
  if (!caseId || !content) throw new HttpsError('invalid-argument', 'caseId and content are required.');
  await requireCaseAccess(caseId, user, 'cases.edit');

  const noteId = newId('note');
  const nowIso = new Date().toISOString();
  // authorId AND createdBy are both forced to the verified caller — never
  // accepted from the client — since an investigation note's whole point is
  // an accountable internal record (reporters never see this collection at
  // all, see docs/DATABASE.md).
  await db.collection('cases').doc(caseId).collection('investigation_notes').doc(noteId).set({
    noteId, caseId, authorId: user.userId, content, createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  });
  await appendAudit({ actorId: user.userId, action: 'INVESTIGATION_NOTE_ADDED', caseId });

  return { noteId };
});

// ---------------------------------------------------------------------------
// addCommunication
// ---------------------------------------------------------------------------

export const addCommunication = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, content } = request.data as { caseId: string; content: string };
  if (!caseId || !content) throw new HttpsError('invalid-argument', 'caseId and content are required.');

  // communications.send (not cases.edit) — the correct, dedicated permission
  // already defined in permissions.ts for this action.
  await requireCaseAccess(caseId, user, 'communications.send');

  const messageId = newId('msg');
  const nowIso = new Date().toISOString();
  // === AMÉLIORATION AJOUTÉE : sender et senderDisplayName jamais acceptés du client ===
  // The repository-layer signature (scripts/firestoreAdminRepository.ts)
  // takes `sender`/`senderDisplayName` as caller-supplied values — fine for
  // a trusted migration script, not for a public callable. This path is
  // reached only by an authenticated staff member (reporters have no
  // Firebase Auth token — see getCaseForReporter above), so `sender` is
  // always forced to 'investigator' and the display name to the verified
  // token's own name, never taken from `request.data`. A reporter-side
  // equivalent (through getCaseForReporter's credential model) is still on
  // the backlog below.
  const message: Communication = {
    messageId, caseId, sender: 'investigator', senderDisplayName: user.name, content,
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('communications').doc(messageId).set(message);
  await appendTimeline(caseId, 'MESSAGE_SENT', user.userId);

  return { messageId };
});

// ---------------------------------------------------------------------------
// addCorrectiveAction
// ---------------------------------------------------------------------------

export const addCorrectiveAction = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, description, owner, entity, dueDate, priority } = request.data as {
    caseId: string;
    description: string;
    owner: string;
    entity?: string;
    dueDate: string;
    priority: CorrectiveAction['priority'];
  };
  if (!caseId || !description || !owner || !dueDate || !priority) {
    throw new HttpsError('invalid-argument', 'caseId, description, owner, dueDate and priority are required.');
  }
  await requireCaseAccess(caseId, user, 'cases.edit');

  const actionId = newId('ca');
  const nowIso = new Date().toISOString();
  const action: CorrectiveAction = {
    actionId, caseId, description, owner, entity, dueDate, priority, status: 'open',
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('corrective_actions').doc(actionId).set(action);
  await appendTimeline(caseId, 'CORRECTIVE_ACTION_ADDED', user.userId, description);
  await appendAudit({ actorId: user.userId, action: 'CORRECTIVE_ACTION_ADDED', caseId, objectType: 'corrective_action', objectId: actionId });

  return { actionId };
});

// ---------------------------------------------------------------------------
// recordRiskAssessment
// ---------------------------------------------------------------------------

export const recordRiskAssessment = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, financialImpact, hierarchicalLevel, recurrence, reputationRisk, totalScore, priority, isOverride, originalScore, overrideReason } =
    request.data as {
      caseId: string;
      financialImpact: RiskAssessment['financialImpact'];
      hierarchicalLevel: RiskAssessment['hierarchicalLevel'];
      recurrence: RiskAssessment['recurrence'];
      reputationRisk: RiskAssessment['reputationRisk'];
      totalScore: number;
      priority: RiskAssessment['priority'];
      isOverride: boolean;
      originalScore?: number;
      overrideReason?: string;
    };
  if (!caseId || !financialImpact || !hierarchicalLevel || !recurrence || !reputationRisk || totalScore == null || !priority) {
    throw new HttpsError('invalid-argument', 'caseId, financialImpact, hierarchicalLevel, recurrence, reputationRisk, totalScore and priority are required.');
  }
  await requireCaseAccess(caseId, user, 'cases.edit');

  const ref = db.collection('cases').doc(caseId);
  const existingActive = await ref.collection('risk_assessments').where('active', '==', true).get();
  const batch = db.batch();
  existingActive.docs.forEach((d) => batch.update(d.ref, { active: false }));

  const assessmentId = newId('risk');
  const nowIso = new Date().toISOString();
  const assessment: RiskAssessment = {
    assessmentId, caseId, financialImpact, hierarchicalLevel, recurrence, reputationRisk, totalScore, priority,
    isOverride: !!isOverride, originalScore, overrideReason, active: true,
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  batch.set(ref.collection('risk_assessments').doc(assessmentId), assessment);
  batch.update(ref, { riskScore: totalScore, priority, updatedAt: nowIso, updatedBy: user.userId });
  await batch.commit();

  await appendTimeline(caseId, 'RISK_ASSESSED', user.userId, `Score ${totalScore} → ${priority}`);
  await appendAudit({
    actorId: user.userId,
    action: isOverride ? 'RISK_OVERRIDDEN' : 'RISK_ASSESSED',
    caseId,
    previousValue: originalScore,
    newValue: totalScore,
    reason: overrideReason,
  });

  return { assessmentId };
});

// ---------------------------------------------------------------------------
// declareConflictOfInterest
// ---------------------------------------------------------------------------

export const declareConflictOfInterest = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, outcome, details } = request.data as { caseId: string; outcome: ConflictOfInterestDeclaration['outcome']; details?: string };
  if (!caseId || !outcome) throw new HttpsError('invalid-argument', 'caseId and outcome are required.');
  if (outcome !== 'no_conflict' && outcome !== 'conflict_identified') {
    throw new HttpsError('invalid-argument', "outcome must be 'no_conflict' or 'conflict_identified'.");
  }
  await requireCaseAccess(caseId, user, 'cases.edit');

  // === AMÉLIORATION AJOUTÉE : userId toujours dérivé du token vérifié ===
  // The repository-layer signature (scripts/firestoreAdminRepository.ts)
  // takes `userId` as a plain parameter — appropriate for a trusted script,
  // but a public callable must never let a caller declare a conflict of
  // interest AS someone else. Always the verified caller's own uid.
  const declaration: ConflictOfInterestDeclaration = { caseId, userId: user.userId, outcome, details, declaredAt: new Date().toISOString() };
  await db.collection('cases').doc(caseId).collection('coi_declarations').doc(newId('coi')).set(declaration);
  await appendTimeline(caseId, 'CONFLICT_OF_INTEREST_DECLARED', user.userId, outcome);
  await appendAudit({ actorId: user.userId, action: 'CONFLICT_OF_INTEREST_DECLARED', caseId, newValue: outcome });

  return { ok: true };
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

// === AMÉLIORATION AJOUTÉE ===
// Factored out of what was originally getCaseForReporter's own body, now
// that a second reporter-facing callable (addCommunicationAsReporter,
// below) needs the exact same rate-limited lookup-and-verify sequence —
// factored out rather than copy-pasted a second time, same discipline as
// requireCaseAccess above. Every failure path converges on the identical
// `invalid()` error (never distinguishing "no such case" from "wrong
// code"), and a caller's rate-limit attempt is recorded/cleared here in
// exactly one place, not once per callable.
async function verifyReporterAccess(caseNumber: string, accessCode: string): Promise<{ ref: FirebaseFirestore.DocumentReference; kase: Case }> {
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
  return { ref: caseDoc.ref, kase };
}

export const getCaseForReporter = onCall(async (request) => {
  const { caseNumber, accessCode } = request.data as { caseNumber?: string; accessCode?: string };
  if (!caseNumber || !accessCode) {
    throw new HttpsError('invalid-argument', 'caseNumber and accessCode are required.');
  }
  const { ref: caseRef, kase } = await verifyReporterAccess(caseNumber, accessCode);

  const commsSnap = await caseRef.collection('communications').orderBy('createdAt', 'asc').get();
  const communications = commsSnap.docs.map((d) => d.data() as Communication);

  await appendAudit({ actorId: 'reporter', action: 'CASE_ACCESSED_BY_REPORTER', caseId: caseRef.id });

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
// addCommunicationAsReporter
// === AMÉLIORATION AJOUTÉE ===
// The reporter-side equivalent of addCommunication above — same
// credential model as getCaseForReporter (caseNumber + accessCode, not a
// Firebase Auth token, and the same shared rate limiter), so a reporter
// can actually reply, not just read. `senderDisplayName` is deliberately
// generic ('Lanceur d'alerte') regardless of Case.reportingMode, rather
// than looking up the reporter's real name from `reporter_identities` —
// that collection's whole purpose is explicit, individually-audited access
// (section 44 of the brief, see getReporterIdentity below), and this
// callable has no legitimate reason to read it just to fill in a label.
// This is a deliberately conservative simplification versus the legacy
// AlertTrackingView (which does show a real name for non-anonymous
// alerts), not an oversight.
// ---------------------------------------------------------------------------

export const addCommunicationAsReporter = onCall(async (request) => {
  const { caseNumber, accessCode, content } = request.data as { caseNumber?: string; accessCode?: string; content?: string };
  if (!caseNumber || !accessCode || !content) {
    throw new HttpsError('invalid-argument', 'caseNumber, accessCode and content are required.');
  }
  const { ref: caseRef } = await verifyReporterAccess(caseNumber, accessCode);

  const messageId = newId('msg');
  const nowIso = new Date().toISOString();
  const message: Communication = {
    messageId,
    caseId: caseRef.id,
    sender: 'reporter',
    senderDisplayName: 'Lanceur d’alerte',
    content,
    createdAt: nowIso,
    createdBy: 'reporter',
    updatedAt: nowIso,
    updatedBy: 'reporter',
  };
  await caseRef.collection('communications').doc(messageId).set(message);
  await appendTimeline(caseRef.id, 'MESSAGE_SENT', 'reporter');

  return { messageId };
});

// ---------------------------------------------------------------------------
// getReporterIdentity
// === AMÉLIORATION AJOUTÉE ===
// Section 44 of the brief, quoted already in both existing repository
// implementations: "no investigator gets reporter identity merely because
// it was assigned to the case" — explicit, individually-authorized,
// audited access only. Neither `LocalCaseRepository` nor
// `FirestoreAdminCaseRepository` actually enforces a distinct permission
// for this beyond auditing the access (both are lower-level storage
// primitives, same reasoning as requireCaseAccess's own header comment);
// a public callable is the real trust boundary, so this one does gate it,
// on `audit.read` rather than `cases.edit` — the closest existing
// `Permission` an investigator plainly does NOT hold (only
// `functional_admin`/`darc_compliance` do, matching the brief's intent
// without inventing a new permission in the `Permission` union just for
// this one case; `system_admin` also has `audit.read` but has no case
// access at all by design, so `can()`'s assigned-or-global-visibility
// check still correctly excludes it here).
// ---------------------------------------------------------------------------

export const getReporterIdentity = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId } = request.data as { caseId: string };
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId is required.');

  await requireCaseAccess(caseId, user, 'audit.read');

  // Audited unconditionally, even though nothing has been read yet — the
  // audit entry itself is the record that this identity-access request was
  // made, matching both existing repository implementations exactly.
  await appendAudit({ actorId: user.userId, action: 'REPORTER_IDENTITY_ACCESSED', caseId, reason: 'Explicit identity access request' });

  const snap = await db.collection('reporter_identities').doc(caseId).get();
  return snap.exists ? snap.data() : null;
});

// ---------------------------------------------------------------------------
// addEvidence
// === AMÉLIORATION AJOUTÉE ===
// The file's bytes are uploaded directly to Cloud Storage by the client
// (Firebase Storage SDK, gated by storage.rules — never through this
// callable, which only records metadata), at a path the client generates
// under evidence/{caseId}/{anyId}/{fileName}. This callable is called
// AFTER that upload succeeds, to record the Evidence document — mirrors
// both existing repository implementations' addEvidence exactly, plus a
// defense-in-depth check that storagePath actually falls under this
// case's own prefix (a caller cannot register metadata pointing at some
// unrelated file elsewhere in the bucket).
// ---------------------------------------------------------------------------

export const addEvidence = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, fileName, fileType, fileSize, description, storagePath, sha256Hash, confidentiality } = request.data as {
    caseId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    description?: string;
    storagePath: string;
    sha256Hash?: string;
    confidentiality: Evidence['confidentiality'];
  };
  if (!caseId || !fileName || !fileType || fileSize == null || !storagePath || !confidentiality) {
    throw new HttpsError('invalid-argument', 'caseId, fileName, fileType, fileSize, storagePath and confidentiality are required.');
  }
  if (confidentiality !== 'standard' && confidentiality !== 'restricted') {
    throw new HttpsError('invalid-argument', "confidentiality must be 'standard' or 'restricted'.");
  }
  if (!storagePath.startsWith(`evidence/${caseId}/`)) {
    throw new HttpsError('invalid-argument', 'storagePath must be under this case\'s own evidence/ prefix.');
  }

  // evidence.upload — the one place in this batch where a dedicated,
  // more specific Permission than cases.edit actually exists.
  await requireCaseAccess(caseId, user, 'evidence.upload');

  const evidenceId = newId('evd');
  const nowIso = new Date().toISOString();
  const evidence: Evidence = {
    evidenceId, caseId, fileName, fileType, fileSize, description, storagePath, sha256Hash,
    version: 1, confidentiality, status: 'active',
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('evidence').doc(evidenceId).set(evidence);
  await appendTimeline(caseId, 'EVIDENCE_ADDED', user.userId, fileName);
  await appendAudit({ actorId: user.userId, action: 'EVIDENCE_UPLOADED', caseId, objectType: 'evidence', objectId: evidenceId });

  return { evidenceId };
});

// ---------------------------------------------------------------------------
// getEvidenceDownloadUrl
// === AMÉLIORATION AJOUTÉE ===
// Fulfills the promise already made by Evidence.storagePath's own comment
// in caseTypes.ts: "Never a public URL — resolved through a signed,
// short-lived, audited Cloud Function call." storage.rules denies direct
// reads unconditionally (`allow read: if false`) specifically so this is
// the only path — every access is authorized the same way cases.read/
// evidence.read already are, and every access is audited, not just
// successful downloads gated silently.
// ---------------------------------------------------------------------------

const EVIDENCE_URL_TTL_MS = 15 * 60 * 1000; // "short-lived" — 15 minutes

export const getEvidenceDownloadUrl = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, evidenceId } = request.data as { caseId: string; evidenceId: string };
  if (!caseId || !evidenceId) throw new HttpsError('invalid-argument', 'caseId and evidenceId are required.');

  await requireCaseAccess(caseId, user, 'evidence.read');

  const snap = await db.collection('cases').doc(caseId).collection('evidence').doc(evidenceId).get();
  if (!snap.exists) throw new HttpsError('not-found', `Evidence ${evidenceId} not found.`);
  const evidence = snap.data() as Evidence;
  // Deleted evidence is excluded from listEvidence() in both existing
  // repositories — mirrored here rather than treated as still downloadable.
  if (evidence.status === 'deleted' || !evidence.storagePath) {
    throw new HttpsError('not-found', `Evidence ${evidenceId} not found.`);
  }

  const [url] = await getStorage()
    .bucket(STORAGE_BUCKET)
    .file(evidence.storagePath)
    .getSignedUrl({ action: 'read', expires: Date.now() + EVIDENCE_URL_TTL_MS });

  await appendAudit({ actorId: user.userId, action: 'EVIDENCE_ACCESSED', caseId, objectType: 'evidence', objectId: evidenceId });

  return { url, expiresAt: new Date(Date.now() + EVIDENCE_URL_TTL_MS).toISOString() };
});

// === AMÉLIORATION AJOUTÉE : notifyEmail — portage Firebase de api/notify-email.ts ===
// Même contrat exact que la fonction Vercel `api/notify-email.ts` (POST
// {to, subject, body} → Resend), pour que `src/services/emailNotify.ts`
// fonctionne sans modification une fois servi par Firebase Hosting.
// Prête mais NON déployée tant que le projet reste sur Spark (Cloud Functions
// exige Blaze). Activation : voir docs/FIREBASE-HOSTING.md §4 — secret
// RESEND_API_KEY dans Secret Manager, puis réécriture Hosting
// `/api/notify-email` → `notifyEmail`.
// Mêmes garanties d'honnêteté que l'original : 503 si la clé manque, erreurs
// Resend répercutées, jamais un faux 200.
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

export const notifyEmail = onRequest({ secrets: [RESEND_API_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST.' });
    return;
  }

  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) {
    res.status(503).json({ error: 'Email service not configured: RESEND_API_KEY is missing.' });
    return;
  }

  const { to, subject, body } = (req.body ?? {}) as { to?: string; subject?: string; body?: string };
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'to, subject and body are required.' });
    return;
  }

  const fromAddress = process.env.NOTIFY_FROM_EMAIL || 'ACTIVA EthicAlert <onboarding@resend.dev>';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, text: body }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      res.status(502).json({ error: `Resend error (${resendRes.status}): ${errText.slice(0, 300)}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error while calling Resend.' });
  }
});
