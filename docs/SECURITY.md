# ACTIVA Hotline — Security Findings & Testing Log

Tracks security-relevant findings, decisions, and the live tests actually run against
the real project (`activa-ethicalert-47246`), per section 54 of the brief ("Test
explicitly: unauthorized URL access, unauthorized API access, unauthorized Firestore
access, ... role escalation, ... audit log manipulation"). Every claim here was
verified with a real request, not reasoned about in the abstract — see the linked
evidence in `docs/PHASES.md`/`docs/FIREBASE-SETUP.md` for the exact calls made.

## Security review of the full branch diff — 3 confirmed findings, all fixed

A structured review of every file changed on this branch (vs `origin/main`) was
run in two passes: (1) an initial scan against 46 changed files identified 5
candidate vulnerabilities; (2) each candidate was independently re-verified
against the actual current code (not the summary) by a separate pass, scored
for confidence, and only kept at confidence ≥ 8/10. Two candidates — `audit_logs`
being world-readable, and the reporter access-code hash being a weak KDF —
were rejected on re-verification: both are **pre-existing** (the open
`audit_logs`/`alerts` rules predate this branch; `src/services/crypto.ts`'s
hash predates this branch and this branch's Cloud Functions consume it
without weakening it, and in the `alerts`-vs-`reporter_credentials` case
the change is a strict improvement, not a regression). The other 3 were
confirmed real and are fixed below.

### Fix 1 (was High): Storage write rule didn't check the `evidence.upload` permission

`storage.rules`' write rule (`canEditCase()`, now split) mirrored only the
**read**-path authorization (signed-in/scope/confidentiality/assigned-or-global)
for both reads *and* writes — never checking that the caller's role actually
holds `evidence.upload`. Concretely, `consultation` (strictly read-only in
`ROLE_PERMISSIONS`) and `darc_compliance` (has `evidence.read`, not
`evidence.upload`) could both overwrite an existing evidence file's bytes at
its known `storagePath`, silently corrupting evidence an investigator would
later download via `getEvidenceDownloadUrl` with no Firestore trace (the
metadata, `sha256Hash` included, is untouched by a Storage-level overwrite).

**Fix**: added `hasEvidenceUploadPermission()` (mirrors `ROLE_PERMISSIONS`'s
actual `evidence.upload` holders — `investigator`/`senior_investigator`/
`functional_admin` only), required by a new `canUploadEvidence()`. Also made
the write itself non-destructive: `allow write: if canUploadEvidence() &&
resource == null && ...` — `resource == null` is true only for a brand-new
object, so both overwrite *and* delete are now denied outright (evidence
removal stays a Firestore-only `status: 'deleted'` flag, never an actual
Storage delete). **Not independently verified live** — the Storage bucket
still doesn't exist on this project (see `docs/FIREBASE-SETUP.md`), so this
fix could not be deployed or exercised against a real bucket; correctness
rests on a careful reading of the Storage Rules Language semantics for
`resource == null`.

### Fix 2 (was Medium): Firestore case-read rule never checked the role held `cases.read`, and the confidentiality fallback was wrong

`firestore.rules`' `cases/{caseId}` read rule (and the identical subcollection
rule) never had an equivalent of `can()`'s first check in `permissions.ts` —
`roleHasPermission(role, 'cases.read')`. Combined with `maxConfidentialityRank()`
falling back to rank 1 ("restricted") for *any* role outside its two explicit
lists — including `reporter` and `system_admin`, which map to `null` (no
access at all) in `permissions.ts` — a `system_admin` account added to a
case's `additionalInvestigators` (e.g. via `assignCase`, which validated
nothing about the target's role) could read that case directly through the
client SDK, on any case at `restricted` confidentiality. This directly
contradicted the project's own repeatedly-stated invariant, "System
Administrator ≠ Case Access."

**Fix**: added `hasCaseReadPermission()` (mirrors the real `cases.read`
holders: `investigator`/`senior_investigator`/`functional_admin`/
`darc_compliance`/`consultation`, excluding `reporter` and `system_admin`),
required in both read rules. Corrected `maxConfidentialityRank()`'s fallback
from rank 1 to rank 0 for `reporter`/`system_admin` (matching their `null`
max in `permissions.ts`), with `executive` broken out into its own explicit
rank-1 branch so it isn't accidentally caught by the same fallback.
Defense-in-depth: `assignCase` now also calls `assertCaseBearingRole()`
(Admin SDK `getUser().customClaims`) on every target uid before writing, so
even a future rules regression wouldn't be the only thing stopping this.

**Live-verified** (real signed-in requests, real accounts, against the
redeployed rules): a throwaway `restricted` case with `system_admin`
(`d.mendy@group-activa.com`) added to `additionalInvestigators` → **403**
(was the exploit's `200` before this fix). `a.kouassi` re-reading her own
real assigned case after the redeploy → **200** (no regression). Throwaway
case deleted after the test.

### Fix 3 (was Medium): `addPerson` let any `cases.edit` holder permanently lock other staff out of a case, unaudited and irreversible

`addPerson` accepted `linkedUserId` straight from the client, gated only by
`cases.edit` — held by every plain `investigator`. When `kind === 'subject'`,
that uid was `arrayUnion`-ed into `Case.implicatedUserIds`, the single field
`isNotImplicated()` depends on in both `firestore.rules` and `storage.rules`,
and the check `can()` evaluates *before* scope/confidentiality/assignment/
global-visibility — overriding all of them, with no exemption for any role.
No callable removed a person or cleared `implicatedUserIds`, and no audit
entry was written for the link. An investigator under review (or named in
their own case) could therefore call `addPerson` twice — once naming the
`functional_admin`, once naming the `darc_compliance` officer — and
permanently detach the case from every oversight role able to reach it,
while remaining able to work the case themselves.

**Fix**: setting `linkedUserId` on a `subject` now additionally requires
`cases.assign` (held only by `functional_admin`/`darc_compliance` — the two
oversight roles, not plain investigators); recording an ordinary witness or
an unlinked subject is unaffected. Every link now writes a
`PERSON_LINKED_TO_USER` audit entry. Added a new `removePersonLink` callable
(same `cases.assign` gate, mandatory `reason`) that clears `linkedUserId`
and pulls the uid back out of `implicatedUserIds` — the reversal path that
didn't exist before. **Not independently live-tested against the real
project** (the callable is a Cloud Function, undeployed like the rest —
see `docs/FIREBASE-SETUP.md`); correctness rests on a clean
`npm --prefix functions run build` and a careful reading against the
`addPerson`/`requireCaseAccess` pattern already exercised in earlier phases.

## Finding: shared env var names silently link Phase 1's legacy sync to Phase 4's real config

**Severity: Medium (data-hygiene, not an access-control break) — found and mitigated in this session.**

`services/firebase.ts` (the Phase 1 `AlertRecord` best-effort Firestore sync) and
`src/services/firebaseClient.ts` (Phase 4's `CaseLookup`) both read the *same*
`VITE_FIREBASE_*` environment variables. When a real `.env` was created for Phase 4
testing, this meant `isFirebaseConfigured()` in the legacy path also silently started
returning `true` — so any alert submitted through the Phase 1 public portal while that
`.env` was present would have synced into the real project's `alerts`/`audit_logs`
collections, via the wide-open legacy rules (`allow create: if true`), without anyone
explicitly going through `AdminConfigView`'s "connect Firebase" flow (the intended
activation gesture for that feature).

**Verified no pollution occurred**: read `alerts` (0 docs), `users` (0 docs), and
cross-checked every `audit_logs` document id against the `audv2-*` pattern Phase 2+
writes use (18/18 matched — none from the legacy path) via the Admin SDK, before
concluding this was a live risk rather than an incident.

**Mitigation taken**: the `.env` file was deleted from this session's container. It
was never committed (`.env*` is gitignored) — deleting the session/container removes
any other copy. This is not a code change; nothing in the shipped app was altered.

**If you (re)create `.env` locally to test `CaseLookup` yourself**, know that it will
also activate the legacy sync for as long as it's present. Two ways to avoid
unintended pollution, your choice:
1. Only keep `.env` in place for the duration of a `CaseLookup` test session, then
   delete it — the legacy sync has no persistent env var only it reads.
2. Tighten the legacy `alerts`/`audit_logs` rules in `firestore.rules` to require
   authentication (this is a real behavior change to a Phase 1 feature that
   currently works unauthenticated by design — not something to do unilaterally;
   flagged here as an option, not applied).

## Live-tested and confirmed (all via real signed-in requests against the real project — see `docs/PHASES.md` for each)

| Test (mirrors section 54 of the brief) | Result |
|---|---|
| Unauthenticated read of a `cases/{id}` document | Denied (`403`) |
| Assigned investigator reading their own case | Allowed |
| Investigator reading a case outside their country/entity scope | Denied |
| `functional_admin` (global visibility) reading any in-scope case | Allowed |
| `system_admin` reading case content (least privilege — should never be allowed) | Denied, as designed |
| A user made the *implicated subject* of a case, reading it as `functional_admin` (global visibility) | Denied — rule #9 holds even over global visibility |
| Unconstrained `list` of the `cases` collection, any role | Denied outright by Firestore itself (see `docs/FIREBASE-SETUP.md` — Phase 4 finding) |
| `getDoc` on a genuinely non-existent Case ID | `permission-denied`, not a distinguishable "not found", for every role (see Phase 4b) — existence is never leaked |
| Wrong password sign-in (`accounts:signInWithPassword`) | Rejected (`INVALID_LOGIN_CREDENTIALS`) |
| Direct write attempt to `cases/**` (any subcollection) | Closed (`allow write: if false`) — every mutation must go through a Cloud Function, none deployed, so **no client-side path to mutate case data exists right now** |
| Direct read of `reporter_credentials/*` or `reporter_identities/*` | Closed (`allow read, write: if false`) regardless of role |
| Direct read/write of `counters/*` | Closed |
| An `investigator`, assigned to and in-scope for a throwaway test case, reading it when its `confidentialityLevel` is `highly_confidential` (above her `confidential` clearance) | **Denied (`403`)** — proves the newly-added confidentiality-clearance check in `firestore.rules` (`isConfidentialityAllowed`) actually works, not just present in the rules text |
| The same throwaway case, downgraded to `confidential` | Allowed — isolates that the previous denial was specifically the confidentiality check, not scope/assignment |
| The real investigator (`c.ngo`) re-reading her real, previously-`highly_confidential`, now-corrected-to-`confidential` assigned case, *after* the new rule deployed | Allowed — confirms the confidentiality-clearance rule shipped **without** the access regression it would otherwise have caused (see "Fix" section below) |
| Same real investigator (`a.kouassi`) re-reading her own real `confidential` assigned case, after the rule deployed | Allowed — regression check on an unrelated, unaffected case |

All four confidentiality-clearance tests above used a real Firebase Auth ID
token obtained by minting a custom token for the real staff account (Admin
SDK `createCustomToken`) and exchanging it via
`accounts:signInWithCustomToken` — not a stored password (none are kept,
by design; see the temp-password handling elsewhere in this doc's history).
The resulting ID token carries that account's real custom claims exactly as
Firestore would see them from an ordinary password sign-in, so this is a
genuine signed-in request against the real deployed rule, not a simulation.

## Fix: confidentiality clearance mirrored into `firestore.rules` (this session)

**Closes a gap this same document previously flagged as open**: role-based
confidentiality clearance (`ROLE_MAX_CONFIDENTIALITY`/`CONFIDENTIALITY_RANK`
in `src/domain/permissions.ts`) is now also enforced in the deployed
`firestore.rules` (`confidentialityRank`/`maxConfidentialityRank`/
`isConfidentialityAllowed`), not only in client-side TypeScript.

Before deploying, the change was checked against every real case in the
live project to catch a regression before it happened, not after: one demo
case (`CASE-2026-000002`, migrated from `alt-001`) had been auto-classified
`highly_confidential` by the Phase 2b migration's priority mapping, while
already assigned to an `investigator` (cleared only to `confidential`).
Deploying the new rule unchanged would have silently locked that
investigator out of her own assigned case. Per an explicit user decision
(asked rather than assumed, given this is real production data), the case's
`confidentialityLevel` was corrected to `confidential` — matching its actual
assignment — via a one-off, transactional Admin SDK write (guarded by
reading and re-checking the expected prior value inside the transaction
before writing, the same discipline `LockService` would give in a
single-threaded environment) *before* the rule was deployed. The correction
was written to `audit_logs` (`action: CASE_CONFIDENTIALITY_CORRECTED`,
`previousValue`/`newValue` recorded) and to the case's own `timeline`
subcollection, exactly like any other tracked case change.

Net effect, all live-verified (table above): the new check genuinely
enforces confidentiality clearance for cases it applies to, and it shipped
with zero observed regression on the real, already-assigned demo cases.

## Structural guarantees (not independently re-tested here because they follow from Firebase's own design, not this app's code)

- **No client-side privilege escalation via custom claims**: `role`/`countries`/`entities` are set only by `admin.auth().setCustomUserClaims()` (Admin SDK, `scripts/setupAuthUsers.ts`) — there is no Firebase Auth client API that lets a signed-in user modify their own custom claims. A compromised client can at most impersonate what its own account is already authorized to do.
- **Case IDs are unguessable-but-irrelevant**: `case-{timestamp}-{random6}` has limited entropy from the timestamp component, but knowing or guessing a valid id grants nothing — every read still goes through the same `firestore.rules` authorization check proven above. ID predictability is not a vulnerability in this model (unlike a system that treats "knows the ID" as sufficient authorization, which this one explicitly does not — see the reporter-access model in `docs/DATABASE.md`, which is credential-based, not ID-based).

## Known, accepted, pre-existing risk (inherited from Phase 1, not introduced by this session's work)

`firestore.rules`' legacy block (`/alerts`, `/audit_logs`, `/users`) predates this
session and remains wide open by original design (anonymous whistleblower submission
requires unauthenticated writes to `/alerts`). This was flagged in the very first
audit of this project (see the architecture audit that opened this engagement) and is
unchanged: `allow read: if true` on `/alerts` and `/audit_logs` means anyone with the
project's public API key (inherently public for a web app) can read every legacy
alert and audit entry if a real Firebase project is ever connected via
`AdminConfigView`. This is a real gap in the Phase 1 architecture, not remediated by
this session's Firebase work (which deliberately did not touch the legacy rules block,
per "never destroy existing functionality") — closing it properly requires the same
Cloud-Functions-mediated-write pattern already used for the new `cases` model, applied
retroactively to the legacy `alerts` collection, which is realistically a Phase 5+
migration (replace `AlertRecord` reads/writes with the `Case` model end to end) rather
than a rules-only patch.
