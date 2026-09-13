# ACTIVA Hotline — RBAC & Permissions Model

Documents the authorization model implemented in `src/domain/permissions.ts`
(Phase 2), and how it is mirrored — not re-derived — into the real,
deployed `firestore.rules` (Phase 3). This file is **generated from the
actual code**; if it and `permissions.ts`/`firestore.rules` ever disagree,
the code is the source of truth.

Per section 28 of the brief, authorization here is granular and atomic
(`Permission` strings), not a single `isAdmin` boolean. Per section 29,
effective access to a given case is a conjunction of five independent
checks — all five must hold, any one failing denies access:

```
Authentication
  ∧ Role holds the permission               (roleHasPermission)
  ∧ Country/entity scope covers the case     (isInScope)
  ∧ Confidentiality level the role is cleared for   (isConfidentialityAllowed)
  ∧ (assigned to the case OR role has global visibility)
  ∧ NOT the implicated subject of the case   (rule #9 — checked FIRST, overrides everything)
```

All of this is implemented once, in `can(user, permission, context?)`, and
is meant to be the **single call site** both the client UI and (once
deployed) Cloud Functions use — never re-implemented locally. `App.tsx`'s
existing `renderAccessDenied` guard is the kind of place this plugs into
once the new `Case` model reaches the UI (Phase 4+); today it is verified,
ready-to-use logic, not yet wired into a live screen for the new model
(the deployed `firestore.rules`, below, is the one place this logic is
already live and enforced today).

## === AMÉLIORATION AJOUTÉE (Phase 12) === 10-role mapping

A later brief asked for (at least) 10 named roles: WHISTLEBLOWER,
CASE_OFFICER, INVESTIGATOR, COMPLIANCE_OFFICER, COMPLIANCE_MANAGER,
COMPLIANCE_DIRECTOR, AUDIT_COMMITTEE, SYSTEM_ADMIN, SECURITY_ADMIN,
COMPLIANCE_ADMIN. Per `REUSE > ADAPT > CREATE > REPLACE`, the 8 already
mature, tested roles below are kept exactly as they are (no renames) and
mapped onto that list rather than duplicated under new names, since
fragmenting further would only add near-duplicate roles with no distinct
capability:

| Brief's name | This model's `RoleId` |
|---|---|
| WHISTLEBLOWER | `reporter` |
| CASE_OFFICER / INVESTIGATOR | `investigator` / `senior_investigator` |
| COMPLIANCE_OFFICER | `darc_compliance` |
| COMPLIANCE_MANAGER | `functional_admin` |
| COMPLIANCE_DIRECTOR | `executive` |
| SYSTEM_ADMIN | `system_admin` |
| COMPLIANCE_ADMIN | *(covered by `system_admin`'s `configuration.manage` in this app's simpler admin model)* |
| AUDIT_COMMITTEE | `audit_committee` **(new)** |
| SECURITY_ADMIN | `security_admin` **(new)** |

Only `security_admin` and `audit_committee` are genuinely new — the only
two capabilities (security-policy management; read-only oversight distinct
from `executive`) nothing in the original 8-role model already covered.

## Permissions (`Permission` union)

| Permission | Meaning |
|---|---|
| `cases.read` | Read a case's content. |
| `cases.create` | Create a new case (e.g. from an admitted report). |
| `cases.assign` | Set the initial assignee. |
| `cases.reassign` | Change an existing assignment. |
| `cases.edit` | Edit case fields (allegations, persons, notes, ...). |
| `cases.close` | Transition a case to `closed` (subject to `workflow.ts` closure gating). |
| `cases.reopen` | Transition a `closed` case back to `reopened`. |
| `cases.export` | Export case data. |
| `evidence.read` / `evidence.upload` / `evidence.delete` | Evidence lifecycle. |
| `communications.read` / `communications.send` | Reporter⇄investigator messaging. |
| `reports.read` / `reports.export` | Aggregated reporting. |
| `configuration.manage` | Risk matrix, SLA rules, categories, etc. |
| `users.manage` | Staff account administration. |
| `audit.read` | Read the audit trail. |

## Roles → permissions (`ROLE_PERMISSIONS`)

| Role | Permissions |
|---|---|
| `reporter` | *(none — reporters interact through a dedicated, credential-based portal, never through case permissions; see `docs/DATABASE.md`.)* |
| `investigator` | `cases.read`, `cases.edit`, `evidence.read`, `evidence.upload`, `communications.read`, `communications.send` |
| `senior_investigator` | investigator's set **+** `cases.reassign`, `cases.close`, `evidence.delete`, `reports.read` |
| `functional_admin` | broadest case-operational role: adds `cases.create`, `cases.assign`, `cases.reopen`, `cases.export`, `reports.export`, `audit.read` to senior_investigator's set |
| `darc_compliance` | `cases.read`, `cases.assign`, `cases.reassign`, `cases.close`, `cases.reopen`, `cases.export`, `evidence.read`, `communications.read`, `reports.read`, `reports.export`, `audit.read` (no `cases.edit`, no `evidence.upload/delete` — oversight, not casework) |
| `consultation` | read-only across the board: `cases.read`, `evidence.read`, `communications.read`, `reports.read` |
| `system_admin` | `configuration.manage`, `users.manage`, `audit.read` **only** — deliberately excludes every `cases.*`/`evidence.*`/`communications.*` permission |
| `executive` | `reports.read` only — aggregated/anonymized dashboards, never raw case content |
| `security_admin` | `security.manage`, `audit.read` **only** — same least-privilege exclusion of every `cases.*`/`evidence.*`/`communications.*` permission as `system_admin`; manages authentication/MFA/access-policy settings, never case content |
| `audit_committee` | `reports.read`, `audit.read` **only** — read-only oversight distinct from `executive` (adds `audit.read`), never a `cases.*`/`evidence.*`/`users.*`/`configuration.*` permission, so it can never modify a case, evidence, permission, user, or workflow |

**"System Administrator ≠ Case Access"** (section 30 of the brief, quoted
directly in `permissions.ts`) is enforced by omission: `system_admin` simply
has no case-scoped permission in its list, so `roleHasPermission(...)` fails
before any scope/assignment check is even reached. Least privilege, not a
special-cased exception.

## Confidentiality clearance (`ROLE_MAX_CONFIDENTIALITY`)

A second, independent gate on top of `cases.read` — holding the permission
is not enough if the role isn't cleared for the case's
`confidentialityLevel` (`restricted` < `confidential` < `highly_confidential`
by `CONFIDENTIALITY_RANK`):

| Role | Max confidentiality cleared |
|---|---|
| `reporter` | *(n/a — no case access at all)* |
| `investigator` | `confidential` |
| `senior_investigator` | `highly_confidential` |
| `functional_admin` | `highly_confidential` |
| `darc_compliance` | `highly_confidential` |
| `consultation` | `confidential` (deliberately capped **below** `highly_confidential` even though it has `cases.read` — see the comment in `permissions.ts`) |
| `system_admin` | *(n/a — no case access at all)* |
| `executive` | `restricted` only |
| `security_admin` | *(n/a — no case access at all)* |
| `audit_committee` | `restricted` only — same ceiling as `executive`, aggregated visibility only |

## Scope (`isInScope`)

`user.countries`/`user.entities` are allow-lists. **Empty array means
unrestricted** — by convention this is only ever set that way for
admin-style roles, never assumed automatically from the role name itself;
it's a data property of the `AppUser` record. A case is in scope only if
both the country check and the entity check pass independently.

## Visibility: assigned vs. global (`GLOBAL_VISIBILITY_ROLES`)

Two ways to be allowed to see an in-scope, confidentiality-cleared case:

1. **Assigned**: `case.assignee === user.userId` **or**
   `case.additionalInvestigators.includes(user.userId)`.
2. **Global visibility**: the role is in
   `['functional_admin', 'darc_compliance', 'consultation', 'executive']` —
   these roles see every in-scope case regardless of assignment.

`investigator` and `senior_investigator` are **not** in that list: they only
ever see cases they are explicitly assigned to, never the full in-scope set.

## Rule #9 — the implicated-person override (checked first, beats everything)

> "A person implicated in a report must NEVER access that case, regardless
> of role or assignment." (section 9 of the brief)

`can()` checks `context.implicatedUserIds?.includes(user.userId)` **before**
scope, confidentiality, or assignment/visibility — and returns `false`
immediately if it matches, full stop. This is the one check in the whole
model that no role, including `functional_admin` with global visibility,
can override. `implicatedUserIds` is populated via
`implicatedUserIdsFromPersons()` (persons with `kind: 'subject'` and a
`linkedUserId`) and denormalized onto `Case.implicatedUserIds` itself (see
`caseTypes.ts`) specifically so Firestore Security Rules — which cannot run
an arbitrary subcollection query — can enforce this same check server-side
against `resource.data` directly.

**Live-verified** (see `docs/SECURITY.md`): a user made the implicated
subject of a throwaway test case was denied access even as
`functional_admin` (global visibility) against the real, deployed rules —
confirming the mirrored enforcement actually matches, not just reads the
same on paper.

## Where this is actually enforced today vs. not yet

| Layer | Status |
|---|---|
| `src/domain/permissions.ts` (`can()`) | Real, unit-verified logic. Not yet called from any live screen on the new `Case` model (that UI is Phase 5+). |
| `firestore.rules` (`cases/{caseId}` read rule) | **Live and deployed** against the real project (`activa-ethicalert-47246`). Mirrors `can()`'s read-path logic (auth, role/claims, scope, confidentiality clearance, implicated-person, assigned-or-global-visibility) using Firebase custom claims (`role`, `countries`, `entities`) set by `scripts/setupAuthUsers.ts` — with one deliberate, documented narrowing from `permissions.ts`, not accidental drift: the rules' `hasGlobalCaseVisibility()` deliberately excludes `executive` from global visibility (rules-file comment: aggregated dashboards only, never raw case content) even though `GLOBAL_VISIBILITY_ROLES` in `permissions.ts` lists it — so an `executive` who somehow held `cases.read` would still be refused by the deployed rule; `can()` alone is stricter on paper but the rules are stricter in practice for this role. All writes to `cases/**` are `allow write: if false` — no client can mutate case data at all right now; every mutation must go through a Cloud Function (written, not deployed — see `docs/FIREBASE-SETUP.md`). |
| `functions/src/index.ts` | Written, type-checked, **not deployed** (Spark plan decision — see `docs/FIREBASE-SETUP.md`). Reuses `permissions.ts`/`workflow.ts` directly rather than re-implementing checks, so once deployed, server-side enforcement is guaranteed to match this document exactly. |

**=== AMÉLIORATION AJOUTÉE : confidentiality clearance now mirrored into `firestore.rules` ===**
Confidentiality-level clearance (`ROLE_MAX_CONFIDENTIALITY`/`CONFIDENTIALITY_RANK`)
was enforced only in the TypeScript `can()` function as of the previous
version of this document; it is now also enforced in the deployed rules
(`confidentialityRank()`/`maxConfidentialityRank()`/`isConfidentialityAllowed()`
in `firestore.rules`, mirroring the TypeScript tables field-for-field).
Deploying this surfaced one real pre-existing data inconsistency, corrected
before the rule went live rather than after: the automatic Phase 2b
migration (`confidentialityForPriority()` in `migrateLegacy.ts`) had mapped
one demo case's `very_high` priority to `highly_confidential`, but that case
was already assigned to an `investigator` (cleared only to `confidential`).
Deploying the new rule as-is would have silently revoked that investigator's
access to her own assigned case. Per an explicit user decision, the case's
`confidentialityLevel` was corrected to `confidential` (matching its actual
assignment) via a one-off Admin SDK write — audited (`audit_logs`,
action `CASE_CONFIDENTIALITY_CORRECTED`) and recorded on the case's own
`timeline` subcollection — *before* the rule was deployed, so no real access
was lost. See `docs/SECURITY.md` for the live tests proving both that this
regression didn't happen and that the new check genuinely works.
