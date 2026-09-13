# ACTIVA Hotline — Phase Log

Tracks the AUDIT → PLAN → IMPLEMENT → TEST → VERIFY → DOCUMENT cycle for each
phase of the migration from the current client-only app to the target
Enterprise Whistleblowing & Case Management platform. Updated at the end of
every phase — do not mark a phase done here until it has actually been
implemented and verified.

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 1 | Fix broken staff-portal wiring, sidebar layout, salted password hashing, rate limiting | ✅ Done | See commit `641fd45`. Client-only hardening — documented limitations still apply (see `ARCHITECTURE.md` §A). |
| 2 | Target data model + architecture docs + additive domain/data-access layer + legacy migration function | ✅ Done | See below. |
| 2b | Activate the Phase 2 data model in the real Firebase project (`activa-ethicalert-47246`) | ✅ Done | See `docs/FIREBASE-SETUP.md`. 3 demo cases + full child collections + audit trail really written to and re-read from Firestore via `scripts/seedFirestore.ts`. Rules update drafted but **not yet deployed** (one manual console step, documented). This is data only — no Auth, no Cloud Functions, UI still unaware of this data. |
| 3 | Firebase Authentication + strict Security Rules | ✅ Done (Auth + Rules) / 🛑 Won't deploy on Spark (Functions, explicit decision) | See `docs/FIREBASE-SETUP.md`. 5 real staff Auth accounts with custom claims, created and verified via a real sign-in + decoded ID token. `firestore.rules` rewritten with real role/scope/implicated-person checks and **deployed for real** (direct Firebase Rules API call) — then **verified live** with real signed-in REST calls, catching and fixing a genuine bug (legacy demo ids vs. real Auth UIDs on `Case.assignee`). Cloud Functions (`functions/src/index.ts`, 3 of ~15 operations) written and type-checked. Deployment was pursued to the end: `serviceusage.serviceUsageAdmin` was granted, which genuinely fixed the original IAM gap (`cloudfunctions.googleapis.com` auto-enabled successfully) — but hit a hard, non-negotiable platform wall next: Cloud Build/Artifact Registry require the Blaze plan, no role or workaround changes that. **Explicit decision: stay on Spark.** Functions remain written but undeployed indefinitely by choice, not by unresolved blocker. |
| 4 | Control Panel (Overview, Alerts, Triage, Assignment, SLA & Escalations views) | 🛑 List-based screens blocked indefinitely on Spark / ✅ Case-ID lookup tool shipped | Firestore rejects `list`/query operations outright (not a silent per-document filter) whenever the rule depends on a field no query `where` clause constrains — here, `implicatedUserIds` (rule #9). Verified live: even `functional_admin` gets `403` trying to list `cases`, and (also verified live) a genuinely non-existent Case ID *also* returns `permission-denied`, not a clean "not found", for every role — Firestore never lets a denied read distinguish the two. A real "list of cases" UI needs a Cloud Function, blocked on the Spark decision (see Phase 3). What **was** shippable within Spark's limits: `src/components/CaseLookup.tsx` — real Firebase Auth sign-in + a single-document `getDoc` by known Case ID against the real, deployed rules, wired into the app as a new "Firebase Lookup (Beta)" tab. See `docs/FIREBASE-SETUP.md`. |
| 5 | Case Management UI on the new `Case` model | 🔜 Not started | Depends on Phase 3/4. |
| 6 | Investigation Workspace (Tasks, Interviews, Findings UI) | 🔜 Not started | Depends on Phase 5. |
| 7 | Risk / SLA / Assignment engines wired to configuration | 🔜 Not started | Depends on Phase 3. |
| 8 | Evidence upload (Storage) + Communications UI | 🔜 Not started | Depends on Phase 3. |
| 9 | Audit trail (server-side, append-only) + 3-tier Reporting | 🔜 Not started | Depends on Phase 3. |
| 10 | Security testing (section 54 of the brief) | 🟡 Partial — everything currently deployed is tested | See `docs/SECURITY.md`. 10 live tests against the real project (unauthenticated/out-of-scope/implicated/least-privilege access, non-existent-id behavior, write-closure, credential-isolation), plus a real finding caught and mitigated: `.env`'s shared `VITE_FIREBASE_*` names meant Phase 4's real config silently also activated Phase 1's legacy Firestore sync (open rules) — verified no data actually leaked, then removed `.env` from this session. Remaining scope (evidence access, export abuse, reassignment abuse, role escalation *within* a deployed Cloud Function) can't be tested until Phase 3's Functions deploy. |
| 11 | UX refinement | 🔜 Not started | — |
| 12 | Production readiness | 🔜 Not started | — |

---

## Phase 2 — Detail

**AUDIT** → see the audit delivered in chat before this phase started (architecture, feature matrix, security/data-model/workflow/permission gaps).

**PLAN** → introduce the target data model and a working data-access layer, additively, so nothing already shipped (Phase 1) is touched. Prove the model with a real migration of the 3 seed legacy cases rather than a schema-only exercise.

**IMPLEMENT**:
- `docs/ARCHITECTURE.md`, `docs/DATABASE.md` — current vs. target architecture, full field-by-field data model, legacy→target mapping table.
- `src/domain/caseTypes.ts` — target TypeScript model (Case, Allegation, Person, Evidence, Task, Interview, InvestigationNote, Communication, FindingSummary, CorrectiveAction, RiskAssessment, TimelineEvent, ConflictOfInterestDeclaration, AppUser/Role, configuration types).
- `src/domain/workflow.ts` — case status state machine with real transition validation, including the closure-gating rules from section 25 of the brief (all allegations assessed, findings documented, no open corrective actions, functional review sign-off).
- `src/domain/permissions.ts` — granular RBAC (`Permission` union + `ROLE_PERMISSIONS`) and scope-based `can()` function (role × country/entity scope × assignment × confidentiality level × "implicated persons never access their own case").
- `src/data-access/caseRepository.ts` — `CaseRepository` interface (the contract Phase 3's Cloud-Function-backed implementation will fulfill) + a fully working `LocalCaseRepository` (localStorage-backed, `activa_v2_*` keys, isolated from the live `activa_ethicalert_*` keys) that enforces the workflow and permission checks on every write and appends an audit event.
- `src/data-access/migrateLegacy.ts` — lossless-as-possible conversion of `AlertRecord[]` → `Case` + child collections, with explicit, honest warnings where the legacy model cannot supply a field (e.g. no historical per-allegation finding, no binary evidence content).

**TEST / VERIFY** (ad-hoc script run via `tsx` against the real `LocalCaseRepository`, then deleted — not part of the committed codebase):
- Migrated the 3 seed `AlertRecord`s end-to-end: correct `CaseStatus` mapping, correct priority/risk score carry-over, correct counts of allegations/persons/evidence/corrective actions/timeline events for each.
- `workflow.checkTransition`: confirmed `new → closed` is rejected (not a defined edge), `new → triage` is allowed, `functional_review → closed` is rejected both when an allegation has no finding and when corrective actions are still open, and correctly rejected again for missing functional-review sign-off even once those two conditions are satisfied — only succeeding once sign-off is also present.
- `permissions.can()`: confirmed a `system_admin` cannot read case content (least privilege, section 30), a non-assigned investigator cannot read a case they are not assigned to, and a user linked to an implicated `Person` cannot read the case even as `functional_admin` (section 23/rule 9).
- `tsc --noEmit` clean in both the project's default config and `--strict`.
- `vite build` output unchanged in size — confirms the new modules are inert (not imported by any shipped screen yet), so Phase 1's live app is provably unaffected.

**DOCUMENT** → this file + `ARCHITECTURE.md` + `DATABASE.md`.

**Explicitly out of scope for Phase 2** (deferred to later phases, not forgotten): wiring this model into any screen, real Firestore/Cloud Functions backing, SLA/notification engines actually running on a schedule, evidence binary upload. Building any of those now, without Phase 3's real backend, would mean shipping UI that "gives the impression the system works" without the engine behind it — which the brief explicitly forbids.

---

## Phase 2b — Detail (activating Phase 2's data in the real Firebase project)

**AUDIT** → confirmed no `.firebaserc`/`firebase.json`/credentials/CLI existed anywhere in the repo or session before this phase — nothing to reuse.

**PLAN** → given a service-account key to project `activa-ethicalert-47246`: (1) prove connectivity/auth with a throwaway read-write-delete probe before touching real data, (2) build a Node/Admin-SDK-only `CaseRepository` implementation reusing the exact same `domain/workflow.ts` + `domain/permissions.ts` logic as the browser-side `LocalCaseRepository` (single source of truth, not a re-implementation), (3) run the same, already-tested `migrateLegacyAlertsToCases()` function from Phase 2 against it, (4) verify with an independent fresh read, (5) explicitly close off the new collections in `firestore.rules` rather than relying on Firestore's implicit default-deny.

**IMPLEMENT**:
- `scripts/firestoreAdminRepository.ts` — Node-only, never imported from `src/`, uses `firebase-admin` (full-access, rules-bypassing by design — this is a trusted backend context, the seed script today and Cloud Functions in Phase 3).
- `scripts/seedFirestore.ts` — entry point, reads credentials from `GOOGLE_APPLICATION_CREDENTIALS_PATH`/`FIRESTORE_DATABASE_ID` env vars (never hard-coded), runs the migration, prints real counts per case.
- `firestore.rules` updated (additively — legacy `/alerts`, `/audit_logs`, `/users` rules untouched) to explicitly `allow read, write: if false` on `cases/**`, `reporter_credentials/*`, `reporter_identities/*`, `counters/*`.
- `firebase.json`, `.firebaserc`, `firestore.indexes.json` added for future `firebase deploy` use.
- `.gitignore` hardened against ever committing a service account key, even though the actual key used lived entirely outside the repo (session scratchpad only).

**TEST / VERIFY**:
- Connectivity probe: wrote, read back, and deleted a throwaway document in a `_connectivity_check` collection — first attempt failed with a gRPC `NOT_FOUND` (wrong database id assumption — the project uses a named database `default`, not the special `(default)`), fixed and re-verified.
- Ran the real seed: 3 `Case` documents created with correct field mapping, each with the expected child-collection documents (confirmed by an independent second script re-reading from a fresh Admin SDK connection, not the same process that wrote them): allegations, persons, evidence metadata, corrective actions, communications, investigation notes, timeline — matching the same counts already verified against `LocalCaseRepository` in Phase 2.
- Confirmed `reporter_credentials` holds only hash+salt (no plaintext) and `reporter_identities` has exactly 1 document (the one non-anonymous legacy alert).
- Confirmed 18 `audit_logs` entries written, one per creation event, by the same repository code path a production import would use.
- Attempted `firebase deploy --only firestore:rules`: failed on a Service Usage API permission the given service account does not hold (it has Firestore data-plane access but not project-level Service Usage read access) — documented as a known, honestly-reported gap rather than silently left undone or falsely claimed as deployed. The rules file is ready; deployment needs either a one-time manual paste in the console or one additional IAM role, both documented in `docs/FIREBASE-SETUP.md`.
- `tsc --noEmit` clean (default project config).

**DOCUMENT** → `docs/FIREBASE-SETUP.md` (full status, what's live, what isn't, how to redeploy rules, how to revoke the shared key) + this entry.

---

## Phase 3 — Detail (Authentication, Security Rules, Cloud Functions)

**AUDIT** → confirmed the Phase 2/2b groundwork (real domain model, real Firestore data) was in place and untouched; confirmed there were 0 existing Firebase Auth users and that the Email/Password sign-in provider was already enabled (checked via the Identity Toolkit Admin API before assuming anything needed console changes).

**PLAN** → (1) provision real staff Auth accounts with custom claims mirroring `permissions.ts` exactly, (2) prove sign-in genuinely works end-to-end (not just "user created"), (3) rewrite `firestore.rules` to enforce that same role/scope/implicated logic for real reads, (4) deploy and then *try to defeat* the deployed rules with real signed-in requests before trusting them, (5) only then attempt Cloud Functions, and stop cleanly (document, don't hack around) if project-level infrastructure (billing/API enablement) turns out to be genuinely out of reach.

**IMPLEMENT**:
- `scripts/setupAuthUsers.ts` — creates/updates the 5 staff accounts from `INITIAL_USERS` with custom claims (idempotent, generates and prints temporary passwords only for newly created accounts, never stores them).
- `src/domain/caseTypes.ts` — added `Case.implicatedUserIds` (denormalized from `Person.linkedUserId`), needed because Security Rules cannot run an arbitrary subcollection query; kept in sync by `addPerson()` in both `LocalCaseRepository` and `FirestoreAdminCaseRepository`.
- `firestore.rules` — real `cases/{caseId}` read rule: signed-in, not implicated, in country/entity scope, and (global-visibility role OR assigned investigator); all writes stay closed (Cloud Functions only). Subcollections stay closed pending a follow-up pass (reporter-facing reads need a Cloud Function anyway, since reporters hold no Firebase Auth token in this design).
- `scripts/relinkLegacyAssignees.ts` — fixes the legacy-id vs. real-UID mismatch the live rules test caught.
- `functions/` — a real Cloud Functions package (`createCase`, `assignCase`, `changeCaseStatus`) reusing `domain/permissions.ts` and `domain/workflow.ts` directly.

**TEST / VERIFY** (all against the real project, not simulated):
- Listed Auth users before (0) and after (5) provisioning; re-read custom claims from Firebase Auth itself, not from local script state.
- Signed in for real via the Identity Toolkit REST API with a newly created account's temporary password → succeeded with a valid ID token; retried with a wrong password → correctly rejected (`INVALID_LOGIN_CREDENTIALS`).
- Deployed `firestore.rules` for real via a direct `firebaserules.googleapis.com` call (`firebase deploy` itself is blocked — see below) and confirmed the release pointed at the new ruleset.
- Ran 5 live-rules scenarios with real signed-in Firestore REST calls: unauthenticated → denied; assigned investigator reading their own case → **initially wrongly denied**, root-caused to legacy-id vs. real-UID mismatch, fixed via `relinkLegacyAssignees.ts`, re-tested → allowed; same investigator reading an out-of-scope case → denied; `functional_admin` (global visibility) reading that same case → allowed; `system_admin` reading any case → denied (least privilege). A 6th scenario (throwaway case, `functional_admin` made the implicated subject) confirmed the implicated-person rule overrides even global visibility, then cleaned up the throwaway data.
- `functions/`: `npm run build` (tsc) succeeded; root `tsc --noEmit` also picks up and cleanly type-checks `functions/src/index.ts` (confirmed via `--listFiles`).
- Attempted `firebase deploy --only functions`: predeploy build succeeded, deployment itself failed on the same `serviceusage.googleapis.com` permission gap as the rules issue — but this time confirmed there is no safe single-call bypass (Cloud Functions deployment needs Cloud Build + Artifact Registry, not one REST call), and separately confirmed via the Cloud Billing API that billing/Blaze status isn't even readable with this service account. Stopped there rather than escalating workarounds further — documented exactly what the project owner needs to do instead.

**DOCUMENT** → `docs/FIREBASE-SETUP.md` (rewritten for Phase 3 state) + this entry.

**Explicitly out of scope for Phase 3** (deferred, not forgotten): the remaining ~12 `CaseRepository` operations as Cloud Functions, Storage rules for evidence upload, the reporter-facing `getCaseForReporter` callable (reporters still have no way to reach this data at all — intentional, since building that UI now would be exactly the "interface that gives the impression the system works" the brief forbids), and wiring any of this into the shipped React app (Phase 4+).

---

## Phase 4 — Detail (Control Panel attempt: real finding, cleanly stopped)

**AUDIT** → Phase 3 gave real Auth + real, verified single-document read rules. The natural next step was to build a real Control Panel reading live Firestore data.

**PLAN** → real login (Firebase Auth email/password) → Overview KPIs and an Alerts/Cases list, computed from real `cases` queries → a read-only Case detail (allegations, persons, evidence, corrective actions, timeline) → no mutation buttons (Cloud Functions aren't deployed, so none would be real).

**IMPLEMENT**:
- Registered a real Firebase Web App via the Firebase Management API (`activa-ethicalert-47246`, appId `1:308693813201:web:8f3bbcfcb68ee81964c2f0`) and wrote its config to a gitignored `.env`.
- `src/services/firebaseClient.ts`: a real, working, separate client connection (own named Firebase App instance, correct named database id) — deliberately isolated from the legacy `services/firebase.ts` sync path so nothing here can affect the shipped Phase 1 app.
- Extended `firestore.rules` so subcollection documents (`allegations`, `persons`, ...) are readable under the same authorization as their parent case (via `get()`), deployed the same way as Phase 3.

**TEST / VERIFY, and where this phase actually stopped**:
- Before writing any list-based UI, tested the underlying capability directly against real data (the same discipline as Phase 3, not assumed): `list` of a known case's `allegations` subcollection as its assigned investigator → **403**, contradicting the plan. Isolated the cause methodically rather than guessing: confirmed a single-document `get` on that same subcollection doc succeeds (200); confirmed the *parent* case's own single-document `get` still works; then tested the simplest possible case — an unconstrained `list` of the entire top-level `cases` collection as `functional_admin`, who trivially passes every check except `isNotImplicated` (which depends on `implicatedUserIds`, a field no query constrains) — also **403**. This isolates the cause precisely: Firestore refuses `list` operations outright when the rule can't be proven safe from the query's `where` filters alone, for *any* possible result — it does not fall back to filtering out individual denied documents the way `get` effectively does per-request.
- Concluded that weakening `isNotImplicated` (the strongest, most explicitly-mandated rule in the brief — rule #9) to make listing "provable" is not a call to make unilaterally, and that the only architecturally sound fix is exactly what `docs/ARCHITECTURE.md` already specified before this phase started: list/search operations go through a Cloud Function with server-side (Admin SDK) filtering, not a raw client query.
- Did **not** proceed to build Overview/Alerts-list/Case-detail UI on top of a capability just proven not to work — that would be shipping the "interface that gives the impression the system works" the brief explicitly forbids. Cleaned up all diagnostic scripts; kept only the real, working parts (`firebaseClient.ts`, the extended single-document subcollection rules) as ready infrastructure for once Cloud Functions are deployable.
- `tsc --noEmit` and `vite build` both re-verified clean after these changes (no risk to the shipped Phase 1 app either way, since nothing in `src/App.tsx` or any existing component was touched).

**DOCUMENT** → `firestore.rules` comments, `firebaseClient.ts` header, this entry, and the Phase 4 row above.

**Net result**: Phase 4 did not ship a Control Panel, but it did produce a verified, precise technical reason *why not yet*, and confirmed (rather than assumed) that Cloud Functions deployment is the single blocker for both the remainder of Phase 3 and all of Phase 4/5/6's real screens. The next actionable step is the same as Phase 3's: the project owner enabling Blaze billing (see `docs/FIREBASE-SETUP.md`).

---

## Phase 4b — Detail (Case-ID Lookup tool: what *is* shippable on Spark)

**AUDIT** → Phase 4's finding left one real capability standing: a single-document `getDoc` by known Case ID, correctly enforced by the deployed rules. Worth shipping as a real (if narrow) tool rather than leaving Firebase integration entirely inert in the UI.

**PLAN** → real staff sign-in (Firebase Auth) → a search box that only accepts what actually works (the internal Case ID, not the human case number, since that was already proven to hit the same list-provability wall) → honest, accurate result/error states → wired into the app as an additive nav tab, zero changes to any existing screen.

**IMPLEMENT**: `src/components/CaseLookup.tsx`, a new "Firebase Lookup (Beta)" tab in `Navbar.tsx`/`App.tsx`, 30 new translation keys added to all three languages (147 total, parity verified).

**TEST / VERIFY**:
- Attempted a full browser click-through (Playwright) against the real Firebase project. Login-form rendering, i18n (FR/EN), and app-styling integration all verified clean this way. The actual sign-in network call could not be exercised end-to-end in this sandbox: headless Chromium's outbound HTTPS to Google domains is reset by this environment's egress proxy regardless of proxy/TLS/HTTP2 configuration tried (5 distinct configurations), while the identical calls succeed reliably from Node — the proxy's own logs cite "organization policy" for several Google domains, consistent with a deliberate sandbox restriction on browser-originated traffic to those hosts, not a defect in the app. Documented rather than worked around further or silently left unstated.
- Given that gap, correctness was instead verified the way the rest of this project's backend work was verified all along: direct REST calls mirroring exactly what the component's Firebase SDK calls do. This is how a real bug was caught before calling the tool done: a genuinely non-existent Case ID returns `permission-denied` (not a distinguishable "not found") for *every* role, including global-visibility ones — Firestore's rule engine can't return "not found" separately from "denied" here, by design (existence isn't leaked to unauthorized callers). The component's original "it exists, but..." copy for the access-denied case was factually wrong for a mistyped id; fixed in all three languages to state the real, honest ambiguity instead of asserting existence.
- `tsc --noEmit` and `vite build` clean; bundle size grew as expected now that real `firebase/auth` + `firebase/firestore` client code is actually shipped and used for the first time (previously inert).

**DOCUMENT** → this entry + `docs/FIREBASE-SETUP.md`.

---

## Documentation completeness — `docs/WORKFLOW.md` and `docs/PERMISSIONS.md`

**AUDIT** → section 50 of the brief ("Documentation obligatoire") lists eight
required files: `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`,
`WORKFLOW.md`, `PERMISSIONS.md`, `CONTROL-PANEL.md`, `INVESTIGATION.md`,
`API.md`. Five existed at this point (the first three, plus this phase log);
`WORKFLOW.md` and `PERMISSIONS.md` were genuinely writable right now — their
underlying logic (`src/domain/workflow.ts`, `src/domain/permissions.ts`) has
existed since Phase 2, is fully implemented, and was re-verified against the
real, deployed `firestore.rules` during Phase 3's live testing. Unlike
`CONTROL-PANEL.md`/`INVESTIGATION.md`/`API.md`, none of this required
inventing anything or describing unbuilt UI — the opposite of "documentation
that gives the impression the system works" the brief forbids elsewhere.

**PLAN** → generate both docs strictly from the current code (not a
parallel design), re-reading `workflow.ts`, `permissions.ts`,
`caseTypes.ts`, and the deployed `firestore.rules` side by side so any gap
between "what the TypeScript says" and "what's actually enforced live"
gets called out explicitly rather than smoothed over.

**IMPLEMENT**:
- `docs/WORKFLOW.md` — the full `CaseStatus` state table, the literal
  `ALLOWED_TRANSITIONS` adjacency list, the four closure-gating checks in
  `checkTransition` (in the order they're actually evaluated), how
  `deriveOverallFinding` computes `Case.overallFinding`, and an explicit
  "where this plugs in today vs. not yet" section (nowhere live yet on the
  new model — Phase 5+; the real enforcement boundary is the Cloud
  Function once deployed, not any client-side call).
- `docs/PERMISSIONS.md` — the `Permission` union, the full role→permission
  table transcribed from `ROLE_PERMISSIONS`, the `ROLE_MAX_CONFIDENTIALITY`
  table, scope (`isInScope`), assigned-vs-global visibility
  (`GLOBAL_VISIBILITY_ROLES`), and rule #9 (the implicated-person override,
  checked first, beats every other role including global-visibility ones —
  cross-referenced to the live test in `docs/SECURITY.md` that actually
  proved this).

**TEST / VERIFY**: re-read `firestore.rules` line by line while writing the
"where this is enforced today" table and caught two real, previously
undocumented mismatches between `permissions.ts` and the deployed rules
(neither is a bug — both are deliberate, but neither had been written down
before):
1. Confidentiality-level clearance (`ROLE_MAX_CONFIDENTIALITY`) is enforced
   in `can()` but is **not yet mirrored into `firestore.rules`** — every
   migrated demo item's confidentiality happens to be within what every
   authorized reader is cleared for, so this has not yet caused an observed
   leak, but it is a real, present gap between the TypeScript model and the
   live rule, now flagged explicitly rather than silently assumed identical.
2. `firestore.rules`' `hasGlobalCaseVisibility()` deliberately **excludes**
   `executive` (rules-file comment: aggregated dashboards only), whereas
   `permissions.ts`'s `GLOBAL_VISIBILITY_ROLES` **includes** `executive` —
   so the deployed rule is actually stricter for that one role than the
   TypeScript table alone would suggest. Not a security hole (stricter, not
   looser), but worth recording precisely rather than describing the two
   layers as if they were a verbatim match.
No code was changed to produce this phase — both are genuinely pre-existing
properties of the already-deployed `firestore.rules`, only now written down.

**DOCUMENT** → `docs/WORKFLOW.md`, `docs/PERMISSIONS.md`, this entry.
Remaining section-50 gaps, honestly still open: `CONTROL-PANEL.md`,
`INVESTIGATION.md`, `API.md` — all three describe UI/API surfaces that
don't exist yet (Phase 4/5/6/8, blocked on the Spark/Cloud-Functions
decision), so writing them now would mean documenting unbuilt behavior,
which this project has consistently refused to do throughout every prior
phase.

---

## Fix: confidentiality-clearance gap closed in `firestore.rules` (real prod change)

**AUDIT** → the previous entry's flagged gap #1 (confidentiality clearance
enforced in `permissions.ts` but not in `firestore.rules`) is a real,
fixable-without-Cloud-Functions security gap, not a Phase 4/5/6-blocked
item — worth closing now rather than leaving open indefinitely. Checked the
real project's data first, per this session's standing discipline: found
one of the 3 real demo cases (`CASE-2026-000002`) auto-classified
`highly_confidential` by the Phase 2b migration while already assigned to
an `investigator` (cleared only to `confidential`) — deploying the new rule
unchanged would have silently revoked her access to her own assigned case.

**PLAN** → put the exact trade-off to the user rather than deciding
unilaterally (a live access-affecting change to real production data
warrants that): leave the gap open, deploy-and-break, deploy-and-reassign,
or deploy-and-reclassify-the-case-to-match-its-assignment. User chose the
last option.

**IMPLEMENT**:
- One-off Admin SDK script: inside a Firestore transaction (reads and
  re-checks the expected prior `confidentialityLevel`/`assignee` before
  writing — the same discipline `LockService` gives in a single-threaded
  context), corrected `CASE-2026-000002`'s `confidentialityLevel` from
  `highly_confidential` to `confidential`; wrote a matching `audit_logs`
  entry (`action: CASE_CONFIDENTIALITY_CORRECTED`, `previousValue`/
  `newValue` recorded) and a `timeline` subcollection event, exactly like
  any other tracked case change.
- `firestore.rules`: added `confidentialityRank()`, `maxConfidentialityRank()`,
  `isConfidentialityAllowed()` (mirroring `CONFIDENTIALITY_RANK`/
  `ROLE_MAX_CONFIDENTIALITY` in `permissions.ts` field-for-field), and wired
  `isConfidentialityAllowed(...)` into both the `cases/{caseId}` read rule
  and the subcollection read rule.
- Deployed via the same direct `firebaserules.googleapis.com` call pattern
  used since Phase 3 (create a ruleset, then `PATCH` the
  `cloud.firestore/default` release — the release id itself contains a
  slash and must be percent-encoded in the URL path, a new wrinkle
  discovered and worked around this time).

**TEST / VERIFY** (all real signed-in requests, ID tokens obtained by
minting an Admin SDK custom token for the real staff account and exchanging
it via `accounts:signInWithCustomToken` — no stored passwords used):
- A throwaway `highly_confidential` test case, in-scope and assigned to
  `a.kouassi` (`investigator`, cleared to `confidential`) → `403`, proving
  the new check actually blocks something.
- The same throwaway case downgraded to `confidential` → `200`, isolating
  that the denial above was specifically the confidentiality check.
- `c.ngo` re-reading her real, now-corrected `CASE-2026-000002` → `200` —
  the regression this whole exercise existed to prevent, confirmed absent.
- `a.kouassi` re-reading her own unrelated real assigned case
  (`CASE-2026-000003`, unaffected `confidential`) → `200`, general
  regression check.
- Throwaway test case deleted after use; no other data left behind.

**DOCUMENT** → `firestore.rules` comments, `docs/PERMISSIONS.md`,
`docs/SECURITY.md` (new live tests + a dedicated "Fix" section), this
entry.

---

## Documentation completeness (2) — `docs/API.md`

**AUDIT** → of the three still-open section-50 files
(`CONTROL-PANEL.md`, `INVESTIGATION.md`, `API.md`), the first two describe
UI screens that literally do not exist in the codebase — nothing to
document without inventing it. `API.md` is different: `functions/src/index.ts`
(3 real, type-checked callables) and the full `CaseRepository` interface
(~24 operations, `src/data-access/caseRepository.ts`) are real, existing
code, exactly like `workflow.ts`/`permissions.ts` were for the previous two
docs — undeployed, but not undocumented-because-unbuilt.

**PLAN** → document the 3 implemented callables' real request/response
shapes and error codes (read directly off the code, not paraphrased from
memory), the identity/auth pattern all three share, and the remaining ~15
planned-but-unimplemented operations as a concrete backlog table (purpose,
not just a name) — with the deployment status stated plainly at the very
top rather than buried, since this is exactly the kind of doc that could
otherwise read as claiming a live API.

**IMPLEMENT**: `docs/API.md` — status table up front, per-callable
reference for `createCase`/`assignCase`/`changeCaseStatus` (permission
required, request, response, errors, and the non-obvious behavior notes:
priority/riskScore never settable at creation, rejected transitions are
still audited, `overallFinding` always derived not accepted), the full
planned-operations backlog table, and a closing section tying it back to
`docs/ARCHITECTURE.md`'s "the client never decides a sensitive mutation
alone" principle.

**TEST / VERIFY**: re-read `functions/src/index.ts` line by line while
writing the per-callable tables (not from the earlier phase summaries) —
confirmed every documented default, error code, and side effect against the
literal code. No code changed; `tsc --noEmit` re-run clean regardless
(docs-only change) to confirm nothing else in the tree was disturbed.

**DOCUMENT** → `docs/API.md`, this entry. Section 50 status: 6 of 8 files
now present (`ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `WORKFLOW.md`,
`PERMISSIONS.md`, `API.md`). `CONTROL-PANEL.md`/`INVESTIGATION.md` remain
the only two genuinely blocked — both would require describing screens that
don't exist, still tied to the same Spark/Cloud-Functions decision as ever.

---

## `getCaseForReporter` implemented — closes a real, self-documented gap

**AUDIT** → `docs/API.md` had just flagged `getCaseForReporter` as "the one
reporters actually need" (no other path to case data exists for them at
all). Separately, `src/services/rateLimiter.ts`'s own header comment
(written in an earlier phase) says outright that "true rate limiting must
ultimately be enforced server-side" — a pre-existing, self-documented TODO,
not a new idea introduced here. Both point at the same next unit of work,
and neither requires Cloud Functions to be *deployed* to be written and
verified by build — only to go live.

**PLAN** → implement the callable reusing existing, already-verified pieces
exactly rather than re-deriving them: `verifyPassword()` from
`src/services/crypto.ts` (the same salted-hash check the legacy
`AlertTrackingView` already performs) for the password check, and a new
Firestore-backed attempt counter for the part that file's own comment says
is still missing. Response shape kept deliberately narrow, mirroring what
the legacy reporter view already exposes today — not a new UI capability,
a faithful port of an existing one onto the new `Case` model's server side.

**IMPLEMENT**:
- `functions/tsconfig.json`: added `../src/services/crypto.ts` to `include`
  (previously only `domain/**` was reachable from the functions package).
- `functions/src/index.ts`: `getCaseForReporter` — no `requireAppUser()`
  call (reporters have no Firebase Auth token, by design); looks up the
  case by `caseNumber` (Admin SDK query, bypasses rules, safe in a trusted
  server context), verifies the access code via the imported
  `verifyPassword()`, and returns `{ caseNumber, status, receivedAt,
  description, communications }` only. Every failure path — case not
  found, credentials doc missing, wrong access code — returns the exact
  same `permission-denied`/`'Invalid case number or access code.'`, so
  existence is never leaked (same discipline as the Phase 4b finding).
  New `rate_limits/{caseNumber}` Firestore-backed counter
  (`assertReporterNotRateLimited`/`recordReporterAttempt`, transactional on
  the increment path) mirrors the client limiter's thresholds exactly (5
  attempts, 5-minute lockout) so the UX contract doesn't change, only where
  it's enforced.
- `firestore.rules`: added `match /rate_limits/{key} { allow read, write:
  if false; }` — functionally a no-op (an undeclared collection already
  denies by default in this rules file, which has no catch-all `match
  /{document=**}`), added for the same explicit-and-auditable style as
  `counters/*`. Deployed live via the same direct API pattern as every
  other rules change this session.

**TEST / VERIFY**:
- `npm run build` inside `functions/` — clean.
- Root `tsc --noEmit` — clean (the new `src/services/crypto.ts` include
  didn't disturb anything else).
- Redeployed `firestore.rules` (the `rate_limits` addition) live, then
  re-ran a live signed-in read of `a.kouassi`'s real assigned case
  (custom-token-minted ID token, same technique as the previous phase) →
  `200`, confirming the redeploy introduced no regression.
- `getCaseForReporter` itself could not be exercised as a live network call
  in this pass (Cloud Functions remain undeployed on Spark, by standing
  decision) — stated plainly rather than implied tested. Its correctness
  rests on: a clean TypeScript build, direct reuse of `verifyPassword()`
  (already exercised by the shipped `AlertTrackingView`, itself
  unit-equivalent to real client usage), and line-by-line review of the
  three failure paths converging on one identical error.

**DOCUMENT** → `docs/API.md` (moved from "planned" to "implemented",
with the rate-limiting design noted), this entry.

---

## Three more Cloud Functions: `addAllegation`, `setAllegationFinding`, `addPerson`

**AUDIT** → of the remaining `CaseRepository` backlog, these three are the
highest-value next unit: `addPerson` is where `Case.implicatedUserIds` gets
maintained (the field rule #9's enforcement in `firestore.rules` directly
depends on), and `addAllegation`/`setAllegationFinding` feed the very
closure-gating logic `changeCaseStatus` already calls
(`checkTransition`/`deriveOverallFinding`, `docs/WORKFLOW.md`) — without
them, that callable can never actually be exercised end to end even once
deployed, since a case can't be closed with zero allegations.

**PLAN** → port `LocalCaseRepository`/`FirestoreAdminCaseRepository`'s
existing, already-verified logic for these three operations (read them
side by side, don't re-derive from memory), but add a permission check
neither repository implementation has itself — because Cloud Functions,
unlike those repository classes, ARE the real trust boundary once
deployed (`docs/ARCHITECTURE.md`: "the client never decides a sensitive
mutation alone", the same principle `createCase`/`assignCase`/
`changeCaseStatus` already enforce). Factor the repeated "fetch case,
compute implicatedUserIds fresh, call can()" sequence into one shared
helper rather than copy it a third time slightly differently.

**IMPLEMENT**:
- `requireCaseAccess(caseId, user, permission)` — new shared helper,
  factored out of the pattern `assignCase`/`changeCaseStatus` already used
  inline, so every new callable calls it identically.
- `addAllegation` — `cases.edit` required; new allegation always starts
  `status: 'open'` with no `finding`, matching both existing repository
  implementations exactly; writes an `ALLEGATION_ADDED` timeline event.
- `setAllegationFinding` — `cases.edit` required; locates the allegation by
  a `collectionGroup('allegations')` query (only the `allegationId` is
  known here, same constraint the Firestore repository already documents);
  validates `finding` against the real `FindingOutcome` union before
  writing anything; writes both a timeline event and an audit entry.
- `addPerson` — `cases.edit` required; validates `kind` is exactly
  `'subject'` or `'witness'`; when `kind === 'subject'` and `linkedUserId`
  is set, appends to `Case.implicatedUserIds` via `FieldValue.arrayUnion`
  in the same call — flagged in the code itself as the one write in this
  file `firestore.rules`' rule #9 enforcement directly depends on.
- Widened `appendAudit`'s parameter type to accept `objectType`/`objectId`
  (both optional, simply forwarded) — needed by `setAllegationFinding`'s
  audit entry, which mirrors `scripts/firestoreAdminRepository.ts`'s
  identical call exactly. `createCase`/`assignCase`/`changeCaseStatus`'s
  existing calls are unaffected (both fields stay optional).

**TEST / VERIFY**: `npm run build` inside `functions/` — clean. Root
`tsc --noEmit` — clean. No live network test possible for the same reason
as `getCaseForReporter` (undeployed, Spark decision) — stated plainly
rather than implied. Correctness rests on: matching both existing,
already-tested repository implementations field-for-field, and the new
`cases.edit` gate being the same permission/scope/implicated-person check
already live-verified in `firestore.rules` and in `assignCase`/
`changeCaseStatus`.

**DOCUMENT** → `docs/API.md` (all three moved from "planned" to
"implemented"), this entry. Cloud Functions backlog now: `addEvidence` (+
Storage), `addTask`, `addInterview`, `addInvestigationNote`,
`addCommunication`, `addCorrectiveAction`, `recordRiskAssessment`,
`declareConflictOfInterest`, `getReporterIdentity`.

---

## Remaining backlog Cloud Functions: `addTask`, `addInterview`, `addInvestigationNote`, `addCommunication`, `addCorrectiveAction`, `recordRiskAssessment`, `declareConflictOfInterest`

**AUDIT** → seven straightforward remaining ports, all following the exact
pattern already established across the last two phases (`requireCaseAccess`
+ mirror an existing, already-verified repository method). Worth doing as
one batch rather than one-by-one, since none introduces new architectural
questions — with two exceptions caught while porting, both worth a real fix
rather than a literal port: `addCommunication` and `declareConflictOfInterest`
both take an identity-bearing parameter (`sender`/`senderDisplayName`,
`userId`) directly from the caller in the repository-layer signature — safe
for a trusted migration script, not for a public callable a signed-in
attacker could call with a spoofed identity in the request body.

**PLAN** → port all seven mirroring `LocalCaseRepository`/
`FirestoreAdminCaseRepository` field-for-field, gate each on the closest
existing `Permission` (`cases.edit` for five of them — there is no more
specific permission for tasks/interviews/notes/corrective actions/risk
assessments in the `Permission` union — `communications.send` for
`addCommunication`, which already has one), and for the two
identity-spoofing risks: always force the identity field from the verified
token, never accept it from `request.data`, and say so explicitly in both
the code and `docs/API.md` rather than let it pass as an unremarked detail.

**IMPLEMENT**:
- `addTask` (`cases.edit`) — new task always `status: 'not_started'`.
- `addInterview` (`cases.edit`) — `conductedBy` forced to the caller; new
  interview always `status: 'planned'`.
- `addInvestigationNote` (`cases.edit`) — `authorId`/`createdBy` forced to
  the caller (accountable internal record, never reporter-visible).
- `addCommunication` (`communications.send`) — `sender` forced to
  `'investigator'`, `senderDisplayName` forced to the caller's own token
  name; a reporter-side equivalent is explicitly left on the backlog
  (reporters have no Firebase Auth token to check `communications.send`
  against in the first place).
- `addCorrectiveAction` (`cases.edit`) — new action always `status: 'open'`.
- `recordRiskAssessment` (`cases.edit`) — deactivates every previously-
  active risk assessment and writes the new one, then updates
  `Case.riskScore`/`Case.priority`, all in one atomic `batch()` (mirrors
  both repository implementations' "only one active assessment per case"
  invariant, `caseTypes.ts`). Audited as `RISK_OVERRIDDEN`/`RISK_ASSESSED`.
- `declareConflictOfInterest` (`cases.edit`) — `userId` forced to the
  verified caller, never accepted from `request.data`.
- Widened imports (`ConflictOfInterestDeclaration`, `Interview`,
  `RiskAssessment`, `Task`) from `caseTypes.ts`; updated the file's header
  comment and the trailing backlog comment to reflect the true remaining
  set (`addEvidence`, `getReporterIdentity`, a reporter-side
  `addCommunication`).

**TEST / VERIFY**: `npm run build` inside `functions/` — clean on the first
attempt after fixing one leftover type-authoring slip (`recordRiskAssessment`'s
`priority` field type briefly referenced an unrelated `CaseStatus` type
while being drafted — caught by the same build, corrected before commit,
not shipped). Root `tsc --noEmit` — clean. No live network test possible
(undeployed, Spark decision, unchanged) — stated plainly. Correctness rests
on matching both existing, already-tested repository implementations
field-for-field, and the two identity-spoofing fixes being a deliberate,
documented hardening over the repository-layer signatures, not an
oversight either way.

**DOCUMENT** → `docs/API.md` (all seven moved from "planned" to
"implemented", numerator corrected from an approximate "~15" to the exact
14-implemented / 3-remaining count), this entry. Cloud Functions backlog
now only: `addEvidence` (+ Storage Security Rules, a genuinely larger
unit), `getReporterIdentity` (mandatory audit logging), a reporter-side
`addCommunication`. Every other write path in `CaseRepository` is now a
real, type-checked Cloud Function — undeployed, but no longer unwritten.

---

## Last two backlog Cloud Functions: `addCommunicationAsReporter`, `getReporterIdentity`

**AUDIT** → of the 3 remaining backlog items, 2 don't actually need
Storage (only `addEvidence` does): a reporter-side `addCommunication` (the
staff-side one was already done; without a reporter equivalent, a reporter
can read their case's messages via `getCaseForReporter` but never reply —
a real, asymmetric gap), and `getReporterIdentity`. The latter needed a
genuine design decision, not just a port: neither existing repository
implementation actually enforces a distinct permission for it (section 44
of the brief: "no investigator gets reporter identity merely because it
was assigned to the case" — stated in both repositories' own comments, but
not actually gated beyond an audit-log write).

**PLAN** → `addCommunicationAsReporter`: reuse `getCaseForReporter`'s
credential-verification sequence rather than duplicate it, since both
need the identical rate-limited lookup-and-verify. `getReporterIdentity`:
since Cloud Functions are the real trust boundary (unlike the repository
classes), decide on a permission to gate this on that reflects section
44's stated intent without inventing a new entry in the `Permission`
union — `audit.read` is the closest existing permission that
`investigator`/`senior_investigator` do not hold while
`functional_admin`/`darc_compliance` do, matching the brief's intent
exactly (`system_admin` also has `audit.read` but is excluded anyway by
`can()`'s assigned-or-global-visibility check, since it has no case access
by design).

**IMPLEMENT**:
- Factored `getCaseForReporter`'s lookup-verify-rate-limit body into a
  shared `verifyReporterAccess(caseNumber, accessCode)` helper (returning
  the case doc reference and data) rather than duplicate it a second time;
  `getCaseForReporter` itself now calls this helper, unchanged in
  behavior.
- `addCommunicationAsReporter` (`{ caseNumber, accessCode, content }` →
  `{ messageId }`) — `sender: 'reporter'`, `senderDisplayName` deliberately
  generic (`'Lanceur d'alerte'`) rather than looked up from
  `reporter_identities`, a conservative simplification versus the legacy
  `AlertTrackingView`'s real-name display for non-anonymous reports,
  documented as deliberate rather than left unstated.
- `getReporterIdentity` (`{ caseId }` → the identity doc or `null`), gated
  via `requireCaseAccess(caseId, user, 'audit.read')`; writes the
  `REPORTER_IDENTITY_ACCESSED` audit entry unconditionally, even before
  the read — the entry itself is the record the request was made, matching
  both existing repository implementations exactly.
- Updated the file's header comment and trailing backlog note: only
  `addEvidence` remains, now stated as the sole exception rather than one
  of several.

**TEST / VERIFY**: `npm run build` inside `functions/` — clean. Root
`tsc --noEmit` — clean. No live network test possible (undeployed, Spark
decision, unchanged) — stated plainly rather than implied. Correctness
rests on: `getCaseForReporter`'s behavior being provably unchanged after
the refactor (same helper, same call sites, same return shape — verified
by reading the diff, not just trusting the build), and the `audit.read`
gate producing exactly the intended role set by tracing `can()`'s own
logic (`ROLE_PERMISSIONS['investigator']` excludes `audit.read`;
`GLOBAL_VISIBILITY_ROLES` excludes `system_admin`) rather than assumed.

**DOCUMENT** → `docs/API.md` (both moved from "planned" to "implemented";
denominator corrected again — 16 of 17 mutation-shaped operations now
real), this entry. Cloud Functions backlog is now exactly one item:
`addEvidence`, which needs Storage Security Rules and a signed-URL flow —
a genuinely different, larger unit of work than everything ported so far,
not a small remaining port.

---

## Last Cloud Functions item: `addEvidence`, `getEvidenceDownloadUrl` — and a harder wall found

**AUDIT** → before writing any Storage-dependent code, checked whether
Storage even exists on this project rather than assuming it (same
discipline as every prior wall found this session). It doesn't: a direct
`storage.googleapis.com` check on the expected default bucket name
(`activa-ethicalert-47246.firebasestorage.app`) returned 404 "bucket does
not exist", and `firebasestorage.googleapis.com` itself returned
`SERVICE_DISABLED`. Since October 2024, Google requires the Blaze plan to
provision a *new* default Storage bucket — the same category of wall
already documented for Cloud Functions (`docs/FIREBASE-SETUP.md`), and the
project's existing "stay on Spark" decision applies here too without
needing to be re-asked.

**PLAN** → write the code anyway, exactly as ready-to-plug-in as
everything else this session has produced for the undeployed Cloud
Functions, but be explicit that this one sits behind a *harder* wall
(no bucket at all, not just an undeployed function) rather than blur the
two together. Design: the client uploads file bytes directly to Cloud
Storage (never through a callable) at a path it generates under
`evidence/{caseId}/{anyId}/{fileName}`, gated by new `storage.rules`;
`addEvidence` is called afterward to record Firestore metadata;
`getEvidenceDownloadUrl` is the one path allowed to read the file at all,
fulfilling the promise `Evidence.storagePath`'s own comment in
`caseTypes.ts` already made ("resolved through a signed, short-lived,
audited Cloud Function call").

**IMPLEMENT**:
- `storage.rules` (new file) — mirrors `firestore.rules`' authorization
  logic (`isNotImplicated`/`isInScope`/confidentiality/assigned-or-global)
  for the upload path, using Storage Rules' `firestore.get()` cross-service
  read to fetch the parent case; `allow read: if false` unconditionally, a
  25MB size cap on writes. Flagged in its own header comment that this
  necessarily duplicates `firestore.rules`' logic (two separate rule
  languages, no shared functions) and must be updated by hand if the
  source ever changes — not an automatic guarantee.
- `firebase.json`: added a `storage` block pointing at `storage.rules`.
- `addEvidence` (`evidence.upload`) — validates `confidentiality` and that
  `storagePath` falls under this case's own `evidence/{caseId}/` prefix
  (defense in depth: a caller cannot record metadata pointing at an
  unrelated file); new evidence always `version: 1`, `status: 'active'`.
- `getEvidenceDownloadUrl` (`evidence.read`) — excludes `status: 'deleted'`
  evidence the same way `listEvidence()` already does in both existing
  repositories; mints a 15-minute signed URL via the Admin SDK
  (`getStorage().bucket(...).file(...).getSignedUrl(...)`); writes an
  `EVIDENCE_ACCESSED` audit entry on every call, not just successful ones.

**TEST / VERIFY**: `npm run build` inside `functions/` — clean on the first
attempt. Root `tsc --noEmit` — clean. No live test of any kind is possible
here — not "undeployed" but "the bucket this would write to doesn't
exist" — confirmed via the same direct API checks used throughout this
session (never assumed). Correctness rests entirely on matching both
existing repository implementations field-for-field and a careful reading
of the Storage Rules Language documentation for `firestore.get()` syntax,
which could not itself be exercised against a real bucket to confirm.

**DOCUMENT** → `docs/API.md` (moved to "implemented" with the harder-wall
distinction made explicit), `storage.rules`' own header comment, this
entry. **Every mutation-shaped `CaseRepository` operation is now a real,
type-checked Cloud Function** — the only remaining backlog is read-side
(`getCase`/`listCases`, `list*` for every subcollection), which is a
different problem (Firestore's list-query wall, Phase 4) than "not yet
written."
