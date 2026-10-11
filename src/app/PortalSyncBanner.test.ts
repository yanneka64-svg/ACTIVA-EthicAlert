/** === AMÉLIORATION AJOUTÉE (modifications simultanées et envois en échec) === */
import { describe, expect, it, vi } from 'vitest';
vi.mock('../services/storage', () => ({ storage: { getAlerts: () => [], getActiveUser: () => null } }));
import { issueFromDetail } from './PortalSyncBanner';

describe('PortalSyncBanner — quel bandeau afficher', () => {
  it('rien quand tout est enregistré', () => {
    expect(issueFromDetail({ caseId: 'c', ok: true })).toBeNull();
  });
  it('conflit, refus, attente', () => {
    expect(issueFromDetail({ caseId: 'c', ok: true, conflicts: ['closureSummary'] })?.kind).toBe('conflict');
    expect(issueFromDetail({ caseId: 'c', ok: false, error: 'denied' })?.kind).toBe('rejected');
    expect(issueFromDetail({ caseId: 'c', ok: false, pending: true })?.kind).toBe('pending');
  });
});
