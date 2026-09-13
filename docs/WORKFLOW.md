# ACTIVA Hotline — Case Workflow

Documents the case lifecycle state machine implemented in
`src/domain/workflow.ts` (Phase 2). This file is **generated from the actual
code**, not a separate design — if this document and `workflow.ts` ever
disagree, the code is the source of truth and this file is stale and should
be regenerated, never the other way around.

`workflow.ts` is pure, storage-agnostic logic. It is meant to be called from
**both** a future Cloud Function (the real, server-side authority once
Functions are deployable — see `docs/FIREBASE-SETUP.md` for why they are not
deployed yet) **and** the client UI (for fast feedback / disabling buttons
that would be rejected anyway). It is not wired into any screen today; that
happens once the UI migrates to the new `Case` model (Phase 5+). Today it
exists as verified, ready-to-plug-in logic, not yet a live enforcement path.

## States

Matches `CaseStatus` in `src/domain/caseTypes.ts` and section 24 of the
brief:

| Status | FR label | EN label | Meaning |
|---|---|---|---|
| `new` | Nouveau | New | Just received, nothing done yet. |
| `triage` | Triage | Triage | Being screened for admissibility/duplication. |
| `under_review` | Revue de recevabilité | Under review | Admissibility review before assignment. |
| `assigned` | Affecté | Assigned | An investigator has been named but hasn't started work. |
| `investigation` | Investigation | Investigation | Active investigation work. |
| `pending_information` | En attente d'informations | Pending information | Paused, waiting on something external (a witness, a document, the reporter). |
| `escalated` | Escaladé | Escalated | Raised beyond the assigned investigator (e.g. seniority, conflict of interest, severity). |
| `conclusion_pending` | Conclusion en attente | Conclusion pending | Findings drafted, awaiting the functional review step. |
| `functional_review` | Revue fonctionnelle | Functional review | Under formal sign-off review. |
| `closed` | Clôturé | Closed | Done — see closure gating below; this is a **guarded** transition, not a free one. |
| `reopened` | Rouvert | Reopened | A closed case brought back for further work (e.g. new evidence). |
| `archived` | Archivé | Archived | Terminal. No transitions out. |
| `duplicate` | Doublon | Duplicate | Side-status: this report duplicates another. |
| `out_of_scope` | Hors périmètre | Out of scope | Side-status: outside the hotline's mandate. |

## Allowed transitions

This is the literal `ALLOWED_TRANSITIONS` adjacency list in `workflow.ts` —
the only source of truth for "what can follow what":

```
new                  → triage, duplicate, out_of_scope
triage               → under_review, duplicate, out_of_scope
under_review         → assigned, pending_information, duplicate, out_of_scope
assigned             → investigation, pending_information
investigation        → pending_information, escalated, conclusion_pending
pending_information  → investigation, assigned
escalated            → investigation, conclusion_pending
conclusion_pending   → functional_review, investigation   (sent back by review)
functional_review    → closed, investigation               (sent back by review)
closed               → reopened
reopened             → investigation
archived             → (terminal — nothing)
duplicate            → archived
out_of_scope         → archived
```

Two entry points into checking a transition:

- **`isStructurallyValidTransition(from, to)`** — pure graph lookup above.
  Also rejects `from === to` (a transition to the same status is never
  "allowed", it's a no-op the caller should not attempt).
- **`checkTransition(from, to, context)`** — the full check: runs the
  structural check first, then applies the one business precondition the
  brief calls out explicitly (closure gating, below). Returns
  `{ allowed: boolean; reason?: string }` so a caller (UI or Cloud Function)
  can show *why* a transition was refused, not just that it was.

## Closure gating (section 25 of the brief)

Transitioning **to `closed`** is the one transition with real preconditions
beyond "is this edge in the graph", checked in this order by
`checkTransition`:

1. **At least one allegation must exist.** A case with zero documented
   allegations cannot be closed (`allegations.length === 0` → refused).
2. **Every allegation must be assessed with a finding.** Any allegation
   whose `status !== 'assessed'` or whose `finding` is unset blocks closure;
   the refusal reason names how many are still outstanding.
3. **No corrective action may be left open.** Any `CorrectiveAction` with
   status `open`, `in_progress`, or `overdue` blocks closure (only
   `completed` or `not_applicable` are closure-safe); the refusal reason
   names how many remain.
4. **Functional review sign-off, only when arriving from `functional_review`.**
   If `from === 'functional_review'` and the caller didn't pass
   `hasFunctionalReviewSignOff: true` in the context, closure is refused.
   (Note: the graph above also allows `investigation → ??? `... actually
   `closed` is only reachable from `functional_review` per the adjacency
   list, so in practice this check always applies when closing — it's kept
   as an explicit, separately-named condition so the reason message stays
   precise if the graph is ever extended.)

All four checks are evaluated against whatever `context` the caller
supplies (`allegations`, `correctiveActions`, `hasFunctionalReviewSignOff`)
— `workflow.ts` never fetches data itself, so the caller (repository or
Cloud Function) is responsible for loading the real child-collection data
before calling `checkTransition`.

## Derived finding (never set by hand)

`deriveOverallFinding(allegations)` computes `Case.overallFinding` **only**
from the individual `Allegation.finding` values — there is deliberately no
code path that lets a human or an AI set `overallFinding` directly, per the
comment on the field in `caseTypes.ts`:

- Returns `undefined` if there are no allegations, or if any allegation
  still lacks a `finding` (not all assessed yet — no verdict to derive).
- `substantiated` — every allegation's finding is `SUBSTANTIATED`.
- `unsubstantiated` — every allegation's finding is `UNSUBSTANTIATED`.
- `mixed` — a mix that includes at least one `SUBSTANTIATED` or
  `PARTIALLY_SUBSTANTIATED` finding alongside others.
- `inconclusive` — the remaining case (e.g. all `INCONCLUSIVE`/`OUT_OF_SCOPE`/
  `DUPLICATE` findings, none fully substantiated or unsubstantiated).

## Where this plugs in

- **Today**: nowhere live yet — the shipped Phase 1 UI still runs on the
  legacy `AlertRecord` model, which has no workflow engine of its own. This
  module is additive, verified-correct groundwork for Phase 5+ (Case
  Management UI on the new model) and for the Cloud Functions in
  `functions/src/index.ts` (`changeCaseStatus` already imports and calls
  `checkTransition` — see that file — but is not deployed; see
  `docs/FIREBASE-SETUP.md`).
- **Enforcement boundary**: once Cloud Functions are deployed, `workflow.ts`
  running there is the real authority (a client can't bypass it — writes to
  `cases/**` are closed at the Firestore Security Rules level, `allow write:
  if false`, precisely so that every mutation, including status changes,
  must go through a Function that calls this same logic). Any client-side
  call to `checkTransition`/`isStructurallyValidTransition` before that is
  UX-only (disabling a button that would be rejected anyway) and must never
  be treated as the security boundary itself.
