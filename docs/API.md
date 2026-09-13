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
| Cloud Functions (the real network-callable API) | **7 of ~15 mutation/read operations implemented and type-checked**: `createCase`, `assignCase`, `changeCaseStatus`, `addAllegation`, `setAllegationFinding`, `addPerson`, `getCaseForReporter`. **Not deployed** — see `docs/FIREBASE-SETUP.md` for the exact, final reason (Cloud Build/Artifact Registry require the Blaze billing plan; the project has made an explicit, documented decision to stay on Spark). Nothing below is reachable over the network right now. |
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

## Planned, not yet implemented (the remaining `CaseRepository` surface)

Same pattern as the three above (verify identity from the token, call
`can()`/`checkTransition()` from the same domain layer, write a timeline
event and an audit entry) — listed here as the concrete backlog, not a
vague "more to come":

| Operation | Purpose |
|---|---|
| `listAllegations`, `listPersons` | Read-side of the two mutations above — not yet a callable (see the `getCase`/`listCases` row below on reads generally). |
| `addEvidence`, `listEvidence` | Evidence metadata + (once built) a signed, short-lived Storage upload/download URL — deliberately never a public URL (see `Evidence.storagePath`'s comment in `caseTypes.ts`). |
| `addTask`, `listTasks` | Investigation task tracking. |
| `addInterview`, `listInterviews` | Interview scheduling/summaries. |
| `addInvestigationNote`, `listInvestigationNotes` | Internal notes — never reporter-visible, a distinct collection from `Communication` on purpose. |
| `addCommunication`, `listCommunications` | Reporter⇄investigator messaging. |
| `addCorrectiveAction`, `listCorrectiveActions` | Corrective action tracking — feeds the closure-gating check in `checkTransition`. |
| `recordRiskAssessment`, `getActiveRiskAssessment` | Risk scoring, preserving original vs. override (see `RiskAssessment.isOverride` in `caseTypes.ts`). Is what should ultimately set `Case.priority`/`riskScore` after `createCase` — not yet wired. |
| `declareConflictOfInterest` | Conflict-of-interest declarations. |
| `getReporterIdentity` | Must log a `REPORTER_IDENTITY_ACCESSED` audit entry on every call — see `docs/DATABASE.md`. |
| `listAuditEvents` | Audit trail retrieval (`audit.read` permission). |
| `getCase`, `listCases` | Reads. `getCase` already has a real, deployed, direct-Firestore equivalent (`getDoc`, see `docs/PERMISSIONS.md`) — a callable version would mainly matter for reporters or for hiding fields server-side. `listCases` is the one genuinely blocked by Firestore's list-query wall (`docs/FIREBASE-SETUP.md` Phase 4 finding) — this is the callable every future Control Panel screen needs before it can be built for real. |

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
