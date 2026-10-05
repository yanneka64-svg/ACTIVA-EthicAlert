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
// === AMÉLIORATION AJOUTÉE (revue PR #139) === vérification App Check de notifyEmail.
import { getAppCheck } from 'firebase-admin/app-check';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
// === AMÉLIORATION AJOUTÉE (revue PR #139) === pagination par curseur de listCases.
import { FieldPath } from 'firebase-admin/firestore';
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
  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4) ===
  ReporterCredentials,
  // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
  ReporterIdentity,
  RiskAssessment,
  RoleId,
  Task,
} from '../../src/domain/caseTypes';
import { can, implicatedUserIdsFromPersons, Permission } from '../../src/domain/permissions';
import { checkTransition, deriveOverallFinding } from '../../src/domain/workflow';
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
import { PortalPatchError, PORTAL_KEYS, portalVisibleCaseStatus, reporterVisibleCaseStatus, sanitizePortalPatch, type PortalPatch, type PortalState } from '../../src/domain/portalUpdate';
import { serializePortalConfigSection, type PortalConfigSection } from '../../src/domain/portalConfig';
import { sanitizePortalAuditBatch, type PortalAuditInput } from '../../src/domain/auditTrail';
import {
  buildNotificationEmail,
  DEFAULT_EMAIL_NOTIFICATION_SETTINGS,
  GROUP_LABEL,
  isValidEmail,
  namesMatch,
  parseContact,
  RECIPIENT_GROUP_IDS,
  resolveNotificationRecipients,
  sanitizeEmailNotificationSettings,
  type CaseNotificationFacts,
  type EmailNotificationSettings,
  type NotificationEvent,
  type RecipientGroupId,
  type StaffRecipientCandidate,
} from '../../src/domain/emailNotificationRules';
// === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail : logo + lien) ===
import { plainTextToBrandedHtml, renderBrandedEmailHtml } from '../../src/domain/emailTemplate';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 1 : listCases) ===
import { CaseListFilter, isCaseListedFor, VisiblePageCollector } from '../../src/domain/caseVisibility';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === filtres poussés dans la requête Firestore.
import { caseQueryEqualities, normalizePagination } from '../../src/domain/caseQuery';
// === AMÉLIORATION AJOUTÉE (revue PR #139) === validation d'exécution de la soumission publique.
import { formatTrackingNumber, parseReporterCaseInput } from '../../src/domain/reporterCaseInput';
// === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
import type { ReporterCaseDetails } from '../../src/domain/reporterCaseDetails';
// === AMÉLIORATION AJOUTÉE (échanges instantanés, anonymat, documents du déclarant) ===
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  MessageAttachment,
  REPORTER_FILE_MAX_BYTES,
  REPORTER_FILE_MAX_PER_CASE,
  TEAM_DISPLAY_NAME,
  safeFileName,
  sanitizeCommunicationsForReporter,
} from '../../src/domain/conversation';
// === AMÉLIORATION AJOUTÉE : réutilise le HASH/SALT existant, jamais réimplémenté ===
// Same salted, iterated-SHA256 verification already used by the legacy
// client-side AlertTrackingView (src/components/AlertTrackingView.tsx) —
// imported, not re-derived, so client and server can never disagree about
// what a valid access code hash looks like. Works in this Node 20 runtime
// because `crypto.subtle`/`crypto.getRandomValues` are Node's built-in
// global WebCrypto implementation, not a browser-only API.
// (=== AMÉLIORATION AJOUTÉE (Audit DevOps — P1) === runtime passé à Node 22,
// functions/package.json — WebCrypto global identique.)
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4 :
// miroir de la soumission publique) === `generateSalt`/`hashPassword`/
// `generateAccessPassword` réutilisés tels quels (même algorithme que
// `verifyPassword` déjà importé ci-dessus, et que le client
// AlertSubmissionFlow.tsx) pour `createCaseAsReporter`, plus bas.
import { generateAccessPassword, generateSalt, hashPassword, verifyPassword } from '../../src/services/crypto';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : relais e-mail fermé) ===
// Même garde-fou pur que api/notify-email.ts (src/domain/notifyEmailGuard.ts).
import {
  FixedWindowRateLimiter,
  HeaderBag,
  NOTIFY_RATE_WINDOW_MS,
  appCheckToken,
  bearerToken,
  clientIp,
  isStaffClaims,
  newAlertNotification,
  parseCsvList,
  parseNewAlertNotification,
  rateLimitFromEnv,
  validateNotifyEmailRequest,
} from '../../src/domain/notifyEmailGuard';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P1 : fiabilité et coût) ===
import { setGlobalOptions } from 'firebase-functions/v2';
// === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
// enregistrés dans Firebase) === voir functions/src/staffAccounts.ts.
import { staffUidByContactEmail } from './staffAccounts';
export {
  changeMyStaffPassword,
  createStaffAccount,
  deleteStaffAccount,
  getMyStaffProfile,
  listStaffDirectory,
  resetStaffAccountPassword,
  updateStaffAccount,
} from './staffAccounts';

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P1 : fiabilité et coût) ===
// Options communes à TOUTES les fonctions, appliquées avant leur
// déclaration :
// - `region` : explicitement celle qui était déjà utilisée implicitement
//   (us-central1 = défaut de firebase-functions ET de getFunctions() côté
//   client, src/services/firebaseClient.ts, ET de la réécriture Hosting
//   documentée dans docs/FIREBASE-HOSTING.md). Aucun changement de
//   comportement. Pour rapprocher les fonctions de la base Firestore
//   (latence/RGPD), changer CES TROIS endroits ensemble — voir
//   docs/DEVOPS-RUNBOOK.md §Région.
// - `maxInstances` : plafond dur de mise à l'échelle — le seul garde-fou
//   qui borne réellement la facture sur le plan Blaze (une alerte de
//   budget n'arrête pas la dépense). Largement au-dessus du besoin réel
//   (dispositif d'alerte interne, faible volume).
// - `minInstances: 0` : aucune instance facturée au repos.
setGlobalOptions({ region: 'us-central1', maxInstances: 10, minInstances: 0 });
// === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
// même secret que notifyEmail, déclaré ici car utilisé par des fonctions
// définies plus haut dans ce fichier que RESEND_API_KEY.
const NOTIFY_RESEND_KEY = defineSecret('RESEND_API_KEY');

initializeApp();
// === AMÉLIORATION AJOUTÉE (correctif — base Firestore nommée) ===
// La base du projet est la base NOMMÉE `default` (firebase.json,
// docs/FIREBASE-SETUP.md), pas la base spéciale `(default)` que vise
// `getFirestore()` sans argument : tout accès Firestore échouait avec
// NOT_FOUND. Même valeur que le client (firebaseClient.ts) et les scripts.
const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || 'default');
// === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === un champ
// facultatif non renseigné (ex. `entity` d'une mesure corrective, `scheduledAt`
// d'un entretien) arrivait `undefined` et faisait échouer l'écriture (erreur
// 500) : il est désormais simplement omis.
db.settings({ ignoreUndefinedProperties: true });

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
  // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) === un
  // compte dont le mot de passe temporaire n'a pas encore été changé n'a
  // accès à aucune fonction métier (functions/src/staffAccounts.ts).
  if ((request.auth.token as { pwdTemp?: unknown }).pwdTemp === true) {
    throw new HttpsError('failed-precondition', 'Password change required.');
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

// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur) === identifiant proposé par le portail.
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{3,80}$/;

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

// === AMÉLIORATION AJOUTÉE (revue PR #139) === les comptes du personnel ont
// un identifiant local (localStorage) distinct de leur UID Firebase Auth ;
// l'e-mail est l'identité commune (scripts/setupAuthUsers.ts crée les
// comptes par e-mail). Une cible d'attribution peut donc être un UID ou un
// e-mail : elle est toujours résolue en UID réel avant tout contrôle ou
// écriture.
async function resolveStaffUid(idOrEmail: string): Promise<string> {
  if (typeof idOrEmail !== 'string' || !idOrEmail.trim()) {
    throw new HttpsError('invalid-argument', 'Invalid assignee.');
  }
  const value = idOrEmail.trim();
  const byUid = await getAuth().getUser(value).catch(() => null);
  if (byUid) return byUid.uid;
  if (value.includes('@')) {
    const byEmail = await getAuth().getUserByEmail(value.toLowerCase()).catch(() => null);
    if (byEmail) return byEmail.uid;
    // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) === les
    // comptes créés depuis le portail ont une adresse Auth technique ;
    // leur e-mail de contact est dans leur profil Firestore.
    const byContact = await staffUidByContactEmail(value).catch(() => null);
    if (byContact?.active) return byContact.uid;
  }
  throw new HttpsError('invalid-argument', `${value} is not a known staff account.`);
}

async function assertCaseBearingRole(uid: string): Promise<void> {
  const targetUser = await getAuth().getUser(uid).catch(() => null);
  const role = (targetUser?.customClaims as { role?: RoleId } | undefined)?.role;
  if (!role || !CASE_BEARING_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `${uid} does not hold a role that can be assigned to a case.`);
  }
}

// === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
/**
 * Date de dernière activité du dossier (toute action : statut, message,
 * tâche, note…). Le portail ne recharge le détail d'un dossier que si cette
 * date ou `updatedAt` a changé depuis son dernier chargement. `update()`
 * (jamais `set`) : ne crée jamais de document ; un échec n'empêche jamais
 * l'action elle-même.
 */
async function touchCaseActivity(caseId: string): Promise<void> {
  await db.collection('cases').doc(caseId).update({ lastActivityAt: new Date().toISOString() }).catch(() => {});
}

async function appendTimeline(caseId: string, label: string, actor: string, details?: string) {
  // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
  await touchCaseActivity(caseId);
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
  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === pagination validée
  // (mêmes défauts 25/0 ; limit borné à [1, 500], offset ≥ 0).
  const { limit, offset } = normalizePagination(data.limit, data.offset);

  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : coût et latence) ===
  // Avant : lecture de TOUTE la collection puis, dossier par dossier et en
  // série, de TOUTES ses personnes. Désormais :
  // - les filtres d'égalité du client sont appliqués par Firestore (seuls
  //   les dossiers candidats sont lus et facturés) ;
  // - seules les personnes `kind == 'subject'` sont lues (les seules
  //   utilisées par implicatedUserIdsFromPersons), en parallèle.
  // isCaseListedFor (le prédicat de filterVisibleCases) réapplique ensuite exactement les mêmes filtres et
  // l'autorisation can() : le résultat renvoyé est inchangé.
  let query: FirebaseFirestore.Query = db.collection('cases');
  for (const [field, value] of caseQueryEqualities(filter)) {
    query = query.where(field, '==', value);
  }
  // === AMÉLIORATION AJOUTÉE (revue PR #139) ===
  // - Lecture par lots bornés (curseur sur l'id de document), chaque lot
  //   étant ÉVALUÉ puis relâché : seuls le lot courant et les dossiers de
  //   la page demandée restent en mémoire (VisiblePageCollector), quel que
  //   soit le volume de la collection.
  // - Plus de requête `persons` par dossier (N+1) : l'implication est lue
  //   dans le champ dénormalisé `Case.implicatedUserIds`, tenu à jour par
  //   addPerson/removePersonLink et déjà utilisé par firestore.rules pour la
  //   même décision. Repli sur la sous-collection uniquement pour un dossier
  //   ancien dépourvu de ce champ (au plus LIST_BATCH_SIZE requêtes
  //   simultanées, jamais toute la collection d'un coup).
  // Le contrat `total` (nombre de dossiers VISIBLES) impose toujours
  // d'évaluer chaque candidat : un total exact sans parcours complet
  // demanderait un compteur agrégé côté serveur (évolution distincte).
  // Ordre et résultat identiques à filterVisibleCases sur la liste complète
  // (même prédicat isCaseListedFor, même ordre par id de document).
  const LIST_BATCH_SIZE = 500;
  const collector = new VisiblePageCollector(limit, offset);
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let batchQuery = query.orderBy(FieldPath.documentId()).limit(LIST_BATCH_SIZE);
    if (lastDoc) batchQuery = batchQuery.startAfter(lastDoc);
    const batch = await batchQuery.get();
    const cases = batch.docs.map((doc) => doc.data() as Case);
    const personsByCase = new Map<string, Person[]>();
    const withoutDenormalized: Case[] = [];
    for (const kase of cases) {
      if (Array.isArray(kase.implicatedUserIds)) {
        personsByCase.set(kase.caseId, kase.implicatedUserIds.map((uid) => ({ kind: 'subject', linkedUserId: uid }) as Person));
      } else {
        withoutDenormalized.push(kase);
      }
    }
    await Promise.all(
      withoutDenormalized.map(async (kase) => {
        const personsSnap = await db.collection('cases').doc(kase.caseId).collection('persons').where('kind', '==', 'subject').get();
        personsByCase.set(kase.caseId, personsSnap.docs.map((d) => d.data() as Person));
      })
    );
    for (const kase of cases) {
      if (isCaseListedFor(kase, personsByCase.get(kase.caseId) ?? [], filter, user)) collector.add(kase);
    }
    if (batch.size < LIST_BATCH_SIZE) break;
    lastDoc = batch.docs[batch.docs.length - 1];
  }

  return collector.page();
});

// ---------------------------------------------------------------------------
// assignCase
// ---------------------------------------------------------------------------

export const assignCase = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, assignee: rawAssignee, additionalInvestigators: rawAdditional } = request.data as { caseId: string; assignee: string; additionalInvestigators?: string[] };
  if (!caseId || !rawAssignee) throw new HttpsError('invalid-argument', 'caseId and assignee are required.');
  if (rawAdditional !== undefined && !Array.isArray(rawAdditional)) throw new HttpsError('invalid-argument', 'additionalInvestigators must be an array.');
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === UID ou e-mail → UID réel.
  const assignee = await resolveStaffUid(rawAssignee);
  const additionalInvestigators = rawAdditional
    ? Array.from(new Set(await Promise.all(rawAdditional.map(resolveStaffUid)))).filter((uid) => uid !== assignee)
    : undefined;

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

  // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur) === même
  // identifiant que la copie du portail (rattachement ultérieur à un compte).
  const clientPersonId = (input as { clientId?: unknown }).clientId;
  delete (input as { clientId?: unknown }).clientId;
  const personId =
    typeof clientPersonId === 'string' && CLIENT_ID_RE.test(clientPersonId) && !(await db.collection('cases').doc(caseId).collection('persons').doc(clientPersonId).get()).exists
      ? clientPersonId
      : newId('per');
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

  // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur) === même
  // identifiant que la copie du portail, pour que ses mises à jour suivantes
  // (avancement de la tâche) désignent la bonne tâche.
  const clientTaskId = (request.data as { clientId?: unknown }).clientId;
  const taskId =
    typeof clientTaskId === 'string' && CLIENT_ID_RE.test(clientTaskId) && !(await db.collection('cases').doc(caseId).collection('tasks').doc(clientTaskId).get()).exists
      ? clientTaskId
      : newId('tsk');
  const nowIso = new Date().toISOString();
  const task: Task = { taskId, caseId, title, description, owner, priority, dueDate, status: 'not_started', createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId };
  await db.collection('cases').doc(caseId).collection('tasks').doc(taskId).set(task);
  // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
  await touchCaseActivity(caseId);

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
  // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
  await touchCaseActivity(caseId);

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
  // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
  await touchCaseActivity(caseId);

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
  // === AMÉLIORATION AJOUTÉE (anonymat de l'équipe) === nom affiché neutre ;
  // le nom réel n'est conservé qu'en interne (`authorName`, jamais renvoyé au
  // déclarant — voir sanitizeCommunicationsForReporter).
  const message: Communication & { authorName: string } = {
    messageId, caseId, sender: 'investigator', senderDisplayName: TEAM_DISPLAY_NAME, authorName: user.name, content,
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  await db.collection('cases').doc(caseId).collection('communications').doc(messageId).set(message);
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === l'enquêteur a fini d'écrire.
  await db.collection('cases').doc(caseId).collection('presence').doc('state').set({ teamTypingAt: null }, { merge: true });
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

  // === AMÉLIORATION AJOUTÉE (revue PR #139) === la déclaration réellement
  // persistée (userId issu du jeton vérifié) est renvoyée au client.
  return { ok: true, declaration };
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

  let querySnap = await db.collection('cases').where('caseNumber', '==', key).limit(1).get();
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === un dossier créé par le miroir
  // de la soumission publique est aussi retrouvé par le numéro de suivi local
  // déjà remis au lanceur d'alerte (`externalReference`), même code d'accès.
  // === AMÉLIORATION AJOUTÉE (revue PR #139 — unicité du numéro de suivi) ===
  // 1. Index de réservation (external_references/{ref} → caseId), écrit
  //    atomiquement avec le dossier par createCaseAsReporter : il désigne LE
  //    dossier de ce numéro de suivi, quels que soient d'éventuels doublons.
  // 2. Repli : toutes les correspondances restantes sont essayées (aucune
  //    n'est écartée). Depuis la réservation, aucun doublon ne peut plus
  //    être créé : ce repli ne couvre que d'éventuels dossiers antérieurs.
  let candidates: FirebaseFirestore.DocumentSnapshot[] = querySnap.docs;
  if (querySnap.empty) {
    candidates = [];
    const reservation = await db.collection('external_references').doc(key).get();
    const reservedCaseId = reservation.exists ? (reservation.data() as { caseId?: string }).caseId : undefined;
    if (reservedCaseId) {
      const reservedCase = await db.collection('cases').doc(reservedCaseId).get();
      if (reservedCase.exists) candidates.push(reservedCase);
    }
    const others = await db.collection('cases').where('externalReference', '==', key).get();
    for (const doc of others.docs) if (doc.id !== reservedCaseId) candidates.push(doc);
  }
  for (const caseDoc of candidates) {
    const credsSnap = await db.collection('reporter_credentials').doc(caseDoc.id).get();
    if (!credsSnap.exists) continue;
    const creds = credsSnap.data() as { accessCodeHash: string; accessCodeSalt: string };
    const passwordOk = await verifyPassword(accessCode, creds.accessCodeSalt, creds.accessCodeHash);
    if (!passwordOk) continue;
    await recordReporterAttempt(key, true);
    return { ref: caseDoc.ref, kase: caseDoc.data() as Case };
  }

  await recordReporterAttempt(key, false);
  throw invalid();
}

export const getCaseForReporter = onCall(async (request) => {
  const { caseNumber, accessCode } = request.data as { caseNumber?: string; accessCode?: string };
  if (!caseNumber || !accessCode) {
    throw new HttpsError('invalid-argument', 'caseNumber and accessCode are required.');
  }
  const { ref: caseRef, kase } = await verifyReporterAccess(caseNumber, accessCode);

  const commsSnap = await caseRef.collection('communications').orderBy('createdAt', 'asc').get();
  // === AMÉLIORATION AJOUTÉE (anonymat de l'équipe) === jamais le nom ni
  // l'identifiant d'un membre du personnel côté déclarant.
  const communications = sanitizeCommunicationsForReporter(commsSnap.docs.map((d) => d.data() as Communication));
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === session courte pour
  // la conversation en direct (sans revérifier le mot de passe à chaque fois).
  const sessionToken = await issueReporterSession(caseRef.id);
  const presence = await caseRef.collection('presence').doc('state').get();

  await appendAudit({ actorId: 'reporter', action: 'CASE_ACCESSED_BY_REPORTER', caseId: caseRef.id });

  // Deliberately narrow, reporter-safe view — mirrors exactly what the
  // legacy AlertTrackingView already shows a reporter (status, description,
  // communications), never allegations/persons/evidence/investigation_notes/
  // assignee identity/confidentialityLevel, none of which a reporter is
  // meant to see (see docs/DATABASE.md).
  return {
    caseNumber: kase.caseNumber,
    status: reporterVisibleCaseStatus(kase.status, kase.portal), // === AMÉLIORATION AJOUTÉE (statut affiché par le portail) ===
    receivedAt: kase.receivedAt,
    description: kase.description,
    communications,
    sessionToken,
    teamTypingAt: (presence.data()?.teamTypingAt as string | undefined) ?? null,
    // === AMÉLIORATION AJOUTÉE (suivi du déclarant depuis n'importe quel
    // appareil) === uniquement ce que le déclarant a lui-même renseigné au
    // dépôt (numéro de suivi remis, catégorie, entité, pays, mode), plus les
    // dates de mise à jour/clôture : jamais l'attribution, les notes
    // internes, les personnes citées ni l'évaluation du risque.
    reporterCase: {
      externalReference: kase.externalReference ?? null,
      category: kase.category,
      subcategory: kase.subcategory,
      country: kase.country,
      entity: kase.entity,
      reportingMode: kase.reportingMode,
      incidentDate: kase.incidentDate ?? null,
      updatedAt: kase.updatedAt,
      closedAt: kase.closedAt ?? null,
    },
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
  const { caseNumber, accessCode, content, sessionToken } = request.data as { caseNumber?: string; accessCode?: string; content?: string; sessionToken?: string };
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === session du déclarant
  // acceptée à la place du couple numéro + code (même dossier, déjà prouvé).
  if (!content || (!sessionToken && (!caseNumber || !accessCode))) {
    throw new HttpsError('invalid-argument', 'caseNumber, accessCode and content are required.');
  }
  if (typeof content !== 'string' || content.length > 10000) throw new HttpsError('invalid-argument', 'Message too long.');
  const { ref: caseRef } = sessionToken
    ? await verifyReporterSession(sessionToken)
    : await verifyReporterAccess(caseNumber as string, accessCode as string);

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
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === le déclarant a fini d'écrire.
  await caseRef.collection('presence').doc('state').set({ reporterTypingAt: null }, { merge: true });
  await appendTimeline(caseRef.id, 'MESSAGE_SENT', 'reporter');

  return { messageId };
});

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (échanges instantanés, « est en train d'écrire »,
// documents du déclarant) ===
// ---------------------------------------------------------------------------

// Session du déclarant : jeton signé (HMAC-SHA256) portant l'identifiant du
// dossier et une expiration (2 h), remis par getCaseForReporter après
// vérification du mot de passe. Évite de recalculer l'empreinte PBKDF2 (et
// de solliciter le limiteur de tentatives) à chaque rafraîchissement de la
// conversation. Secret aléatoire créé une fois dans `system/reporter_session`
// (collection fermée aux clients : aucune règle Firestore ne l'ouvre).
const REPORTER_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
let reporterSessionSecretCache: Buffer | null = null;

async function reporterSessionSecret(): Promise<Buffer> {
  if (reporterSessionSecretCache) return reporterSessionSecretCache;
  const ref = db.collection('system').doc('reporter_session');
  const hex = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? (snap.data() as { secret?: string }).secret : undefined;
    if (existing) return existing;
    const created = randomBytes(32).toString('hex');
    tx.set(ref, { secret: created, createdAt: new Date().toISOString() });
    return created;
  });
  reporterSessionSecretCache = Buffer.from(hex, 'hex');
  return reporterSessionSecretCache;
}

async function issueReporterSession(caseId: string): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ c: caseId, e: Date.now() + REPORTER_SESSION_TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', await reporterSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function verifyReporterSession(token: string): Promise<{ ref: FirebaseFirestore.DocumentReference; kase: Case; expiresAt: number }> {
  const expired = () => new HttpsError('unauthenticated', 'Reporter session expired. Sign in again.');
  if (typeof token !== 'string' || token.length > 500 || !token.includes('.')) throw expired();
  const [payload, sig] = token.split('.');
  const expected = createHmac('sha256', await reporterSessionSecret()).update(payload).digest();
  const given = Buffer.from(sig ?? '', 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw expired();
  let data: { c?: string; e?: number };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw expired();
  }
  if (!data.c || !data.e || data.e < Date.now()) throw expired();
  const ref = db.collection('cases').doc(data.c);
  const snap = await ref.get();
  if (!snap.exists) throw expired();
  return { ref, kase: snap.data() as Case, expiresAt: data.e };
}

/**
 * Conversation du déclarant, rafraîchie toutes les quelques secondes tant
 * qu'elle est ouverte : messages (vue anonymisée), « l'équipe est en train
 * d'écrire », statut. `typing` (facultatif) signale que le déclarant écrit
 * (true) ou a arrêté (false). Renouvelle la session avant son expiration.
 */
export const reporterConversation = onCall(async (request) => {
  const { sessionToken, typing } = (request.data ?? {}) as { sessionToken?: string; typing?: boolean };
  const { ref, kase, expiresAt } = await verifyReporterSession(sessionToken ?? '');
  const presenceRef = ref.collection('presence').doc('state');
  if (typing === true || typing === false) {
    await presenceRef.set({ reporterTypingAt: typing ? new Date().toISOString() : null }, { merge: true });
  }
  const [commsSnap, presence] = await Promise.all([ref.collection('communications').orderBy('createdAt', 'asc').get(), presenceRef.get()]);
  return {
    status: reporterVisibleCaseStatus(kase.status, kase.portal), // === AMÉLIORATION AJOUTÉE (statut affiché par le portail) ===
    communications: sanitizeCommunicationsForReporter(commsSnap.docs.map((d) => d.data() as Communication)),
    teamTypingAt: (presence.data()?.teamTypingAt as string | undefined) ?? null,
    ...(expiresAt - Date.now() < 30 * 60 * 1000 ? { sessionToken: await issueReporterSession(ref.id) } : {}),
  };
});

/**
 * Conversation d'un dossier pour l'équipe (même accès que la lecture des
 * messages) : messages complets et « le déclarant est en train d'écrire ».
 * `typing` signale que l'enquêteur écrit (affiché au déclarant SANS nom).
 */
export const staffConversation = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, typing } = (request.data ?? {}) as { caseId?: string; typing?: boolean };
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId is required.');
  const { ref } = await requireCaseAccess(caseId, user, 'communications.read');
  const presenceRef = ref.collection('presence').doc('state');
  if (typing === true || typing === false) {
    await presenceRef.set({ teamTypingAt: typing ? new Date().toISOString() : null }, { merge: true });
  }
  const [commsSnap, presence] = await Promise.all([ref.collection('communications').orderBy('createdAt', 'asc').get(), presenceRef.get()]);
  return {
    communications: commsSnap.docs.map((d) => d.data() as Communication),
    reporterTypingAt: (presence.data()?.reporterTypingAt as string | undefined) ?? null,
  };
});

// Documents du déclarant : contenu stocké dans Firestore par morceaux
// (Cloud Storage n'est pas activé sur ce projet), lisible seulement par
// l'équipe habilitée via getEvidenceFileForStaff (accès audité).
const EVIDENCE_CHUNK_BYTES = 900 * 1024;

export const addEvidenceAsReporter = onCall(async (request) => {
  const { sessionToken, fileName, fileType, dataBase64, message } = (request.data ?? {}) as {
    sessionToken?: string;
    fileName?: string;
    fileType?: string;
    dataBase64?: string;
    message?: string;
  };
  const { ref } = await verifyReporterSession(sessionToken ?? '');
  if (typeof dataBase64 !== 'string' || !dataBase64) throw new HttpsError('invalid-argument', 'File content is required.');
  const bytes = Buffer.from(dataBase64, 'base64');
  if (bytes.length === 0) throw new HttpsError('invalid-argument', 'Empty file.');
  if (bytes.length > REPORTER_FILE_MAX_BYTES) throw new HttpsError('invalid-argument', 'File too large.');
  const already = await ref.collection('evidence').where('createdBy', '==', 'reporter').count().get();
  if (already.data().count >= REPORTER_FILE_MAX_PER_CASE) throw new HttpsError('resource-exhausted', 'Too many files for this case.');

  const name = safeFileName(fileName ?? 'document');
  const type = typeof fileType === 'string' && fileType.length <= 120 ? fileType : 'application/octet-stream';
  const evidenceId = newId('ev');
  const messageId = newId('msg');
  const nowIso = new Date().toISOString();
  const audit = { createdAt: nowIso, createdBy: 'reporter', updatedAt: nowIso, updatedBy: 'reporter' };
  const sha256Hash = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  const attachment: MessageAttachment = { evidenceId, fileName: name, fileType: type, fileSize: bytes.length };

  const batch = db.batch();
  for (let i = 0, n = 0; i < bytes.length; i += EVIDENCE_CHUNK_BYTES, n++) {
    batch.set(ref.collection('evidence_chunks').doc(`${evidenceId}_${String(n).padStart(3, '0')}`), {
      evidenceId,
      index: n,
      data: bytes.subarray(i, i + EVIDENCE_CHUNK_BYTES),
    });
  }
  const evidence: Evidence = {
    evidenceId, caseId: ref.id, fileName: name, fileType: type, fileSize: bytes.length,
    description: 'Document envoyé par le déclarant depuis la messagerie sécurisée.',
    storagePath: `firestore:evidence_chunks/${evidenceId}`, sha256Hash,
    version: 1, confidentiality: 'restricted', status: 'active', ...audit,
  };
  batch.set(ref.collection('evidence').doc(evidenceId), evidence);
  const text = typeof message === 'string' && message.trim() ? message.trim().slice(0, 10000) : `Document joint : ${name}`;
  batch.set(ref.collection('communications').doc(messageId), {
    messageId, caseId: ref.id, sender: 'reporter', senderDisplayName: 'Lanceur d’alerte', content: text,
    attachments: [evidenceId], attachmentFiles: [attachment], ...audit,
  });
  batch.set(ref.collection('presence').doc('state'), { reporterTypingAt: null }, { merge: true });
  await batch.commit();
  await appendTimeline(ref.id, 'EVIDENCE_ADDED_BY_REPORTER', 'reporter', name);
  await appendAudit({ actorId: 'reporter', action: 'EVIDENCE_ADDED_BY_REPORTER', caseId: ref.id, objectType: 'evidence', objectId: evidenceId });

  return { messageId, evidenceId };
});

/** Contenu d'un document du déclarant, pour l'équipe habilitée (accès audité). */
export const getEvidenceFileForStaff = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, evidenceId } = (request.data ?? {}) as { caseId?: string; evidenceId?: string };
  if (!caseId || !evidenceId) throw new HttpsError('invalid-argument', 'caseId and evidenceId are required.');
  const { ref } = await requireCaseAccess(caseId, user, 'evidence.read');
  const evSnap = await ref.collection('evidence').doc(evidenceId).get();
  if (!evSnap.exists) throw new HttpsError('not-found', 'Evidence not found.');
  const evidence = evSnap.data() as Evidence;
  if (evidence.status === 'deleted' || !evidence.storagePath?.startsWith('firestore:')) {
    throw new HttpsError('failed-precondition', 'This file is not available for download here.');
  }
  const chunks = await ref.collection('evidence_chunks').where('evidenceId', '==', evidenceId).get();
  const parts = chunks.docs
    .map((d) => d.data() as { index: number; data: Buffer | Uint8Array })
    .sort((a, b) => a.index - b.index)
    .map((c) => Buffer.from(c.data));
  await appendAudit({ actorId: user.userId, action: 'EVIDENCE_DOWNLOADED', caseId, objectType: 'evidence', objectId: evidenceId });
  return { fileName: evidence.fileName, fileType: evidence.fileType, dataBase64: Buffer.concat(parts).toString('base64') };
});

// ---------------------------------------------------------------------------
// createCaseAsReporter
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4 : miroir de
// la soumission publique) ===
// La pièce manquante identifiée en construisant cette phase : `createCase`
// (plus haut) exige `requireAppUser()` — un vrai jeton Firebase Auth avec
// la permission `cases.create` (tenue par le personnel, jamais par
// `reporter`, qui n'a `[]` dans permissions.ts) — donc injoignable par
// AlertSubmissionFlow.tsx, le formulaire PUBLIC, anonyme, sans session.
// Ce nouveau callable suit exactement le même principe que
// `getCaseForReporter`/`addCommunicationAsReporter` juste au-dessus :
// aucun `requireAppUser()`, l'autorisation vient d'ailleurs — ici, du fait
// qu'il ne fait QUE créer un nouveau dossier, jamais lire ou modifier un
// dossier existant. Génère ses propres identifiants de suivi
// (accessCode/salt/hash, mêmes fonctions que `verifyPassword` ci-dessus)
// et son propre numéro de dossier (même compteur transactionnel que
// `createCase`, `counters/cases` — un seul compteur partagé, jamais deux
// suites de numéros qui pourraient se chevaucher).
//
// Volontairement PAS relié à l'écran de confirmation que voit le
// déclarant : `src/services/casesCloudSync.ts` (client) appelle ce
// callable en tâche de fond, best-effort, exactement comme
// `saveAlertToCloud` (services/firebase.ts) le fait déjà pour le modèle
// legacy — le numéro de suivi et le mot de passe réellement affichés
// restent ceux du modèle local (`storage.ts`), seule source de vérité
// tant que les phases 5/6 n'ont pas migré l'UI (voir docs/DATABASE.md).
// Les identifiants générés ici ne sont donc utilisés par aucun écran
// aujourd'hui — mais existent pour que ce dossier miroir reste, en
// principe, consultable par `getCaseForReporter` plus tard, plutôt que
// d'être un enregistrement orphelin sans aucun identifiant de suivi.
// ---------------------------------------------------------------------------

// === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
/** Champs du dossier issus des détails du formulaire public. */
function reporterDetailsCaseFields(details: ReporterCaseDetails | undefined): Partial<Case> {
  if (!details) return {};
  const out: Partial<Case> = {};
  if (details.incidentDates) {
    out.incidentDate = details.incidentDates;
    out.incidentDateUnknown = false;
  }
  if (details.incidentLocation) out.incidentLocation = details.incidentLocation;
  if (details.isOngoing !== undefined) out.isOngoing = details.isOngoing;
  if (details.impactType) out.impactType = details.impactType;
  if (details.estimatedImpactValue) out.estimatedImpactValue = details.estimatedImpactValue;
  if (details.customViolationType) out.customViolationType = details.customViolationType;
  if (details.slaDueAt) {
    out.slaStartAt = new Date().toISOString();
    out.slaDueAt = details.slaDueAt;
  }
  if (details.risk) {
    out.riskScore = details.risk.totalScore;
    out.priority = details.risk.priority;
  }
  return out;
}

/** Documents à écrire avec le dossier : personnes, évaluation du risque, pièces, identité (mode identifié). */
function reporterDetailsWrites(
  caseRef: FirebaseFirestore.DocumentReference,
  caseId: string,
  details: ReporterCaseDetails | undefined,
  reportingMode: Case['reportingMode'],
  nowIso: string
): { ref: FirebaseFirestore.DocumentReference; data: object }[] {
  if (!details) return [];
  const audit = { createdAt: nowIso, createdBy: 'reporter', updatedAt: nowIso, updatedBy: 'reporter' };
  const writes: { ref: FirebaseFirestore.DocumentReference; data: object }[] = [];
  (details.persons ?? []).forEach((p, i) => {
    const personId = `person-${caseId}-${i + 1}`;
    const person: Person = {
      personId, caseId, kind: p.kind, name: p.name,
      ...(p.position ? { position: p.position } : {}),
      ...(p.hierarchyLevel ? { hierarchyLevel: p.hierarchyLevel } : {}),
      ...audit,
    };
    writes.push({ ref: caseRef.collection('persons').doc(personId), data: person });
  });
  if (details.risk) {
    const assessmentId = `risk-${caseId}-reporter`;
    const assessment: RiskAssessment = {
      assessmentId, caseId,
      financialImpact: details.risk.financialImpact,
      hierarchicalLevel: details.risk.hierarchicalLevel,
      recurrence: details.risk.recurrence,
      reputationRisk: details.risk.reputationRisk,
      totalScore: details.risk.totalScore,
      priority: details.risk.priority,
      isOverride: false,
      active: true,
      ...audit,
    };
    writes.push({ ref: caseRef.collection('risk_assessments').doc(assessmentId), data: assessment });
  }
  (details.evidence ?? []).forEach((e, i) => {
    const evidenceId = `evidence-${caseId}-${i + 1}`;
    const evidence: Evidence = {
      evidenceId, caseId, fileName: e.name, fileType: e.type, fileSize: e.size,
      description: 'Pièce déposée par le déclarant avec son signalement (fichier conservé sur son appareil, non transmis).',
      version: 1, confidentiality: 'restricted', status: 'active',
      ...audit,
    };
    writes.push({ ref: caseRef.collection('evidence').doc(evidenceId), data: evidence });
  });
  if (reportingMode === 'identified' && details.identity) {
    const id = details.identity;
    const identity: ReporterIdentity = {
      caseId, isAnonymous: false,
      ...(id.fullName ? { fullName: id.fullName } : {}),
      ...(id.jobTitle ? { jobTitle: id.jobTitle } : {}),
      ...(id.department ? { department: id.department } : {}),
      ...(id.declarantType ? { declarantType: id.declarantType } : {}),
      ...(id.email ? { email: id.email } : {}),
      ...(id.phone ? { phone: id.phone } : {}),
      ...(id.entity ? { entity: id.entity } : {}),
      ...(id.country ? { country: id.country } : {}),
    };
    writes.push({ ref: db.collection('reporter_identities').doc(caseId), data: identity });
  }
  return writes;
}

// === AMÉLIORATION AJOUTÉE (revue PR #139) === limitation de débit DURABLE
// des créations publiques, par adresse IP (compteur Firestore dans
// `rate_limits`, fermé aux clients par firestore.rules) : vérifiée AVANT
// l'attribution du numéro, la dérivation PBKDF2 et toute écriture.
const REPORTER_CREATE_MAX_PER_WINDOW = Number(process.env.REPORTER_CREATE_MAX_PER_HOUR) > 0 ? Number(process.env.REPORTER_CREATE_MAX_PER_HOUR) : 10;
const REPORTER_CREATE_WINDOW_MS = 60 * 60 * 1000;

async function assertCaseCreationAllowed(ip: string): Promise<void> {
  const ref = db.collection('rate_limits').doc(`create_${ip.replace(/[^A-Za-z0-9:.]/g, '_').slice(0, 100) || 'unknown'}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? (snap.data() as { windowStart?: number; count?: number }) : {};
    const fresh = !data.windowStart || now - data.windowStart >= REPORTER_CREATE_WINDOW_MS;
    const count = fresh ? 1 : (data.count ?? 0) + 1;
    tx.set(ref, { windowStart: fresh ? now : data.windowStart, count }, { merge: true });
    return count <= REPORTER_CREATE_MAX_PER_WINDOW;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'Too many submissions from this network. Try again later.');
}

// === AMÉLIORATION AJOUTÉE (revue PR #139) === App Check appliqué dès que
// ENFORCE_APP_CHECK=true (functions/.env), une fois App Check configuré côté
// Web (docs/DEVOPS-RUNBOOK.md) — l'activer avant casserait toute soumission.
export const createCaseAsReporter = onCall({ enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true', secrets: [NOTIFY_RESEND_KEY] }, async (request) => {
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === validation d'exécution
  // (types, tailles, énumérations) : seules les valeurs validées sont écrites.
  const parsed = parseReporterCaseInput(request.data);
  if (!parsed.ok) {
    throw new HttpsError('invalid-argument', parsed.error);
  }
  const data = parsed.value;
  await assertCaseCreationAllowed(request.rawRequest?.ip ?? 'unknown');

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
    reportingMode: data.reportingMode,
    priority: 'low',
    riskScore: 0,
    confidentialityLevel: data.confidentialityLevel,
    additionalInvestigators: [],
    slaStatus: 'ok',
    receivedAt: nowIso,
    incidentDateUnknown: true,
    description: data.description,
    legalHold: false,
    implicatedUserIds: [],
    // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) === reste
    // du formulaire public (nettoyé par sanitizeReporterCaseDetails).
    ...reporterDetailsCaseFields(data.details),
    // === AMÉLIORATION AJOUTÉE (revue PR #139) === voir Case.externalReference
    // (posé dans la transaction ci-dessous, seulement si la réservation réussit).
    createdAt: nowIso,
    createdBy: 'reporter',
    updatedAt: nowIso,
    updatedBy: 'reporter',
  };
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === le code d'accès déjà remis au
  // lanceur d'alerte par le formulaire est réutilisé (seule son empreinte
  // est stockée) : ses identifiants de suivi ouvrent aussi ce dossier réel.
  // À défaut, un code est généré comme avant.
  // === AMÉLIORATION AJOUTÉE (rattrapage des signalements anciens) === un
  // signalement déposé avant l'envoi au serveur n'a plus son code en clair :
  // l'empreinte déjà calculée sur l'appareil est reprise telle quelle
  // (formats stricts, voir parseHashedAccessCode).
  let credentials: ReporterCredentials;
  if (!data.accessCode && data.accessCodeHash && data.accessCodeSalt) {
    credentials = { caseId, accessCodeHash: data.accessCodeHash, accessCodeSalt: data.accessCodeSalt };
  } else {
    const accessCode = data.accessCode ?? generateAccessPassword();
    const accessCodeSalt = generateSalt();
    const accessCodeHash = await hashPassword(accessCode, accessCodeSalt);
    credentials = { caseId, accessCodeHash, accessCodeSalt };
  }

  // === AMÉLIORATION AJOUTÉE (revue PR #139 — unicité du numéro de suivi) ===
  // Réservation du numéro de suivi local, dossier et identifiants écrits dans
  // UNE transaction : jamais de réservation orpheline si une écriture échoue.
  // Seule une réservation existante (lue dans la transaction) fait créer le
  // dossier sans `externalReference` ; toute autre erreur est propagée.
  // === AMÉLIORATION AJOUTÉE (numéro de suivi attribué par le serveur +
  // dépôt rejouable sans doublon) ===
  // - `submissionId` : un nouvel essai du même dépôt (réseau coupé, page
  //   rechargée, file d'attente du navigateur) renvoie le dossier déjà créé
  //   au lieu d'en créer un second ; si cet essai porte un numéro local déjà
  //   remis au déclarant, ce numéro est ajouté comme alias du même dossier.
  // - `entityCode` sans `externalReference` : le serveur attribue le numéro
  //   de suivi officiel (CODE-AA-MM-NNNN), unique, via un compteur par
  //   entité et par mois — fini les numéros identiques générés par deux
  //   appareils différents.
  type CreateOutcome = { caseId: string; caseNumber: string; trackingNumber: string; created: boolean };
  const outcome: CreateOutcome = await db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const credsRef = db.collection('reporter_credentials').doc(caseId);
    const submissionRef = data.submissionId ? db.collection('reporter_submissions').doc(data.submissionId) : null;

    // Toutes les lectures d'abord (règle des transactions Firestore).
    const previous = submissionRef ? await tx.get(submissionRef) : null;
    if (previous?.exists) {
      const prev = previous.data() as { caseId: string; caseNumber: string; trackingNumber: string };
      if (data.externalReference && data.externalReference !== prev.trackingNumber) {
        const aliasRef = db.collection('external_references').doc(data.externalReference);
        const alias = await tx.get(aliasRef);
        if (!alias.exists) tx.create(aliasRef, { caseId: prev.caseId, createdAt: nowIso });
      }
      return { ...prev, created: false };
    }

    let doc: Case = kase;
    let trackingNumber = kase.caseNumber;
    if (data.externalReference) {
      const reservationRef = db.collection('external_references').doc(data.externalReference);
      const reservation = await tx.get(reservationRef);
      if (!reservation.exists) {
        tx.create(reservationRef, { caseId, createdAt: nowIso });
        doc = { ...kase, externalReference: data.externalReference };
        trackingNumber = data.externalReference;
      }
    } else if (data.entityCode) {
      const now = new Date(nowIso);
      const period = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const counterRef = db.collection('counters').doc(`tracking_${data.entityCode}_${period}`);
      const counter = await tx.get(counterRef);
      let seq = counter.exists ? Number((counter.data() as { value?: number }).value ?? 0) : 0;
      let candidate: string | null = null;
      for (let attempt = 0; attempt < 50 && !candidate; attempt++) {
        seq += 1;
        const ref = formatTrackingNumber(data.entityCode, now, seq);
        const taken = await tx.get(db.collection('external_references').doc(ref));
        if (!taken.exists) candidate = ref;
      }
      if (!candidate) throw new HttpsError('resource-exhausted', 'Could not allocate a tracking number. Try again.');
      tx.set(counterRef, { value: seq }, { merge: true });
      tx.create(db.collection('external_references').doc(candidate), { caseId, createdAt: nowIso });
      doc = { ...kase, externalReference: candidate };
      trackingNumber = candidate;
    }
    tx.set(caseRef, doc);
    tx.set(credsRef, credentials);
    // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) === mêmes
    // collections que celles lues par getCaseDetails (personnes, risque,
    // pièces) et getReporterIdentity (identité, accès audité).
    for (const w of reporterDetailsWrites(caseRef, caseId, data.details, data.reportingMode, nowIso)) {
      tx.set(w.ref, w.data);
    }
    if (submissionRef) {
      tx.create(submissionRef, { caseId, caseNumber: kase.caseNumber, trackingNumber, createdAt: nowIso });
    }
    return { caseId, caseNumber: kase.caseNumber, trackingNumber, created: true };
  });

  if (outcome.created) {
    await appendTimeline(caseId, 'CASE_CREATED', 'reporter');
    await appendAudit({ actorId: 'reporter', action: 'CASE_CREATED_BY_REPORTER', caseId, newValue: kase.status });
    // === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
    // un compte du personnel nommé parmi les personnes mises en cause est
    // rattaché automatiquement : il ne voit plus le dossier sur le portail.
    const subjects = (data.details?.persons ?? []).filter((p) => p.kind === 'subject');
    const implicatedUids = await autoLinkImplicatedStaff(caseId, data.details?.persons ?? []);
    // === AMÉLIORATION AJOUTÉE (notifications e-mail) === superviseurs, DARC,
    // et le cas échéant DGA / DRH (règles de l'administration).
    await notifyCaseEvent('new_report', {
      caseId,
      excludedUids: implicatedUids,
      facts: {
        implicatedPersons: subjects.map((p) => ({ name: p.name, position: p.position })),
        reference: outcome.trackingNumber,
        category: kase.category,
        subcategory: kase.subcategory,
        entity: kase.entity,
        country: kase.country,
        priority: kase.priority,
        implicatedLevels: (data.details?.persons ?? []).filter((p) => p.kind === 'subject').map((p) => p.hierarchyLevel),
      },
    });
  }

  // === AMÉLIORATION AJOUTÉE (pièces jointes du formulaire transmises) ===
  // session courte remise au déclarant pour un dossier tout juste créé : elle
  // permet d'envoyer aussitôt les fichiers joints au formulaire
  // (addSubmissionEvidenceAsReporter). Jamais pour un dépôt rejoué.
  const sessionToken = outcome.created ? await issueReporterSession(outcome.caseId) : undefined;
  return {
    caseId: outcome.caseId,
    caseNumber: outcome.caseNumber,
    trackingNumber: outcome.trackingNumber,
    ...(sessionToken ? { sessionToken } : {}),
  };
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

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === limiteur par IP (best
// effort, par instance) ; `maxInstances: 2` borne en plus le débit global
// d'envoi et la facture de ce point public.
const notifyRateLimiter = new FixedWindowRateLimiter(rateLimitFromEnv(process.env.NOTIFY_RATE_LIMIT), NOTIFY_RATE_WINDOW_MS);

// === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié) ===
// 'staff' : jeton d'identité vérifié d'un compte du personnel ;
// 'app'   : seulement un jeton App Check vérifié (dépôt public anonyme) ;
// null    : aucun appelant vérifié.
async function verifiedNotifyCaller(headers: HeaderBag): Promise<'staff' | 'app' | null> {
  const idToken = bearerToken(headers);
  if (idToken) {
    const claims = await getAuth().verifyIdToken(idToken).catch(() => null);
    if (isStaffClaims(claims as Record<string, unknown> | null)) return 'staff';
  }
  const attestation = appCheckToken(headers);
  if (attestation) {
    const verified = await getAppCheck().verifyToken(attestation).catch(() => null);
    if (verified) return 'app';
  }
  return null;
}

// === AMÉLIORATION AJOUTÉE (revue PR #139 — voie anonyme à contenu imposé) ===
// Destinataire d'une notification anonyme : obligatoirement un compte du
// personnel existant (Firebase Auth, claim `role`).
async function isStaffRecipient(email: string): Promise<boolean> {
  const user = await getAuth().getUserByEmail(email).catch(() => null);
  if (isStaffClaims((user?.customClaims ?? null) as Record<string, unknown> | null)) return true;
  // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) === e-mail
  // de contact d'un compte créé depuis le portail (profil Firestore), dont
  // le compte Auth existe toujours avec un rôle.
  const contact = await staffUidByContactEmail(email).catch(() => null);
  if (!contact?.active) return false;
  const owner = await getAuth().getUser(contact.uid).catch(() => null);
  return isStaffClaims((owner?.customClaims ?? null) as Record<string, unknown> | null);
}

export const notifyEmail = onRequest({ secrets: [RESEND_API_KEY], maxInstances: 2 }, async (req, res) => {
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

  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === mêmes règles que
  // api/notify-email.ts : Origin = l'app (X-Forwarded-Host posé par la
  // réécriture Hosting), destinataire unique valide, sujet préfixé
  // « [activa-whistleblowing] », liens vers l'app uniquement, débit par IP.
  const guard = validateNotifyEmailRequest(
    { to, subject, body, headers: req.headers },
    { allowedOrigins: process.env.NOTIFY_ALLOWED_ORIGINS, allowedRecipientDomains: process.env.NOTIFY_ALLOWED_RECIPIENT_DOMAINS }
  );
  if (!guard.ok) {
    console.warn(`notifyEmail refused (${guard.status}): ${guard.error}`);
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  if (!notifyRateLimiter.hit(clientIp(req.headers, req.ip))) {
    res.status(429).json({ error: 'Too many notification requests — retry later.' });
    return;
  }
  // === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié) === l'origine
  // n'authentifie personne : aucun envoi sans jeton d'identité Firebase d'un
  // compte du personnel (attribution, escalade) ou jeton App Check de
  // l'application (dépôt public anonyme). Échec fermé.
  const caller = await verifiedNotifyCaller(req.headers);
  if (!caller) {
    console.warn('notifyEmail refused (401): caller not verified');
    res.status(401).json({ error: 'Caller not verified: staff ID token or App Check token required.' });
    return;
  }
  // === AMÉLIORATION AJOUTÉE (revue PR #139 — voie anonyme à contenu imposé) ===
  // Appelant anonyme : seule la notification « nouveau signalement » passe,
  // reconstruite ici à partir du numéro de suivi, et seulement vers un
  // compte du personnel. Aucun sujet ni corps choisi par le client n'est
  // envoyé.
  let outgoing = { subject: guard.subject, body: guard.body };
  if (caller === 'app') {
    const trackingNumber = parseNewAlertNotification(guard.subject, guard.body);
    if (!trackingNumber) {
      res.status(403).json({ error: 'Anonymous callers may only send the new-report notification.' });
      return;
    }
    if (!(await isStaffRecipient(guard.to))) {
      res.status(403).json({ error: 'Anonymous notifications may only be sent to staff accounts.' });
      return;
    }
    outgoing = newAlertNotification(trackingNumber);
  }

  const fromAddress = process.env.NOTIFY_FROM_EMAIL || 'ACTIVA EthicAlert <onboarding@resend.dev>';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // === AMÉLIORATION AJOUTÉE === valeurs normalisées par le garde-fou.
      // === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) === version HTML
      // (logo, liens cliquables) en plus du texte brut.
      body: JSON.stringify({
        from: fromAddress,
        to: [guard.to],
        subject: outgoing.subject,
        text: outgoing.body,
        html: plainTextToBrandedHtml(outgoing.body, notifyAppUrl(), outgoing.subject.replace(/^\[[^\]]*\]\s*/, '')),
      }),
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

// === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
// Détail complet de dossiers déjà connus (ids obtenus par listCases), pour
// que tous les écrans du portail (Boîte de réception, Mes dossiers, fiche
// dossier…) affichent les dossiers enregistrés dans Firebase, et plus
// seulement ceux créés dans le navigateur. Chaque dossier passe par
// requireCaseAccess(cases.read) : un dossier inconnu, ou non autorisé pour
// l'appelant (mis en cause, hors périmètre, non attribué…), est simplement
// omis — jamais signalé, pour ne rien révéler de son existence. Les
// communications et les métadonnées de pièces exigent en plus leurs propres
// permissions ; l'identité du déclarant n'est jamais renvoyée ici.
const CASE_DETAILS_MAX_IDS = 50;

export const getCaseDetails = onCall(async (request) => {
  const user = requireAppUser(request);
  const raw = (request.data as { caseIds?: unknown } | undefined)?.caseIds;
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > CASE_DETAILS_MAX_IDS ||
    raw.some((id) => typeof id !== 'string' || !id || id.length > 128)
  ) {
    throw new HttpsError('invalid-argument', `caseIds must list 1 to ${CASE_DETAILS_MAX_IDS} case ids.`);
  }
  const caseIds = Array.from(new Set(raw as string[]));

  const byCreatedAt = <T extends { createdAt?: string }>(items: T[]) =>
    items.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

  // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) === dossiers
  // lus EN PARALLÈLE (par groupes de 10) au lieu d'un par un : même
  // contrôle d'accès et même contenu, ordre des résultats conservé.
  const loadOne = async (caseId: string) => {
    let access: { ref: FirebaseFirestore.DocumentReference; kase: Case };
    try {
      access = await requireCaseAccess(caseId, user, 'cases.read');
    } catch {
      return null;
    }
    const { ref, kase } = access;
    const [persons, tasks, interviews, notes, actions, risks, cois] = await Promise.all([
      ref.collection('persons').get(),
      ref.collection('tasks').get(),
      ref.collection('interviews').get(),
      ref.collection('investigation_notes').get(),
      ref.collection('corrective_actions').get(),
      ref.collection('risk_assessments').where('active', '==', true).limit(1).get(),
      ref.collection('coi_declarations').get(),
    ]);
    const personList = persons.docs.map((d) => d.data() as Person);
    const context = { case: kase, implicatedUserIds: implicatedUserIdsFromPersons(personList) };
    const communications = can(user, 'communications.read', context)
      ? (await ref.collection('communications').get()).docs.map((d) => d.data() as Communication)
      : [];
    const evidence = can(user, 'evidence.read', context)
      ? (await ref.collection('evidence').get()).docs
          .map((d) => d.data() as Evidence)
          .filter((e) => e.status !== 'deleted')
      : [];

    return {
      case: kase,
      persons: byCreatedAt(personList),
      tasks: byCreatedAt(tasks.docs.map((d) => d.data() as Task)),
      interviews: byCreatedAt(interviews.docs.map((d) => d.data() as Interview)),
      notes: byCreatedAt(notes.docs.map((d) => d.data() as { createdAt?: string })),
      communications: byCreatedAt(communications),
      correctiveActions: byCreatedAt(actions.docs.map((d) => d.data() as CorrectiveAction)),
      riskAssessment: risks.empty ? null : (risks.docs[0].data() as RiskAssessment),
      coiDeclarations: cois.docs.map((d) => d.data() as ConflictOfInterestDeclaration),
      evidence: byCreatedAt(evidence),
    };
  };
  const details = [];
  const CONCURRENCY = 10;
  for (let i = 0; i < caseIds.length; i += CONCURRENCY) {
    const group = await Promise.all(caseIds.slice(i, i + CONCURRENCY).map(loadOne));
    for (const d of group) if (d) details.push(d);
  }
  return { details };
});

// ---------------------------------------------------------------------------
// applyPortalUpdate
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
// Enregistre le travail du personnel jusqu'ici conservé dans le seul
// navigateur : attribution, statut affiché, clôture, réouverture, escalade,
// routage indépendant, rapport d'enquête, avancement des tâches, rattachement
// d'une personne à un compte. Chaque partie est contrôlée avec la permission
// qui lui correspond ; une partie refusée n'empêche pas les autres et est
// signalée dans la réponse. Toute modification est inscrite dans la piste
// d'audit et l'historique du dossier.
// ---------------------------------------------------------------------------

export const applyPortalUpdate = onCall({ secrets: [NOTIFY_RESEND_KEY] }, async (request) => {
  const user = requireAppUser(request);
  const { caseId, patch: rawPatch } = (request.data ?? {}) as { caseId?: string; patch?: unknown };
  if (typeof caseId !== 'string' || !caseId || caseId.length > 128) throw new HttpsError('invalid-argument', 'caseId is required.');
  let patch: PortalPatch;
  try {
    patch = sanitizePortalPatch(rawPatch);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof PortalPatchError ? e.message : 'Invalid patch.');
  }

  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Case ${caseId} not found.`);
  const kase = snap.data() as Case;
  const personsSnap = await ref.collection('persons').get();
  const persons = personsSnap.docs.map((d) => d.data() as Person);
  const context = { case: kase, implicatedUserIds: implicatedUserIdsFromPersons(persons) };
  if (!can(user, 'cases.read', context)) throw new HttpsError('permission-denied', 'Not authorized on this case.');

  const applied: string[] = [];
  const rejected: { part: string; reason: string }[] = [];
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {};
  let newStatus: CaseStatus | null = null; // === AMÉLIORATION AJOUTÉE (notifications e-mail) ===

  // 1. Statut affiché, clôture, réouverture, escalade, routage, rapport.
  if (patch.portal) {
    const target = patch.portal.workflowStatus ?? null;
    const legacy = patch.portal.status ?? null;
    const needed: Permission =
      target === 'archived' || legacy === 'archived'
        ? 'cases.archive'
        : target === 'reopened' || legacy === 'reopened'
          ? 'cases.reopen'
          : target === 'closed' || legacy === 'closed'
            ? 'cases.close'
            : 'cases.edit';
    if (can(user, needed, context)) {
      for (const key of PORTAL_KEYS) {
        if (!(key in patch.portal)) continue;
        const value = (patch.portal as Record<string, unknown>)[key];
        update[`portal.${key}`] = value === null ? FieldValue.delete() : value;
      }
      // === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === le statut
      // officiel du dossier suit le statut tenu par le portail (seul moteur de
      // workflow utilisé par les équipes ; permission vérifiée ci-dessus).
      const nextStatus = portalVisibleCaseStatus(kase.status, { ...(kase.portal ?? {}), ...(patch.portal as object) } as PortalState);
      newStatus = nextStatus;
      if (nextStatus !== kase.status) {
        update.status = nextStatus;
        if (nextStatus === 'closed' && !kase.closedAt) {
          update.closedAt = nowIso;
          update.closedBy = user.userId;
        }
        if (nextStatus === 'archived') update.archivedAt = nowIso;
      }
      applied.push('portal');
    } else {
      rejected.push({ part: 'portal', reason: `Permission ${needed} required.` });
    }
  }

  // 2. Attribution (liste vide = désattribution).
  let assignment: { assignee: string | null; additionalInvestigators: string[] } | null = null;
  if (patch.assignedInvestigators) {
    if (!can(user, 'cases.assign', context)) {
      rejected.push({ part: 'assignment', reason: 'Permission cases.assign required.' });
    } else {
      try {
        const uids = Array.from(new Set(await Promise.all(patch.assignedInvestigators.map(resolveStaffUid))));
        await Promise.all(uids.map(assertCaseBearingRole));
        if (uids.some((uid) => context.implicatedUserIds.includes(uid))) {
          throw new HttpsError('failed-precondition', 'A person implicated in this case cannot be assigned to it.');
        }
        assignment = { assignee: uids[0] ?? null, additionalInvestigators: uids.slice(1) };
        update.assignee = assignment.assignee ?? FieldValue.delete();
        update.additionalInvestigators = assignment.additionalInvestigators;
        applied.push('assignment');
      } catch (e) {
        rejected.push({ part: 'assignment', reason: e instanceof Error ? e.message : 'Invalid assignment.' });
      }
    }
  }

  // 3. Rattachement d'une personne à un compte (même privilège que addPerson).
  const linkChanges: { personId: string; previous: string | null; next: string | null }[] = [];
  if (patch.personLinks?.length) {
    if (!can(user, 'cases.assign', context)) {
      rejected.push({ part: 'personLinks', reason: 'Permission cases.assign required.' });
    } else {
      const byId = new Map(persons.map((p) => [p.personId, p]));
      for (const link of patch.personLinks) {
        const person = byId.get(link.personId);
        if (!person) continue;
        let next: string | null = null;
        if (link.linkedUserId) {
          try {
            next = await resolveStaffUid(link.linkedUserId);
          } catch {
            rejected.push({ part: `personLinks:${link.personId}`, reason: 'Unknown staff account.' });
            continue;
          }
        }
        if ((person.linkedUserId ?? null) === next) continue;
        linkChanges.push({ personId: person.personId, previous: person.linkedUserId ?? null, next });
        person.linkedUserId = next ?? undefined;
      }
      if (linkChanges.length) {
        update.implicatedUserIds = implicatedUserIdsFromPersons(persons);
        applied.push('personLinks');
      }
    }
  }

  // 4. Avancement des tâches.
  const taskWrites: { taskId: string; data: Record<string, unknown> }[] = [];
  if (patch.taskUpdates?.length) {
    if (!can(user, 'cases.edit', context)) {
      rejected.push({ part: 'taskUpdates', reason: 'Permission cases.edit required.' });
    } else {
      for (const u of patch.taskUpdates) {
        const data: Record<string, unknown> = { updatedAt: nowIso, updatedBy: user.userId };
        if (u.status) data.status = u.status;
        if (u.completedAt !== undefined) data.completedAt = u.completedAt === null ? FieldValue.delete() : u.completedAt;
        if (u.dueDate) data.dueDate = u.dueDate;
        if (u.owner) data.owner = u.owner;
        if (u.title) data.title = u.title;
        taskWrites.push({ taskId: u.taskId, data });
      }
      applied.push('taskUpdates');
    }
  }

  if (!applied.length) {
    throw new HttpsError('permission-denied', rejected.map((r) => r.reason).join(' ') || 'Nothing to update.');
  }

  const batch = db.batch();
  batch.update(ref, { ...update, updatedAt: nowIso, updatedBy: user.userId, lastActivityAt: nowIso });
  for (const c of linkChanges) {
    batch.update(ref.collection('persons').doc(c.personId), {
      linkedUserId: c.next ?? FieldValue.delete(),
      updatedAt: nowIso,
      updatedBy: user.userId,
    });
  }
  for (const w of taskWrites) {
    const taskRef = ref.collection('tasks').doc(w.taskId);
    if ((await taskRef.get()).exists) batch.update(taskRef, w.data as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
  }
  await batch.commit();

  if (patch.portal && applied.includes('portal')) {
    const p = patch.portal;
    await appendAudit({
      actorId: user.userId,
      action: 'PORTAL_CASE_UPDATED',
      caseId,
      previousValue: { status: kase.portal?.status ?? null, workflowStatus: kase.portal?.workflowStatus ?? kase.status },
      newValue: { fields: Object.keys(p), status: p.status ?? null, workflowStatus: p.workflowStatus ?? null },
    });
    await appendTimeline(caseId, 'PORTAL_UPDATED', user.userId, Object.keys(p).join(', '));
  }
  if (assignment) {
    await appendAudit({
      actorId: user.userId,
      action: 'CASE_ASSIGNED',
      caseId,
      previousValue: { assignee: kase.assignee ?? null, additionalInvestigators: kase.additionalInvestigators ?? [] },
      newValue: assignment,
    });
    await appendTimeline(caseId, 'ASSIGNED', user.userId, `Assignee: ${assignment.assignee ?? '-'}`);
  }
  for (const c of linkChanges) {
    await appendAudit({
      actorId: user.userId,
      action: c.next ? 'PERSON_LINKED_TO_USER' : 'PERSON_LINK_REMOVED',
      caseId,
      objectType: 'person',
      objectId: c.personId,
      previousValue: c.previous,
      newValue: c.next,
    });
  }
  if (taskWrites.length) {
    await appendAudit({ actorId: user.userId, action: 'TASKS_UPDATED', caseId, newValue: taskWrites.map((w) => w.taskId) });
  }

  // === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
  const events: NotificationEvent[] = [];
  if (assignment?.assignee && assignment.assignee !== (kase.assignee ?? null)) events.push('assigned');
  if (applied.includes('portal') && patch.portal?.escalatedAt && patch.portal.escalatedAt !== kase.portal?.escalatedAt) events.push('escalated');
  if (newStatus && newStatus !== kase.status && (newStatus === 'closed' || newStatus === 'reopened')) events.push(newStatus);
  if (events.length) {
    const facts: CaseNotificationFacts = {
      reference: kase.externalReference || kase.caseNumber,
      category: kase.category,
      subcategory: kase.subcategory,
      entity: kase.entity,
      country: kase.country,
      priority: kase.priority,
      implicatedLevels: persons.filter((p) => p.kind === 'subject').map((p) => p.hierarchyLevel),
      // === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
      implicatedPersons: persons.filter((p) => p.kind === 'subject').map((p) => ({ name: p.name, position: p.position })),
    };
    const excludedUids = [user.userId, ...implicatedUserIdsFromPersons(persons)];
    for (const ev of events) await notifyCaseEvent(ev, { caseId, facts, excludedUids });
  }

  return { ok: true, applied, rejected };
});

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 2) ===
// Documents : fichiers joints au formulaire de signalement, pièces et rapport
// d'enquête ajoutés par le personnel. Même stockage que les documents de la
// messagerie (morceaux dans Firestore, Cloud Storage n'étant pas activé),
// même téléchargement audité (getEvidenceFileForStaff).
// ---------------------------------------------------------------------------

function decodeEvidenceFile(dataBase64: unknown): Buffer {
  if (typeof dataBase64 !== 'string' || !dataBase64) throw new HttpsError('invalid-argument', 'File content is required.');
  const bytes = Buffer.from(dataBase64, 'base64');
  if (bytes.length === 0) throw new HttpsError('invalid-argument', 'Empty file.');
  if (bytes.length > REPORTER_FILE_MAX_BYTES) throw new HttpsError('invalid-argument', 'File too large.');
  return bytes;
}

function writeEvidenceChunks(batch: FirebaseFirestore.WriteBatch, ref: FirebaseFirestore.DocumentReference, evidenceId: string, bytes: Buffer) {
  for (let i = 0, n = 0; i < bytes.length; i += EVIDENCE_CHUNK_BYTES, n++) {
    batch.set(ref.collection('evidence_chunks').doc(`${evidenceId}_${String(n).padStart(3, '0')}`), {
      evidenceId,
      index: n,
      data: bytes.subarray(i, i + EVIDENCE_CHUNK_BYTES),
    });
  }
}

/**
 * Fichier joint au formulaire de signalement : complète la pièce déjà
 * décrite lors du dépôt (même nom, même taille, sans contenu) ; sinon,
 * ajoute une nouvelle pièce. Aucun message n'est créé dans la conversation.
 */
export const addSubmissionEvidenceAsReporter = onCall(async (request) => {
  const { sessionToken, fileName, fileType, dataBase64 } = (request.data ?? {}) as {
    sessionToken?: string;
    fileName?: string;
    fileType?: string;
    dataBase64?: string;
  };
  const { ref } = await verifyReporterSession(sessionToken ?? '');
  const bytes = decodeEvidenceFile(dataBase64);
  const name = safeFileName(fileName ?? 'document');
  const type = typeof fileType === 'string' && fileType.length <= 120 ? fileType : 'application/octet-stream';
  const sha256Hash = createHash('sha256').update(bytes).digest('hex');
  const nowIso = new Date().toISOString();

  const existing = await ref.collection('evidence').where('createdBy', '==', 'reporter').get();
  if (existing.docs.some((d) => (d.data() as Evidence).sha256Hash === sha256Hash)) {
    return { ok: true, duplicate: true }; // déjà transmis (nouvel essai)
  }
  const placeholder = existing.docs.find((d) => {
    const e = d.data() as Evidence;
    return !e.storagePath && e.fileSize === bytes.length && (e.fileName === name || safeFileName(e.fileName) === name);
  });
  if (!placeholder && existing.size >= REPORTER_FILE_MAX_PER_CASE) {
    throw new HttpsError('resource-exhausted', 'Too many files for this case.');
  }
  const evidenceId = placeholder ? placeholder.id : newId('ev');

  const batch = db.batch();
  writeEvidenceChunks(batch, ref, evidenceId, bytes);
  if (placeholder) {
    batch.update(placeholder.ref, {
      storagePath: `firestore:evidence_chunks/${evidenceId}`,
      sha256Hash,
      fileType: type,
      description: 'Pièce déposée par le déclarant avec son signalement.',
      updatedAt: nowIso,
      updatedBy: 'reporter',
    });
  } else {
    const evidence: Evidence = {
      evidenceId, caseId: ref.id, fileName: name, fileType: type, fileSize: bytes.length,
      description: 'Pièce déposée par le déclarant avec son signalement.',
      storagePath: `firestore:evidence_chunks/${evidenceId}`, sha256Hash,
      version: 1, confidentiality: 'restricted', status: 'active',
      createdAt: nowIso, createdBy: 'reporter', updatedAt: nowIso, updatedBy: 'reporter',
    };
    batch.set(ref.collection('evidence').doc(evidenceId), evidence);
  }
  await batch.commit();
  await appendTimeline(ref.id, 'EVIDENCE_ADDED_BY_REPORTER', 'reporter', name);
  await appendAudit({ actorId: 'reporter', action: 'EVIDENCE_ADDED_BY_REPORTER', caseId: ref.id, objectType: 'evidence', objectId: evidenceId });
  return { ok: true, evidenceId };
});

/**
 * Pièce ajoutée par le personnel (onglet Preuves) ou fichier du rapport
 * d'enquête. Permission `evidence.upload` sur le dossier ; même identifiant
 * que la copie du portail ; audité.
 */
export const addEvidenceAsStaff = onCall(async (request) => {
  const user = requireAppUser(request);
  const { caseId, fileName, fileType, dataBase64, description, clientId } = (request.data ?? {}) as {
    caseId?: string;
    fileName?: string;
    fileType?: string;
    dataBase64?: string;
    description?: string;
    clientId?: string;
  };
  if (typeof caseId !== 'string' || !caseId) throw new HttpsError('invalid-argument', 'caseId is required.');
  const { ref } = await requireCaseAccess(caseId, user, 'evidence.upload');
  const bytes = decodeEvidenceFile(dataBase64);
  const name = safeFileName(fileName ?? 'document');
  const type = typeof fileType === 'string' && fileType.length <= 120 ? fileType : 'application/octet-stream';
  const sha256Hash = createHash('sha256').update(bytes).digest('hex');
  const nowIso = new Date().toISOString();

  let evidenceId = newId('ev');
  if (typeof clientId === 'string' && CLIENT_ID_RE.test(clientId)) {
    const current = await ref.collection('evidence').doc(clientId).get();
    if (current.exists) {
      if ((current.data() as Evidence).sha256Hash === sha256Hash) return { ok: true, evidenceId: clientId, duplicate: true };
    } else {
      evidenceId = clientId;
    }
  }

  const batch = db.batch();
  writeEvidenceChunks(batch, ref, evidenceId, bytes);
  const evidence: Evidence = {
    evidenceId, caseId, fileName: name, fileType: type, fileSize: bytes.length,
    description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 1000) : 'Pièce ajoutée par l’équipe.',
    storagePath: `firestore:evidence_chunks/${evidenceId}`, sha256Hash,
    version: 1, confidentiality: 'restricted', status: 'active',
    createdAt: nowIso, createdBy: user.userId, updatedAt: nowIso, updatedBy: user.userId,
  };
  batch.set(ref.collection('evidence').doc(evidenceId), evidence);
  await batch.commit();
  await appendTimeline(caseId, 'EVIDENCE_ADDED', user.userId, name);
  await appendAudit({ actorId: user.userId, action: 'EVIDENCE_UPLOADED', caseId, objectType: 'evidence', objectId: evidenceId });
  return { ok: true, evidenceId };
});

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
// Configuration partagée par tous les postes (entités, pays, catégories,
// SLA, niveaux hiérarchiques, rôles, transitions, destinataires d'escalade).
// Lecture : tout compte du personnel. Écriture : permission
// configuration.manage, auditée. Stockage : `config/portal`, chaque section
// sérialisée (domain/portalConfig.ts).
// ---------------------------------------------------------------------------

export const getPortalConfig = onCall(async (request) => {
  requireAppUser(request);
  const snap = await db.collection('config').doc('portal').get();
  const data = (snap.data() ?? {}) as { sections?: Record<string, string>; versions?: Record<string, unknown> };
  return { sections: data.sections ?? {}, versions: data.versions ?? {} };
});

export const savePortalConfig = onCall(async (request) => {
  const user = requireAppUser(request);
  if (!can(user, 'configuration.manage')) throw new HttpsError('permission-denied', 'Permission configuration.manage required.');
  const { section, value } = (request.data ?? {}) as { section?: unknown; value?: unknown };
  let serialized: { section: PortalConfigSection; json: string };
  try {
    serialized = serializePortalConfigSection(section, value);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Invalid configuration.');
  }
  const nowIso = new Date().toISOString();
  const ref = db.collection('config').doc('portal');
  const previous = (await ref.get()).data()?.sections?.[serialized.section];
  if (previous === serialized.json) return { ok: true, unchanged: true };
  await ref.set(
    {
      sections: { [serialized.section]: serialized.json },
      versions: { [serialized.section]: { updatedAt: nowIso, updatedBy: user.userId } },
    },
    { merge: true }
  );
  await appendAudit({ actorId: user.userId, action: 'CONFIG_UPDATED', objectType: 'config', objectId: serialized.section });
  return { ok: true, updatedAt: nowIso };
});

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 4) ===
// Piste d'audit centralisée. recordPortalAudit copie dans `audit_logs` les
// événements enregistrés par le portail (auteur, rôle et adresse IP fixés
// ici, jamais par le navigateur ; identifiant stable : un nouvel envoi
// n'ajoute jamais de doublon). listAuditLogs renvoie le journal commun aux
// comptes habilités (audit.read).
// ---------------------------------------------------------------------------

export const recordPortalAudit = onCall(async (request) => {
  const user = requireAppUser(request);
  let entries: PortalAuditInput[];
  try {
    entries = sanitizePortalAuditBatch((request.data as { entries?: unknown } | undefined)?.entries);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Invalid entries.');
  }
  const receivedAt = new Date().toISOString();
  const ip = request.rawRequest?.ip ?? '';
  const batch = db.batch();
  for (const e of entries) {
    const docId = `portal-${user.userId}-${e.id}`.slice(0, 200);
    batch.set(db.collection('audit_logs').doc(docId), {
      id: docId,
      source: 'portal',
      portalEntryId: e.id,
      action: e.actionType,
      details: e.details,
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.roleId,
      ...(e.alertId ? { alertId: e.alertId } : {}),
      ...(e.trackingNumber ? { trackingNumber: e.trackingNumber } : {}),
      timestamp: e.timestamp,
      receivedAt,
      ...(ip ? { ipAddress: ip } : {}),
    });
  }
  await batch.commit();
  return { ok: true, recorded: entries.length };
});

export const listAuditLogs = onCall(async (request) => {
  const user = requireAppUser(request);
  if (!can(user, 'audit.read')) throw new HttpsError('permission-denied', 'Permission audit.read required.');
  const { limit: rawLimit, before } = (request.data ?? {}) as { limit?: unknown; before?: unknown };
  const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.max(1, Math.min(1000, Math.floor(rawLimit))) : 500;
  let query = db.collection('audit_logs').orderBy('timestamp', 'desc');
  if (typeof before === 'string' && before.length <= 40) query = query.where('timestamp', '<', before);
  const snap = await query.limit(limit).get();
  const rows = snap.docs.map((d) => d.data() as Record<string, unknown>);

  // Numéro de suivi des dossiers et nom des comptes (événements du serveur).
  const caseIds = [...new Set(rows.map((r) => r.caseId).filter((v): v is string => typeof v === 'string' && !!v))];
  const actorIds = [...new Set(rows.filter((r) => !r.actorName).map((r) => r.actorId).filter((v): v is string => typeof v === 'string' && !!v && v !== 'reporter' && v !== 'maintenance'))];
  const [caseDocs, staffDocs] = await Promise.all([
    caseIds.length ? db.getAll(...caseIds.map((id) => db.collection('cases').doc(id))) : Promise.resolve([]),
    actorIds.length ? db.getAll(...actorIds.map((id) => db.collection('staff_users').doc(id))) : Promise.resolve([]),
  ]);
  const refOf = new Map(caseDocs.filter((d) => d.exists).map((d) => [d.id, String(d.data()?.externalReference || d.data()?.caseNumber || '')]));
  const nameOf = new Map(staffDocs.filter((d) => d.exists).map((d) => [d.id, String(d.data()?.name || d.data()?.username || '')]));
  const text = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : undefined);

  const entries = rows.map((r) => ({
    id: String(r.id ?? ''),
    source: r.source === 'portal' ? 'portal' : 'server',
    portalEntryId: text(r.portalEntryId, 80),
    action: String(r.action ?? ''),
    details: text(r.details),
    actorId: text(r.actorId, 200),
    actorName: text(r.actorName, 200) ?? (typeof r.actorId === 'string' ? nameOf.get(r.actorId) : undefined),
    actorRole: text(r.actorRole, 64),
    caseId: text(r.caseId, 128),
    alertId: text(r.alertId, 128),
    trackingNumber: text(r.trackingNumber, 64) ?? (typeof r.caseId === 'string' ? refOf.get(r.caseId) : undefined),
    objectType: text(r.objectType, 64),
    objectId: text(r.objectId, 200),
    reason: text(r.reason, 1000),
    timestamp: String(r.timestamp ?? ''),
    ipAddress: text(r.ipAddress, 64),
  }));
  return { entries };
});

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
// Envoi CÔTÉ SERVEUR des notifications (auparavant parties du navigateur : un
// déclarant externe ne connaissant aucun compte du personnel, un nouveau
// signalement ne prévenait en pratique personne). Destinataires et conditions
// réglés dans l'administration (config/portal, section emailNotifications ;
// valeurs par défaut sinon) — voir src/domain/emailNotificationRules.ts.
// Chaque envoi (réussi ou non) est inscrit dans la piste d'audit. Un échec
// d'envoi n'interrompt jamais l'action qui l'a déclenché.
// ---------------------------------------------------------------------------

async function loadEmailNotificationSettings(): Promise<EmailNotificationSettings> {
  try {
    const json = (await db.collection('config').doc('portal').get()).data()?.sections?.emailNotifications;
    return typeof json === 'string' ? sanitizeEmailNotificationSettings(JSON.parse(json)) : DEFAULT_EMAIL_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_EMAIL_NOTIFICATION_SETTINGS;
  }
}

async function loadStaffRecipientCandidates(): Promise<StaffRecipientCandidate[]> {
  const snap = await db.collection('staff_users').get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      email: String(x.email ?? ''),
      name: String(x.name ?? ''),
      role: x.role as RoleId,
      active: x.active !== false,
      countries: Array.isArray(x.countries) ? x.countries : [],
      entities: Array.isArray(x.entities) ? x.entities : [],
    };
  });
}

function notifyAppUrl(): string {
  if (process.env.NOTIFY_APP_URL) return process.env.NOTIFY_APP_URL;
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'activa-ethicalert-47246';
  return `https://${project}.web.app`;
}

/** Envoi d'un e-mail (Resend). Ne lève jamais. */
// === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) === `html` facultatif :
// envoyé avec le texte brut (les messageries choisissent la version à afficher).
async function sendNotificationEmail(to: string, subject: string, body: string, html?: string): Promise<{ ok: boolean; error?: string }> {
  let apiKey = '';
  try {
    apiKey = NOTIFY_RESEND_KEY.value();
  } catch {
    apiKey = '';
  }
  if (!apiKey) return { ok: false, error: 'Service d’envoi non configuré (RESEND_API_KEY).' };
  const allowed = parseCsvList(process.env.NOTIFY_ALLOWED_RECIPIENT_DOMAINS);
  if (allowed.length && !allowed.includes(to.split('@')[1]?.toLowerCase() ?? '')) {
    return { ok: false, error: `Domaine du destinataire non autorisé (${to.split('@')[1]}).` };
  }
  const from = process.env.NOTIFY_FROM_EMAIL || 'ACTIVA EthicAlert <onboarding@resend.dev>';
  const endpoint = process.env.NOTIFY_RESEND_ENDPOINT || 'https://api.resend.com/emails';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text: body, ...(html ? { html } : {}) }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

async function notifyCaseEvent(
  event: NotificationEvent,
  input: { caseId: string; facts: CaseNotificationFacts; excludedUids?: string[] }
): Promise<void> {
  try {
    const [settings, staff] = await Promise.all([loadEmailNotificationSettings(), loadStaffRecipientCandidates()]);
    const recipients = resolveNotificationRecipients({ event, facts: input.facts, settings, staff, excludedUids: input.excludedUids });
    if (!recipients.length) return;
    const appUrl = notifyAppUrl();
    const results = await Promise.all(
      recipients.map(async (r) => {
        const { subject, body, html } = buildNotificationEmail({ event, facts: input.facts, group: r.group, reason: r.reason, appUrl });
        return { r, res: await sendNotificationEmail(r.email, subject, body, html) };
      })
    );
    for (const { r, res } of results) {
      await appendAudit({
        actorId: 'system-notifications',
        action: res.ok ? 'EMAIL_NOTIFICATION_SENT' : 'EMAIL_NOTIFICATION_FAILED',
        caseId: input.caseId,
        objectType: 'email',
        objectId: r.email,
        newValue: { event, group: r.group, reason: r.reason },
        ...(res.error ? { reason: res.error } : {}),
      });
    }
  } catch (e) {
    console.error('notifyCaseEvent failed', event, e);
  }
}

/**
 * E-mail d'essai vers les destinataires d'un groupe (écran d'administration) :
 * vérifie le service d'envoi et les adresses. Renvoie le résultat par adresse.
 */
export const sendTestNotificationEmail = onCall({ secrets: [NOTIFY_RESEND_KEY] }, async (request) => {
  const user = requireAppUser(request);
  if (!can(user, 'configuration.manage')) throw new HttpsError('permission-denied', 'Permission configuration.manage required.');
  const { groupId, settings: rawSettings } = (request.data ?? {}) as { groupId?: unknown; settings?: unknown };
  if (!RECIPIENT_GROUP_IDS.includes(groupId as RecipientGroupId)) throw new HttpsError('invalid-argument', 'Unknown group.');
  let settings: EmailNotificationSettings;
  try {
    settings = rawSettings ? sanitizeEmailNotificationSettings(rawSettings) : await loadEmailNotificationSettings();
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Invalid settings.');
  }
  const group = settings.groups.find((g) => g.id === groupId)!;
  const staff = await loadStaffRecipientCandidates();
  const emails = [
    ...new Set([
      ...staff.filter((s) => s.active && group.roles.includes(s.role) && isValidEmail(s.email)).map((s) => s.email.toLowerCase()),
      // === AMÉLIORATION AJOUTÉE (acheminement) : contacts « Nom <adresse> »
      ...group.extraEmails.map((e) => parseContact(e).email),
    ]),
  ];
  if (!emails.length) return { results: [] };
  const subject = `[activa-whistleblowing] E-mail d’essai — ${GROUP_LABEL[group.id]}`;
  const body = [
    'Bonjour,',
    '',
    `Ceci est un e-mail d’essai envoyé depuis l’administration du portail activa-whistleblowing par ${user.name}.`,
    `Vous recevrez les notifications prévues pour le groupe « ${GROUP_LABEL[group.id]} ».`,
    '',
    `Portail : ${notifyAppUrl()}`,
    '— activa-whistleblowing (message automatique, ne pas répondre)',
  ].join('\n');
  // === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) ===
  const html = renderBrandedEmailHtml({
    appUrl: notifyAppUrl(),
    title: 'E-mail d’essai',
    preheader: `Notifications du groupe « ${GROUP_LABEL[group.id]} »`,
    paragraphs: [
      'Bonjour,',
      `Ceci est un e-mail d’essai envoyé depuis l’administration du portail activa-whistleblowing par ${user.name}.`,
      `Vous recevrez les notifications prévues pour le groupe « ${GROUP_LABEL[group.id]} ».`,
    ],
    cta: { label: 'Ouvrir le portail', url: notifyAppUrl() },
  });
  const results = await Promise.all(emails.map(async (email) => ({ email, ...(await sendNotificationEmail(email, subject, body, html)) })));
  await appendAudit({ actorId: user.userId, action: 'EMAIL_TEST_SENT', objectType: 'email', objectId: group.id, newValue: results.map((r) => ({ email: r.email, ok: r.ok })) });
  return { results };
});

// === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
/**
 * Rattache automatiquement aux comptes du personnel les personnes mises en
 * cause dont le nom correspond (prénom et nom) : `implicatedUserIds` est mis à
 * jour, le compte ne voit plus le dossier sur le portail. Audité. Renvoie les
 * comptes rattachés. N'échoue jamais.
 */
async function autoLinkImplicatedStaff(caseId: string, persons: { kind: string; name: string }[]): Promise<string[]> {
  try {
    const subjects = persons.map((p, i) => ({ ...p, personId: `person-${caseId}-${i + 1}` })).filter((p) => p.kind === 'subject');
    if (!subjects.length) return [];
    const staff = await loadStaffRecipientCandidates();
    const ref = db.collection('cases').doc(caseId);
    const linked: string[] = [];
    for (const p of subjects) {
      const match = staff.filter((s) => s.active && s.name && namesMatch(p.name, s.name));
      if (match.length !== 1) continue; // aucun ou plusieurs homonymes : rien d'automatique
      const uid = match[0].uid;
      await ref.collection('persons').doc(p.personId).set({ linkedUserId: uid, updatedAt: new Date().toISOString(), updatedBy: 'system' }, { merge: true });
      linked.push(uid);
      await appendAudit({ actorId: 'system', action: 'PERSON_AUTO_LINKED_TO_USER', caseId, objectType: 'person', objectId: p.personId, newValue: uid });
    }
    if (linked.length) await ref.update({ implicatedUserIds: FieldValue.arrayUnion(...linked) });
    return linked;
  } catch (e) {
    console.error('autoLinkImplicatedStaff failed', e);
    return [];
  }
}
