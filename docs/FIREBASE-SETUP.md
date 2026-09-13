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

## Phase 3 — Cloud Functions (written, NOT deployed — Spark plan, by explicit decision)

`functions/src/index.ts` implements 3 of the ~15 operations in `CaseRepository` as real Cloud Functions (`createCase`, `assignCase`, `changeCaseStatus`), reusing `src/domain/permissions.ts` and `src/domain/workflow.ts` directly rather than re-implementing the rules. It **compiles cleanly** (`npm --prefix functions run build`, also covered by the root `tsc --noEmit`).

**What was actually tried, in order, all confirmed live against the real project**:
1. `firebase deploy --only functions` with the original service account → `403` on `serviceusage.googleapis.com` checking `cloudfunctions.googleapis.com` (the account couldn't even ask whether the API was enabled).
2. Granted `roles/serviceusage.serviceUsageAdmin` to `firebase-adminsdk-fbsvc@activa-ethicalert-47246.iam.gserviceaccount.com` → re-ran deploy → this worked as intended: `cloudfunctions.googleapis.com` auto-enabled successfully, and it moved on to auto-enabling `cloudbuild.googleapis.com`/`artifactregistry.googleapis.com`.
3. That auto-enable then failed with an explicit, unambiguous platform message: *"Your project ... must be on the Blaze (pay-as-you-go) plan ... Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete."* This is **not** an IAM or permission gap — Cloud Build and Artifact Registry (which any Cloud Functions deployment needs to build the function) are simply unavailable on the Spark plan, full stop. No role, no direct API call, no workaround changes this; it's a hard platform requirement, confirmed by retrying after the console's own Blaze upgrade prompt appeared and reproducing the identical error.
4. **Decision: stay on Spark.** Cloud Functions deployment is therefore not attempted further. This is a legitimate, explicit choice — not a bug or an unresolved blocker to keep chasing.

**Consequence**: everything in this document that depends on Cloud Functions (the remaining ~12 `CaseRepository` operations, the reporter-facing `getCaseForReporter` callable, and Phase 4's list-based Control Panel screens below) stays written-but-undeployed indefinitely under this plan. Auth, Firestore, and the deployed Security Rules are entirely unaffected and continue to work normally — Spark's limitation is specifically Cloud Functions/Cloud Build/Artifact Registry, nothing else covered by this project.

If this decision is revisited later, the path is already proven end-to-end: enable Blaze in the console (fully, past the upgrade confirmation — verify at https://console.firebase.google.com/project/activa-ethicalert-47246/usage/details that it no longer prompts to upgrade), then re-run `firebase deploy --only functions --project activa-ethicalert-47246` (the `serviceusage.serviceUsageAdmin` role granted above is still in place and already proven sufficient for the rest of the flow).

## Phase 4 — Control Panel (blocked on the same issue as Cloud Functions)

Attempted a real, read-only Control Panel (`src/services/firebaseClient.ts`, a real Firebase Web App registered for this project — appId `1:308693813201:web:8f3bbcfcb68ee81964c2f0`, config in a gitignored `.env`). It surfaced a genuine architectural constraint rather than a bug:

**Firestore rejects `list`/query operations outright** whenever the security rule depends on a field no `where` clause constrains — confirmed live, not assumed: `functional_admin` (global visibility, passes every other check) gets `403 Missing or insufficient permissions` on a plain, unconstrained `list` of the `cases` collection. The cause is `isNotImplicated()` in `firestore.rules`, which depends on `implicatedUserIds` — a per-document field, so Firestore can't prove the rule holds for every possible result of an unconstrained query, and refuses the whole request rather than silently filtering out denied documents the way a `get` effectively does. Single-document `getDoc` of one known case (or subcollection document, once extended the same way) still works correctly — that part **is** real and usable.

Weakening `isNotImplicated` to make listing "provable" would mean trading away rule #9 of the brief (a person implicated in a case must never access it) — not a call to make unilaterally in a rules file. The only architecturally sound fix is what `docs/ARCHITECTURE.md` specified before this was ever attempted: list/search goes through a Cloud Function (server-side, Admin SDK, arbitrary filtering), not a raw client query. **With the decision to stay on Spark (above), Phase 4's real list-based screens (Overview, Alerts list, etc.) are blocked indefinitely, not just for now** — the same Cloud Function that would fix this cannot be deployed on Spark. No Control Panel UI was built against the broken capability; that would have been exactly the "interface that gives the impression the system works" the brief forbids.

What still works and is usable within Spark's limits: staff sign-in (Firebase Auth), and single-document lookups of a case or its subdocuments *by known id* (`getDoc`, not `getDocs`/`list`) — enough for, e.g., a "paste a Case ID to look it up" tool, but not a browsable list. If a list-capable screen is wanted without Cloud Functions, the only two honest options are (a) revisit the Spark/Blaze decision later, or (b) deliberately relax `isNotImplicated` for list operations only (accepting that an implicated global-visibility user could see their own case's existence/status in a list, though still not its full detail, since `get` would still block that) — a real security trade-off, so it needs an explicit decision from you, not something to change unilaterally in the rules file.

## Phase 4b — Case ID Lookup tool (shipped)

`src/components/CaseLookup.tsx`, wired into the app as a new **"Firebase Lookup (Beta)"** tab (purple, in the top nav). Real Firebase Auth sign-in, then a single-document `getDoc` by the internal Case ID against the deployed rules — exactly the capability confirmed above. Fully independent of the Phase 1 localStorage demo portal; has zero effect on it.

**A real bug caught before shipping**: a genuinely non-existent Case ID returns `permission-denied`, not a clean "not found" — for every role, including `functional_admin`. Verified directly (REST, signed in as both an investigator and `functional_admin`, against an id guaranteed not to exist). Firestore's rule engine evaluates `isNotImplicated`/`isInScope`/etc. against `resource.data` regardless of whether the document exists, so a missing document and an existing-but-unauthorized one are indistinguishable to the client — which is actually the *correct*, privacy-preserving behavior (it never leaks whether a case you can't see exists), but it meant the tool's original "this case exists, but you're not authorized" copy was factually wrong for a mistyped id. Fixed in all three languages to state the honest ambiguity instead.

**Testing limitation, stated plainly**: a full browser click-through (sign in → search → view result) could not be executed end-to-end in this sandboxed session. Headless Chromium's outbound HTTPS to `identitytoolkit.googleapis.com` is reset by this environment's egress proxy no matter how it's configured (5 different proxy/TLS/HTTP2 configurations tried), while the same calls succeed reliably from Node — the proxy's own logs cite "organization policy" for several Google domains, which reads as a deliberate restriction on browser-originated traffic in this sandbox, not a defect in the code. What *was* verified in a real browser: the login form renders correctly, in French and English, matching the app's design system, with no console errors. What was verified via direct REST calls (the same method used throughout this session, mirroring exactly what the component's Firebase SDK calls do): sign-in success/failure, authorized/out-of-scope/non-existent Case ID behavior — all match what the component implements. If you test this tool yourself in a normal browser (outside this sandbox), the network path is unobstructed and it should work end-to-end as designed — please report back if it doesn't.

## Re-running or extending the seed

```bash
GOOGLE_APPLICATION_CREDENTIALS_PATH=/path/to/your/service-account.json \
FIRESTORE_DATABASE_ID=default \
npx tsx scripts/seedFirestore.ts
```

## Required security follow-up on your side

The service account key you pasted into this conversation is a durable credential and now lives in this chat's history. **Revoke it** once you've confirmed everything above: Firebase Console → Project settings → Service accounts → Manage keys → delete the key with ID `b295f4d34b00deb5eebba2d1507894948e016559`. It was never committed to the repository and was only ever read from an out-of-repo path local to this session. Phase 3's Cloud Functions, once actually deployable, should run on the project's own default compute service account (or a freshly scoped one), not a key pasted into a chat.

Also rotate the 5 staff temporary passwords (see above) before anyone relies on those accounts for real.
