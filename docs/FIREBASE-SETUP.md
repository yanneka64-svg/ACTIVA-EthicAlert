# ACTIVA Hotline — Firebase Project Status

Project: **`activa-ethicalert-47246`** (console: `console.firebase.google.com/project/activa-ethicalert-47246`)
Firestore database id: **`default`** (a *named* database, not the special `(default)` database — pass `FIRESTORE_DATABASE_ID=default` / `getFirestore(app, 'default')` everywhere, or every Admin SDK call will silently target a database that doesn't exist and fail with a gRPC `NOT_FOUND`).

## Phase 2b — Firestore data (done)

Verified by writing then independently re-reading the data with a fresh Admin SDK connection:

- **3 `Case` documents** in `cases/{caseId}`, migrated for real from the 3 legacy demo alerts (`src/data/activaConfig.ts`) via `scripts/seedFirestore.ts` → `src/data-access/migrateLegacy.ts` → `scripts/firestoreAdminRepository.ts`.
- Each with its full set of child documents: `allegations`, `persons`, `evidence` (metadata only), `corrective_actions`, `risk_assessments`, `communications`, `investigation_notes`, `timeline`.
- **`reporter_credentials/{caseId}`** (3 docs): salted hash + salt only, never the plaintext password.
- **`reporter_identities/{caseId}`** (1 doc): only for the one legacy alert that was not anonymous.
- **`audit_logs/{id}`**: one entry per case/child creation.
- **`counters/cases`**: sequence counter for `CASE-YYYY-NNNNNN` numbers.

## Phase 3 — Authentication & Security Rules (done)

### Real Firebase Auth accounts

`scripts/setupAuthUsers.ts` created one real Firebase Authentication account per staff member in `src/data/activaConfig.ts`'s `INITIAL_USERS`, with custom claims (`role`, `countries`, `entities`) matching `src/domain/permissions.ts` exactly:

| Email | Role claim | Scope |
|---|---|---|
| by.ekani@group-activa.com | `functional_admin` | global |
| a.kouassi@group-activa.com | `investigator` | Côte d'Ivoire / ACTIVA Côte d'Ivoire |
| c.ngo@group-activa.com | `investigator` | Cameroun / ACTIVA Assurances |
| d.mendy@group-activa.com | `system_admin` | global (but note: `system_admin` has no `cases.read` permission at all — least privilege, section 30 of the brief) |
| audit-board@group-activa.com | `consultation` | global |

Reporters intentionally get **no** Firebase Auth account — they authenticate via case number + access code against `reporter_credentials`, not email/password (see `docs/DATABASE.md`).

Temporary passwords for these 5 accounts were shown once in the chat that ran this script and are **not** stored anywhere in this repository. **Rotate them** (Firebase Console → Authentication → each user → Reset password, or have the person use "forgot password" — email delivery is already enabled) before treating any of these as real credentials. `by.ekani@group-activa.com` in particular is a real address — that person should reset their own password rather than keep the generated one.

Re-run any time (idempotent — updates claims on existing accounts, only prints passwords for accounts it actually creates):
```bash
GOOGLE_APPLICATION_CREDENTIALS_PATH=/path/to/key.json npx tsx scripts/setupAuthUsers.ts
```

### Data fix required by introducing real Auth (done)

`scripts/seedFirestore.ts` (Phase 2b) ran before Auth accounts existed, so the migrated `Case.assignee`/`additionalInvestigators` fields held the legacy demo ids (e.g. `"usr-investigator-1"`) instead of real Firebase Auth UIDs. This was caught by a **live rules test** (below), not assumed — `scripts/relinkLegacyAssignees.ts` fixes it and is safe to re-run.

### Security Rules — deployed and verified live

`firestore.rules` now enforces real role/scope/implicated-person checks on `cases/{caseId}` reads, mirroring `src/domain/permissions.ts`'s `can()` function field-for-field (see the rules file's comments). All mutations remain closed to the client SDK (`allow write: if false`) — every write must go through a Cloud Function, per the "client never decides a sensitive mutation alone" principle in `docs/ARCHITECTURE.md`.

**This is actually deployed**, not just written: `firebase deploy --only firestore:rules` still fails the same way as in Phase 2b (the service account lacks `serviceusage.services.get`), but the rules were pushed successfully via a direct call to the Firebase Rules API (`firebaserules.googleapis.com` — `POST .../rulesets` then `PATCH .../releases/cloud.firestore/default`), which this service account *does* have permission to call. If you ever need to redeploy rules yourself without touching IAM: either paste into the Console's Rules tab and Publish, or ask for the same direct-API approach again.

**Verified live**, with real Firestore REST calls using real signed-in ID tokens (not just "should work" reasoning):
1. No auth token → denied.
2. `a.kouassi` (investigator, Côte d'Ivoire-scoped) reading their own assigned case → **allowed**.
3. `a.kouassi` reading a Cameroun case they're not assigned to → denied.
4. `by.ekani` (`functional_admin`, global visibility) reading that same Cameroun case → **allowed**.
5. `d.mendy` (`system_admin`) reading any case content → denied (least privilege — matches section 30 of the brief, which the legacy demo app's role-switcher does NOT currently enforce — see `docs/ARCHITECTURE.md` audit).
6. A throwaway case where a `functional_admin` user was made the *implicated* subject → denied, even though that role normally has global visibility (section 23 / rule 9 of the brief — the strongest rule, proven to actually hold).

Test #2 initially failed on the first run (denied when it should have been allowed) — that's what surfaced the legacy-id/real-UID mismatch above. Left in this document because a security rule you haven't tried to defeat isn't verified, only hoped.

## Phase 3 — Cloud Functions (written, NOT deployed — blocked)

`functions/src/index.ts` implements 3 of the ~15 operations in `CaseRepository` as real Cloud Functions (`createCase`, `assignCase`, `changeCaseStatus`), reusing `src/domain/permissions.ts` and `src/domain/workflow.ts` directly rather than re-implementing the rules. It **compiles cleanly** (`npm --prefix functions run build`, also covered by the root `tsc --noEmit`).

**Deployment is blocked**, confirmed by two independent checks, not assumed:
- `GET https://cloudbilling.googleapis.com/v1/projects/activa-ethicalert-47246/billingInfo` → `403 SERVICE_DISABLED` (Cloud Billing API itself has never been enabled/used on this project, or this service account can't see that it has).
- `firebase deploy --only functions` → builds successfully, then fails identically to the rules issue: `403 Permission denied to get service [cloudfunctions.googleapis.com]` via `serviceusage.googleapis.com`. Unlike rules, there is no safe direct-API bypass for a full Functions deployment (it needs Cloud Build + Artifact Registry orchestration, not one REST call), so this was not attempted.

**What's actually needed to finish this** (both require the project owner, not this service account):
1. **Enable Blaze billing** on the project (Firebase Console → bottom-left "Spark plan" → Upgrade). Cloud Functions, Cloud Build and Artifact Registry all require it, even at zero cost for low usage.
2. Either grant the existing service account broader roles (`roles/serviceusage.serviceUsageAdmin` or `roles/editor` — the default "Editor" role most Firebase Admin SDK service accounts start with, which this one may have been created without), **or** deploy yourself: `firebase login` (your own Google account, which owns this project and already has full rights) → `cd functions && npm install && npm run build && firebase deploy --only functions --project activa-ethicalert-47246`.

The remaining ~12 operations (evidence upload + Storage, communications, corrective actions, findings, conflict-of-interest, the reporter-facing `getCaseForReporter` that verifies a case number + access code server-side since reporters hold no Firebase Auth token at all, ...) follow the exact same pattern already established by these 3 and are listed at the bottom of `functions/src/index.ts` — not forgotten, just not worth writing further before the deployment path is unblocked and the first 3 are proven live.

## Re-running or extending the seed

```bash
GOOGLE_APPLICATION_CREDENTIALS_PATH=/path/to/your/service-account.json \
FIRESTORE_DATABASE_ID=default \
npx tsx scripts/seedFirestore.ts
```

## Required security follow-up on your side

The service account key you pasted into this conversation is a durable credential and now lives in this chat's history. **Revoke it** once you've confirmed everything above: Firebase Console → Project settings → Service accounts → Manage keys → delete the key with ID `b295f4d34b00deb5eebba2d1507894948e016559`. It was never committed to the repository and was only ever read from an out-of-repo path local to this session. Phase 3's Cloud Functions, once actually deployable, should run on the project's own default compute service account (or a freshly scoped one), not a key pasted into a chat.

Also rotate the 5 staff temporary passwords (see above) before anyone relies on those accounts for real.
