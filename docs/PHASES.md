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
| 3 | Firebase Authentication + Cloud Functions + strict Security Rules | ⏳ Blocked | Requires a provisioned Firebase project (Auth + Firestore + Storage + Functions, Blaze plan). Code will be written deployable-but-inactive until a real project is connected, per user decision. |
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
