/**
 * === AMÉLIORATION AJOUTÉE ===
 *
 * Real automated tests for the case workflow state machine
 * (src/domain/workflow.ts). Until now this logic had been verified only
 * by manual/live testing (see docs/PHASES.md, docs/WORKFLOW.md) and by
 * `tsc` type-checking — neither catches a logic regression. These tests
 * lock in exactly the behavior docs/WORKFLOW.md documents, so the two can
 * never silently drift apart: a change to workflow.ts that breaks one of
 * these should also mean docs/WORKFLOW.md needs updating, not the other
 * way around.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { Allegation, CaseStatus, CorrectiveAction } from './caseTypes';
import {
  checkTransition,
  deriveOverallFinding,
  isStructurallyValidTransition,
  ALLOWED_TRANSITIONS,
  setWorkflowTransitions,
  getWorkflowTransitions,
} from './workflow';

function allegation(overrides: Partial<Allegation> = {}): Allegation {
  return {
    allegationId: 'alg-1',
    caseId: 'case-1',
    category: 'fraud',
    subcategory: 'expense',
    description: 'test allegation',
    status: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'tester',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'tester',
    ...overrides,
  };
}

function correctiveAction(overrides: Partial<CorrectiveAction> = {}): CorrectiveAction {
  return {
    actionId: 'ca-1',
    caseId: 'case-1',
    description: 'test action',
    owner: 'someone',
    dueDate: '2026-02-01T00:00:00Z',
    priority: 'low',
    status: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'tester',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'tester',
    ...overrides,
  };
}

// === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
// Toujours revenir à la table par défaut après chaque test — l'état
// mutable de workflow.ts est un module-level singleton partagé par tous
// les tests de ce fichier (même worker), même principe que
// authz.test.ts pour domain/permissionOverrides.ts.
afterEach(() => {
  setWorkflowTransitions(ALLOWED_TRANSITIONS);
});

describe('setWorkflowTransitions / getWorkflowTransitions — editable overlay', () => {
  it('getWorkflowTransitions reflects the default table until something is pushed', () => {
    expect(getWorkflowTransitions()).toEqual(ALLOWED_TRANSITIONS);
  });

  it('isStructurallyValidTransition reflects a pushed override immediately', () => {
    expect(isStructurallyValidTransition('new', 'investigation')).toBe(false);
    const next: Record<CaseStatus, CaseStatus[]> = { ...ALLOWED_TRANSITIONS, new: [...ALLOWED_TRANSITIONS.new, 'investigation'] };
    setWorkflowTransitions(next);
    expect(isStructurallyValidTransition('new', 'investigation')).toBe(true);
  });

  it('still refuses a same-status transition regardless of the overlay content', () => {
    setWorkflowTransitions({ ...ALLOWED_TRANSITIONS, investigation: ['investigation'] });
    expect(isStructurallyValidTransition('investigation', 'investigation')).toBe(false);
  });
});

describe('isStructurallyValidTransition', () => {
  it('allows every transition listed in the adjacency table', () => {
    expect(isStructurallyValidTransition('new', 'triage')).toBe(true);
    expect(isStructurallyValidTransition('triage', 'under_review')).toBe(true);
    expect(isStructurallyValidTransition('under_review', 'assigned')).toBe(true);
    expect(isStructurallyValidTransition('assigned', 'investigation')).toBe(true);
    expect(isStructurallyValidTransition('investigation', 'escalated')).toBe(true);
    expect(isStructurallyValidTransition('escalated', 'conclusion_pending')).toBe(true);
    expect(isStructurallyValidTransition('conclusion_pending', 'functional_review')).toBe(true);
    expect(isStructurallyValidTransition('functional_review', 'closed')).toBe(true);
    expect(isStructurallyValidTransition('closed', 'reopened')).toBe(true);
    expect(isStructurallyValidTransition('reopened', 'investigation')).toBe(true);
    expect(isStructurallyValidTransition('duplicate', 'archived')).toBe(true);
    expect(isStructurallyValidTransition('out_of_scope', 'archived')).toBe(true);
  });

  it('rejects a transition to the same status', () => {
    expect(isStructurallyValidTransition('investigation', 'investigation')).toBe(false);
  });

  it('rejects a transition not in the adjacency table', () => {
    expect(isStructurallyValidTransition('new', 'closed')).toBe(false);
    expect(isStructurallyValidTransition('closed', 'new')).toBe(false);
  });

  it('treats archived as terminal — nothing leaves it', () => {
    expect(isStructurallyValidTransition('archived', 'reopened')).toBe(false);
    expect(isStructurallyValidTransition('archived', 'investigation')).toBe(false);
  });

  it('lets conclusion_pending and functional_review send a case back to investigation', () => {
    expect(isStructurallyValidTransition('conclusion_pending', 'investigation')).toBe(true);
    expect(isStructurallyValidTransition('functional_review', 'investigation')).toBe(true);
  });
});

describe('checkTransition — structural check', () => {
  it('refuses a structurally invalid transition with a reason', () => {
    const result = checkTransition('new', 'closed');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not part of the defined workflow/i);
  });

  it('allows a structurally valid transition that is not to "closed" with no further checks', () => {
    expect(checkTransition('new', 'triage').allowed).toBe(true);
    expect(checkTransition('assigned', 'pending_information').allowed).toBe(true);
  });
});

describe('checkTransition — closure gating (section 25 of the brief)', () => {
  it('refuses closure with zero allegations', () => {
    const result = checkTransition('functional_review', 'closed', { allegations: [], correctiveActions: [] });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/at least one allegation/i);
  });

  it('refuses closure while any allegation lacks a finding', () => {
    const result = checkTransition('functional_review', 'closed', {
      allegations: [allegation({ status: 'assessed', finding: 'SUBSTANTIATED' }), allegation({ allegationId: 'alg-2', status: 'open' })],
      correctiveActions: [],
      hasFunctionalReviewSignOff: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/1 allegation\(s\) have no documented finding/i);
  });

  it('refuses closure while a corrective action is open, overdue, or in progress', () => {
    for (const status of ['open', 'overdue', 'in_progress'] as const) {
      const result = checkTransition('functional_review', 'closed', {
        allegations: [allegation({ status: 'assessed', finding: 'SUBSTANTIATED' })],
        correctiveActions: [correctiveAction({ status })],
        hasFunctionalReviewSignOff: true,
      });
      expect(result.allowed, `status=${status} should block closure`).toBe(false);
      expect(result.reason).toMatch(/corrective action\(s\) are not completed/i);
    }
  });

  it('allows closure once corrective actions are completed or not_applicable', () => {
    for (const status of ['completed', 'not_applicable'] as const) {
      const result = checkTransition('functional_review', 'closed', {
        allegations: [allegation({ status: 'assessed', finding: 'SUBSTANTIATED' })],
        correctiveActions: [correctiveAction({ status })],
        hasFunctionalReviewSignOff: true,
      });
      expect(result.allowed, `status=${status} should not block closure`).toBe(true);
    }
  });

  it('refuses closure from functional_review without sign-off, even with everything else satisfied', () => {
    const result = checkTransition('functional_review', 'closed', {
      allegations: [allegation({ status: 'assessed', finding: 'SUBSTANTIATED' })],
      correctiveActions: [correctiveAction({ status: 'completed' })],
      hasFunctionalReviewSignOff: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/sign-off is required/i);
  });

  it('allows closure once every condition is satisfied', () => {
    const result = checkTransition('functional_review', 'closed', {
      allegations: [allegation({ status: 'assessed', finding: 'UNSUBSTANTIATED' })],
      correctiveActions: [correctiveAction({ status: 'not_applicable' })],
      hasFunctionalReviewSignOff: true,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('does not apply closure gating to transitions other than "closed"', () => {
    // investigation -> escalated is structurally valid and not a closure,
    // so it must not be blocked by empty allegations/corrective actions.
    const result = checkTransition('investigation', 'escalated', { allegations: [], correctiveActions: [] });
    expect(result.allowed).toBe(true);
  });
});

describe('deriveOverallFinding', () => {
  it('returns undefined for zero allegations', () => {
    expect(deriveOverallFinding([])).toBeUndefined();
  });

  it('returns undefined while any allegation is not yet assessed', () => {
    expect(deriveOverallFinding([allegation({ finding: 'SUBSTANTIATED' }), allegation({ allegationId: 'alg-2' })])).toBeUndefined();
  });

  it('returns "substantiated" when every finding is SUBSTANTIATED', () => {
    expect(
      deriveOverallFinding([allegation({ finding: 'SUBSTANTIATED' }), allegation({ allegationId: 'alg-2', finding: 'SUBSTANTIATED' })])
    ).toBe('substantiated');
  });

  it('returns "unsubstantiated" when every finding is UNSUBSTANTIATED', () => {
    expect(deriveOverallFinding([allegation({ finding: 'UNSUBSTANTIATED' })])).toBe('unsubstantiated');
  });

  it('returns "mixed" when findings include at least one SUBSTANTIATED or PARTIALLY_SUBSTANTIATED alongside others', () => {
    expect(
      deriveOverallFinding([allegation({ finding: 'SUBSTANTIATED' }), allegation({ allegationId: 'alg-2', finding: 'UNSUBSTANTIATED' })])
    ).toBe('mixed');
    expect(
      deriveOverallFinding([
        allegation({ finding: 'PARTIALLY_SUBSTANTIATED' }),
        allegation({ allegationId: 'alg-2', finding: 'INCONCLUSIVE' }),
      ])
    ).toBe('mixed');
  });

  it('returns "inconclusive" for a remaining mix with no substantiated/partially-substantiated finding', () => {
    expect(
      deriveOverallFinding([allegation({ finding: 'INCONCLUSIVE' }), allegation({ allegationId: 'alg-2', finding: 'OUT_OF_SCOPE' })])
    ).toBe('inconclusive');
  });
});
