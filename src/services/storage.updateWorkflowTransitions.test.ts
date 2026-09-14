/**
 * === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
 * Intégration contre le singleton `storage` réel, même convention que
 * storage.updateRolePermissions.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { checkTransition } from '../domain/workflow';

describe('storage.updateWorkflowTransitions', () => {
  it('persists a transition change and reflects it immediately in checkTransition', () => {
    // 'new' can never reach 'investigation' directly by default.
    expect(checkTransition('new', 'investigation').allowed).toBe(false);

    const before = storage.getWorkflowTransitions();
    storage.updateWorkflowTransitions('new', [...before.new, 'investigation'], storage.getActiveUser());

    expect(storage.getWorkflowTransitions().new).toContain('investigation');
    expect(checkTransition('new', 'investigation').allowed).toBe(true);

    // Revert so this file's other tests (and any re-run) see a clean baseline.
    storage.updateWorkflowTransitions('new', before.new, storage.getActiveUser());
    expect(checkTransition('new', 'investigation').allowed).toBe(false);
  });

  it('logs a CONFIG_UPDATED audit entry naming the edited status', () => {
    const before = storage.getWorkflowTransitions();
    const auditCountBefore = storage.getAuditLogs().length;

    storage.updateWorkflowTransitions('archived', [...before.archived], storage.getActiveUser());

    expect(storage.getAuditLogs().length).toBe(auditCountBefore + 1);
    expect(storage.getAuditLogs()[0].actionType).toBe('CONFIG_UPDATED');
    expect(storage.getAuditLogs()[0].details).toContain('archived');
  });

  it('does not affect other statuses', () => {
    const before = storage.getWorkflowTransitions();
    storage.updateWorkflowTransitions('triage', [], storage.getActiveUser());

    expect(storage.getWorkflowTransitions().investigation).toEqual(before.investigation);
    expect(checkTransition('investigation', 'escalated').allowed).toBe(true);

    // Revert.
    storage.updateWorkflowTransitions('triage', before.triage, storage.getActiveUser());
  });

  it('still rejects a same-status transition even if a status were (mis)configured to include itself', () => {
    const before = storage.getWorkflowTransitions();
    storage.updateWorkflowTransitions('investigation', [...before.investigation, 'investigation'], storage.getActiveUser());

    expect(checkTransition('investigation', 'investigation').allowed).toBe(false);

    storage.updateWorkflowTransitions('investigation', before.investigation, storage.getActiveUser());
  });
});
