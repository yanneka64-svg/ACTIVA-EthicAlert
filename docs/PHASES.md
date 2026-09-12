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
| 3 | Firebase Authentication + Cloud Functions + strict Security Rules | ⏳ Not started | The project itself is now available (`activa-ethicalert-47246`), which unblocks this phase — it was previously blocked on provisioning. Still needs: Blaze plan confirmation for Cloud Functions, Auth provider setup, and a proper (non-chat-pasted) service credential for ongoing backend use. |
| 4 | Control Panel (Overview, Alerts, Triage, Assignment, SLA & Escalations views) | 🔜 Not started | Depends on Phase 3 for real permission enforcement. |
| 5 | Case Management UI on the new `Case` model | 🔜 Not started | Depends on Phase 3/4. |
| 6 | Investigation Workspace (Tasks, Interviews, Findings UI) | 🔜 Not started | Depends on Phase 5. |
| 7 | Risk / SLA / Assignment engines wired to configuration | 🔜 Not started | Depends on Phase 3. |
| 8 | Evidence upload (Storage) + Communications UI | 🔜 Not started | Depends on Phase 3. |
| 9 | Audit trail (server-side, append-only) + 3-tier Reporting | 🔜 Not started | Depends on Phase 3. |
| 10 | Security testing (section 54 of the brief) | 🔜 Not started | — |
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
