import { describe, expect, it } from 'vitest';
import { reporterCaseToAlertRecord, ReporterCasePayload } from './reporterCaseToAlert';
import { AlertRecord } from '../types';

const payload = (over: Partial<ReporterCasePayload> = {}): ReporterCasePayload => ({
  caseNumber: 'CASE-2026-000012',
  status: 'investigation',
  receivedAt: '2026-10-01T08:00:00.000Z',
  description: 'Faits décrits au dépôt.',
  communications: [
    { messageId: 'm2', caseId: 'c1', sender: 'investigator', senderDisplayName: 'Équipe', content: 'Merci', createdAt: '2026-10-02T09:00:00.000Z', createdBy: 'u1', updatedAt: '2026-10-02T09:00:00.000Z' } as never,
    { messageId: 'm1', caseId: 'c1', sender: 'reporter', senderDisplayName: 'Déclarant', content: 'Bonjour', createdAt: '2026-10-01T09:00:00.000Z', createdBy: 'reporter', updatedAt: '2026-10-01T09:00:00.000Z' } as never,
  ],
  reporterCase: {
    externalReference: 'AACMR-26-10-0001',
    category: 'Fraude',
    subcategory: 'Corruption',
    country: 'CMR',
    entity: 'ACTIVA Assurances',
    reportingMode: 'anonymous',
    incidentDate: null,
    updatedAt: '2026-10-02T09:00:00.000Z',
    closedAt: null,
  },
  ...over,
});

describe('reporterCaseToAlertRecord', () => {
  it('construit le dossier vu par le déclarant depuis Firebase seul', () => {
    const a = reporterCaseToAlertRecord(payload(), 'aacmr-26-10-0001');
    expect(a.trackingNumber).toBe('AACMR-26-10-0001');
    expect(a.status).toBe('investigation');
    expect(a.category).toBe('Fraude');
    expect(a.concernedEntity).toBe('ACTIVA Assurances');
    expect(a.whistleblower.isAnonymous).toBe(true);
    expect(a.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(a.messages[0].sender).toBe('whistleblower');
    expect(a.messages[1].sender).toBe('investigator');
    expect(a.evidences).toEqual([]);
  });

  it('garde la copie locale (pièces jointes, lieu) et prend statut et messages de Firebase', () => {
    const existing = {
      id: 'alert-local-1',
      trackingNumber: 'AACMR-26-10-0001',
      createdAt: '2026-10-01T07:59:00.000Z',
      updatedAt: '2026-10-01T07:59:00.000Z',
      incidentLocation: 'Douala',
      incidentDates: 'Mars 2026',
      evidences: [{ id: 'f1', name: 'preuve.pdf', size: 10, type: 'application/pdf', uploadedAt: '2026-10-01T08:00:00.000Z' }],
      status: 'new',
      messages: [],
      whistleblower: { isAnonymous: false, fullName: 'X' },
      category: 'Ancienne',
    } as unknown as AlertRecord;
    const a = reporterCaseToAlertRecord(payload(), 'AACMR-26-10-0001', existing);
    expect(a.id).toBe('alert-local-1');
    expect(a.incidentLocation).toBe('Douala');
    expect(a.incidentDates).toBe('Mars 2026');
    expect(a.evidences).toHaveLength(1);
    expect(a.status).toBe('investigation');
    expect(a.messages).toHaveLength(2);
    expect(a.category).toBe('Fraude');
  });

  it('reste utilisable avec des fonctions déployées plus anciennes (sans reporterCase)', () => {
    const a = reporterCaseToAlertRecord(payload({ reporterCase: undefined, status: 'closed' }), 'AACMR-26-10-0001');
    expect(a.trackingNumber).toBe('AACMR-26-10-0001');
    expect(a.status).toBe('closed');
    expect(a.detailedDescription).toBe('Faits décrits au dépôt.');
  });
});
