# ACTIVA Hotline — API Reference

Documents the server-side mutation API: the `CaseRepository` contract
(`src/data-access/caseRepository.ts`) and its real Cloud Functions
implementation (`functions/src/index.ts`). This file is **generated from
the actual code**; if it and the code ever disagree, the code is the source
of truth.

## Status, stated plainly up front

| | Status |
|---|---|
| `CaseRepository` interface (~24 operations) | Fully specified in TypeScript. Fully implemented twice: `LocalCaseRepository` (localStorage, used by nothing in the shipped UI yet) and `FirestoreAdminCaseRepository` (Admin SDK, used by the one-off seed/migration scripts). Both pass the same behavior (see `docs/PHASES.md` Phase 2/2b). |
| Cloud Functions (the real network-callable API) | **All 18 mutation-shaped `CaseRepository` operations implemented and type-checked**, including `addEvidence`/`getEvidenceDownloadUrl`. Only the read-side callables (`getCase`/`listCases`) remain unbuilt — blocked on Firestore's list-query wall, a different problem entirely (see below). **Not deployed** — see `docs/FIREBASE-SETUP.md` for the exact, final reason (Cloud Build/Artifact Registry require the Blaze billing plan; the project has made an explicit, documented decision to stay on Spark). `addEvidence`/`getEvidenceDownloadUrl` additionally depend on Cloud Storage for Firebase, which is a **harder** wall than the rest: verified directly against the real project, its default Storage bucket does not exist at all yet (SERVICE_DISABLED — see `storage.rules`' header comment). Nothing below is reachable over the network right now. |
| Reads | Not a Cloud Function today — direct Firestore reads via `firestore.rules`, single-document `getDoc` only (see `docs/PERMISSIONS.md`/`docs/FIREBASE-SETUP.md` — list queries are blocked outright by Firestore itself, a Cloud Function is the architecturally-required fix, same billing blocker as above). |

This document describes the API **as designed and as far as it is built**,
not as if it were live. Treat every "not deployed" note here as load-bearing,
not a footnote.

## Authentication & identity (every callable)

Every implemented callable follows the same pattern via `requireAppUser()`:

1. Rejects with `unauthenticated` if the request carries no verified
   Firebase Auth ID token (`request.auth` is null).
2. Rejects with `permission-denied` if the token has no `role` custom claim
   (an account exists in Firebase Auth but was never provisioned with
   ACTIVA Hotline claims via `scripts/setupAuthUsers.ts`).
3. Otherwise builds a real `AppUser` (`src/domain/caseTypes.ts`) straight
   from the verified token's claims (`role`, `countries`, `entities`) — **never**
   from anything else the client sends in the request body. A client cannot
   claim to be a different role or scope than its own signed token carries;
   there is no parameter that overrides this.

This is the same claim shape `scripts/setupAuthUsers.ts` writes and
`firestore.rules` reads — one identity model, three enforcement points
(rules, functions, and `permissions.ts` itself), never re-derived
differently in any of them.

## Implemented operations

### `createCase`

| | |
|---|---|
| Permission required | `cases.create` |
| Request | `{ category, subcategory?, country, entity, reportingMode?, description, confidentialityLevel? }` |
| Response | `{ caseId, caseNumber }` |
| Errors | `unauthenticated`, `permission-denied` (no `cases.create`), `invalid-argument` (missing `category`/`country`/`entity`/`description`) |

Behavior notes, all real (read the function, not this summary, for the
literal defaults): `status` always starts at `'new'`; `priority` always
starts at `'low'` and `riskScore` at `0` — **never set from client input**,
because both are meant to come from a subsequent, dedicated risk-assessment
step (`recordRiskAssessment`, not yet implemented as a callable), so a
caller cannot fabricate an inflated priority at creation time.
`confidentialityLevel` defaults to `'confidential'` if the caller doesn't
supply one (a deliberately cautious default, not `'restricted'`).
`implicatedUserIds` always starts empty (no persons exist yet at creation).
Writes the case document, a `CASE_CREATED` timeline event, and a
`CASE_CREATED` audit log entry, in that order, before returning.

### `assignCase`

| | |
|---|---|
| Permission required | `cases.assign`, evaluated against the **existing** case (scope, confidentiality, implicated-person — the full `can()` check, not just the permission string) |
| Request | `{ caseId, assignee, additionalInvestigators? }` |
| Response | `{ ok: true }` |
| Errors | `unauthenticated`, `invalid-argument` (missing `caseId`/`assignee`), `not-found` (no such case), `permission-denied` (fails `can()`) |

Fetches the case and its `persons` subcollection first specifically to
compute `implicatedUserIds` fresh (via `implicatedUserIdsFromPersons`) —
never trusts a possibly-stale `Case.implicatedUserIds` field for this
authorization decision inside the function, even though the same field is
what `firestore.rules` relies on for the read path. Records the previous
`assignee`/`additionalInvestigators` in the audit entry's `previousValue`,
not just the new state — every reassignment is reconstructable from
`audit_logs` alone.

### `changeCaseStatus`

| | |
|---|---|
| Permission required | `cases.close` if `to === 'closed'`, otherwise `cases.edit` — evaluated against the existing case, same as `assignCase` |
| Request | `{ caseId, to, reason? }` |
| Response | `{ ok: true, status }` |
| Errors | `unauthenticated`, `invalid-argument`, `not-found`, `permission-denied`, `failed-precondition` (workflow rules reject the transition — see `docs/WORKFLOW.md`) |

This is the one callable that calls `checkTransition()`
(`src/domain/workflow.ts`) — the same closure-gating logic documented in
`docs/WORKFLOW.md`, fetched fresh from the real `allegations` and
`corrective_actions` subcollections every time, never assumed from stale
state. **Even a rejected transition is audited**: a `STATUS_CHANGE_REJECTED`
entry is written (with the rejection `reason`) before the `HttpsError` is
thrown, so a pattern of repeated rejected attempts is visible in
`audit_logs`, not silently dropped. On success: updates `status`,
`updatedAt`/`updatedBy`, and — only when transitioning `to === 'closed'` —
`closedAt`/`closedBy` and `overallFinding` (derived via
`deriveOverallFinding`, never accepted from the client); only when
`to === 'archived'` — `archivedAt`. A `STATUS_<from>_TO_<to>` timeline event
and a `STATUS_CHANGED` audit entry (with `previousValue`/`newValue` as the
old/new status) are always written on success.

### `addAllegation`, `setAllegationFinding`, `addPerson`

All three share a new common gate, `requireCaseAccess(caseId, user,
permission)` — fetches the case, computes `implicatedUserIds` fresh from
the real `persons` subcollection (never trusts a possibly-stale copy), and
calls `can()`, exactly like `assignCase`/`changeCaseStatus` already did
inline; factored out here so every new callable calls it identically
rather than re-deriving the same three lines slightly differently each
time. All three require `cases.edit` — the closest existing permission in
`ROLE_PERMISSIONS` (there is no separate `allegations.*`/`persons.*`
permission in the `Permission` union, and adding one would mean touching
`permissions.ts` itself, which this session avoids doing for a
convenience).

| | |
|---|---|
| `addAllegation` | Request `{ caseId, category, subcategory?, description }` → `{ allegationId }`. Errors: `unauthenticated`, `invalid-argument`, `not-found`, `permission-denied`. New allegation always starts `status: 'open'`, no `finding` — matches `LocalCaseRepository`/`FirestoreAdminCaseRepository`'s identical behavior. Writes an `ALLEGATION_ADDED` timeline event. |
| `setAllegationFinding` | Request `{ allegationId, finding, rationale }` → `{ ok: true }`. Only `allegationId` is known here (not its case), so — like `scripts/firestoreAdminRepository.ts`'s identical method — this runs a `collectionGroup('allegations')` query to locate it first. `finding` is validated against the real `FindingOutcome` union (`SUBSTANTIATED`/`PARTIALLY_SUBSTANTIATED`/`UNSUBSTANTIATED`/`INCONCLUSIVE`/`OUT_OF_SCOPE`/`DUPLICATE`) before anything is written. Sets `status: 'assessed'` and the `findingDocumentedBy`/`findingDocumentedAt` fields — this is what ultimately feeds `deriveOverallFinding()` (`docs/WORKFLOW.md`) once every allegation on a case has one. Writes both a `FINDING_DOCUMENTED` timeline event and audit entry. |
| `addPerson` | Request `{ caseId, kind, name, ... }` (the rest of `Person`, minus server-set fields) → `{ personId }`. `kind` is validated to be exactly `'subject'` or `'witness'`. **=== AMÉLIORATION AJOUTÉE : la vérification de sécurité la plus importante de ce fichier ===** when `kind === 'subject'` and `linkedUserId` is set, this appends to `Case.implicatedUserIds` (`FieldValue.arrayUnion`) in the same call — the one write in the entire file that `firestore.rules`' `isNotImplicated` check directly depends on (rule #9, `docs/PERMISSIONS.md`). Skipping or reordering this relative to the person-document write would silently reopen the exact gap rule #9 exists to close, so it is called out explicitly in the code, not just here. |

### `addTask`, `addInterview`, `addInvestigationNote`, `addCommunication`, `addCorrectiveAction`, `recordRiskAssessment`, `declareConflictOfInterest`

All seven go through `requireCaseAccess` too. Most require `cases.edit` (the
same closest-fit permission `addAllegation`/`addPerson` use — there is no
finer-grained `Permission` for tasks/interviews/notes/corrective
actions/risk assessments/COI declarations in the `Permission` union);
`addCommunication` is the exception, gated on the actual dedicated
permission that already exists for it, `communications.send`.

| | |
|---|---|
| `addTask` | `{ caseId, title, description?, owner, priority, dueDate }` → `{ taskId }`. New task always starts `status: 'not_started'`, matching both repository implementations. |
| `addInterview` | `{ caseId, intervieweePersonId?, intervieweeLabel, scheduledAt? }` → `{ interviewId }`. `conductedBy` is always the verified caller; new interview always starts `status: 'planned'`. |
| `addInvestigationNote` | `{ caseId, content }` → `{ noteId }`. `authorId`/`createdBy` are always the verified caller, never client input — an investigation note's whole point is an accountable internal record reporters never see (`docs/DATABASE.md`). Writes an `INVESTIGATION_NOTE_ADDED` audit entry. |
| `addCommunication` | `{ caseId, content }` → `{ messageId }`. **=== AMÉLIORATION AJOUTÉE ===** the repository-layer signature (`scripts/firestoreAdminRepository.ts`) takes `sender`/`senderDisplayName` as caller-supplied values — fine for a trusted migration script, not safe for a public callable. This callable forces `sender: 'investigator'` and `senderDisplayName` from the verified token's own name, never from `request.data` — this path is reached only by an authenticated staff member; a reporter-side equivalent (through `getCaseForReporter`'s credential model, not a Firebase Auth token) is still on the backlog. Writes a `MESSAGE_SENT` timeline event. |
| `addCorrectiveAction` | `{ caseId, description, owner, entity?, dueDate, priority }` → `{ actionId }`. New action always starts `status: 'open'` — this is the status a case's closure gating (`checkTransition`, `docs/WORKFLOW.md`) requires to be resolved (`completed`/`not_applicable`) before a case can reach `closed`. |
| `recordRiskAssessment` | `{ caseId, financialImpact, hierarchicalLevel, recurrence, reputationRisk, totalScore, priority, isOverride, originalScore?, overrideReason? }` → `{ assessmentId }`. Marks every previously-`active` risk assessment on the case `active: false` and the new one `active: true` in one atomic batch (mirrors both repository implementations — "only one `RiskAssessment` per case should be active at a time", `caseTypes.ts`), then updates `Case.riskScore`/`Case.priority` from the new assessment in the same batch. This is the operation `createCase`'s own doc note says should follow case creation (which deliberately never lets a client set an inflated `priority`/`riskScore` directly). Audited as `RISK_OVERRIDDEN` when `isOverride` is true, `RISK_ASSESSED` otherwise, with `previousValue`/`newValue` recording `originalScore`/`totalScore`. |
| `declareConflictOfInterest` | `{ caseId, outcome, details? }` → `{ ok: true }`. `outcome` validated to be exactly `'no_conflict'` or `'conflict_identified'`. **=== AMÉLIORATION AJOUTÉE ===** the repository-layer signature takes `userId` as a plain parameter — fine for a trusted script, but a public callable must never let a caller declare a conflict of interest **as someone else**; this callable always uses the verified caller's own uid, never a client-supplied one. |

### `getCaseForReporter`

| | |
|---|---|
| Auth required | **None** — deliberately does not call `requireAppUser()`. Reporters hold no Firebase Auth token in this design (see `docs/DATABASE.md`); this is the one callable every reporter-facing flow depends on. Access is granted purely by knowing a real `caseNumber` + `accessCode` pair. |
| Request | `{ caseNumber, accessCode }` |
| Response | `{ caseNumber, status, receivedAt, description, communications }` — deliberately narrow, mirroring exactly what the legacy `AlertTrackingView` already shows a reporter today. Never includes allegations, persons, evidence, `investigation_notes`, the assignee's identity, `confidentialityLevel`, or `riskScore` — none of which a reporter is meant to see (`docs/DATABASE.md`). |
| Errors | `invalid-argument` (missing `caseNumber`/`accessCode`), `resource-exhausted` (rate-limited, see below), `permission-denied` (`'Invalid case number or access code.'` — covers both a nonexistent case number **and** a wrong access code, deliberately identical wording and error code for both, so existence is never leaked; same discipline as the Phase 4b `CaseLookup` finding in `docs/SECURITY.md`) |

**=== AMÉLIORATION AJOUTÉE : server-side rate limiting ===** Verifies the
access code with `verifyPassword()` from `src/services/crypto.ts` —
imported, not re-derived, so this can never quietly diverge from the exact
salted-hash check the legacy `AlertTrackingView` already performs
client-side. That file's own client-side rate limiter
(`src/services/rateLimiter.ts`) states plainly in its header comment that
"true rate limiting must ultimately be enforced server-side" — this
callable is that server-side enforcement: failed attempts are tracked in a
`rate_limits/{caseNumber}` document (Cloud Function/Admin SDK only, closed
to every client by `firestore.rules`, same as `counters/*`), using the
same thresholds as the client limiter (5 attempts, 5-minute lockout) so the
UX is unchanged — only where it's actually enforced. A client cannot reset
this counter by clearing `localStorage` or switching browsers, unlike the
purely client-side version.

The lookup-verify-rate-limit sequence itself is factored into a shared
`verifyReporterAccess(caseNumber, accessCode)` helper, reused by
`addCommunicationAsReporter` below rather than duplicated.

### `addCommunicationAsReporter`

| | |
|---|---|
| Auth required | None, same credential model as `getCaseForReporter` (reuses `verifyReporterAccess`, including the same shared rate limiter). |
| Request | `{ caseNumber, accessCode, content }` |
| Response | `{ messageId }` |
| Errors | Same as `getCaseForReporter` (`invalid-argument`, `resource-exhausted`, `permission-denied`) |

The reporter-side equivalent of the staff-only `addCommunication` above —
without it, a reporter could read their case's messages but never reply.
`senderDisplayName` is deliberately generic (`'Lanceur d'alerte'`)
regardless of `Case.reportingMode`, rather than looking up the reporter's
real name from `reporter_identities` — that collection's whole purpose is
explicit, individually-audited access (see `getReporterIdentity` below),
and this callable has no legitimate reason to read it just to fill in a
label. This is a deliberate, conservative simplification versus the legacy
`AlertTrackingView` (which does show a real name for non-anonymous
alerts), not an oversight — stated here rather than left implicit.

### `getReporterIdentity`

| | |
|---|---|
| Permission required | `audit.read` — **not** `cases.edit` (see below) |
| Request | `{ caseId }` |
| Response | The `ReporterIdentity` document, or `null` if none exists (anonymous reports have none). |
| Errors | `unauthenticated`, `invalid-argument`, `not-found`, `permission-denied` |

**=== AMÉLIORATION AJOUTÉE : gate choice, explained ===** Section 44 of
the brief (quoted in both existing repository implementations) says
plainly: "no investigator gets reporter identity merely because it was
assigned to the case" — explicit, individually-authorized, audited access
only. Neither `LocalCaseRepository` nor `FirestoreAdminCaseRepository`
actually enforces a distinct permission for this beyond auditing the
access (reasonable for those lower-level storage primitives, the same
reasoning `requireCaseAccess`'s own header comment gives); a public
callable is the real trust boundary, so this one gates on `audit.read`
rather than `cases.edit` — the closest existing `Permission` an
`investigator`/`senior_investigator` plainly does **not** hold, while
`functional_admin`/`darc_compliance` do, matching the brief's intent
without inventing a new permission in the `Permission` union just for this
one case. (`system_admin` also holds `audit.read` but has no case access
at all by design — `can()`'s assigned-or-global-visibility check still
correctly excludes it.) The audit entry
(`REPORTER_IDENTITY_ACCESSED`) is written unconditionally, even before the
identity document is read — the entry itself is the record that the
request was made, matching both existing repository implementations
exactly.

### `addEvidence`, `getEvidenceDownloadUrl`

| | |
|---|---|
| Permission required | `evidence.upload` for `addEvidence`, `evidence.read` for `getEvidenceDownloadUrl` — the one pair in this whole file where a dedicated, more specific `Permission` than `cases.edit` actually exists in the `Permission` union. |
| `addEvidence` request/response | `{ caseId, fileName, fileType, fileSize, description?, storagePath, sha256Hash?, confidentiality }` → `{ evidenceId }`. `confidentiality` validated to be exactly `'standard'` or `'restricted'`. `storagePath` validated to fall under `evidence/{caseId}/` — a caller cannot register metadata pointing at an unrelated file elsewhere in the bucket. New evidence always starts `version: 1`, `status: 'active'`, matching both existing repository implementations. |
| `getEvidenceDownloadUrl` request/response | `{ caseId, evidenceId }` → `{ url, expiresAt }` — a signed, time-limited Cloud Storage URL, **15 minutes**. |
| Errors | `unauthenticated`, `invalid-argument`, `not-found` (missing evidence, or `status: 'deleted'` — mirrors `listEvidence()`'s exclusion in both repositories rather than treating deleted evidence as still downloadable), `permission-denied` |

The file's bytes are never uploaded through a callable — the client
uploads directly to Cloud Storage (Firebase Storage SDK), gated by
`storage.rules`, at a path it generates under
`evidence/{caseId}/{anyId}/{fileName}`; `addEvidence` is called
*afterward* to record the Firestore metadata pointing at that path.
`getEvidenceDownloadUrl` is what actually fulfills the promise
`Evidence.storagePath`'s own comment in `caseTypes.ts` already made:
"Never a public URL — resolved through a signed, short-lived, audited
Cloud Function call." `storage.rules` denies direct reads unconditionally
(`allow read: if false`) specifically so this callable is the only path;
every access is authorized the same way `evidence.read` already is
everywhere else, and every access — not just a successful download — is
written to `audit_logs` as `EVIDENCE_ACCESSED`.

**=== AMÉLIORATION AJOUTÉE : un mur plus dur que les Functions elles-mêmes ===**
Verified directly against the real project (`activa-ethicalert-47246`):
its default Cloud Storage bucket does not exist — a direct
`storage.googleapis.com` check returns 404 "bucket does not exist", and
`firebasestorage.googleapis.com` itself returns `SERVICE_DISABLED`. Since
October 2024 a *new* default Storage bucket requires the Blaze plan — the
exact same wall already documented for Cloud Functions in
`docs/FIREBASE-SETUP.md`, and the same "stay on Spark" decision applies
here without needing to be re-litigated. `storage.rules` (new, mirrors
`firestore.rules`' authorization logic by necessity — Storage Security
Rules and Firestore Security Rules are separate rule languages that cannot
share function definitions, flagged in that file's own header comment
rather than assumed to auto-stay in sync) is written and added to
`firebase.json`, ready for the day Storage is provisioned, but nothing in
this section has ever been deployed or exercised against a real bucket.

## Reads not yet implemented as callables

Listed separately from the (now complete) mutation surface above:

| Operation | Purpose |
|---|---|
| `listAllegations`, `listPersons`, `listTasks`, `listInterviews`, `listInvestigationNotes`, `listCommunications`, `listCorrectiveActions`, `listEvidence`, `getActiveRiskAssessment`, `listAuditEvents` | Read-side of the mutations above — none are callables yet. |
| `getCase`, `listCases` | `getCase` already has a real, deployed, direct-Firestore equivalent (`getDoc`, see `docs/PERMISSIONS.md`) — a callable version would mainly matter for reporters or for hiding fields server-side. `listCases` is the one genuinely blocked by Firestore's list-query wall (`docs/FIREBASE-SETUP.md` Phase 4 finding) — this is the callable every future Control Panel screen needs before it can be built for real. |

## Where this fits in `docs/ARCHITECTURE.md`'s principle

> "The client never decides a sensitive mutation alone."

Once deployed, every write above is the actual authority — `firestore.rules`
closes `cases/**` to any direct client write (`allow write: if false`)
specifically so that this is not optional: there is no path to mutate case
data except through a callable that re-validates `can()`/`checkTransition()`
server-side, against the caller's real verified identity. Until deployment,
that also means **no client-side path to mutate case data exists at all** —
confirmed live (`docs/SECURITY.md`) — which is a stricter, not weaker,
state than having an unenforced client-side check would be.
