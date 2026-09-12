# ACTIVA Hotline — Firebase Project Status

Project: **`activa-ethicalert-47246`** (console: `console.firebase.google.com/project/activa-ethicalert-47246`)
Firestore database id: **`default`** (a *named* database, not the special `(default)` database — pass `FIRESTORE_DATABASE_ID=default` / `getFirestore(app, 'default')` everywhere, or every Admin SDK call will silently target a database that doesn't exist and fail with a gRPC `NOT_FOUND`).

## What is actually live in this project right now

Verified by writing then independently re-reading the data with a fresh Admin SDK connection (not just trusting the write call):

- **3 `Case` documents** in `cases/{caseId}`, migrated for real from the 3 legacy demo alerts (`src/data/activaConfig.ts`) via `scripts/seedFirestore.ts` → `src/data-access/migrateLegacy.ts` → `scripts/firestoreAdminRepository.ts`.
- Each with its full set of child documents: `allegations`, `persons`, `evidence` (metadata only), `corrective_actions`, `risk_assessments`, `communications`, `investigation_notes` (where present in the legacy record), `timeline`.
- **`reporter_credentials/{caseId}`** (3 docs): salted hash + salt only, never the plaintext password — kept in a collection separate from `cases/*`, per the identity-isolation rule in `docs/DATABASE.md`.
- **`reporter_identities/{caseId}`** (1 doc): only for the one legacy alert that was not anonymous.
- **`audit_logs/{id}`** (18 docs): one entry per case/child creation, written by the same repository code path a real import would use.
- **`counters/cases`**: `{ value: 4 }` — the case-number sequence (one increment was consumed by a first run that failed on a Firestore validation error before the `ignoreUndefinedProperties` fix, so case numbering starts at `CASE-2026-000002`; this is a harmless gap, not a bug).

This is **data only**. It does **not** mean Phase 3 is done — there is still no Firebase Authentication, no Cloud Functions, and the app's UI still reads/writes the legacy `AlertRecord` model in `localStorage` (Phase 1), completely unaware this Firestore data exists. Wiring the UI to this data is explicitly Phase 4/5 work, gated on Phase 3.

## Security rules — one manual step still needed

`firestore.rules` was updated to explicitly deny all client-SDK read/write on the new `cases/*` (and subcollections), `reporter_credentials/*`, `reporter_identities/*`, and `counters/*` paths (the legacy `/alerts`, `/audit_logs`, `/users` rules are untouched — the live Phase-1 app is unaffected). **This file has NOT been deployed to the project yet**: `firebase deploy --only firestore:rules` failed with

```
Error: Request to https://serviceusage.googleapis.com/... had HTTP Error: 403, Permission denied to get service [firestore.googleapis.com]
```

The service account (`firebase-adminsdk-fbsvc@activa-ethicalert-47246.iam.gserviceaccount.com`) has enough IAM permission to read/write Firestore *documents* directly (which is how the seed above succeeded) but not enough to call the Service Usage API that the Firebase CLI's deploy step checks first. Without that data-plane access, the currently-deployed rules only cover the legacy paths; the new paths have **no explicit rule**, which Firestore treats as **deny-by-default** — so they are not actually open, just not self-documented in the rules file yet.

Two ways to finish this (either works, no code change needed):
1. **Console (30 seconds, recommended):** Firebase Console → Firestore Database → Rules tab → paste the contents of `firestore.rules` from this repo → **Publish**.
2. **Grant the service account one more role** (`roles/serviceusage.serviceUsageConsumer`, IAM & Admin → find `firebase-adminsdk-fbsvc@...` → Edit → Add Role) and ask me to re-run `firebase deploy --only firestore:rules --project activa-ethicalert-47246`.

## Re-running or extending the seed

```bash
GOOGLE_APPLICATION_CREDENTIALS_PATH=/path/to/your/service-account.json \
FIRESTORE_DATABASE_ID=default \
npx tsx scripts/seedFirestore.ts
```

`scripts/firestoreAdminRepository.ts` implements the exact same `CaseRepository` interface as `src/data-access/caseRepository.ts`'s `LocalCaseRepository`, so any future script that exercises the domain layer (new demo data, a data fix, a Phase 3 Cloud Function's local test) can target either implementation interchangeably.

## Required security follow-up on your side

The service account key you pasted into this conversation is a durable credential and now lives in this chat's history. **After confirming the above is as expected, revoke it**: Firebase Console → Project settings → Service accounts → Manage keys → delete the key with ID `b295f4d34b00deb5eebba2d1507894948e016559`. It was never committed to the repository and was only ever read from an out-of-repo path (`/tmp/.../scratchpad/secrets/service-account.json`) local to this session — deleting the session or ending the container also removes that copy. Phase 3's real backend should authenticate via a properly scoped, rotated credential (or Application Default Credentials in the actual deployment environment), not a key pasted into a chat.
