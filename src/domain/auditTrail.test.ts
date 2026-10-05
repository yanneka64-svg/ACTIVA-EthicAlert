/** === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 4) === */
import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../types';
import { mergeAuditLogs, sanitizePortalAuditBatch, serverAuditToEntry } from './auditTrail';

const local = (id: string, ts: string): AuditLogEntry =>
  ({ id, authorId: 'u', authorName: 'Op', authorRole: 'operator', actionType: 'MESSAGE_SENT', details: 'local', timestamp: ts }) as AuditLogEntry;

describe('sanitizePortalAuditBatch', () => {
  it('garde les entrées valides, ignore les autres', () => {
    const out = sanitizePortalAuditBatch([
      { id: 'aud-1', actionType: 'MESSAGE_SENT', details: 'x', timestamp: '2026-10-05T10:00:00.000Z', trackingNumber: 'AIIG-26-10-0001' },
      { id: '../bad', actionType: 'MESSAGE_SENT', timestamp: '2026-10-05T10:00:00.000Z' },
      { id: 'aud-2', actionType: 'drop table', timestamp: '2026-10-05T10:00:00.000Z' },
      { id: 'aud-3', actionType: 'MESSAGE_SENT', timestamp: 'hier' },
    ]);
    expect(out).toEqual([{ id: 'aud-1', actionType: 'MESSAGE_SENT', details: 'x', trackingNumber: 'AIIG-26-10-0001', timestamp: '2026-10-05T10:00:00.000Z' }]);
  });
  it('refuse un lot vide ou trop grand', () => {
    expect(() => sanitizePortalAuditBatch([])).toThrow();
    expect(() => sanitizePortalAuditBatch(new Array(51).fill({}))).toThrow();
  });
});

describe('mergeAuditLogs', () => {
  it('journal du serveur + événements locaux non transmis, sans doublon, du plus récent au plus ancien', () => {
    const merged = mergeAuditLogs(
      [local('aud-1', '2026-10-05T10:00:00.000Z'), local('aud-2', '2026-10-05T12:00:00.000Z')],
      [
        { id: 'portal-u-aud-1', source: 'portal', portalEntryId: 'aud-1', action: 'MESSAGE_SENT', details: 'serveur', actorName: 'Op', timestamp: '2026-10-05T10:00:00.000Z', ipAddress: '41.1.2.3' },
        { id: 'audv2-x', source: 'server', action: 'CASE_ASSIGNED', actorId: 'uid', actorName: 'Admin', trackingNumber: 'AIIG-26-10-0001', timestamp: '2026-10-05T11:00:00.000Z' },
      ]
    );
    expect(merged.map((e) => e.id)).toEqual(['aud-2', 'audv2-x', 'aud-1']);
    expect(merged.find((e) => e.id === 'aud-1')?.ipAddress).toBe('41.1.2.3');
    expect(merged.find((e) => e.id === 'audv2-x')?.details).toContain('Attribution');
  });
  it('sans réponse du serveur : journal local inchangé', () => {
    const l = [local('aud-1', '2026-10-05T10:00:00.000Z')];
    expect(mergeAuditLogs(l, null)).toBe(l);
  });
  it('déclarant et maintenance nommés', () => {
    expect(serverAuditToEntry({ id: 'a', action: 'CASE_CREATED_BY_REPORTER', actorId: 'reporter', timestamp: 't' }).authorName).toBe('Lanceur d’alerte');
  });
});
