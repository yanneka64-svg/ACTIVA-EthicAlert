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
| `firestore.rules` (`cases/{caseId}` read rule) | **Live and deployed** against the real project (`activa-ethicalert-47246`). Mirrors `can()`'s read-path logic (auth, role/claims, scope, implicated-person, assigned-or-global-visibility) using Firebase custom claims (`role`, `countries`, `entities`) set by `scripts/setupAuthUsers.ts` — with two deliberate, documented narrowings from `permissions.ts`, not accidental drift: confidentiality clearance is not yet mirrored (see below), and the rules' `hasGlobalCaseVisibility()` deliberately excludes `executive` from global visibility (rules-file comment: aggregated dashboards only, never raw case content) even though `GLOBAL_VISIBILITY_ROLES` in `permissions.ts` lists it — so an `executive` who somehow held `cases.read` would still be refused by the deployed rule, `can()` alone is stricter on paper but the rules are stricter in practice for this role. All writes to `cases/**` are `allow write: if false` — no client can mutate case data at all right now; every mutation must go through a Cloud Function (written, not deployed — see `docs/FIREBASE-SETUP.md`). |
| `functions/src/index.ts` | Written, type-checked, **not deployed** (Spark plan decision — see `docs/FIREBASE-SETUP.md`). Reuses `permissions.ts`/`workflow.ts` directly rather than re-implementing checks, so once deployed, server-side enforcement is guaranteed to match this document exactly. |

Confidentiality-level clearance (`ROLE_MAX_CONFIDENTIALITY`) is enforced
today in the TypeScript `can()` function but is **not yet mirrored into
`firestore.rules`** — flagged here explicitly rather than silently, since
this doc's whole purpose is to say precisely what's live vs. what's still
only client-side-ready logic. Adding it to the rules is a small, well-scoped
follow-up (the custom claims would need a role→max-level lookup identical to
the TypeScript table above) and does not require Cloud Functions to be
deployed first; it has not been done in this session because it changes the
live, already-verified security rules and should be a deliberate, tested
step of its own rather than a drive-by edit while writing documentation.
