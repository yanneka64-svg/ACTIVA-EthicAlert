# ACTIVA Hotline — Security Findings & Testing Log

Tracks security-relevant findings, decisions, and the live tests actually run against
the real project (`activa-ethicalert-47246`), per section 54 of the brief ("Test
explicitly: unauthorized URL access, unauthorized API access, unauthorized Firestore
access, ... role escalation, ... audit log manipulation"). Every claim here was
verified with a real request, not reasoned about in the abstract — see the linked
evidence in `docs/PHASES.md`/`docs/FIREBASE-SETUP.md` for the exact calls made.

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
