/**
 * ACTIVA Hotline — Case workflow state machine (Phase 2)
 *
 * Pure, storage-agnostic logic: given a current CaseStatus and a target
 * CaseStatus, says whether the transition is allowed, and (for the ones the
 * brief calls out explicitly) what preconditions must hold first.
 *
 * This module does not touch the DOM, Firestore, or localStorage — it is
 * meant to be called from BOTH the future Cloud Functions (server-side
 * enforcement, the real authority) and the client UI (fast feedback / disabling
 * buttons that would be rejected anyway). It is not wired into any screen yet;
 * that happens once the UI migrates to the new Case model (Phase 5+).
 */

import { Case, CaseStatus, CorrectiveAction, Allegation } from './caseTypes';

/**
 * Adjacency list of allowed transitions, matching section 24 of the brief:
 *   NEW → TRIAGE → UNDER_REVIEW → ASSIGNED → INVESTIGATION → PENDING_INFORMATION
 *   → ESCALATED → CONCLUSION_PENDING → FUNCTIONAL_REVIEW → CLOSED → REOPENED → ARCHIVED
 * plus the side-statuses (DUPLICATE, OUT_OF_SCOPE) reachable only from early triage,
 * and REOPENED looping back into INVESTIGATION.
 *
 * === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
 * Exportée (était privée à ce module) et renommée en DEFAULT_TRANSITIONS
 * dans son rôle : c'est désormais la valeur PAR DÉFAUT/de repli, jamais
 * modifiée elle-même — storage.ts en seed une copie mutable et persistée
 * (même motif seed-then-mutate que hierarchyLevels/rolePermissions), que
 * `setWorkflowTransitions()` ci-dessous pousse dans l'état effectif que
 * `isStructurallyValidTransition` consulte réellement. Contrairement à
 * domain/permissions.ts (voir domain/permissionOverrides.ts), ce module
 * n'a AUCUNE dépendance transitive vers services/storage.ts ou
 * services/authz.ts (seul `./caseTypes`, un module de purs types) — l'état
 * mutable peut donc vivre directement ici, sans fichier-pont séparé, tout
 * en restant "storage-agnostic" au sens où ce fichier n'importe jamais
 * storage.ts lui-même (c'est storage.ts qui l'appelle, jamais l'inverse).
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ['triage', 'duplicate', 'out_of_scope'],
  triage: ['under_review', 'duplicate', 'out_of_scope'],
  under_review: ['assigned', 'pending_information', 'duplicate', 'out_of_scope'],
  assigned: ['investigation', 'pending_information'],
  investigation: ['pending_information', 'escalated', 'conclusion_pending'],
  pending_information: ['investigation', 'assigned'],
  escalated: ['investigation', 'conclusion_pending'],
  conclusion_pending: ['functional_review', 'investigation'], // back to investigation if review sends it back
  functional_review: ['closed', 'investigation'],
  closed: ['reopened'],
  reopened: ['investigation'],
  archived: [], // terminal
  duplicate: ['archived'],
  out_of_scope: ['archived'],
};

// === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
// État effectif consulté par isStructurallyValidTransition — tant que
// storage.ts n'a rien poussé (ex. ce module utilisé isolément, ou par les
// tests de workflow.test.ts, qui n'importent jamais storage.ts), reste
// strictement égal à ALLOWED_TRANSITIONS : comportement inchangé pour
// quiconque n'édite jamais cette table en administration.
let effectiveTransitions: Record<CaseStatus, CaseStatus[]> = ALLOWED_TRANSITIONS;

/** Appelé par storage.ts — jamais directement par un écran. */
export function setWorkflowTransitions(next: Record<CaseStatus, CaseStatus[]>): void {
  effectiveTransitions = next;
}

export function getWorkflowTransitions(): Record<CaseStatus, CaseStatus[]> {
  return effectiveTransitions;
}

export interface TransitionCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Pure structural check: is `to` reachable from `from` at all? */
export function isStructurallyValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return false;
  return effectiveTransitions[from]?.includes(to) ?? false;
}

/**
 * Full check including the business preconditions called out explicitly in the
 * brief (closure gating, escalation only from an active investigation, etc.).
 * `caseRecord` may be a partial Case plus its child collections already
 * fetched by the caller (repository / Cloud Function) — this function never
 * fetches data itself, it only evaluates what it is given.
 */
export function checkTransition(
  from: CaseStatus,
  to: CaseStatus,
  context: {
    allegations?: Allegation[];
    correctiveActions?: CorrectiveAction[];
    hasFunctionalReviewSignOff?: boolean;
  } = {}
): TransitionCheckResult {
  if (!isStructurallyValidTransition(from, to)) {
    return { allowed: false, reason: `Transition ${from} → ${to} is not part of the defined workflow.` };
  }

  // CLOSURE CONTROL (section 25 of the brief):
  //   All allegations assessed + findings documented + corrective actions
  //   documented + required review completed.
  if (to === 'closed') {
    const allegations = context.allegations ?? [];
    const unassessed = allegations.filter((a) => a.status !== 'assessed' || !a.finding);
    if (allegations.length === 0) {
      return { allowed: false, reason: 'At least one allegation must be documented before closure.' };
    }
    if (unassessed.length > 0) {
      return {
        allowed: false,
        reason: `${unassessed.length} allegation(s) have no documented finding yet.`,
      };
    }

    const actions = context.correctiveActions ?? [];
    const openActions = actions.filter((a) => a.status === 'open' || a.status === 'overdue' || a.status === 'in_progress');
    if (openActions.length > 0) {
      return {
        allowed: false,
        reason: `${openActions.length} corrective action(s) are not completed or marked not applicable.`,
      };
    }

    if (from === 'functional_review' && !context.hasFunctionalReviewSignOff) {
      return { allowed: false, reason: 'Functional review sign-off is required before closure.' };
    }
  }

  return { allowed: true };
}

/** Derives Case.overallFinding from the individual allegation findings — never set by hand. */
export function deriveOverallFinding(allegations: Allegation[]): Case['overallFinding'] | undefined {
  if (allegations.length === 0) return undefined;
  const findings = allegations.map((a) => a.finding).filter(Boolean);
  if (findings.length < allegations.length) return undefined; // not all allegations assessed yet

  const substantiatedCount = findings.filter((f) => f === 'SUBSTANTIATED').length;
  const partialCount = findings.filter((f) => f === 'PARTIALLY_SUBSTANTIATED').length;
  const unsubstantiatedCount = findings.filter((f) => f === 'UNSUBSTANTIATED').length;

  if (substantiatedCount === findings.length) return 'substantiated';
  if (unsubstantiatedCount === findings.length) return 'unsubstantiated';
  if (substantiatedCount > 0 || partialCount > 0) return 'mixed';
  return 'inconclusive';
}

/** Human-readable label helper, FR/EN — used by future UI, not by logic. */
export const CASE_STATUS_LABELS: Record<CaseStatus, { fr: string; en: string }> = {
  new: { fr: 'Nouveau', en: 'New' },
  triage: { fr: 'Triage', en: 'Triage' },
  under_review: { fr: 'Revue de recevabilité', en: 'Under review' },
  assigned: { fr: 'Affecté', en: 'Assigned' },
  investigation: { fr: 'Investigation', en: 'Investigation' },
  pending_information: { fr: 'En attente d’informations', en: 'Pending information' },
  escalated: { fr: 'Escaladé', en: 'Escalated' },
  conclusion_pending: { fr: 'Conclusion en attente', en: 'Conclusion pending' },
  functional_review: { fr: 'Revue fonctionnelle', en: 'Functional review' },
  closed: { fr: 'Clôturé', en: 'Closed' },
  reopened: { fr: 'Rouvert', en: 'Reopened' },
  archived: { fr: 'Archivé', en: 'Archived' },
  duplicate: { fr: 'Doublon', en: 'Duplicate' },
  out_of_scope: { fr: 'Hors périmètre', en: 'Out of scope' },
};
