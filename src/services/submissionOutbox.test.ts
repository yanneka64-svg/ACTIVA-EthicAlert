/**
 * === AMÉLIORATION AJOUTÉE (aucun signalement perdu) ===
 * File d'attente des signalements : jamais de suppression d'un envoi
 * refusé, renvoi sans détails, rattrapage des signalements restés sur
 * l'appareil. Aucun appel réseau réel (mocks).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertRecord } from '../types';

const mockSubmit = vi.fn();
const mockLink = vi.fn();
let alerts: AlertRecord[] = [];

vi.mock('./casesCloudSync', () => ({
  submitReportToBackend: (...args: unknown[]) => mockSubmit(...args),
}));
vi.mock('./storage', () => ({
  storage: {
    getAlerts: () => alerts,
    linkMirroredCase: (...args: unknown[]) => mockLink(...args),
  },
}));

import { enqueueLocalOnlyReports, enqueueSubmission, flushSubmissionOutbox, pendingSubmissionCount } from './submissionOutbox';

const KEY = 'activa_submission_outbox_v1';
const store = new Map<string, string>();

function localAlert(id: string, extra: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id,
    trackingNumber: 'AACMR-26-10-0001',
    channel: 'web',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    whistleblower: { isAnonymous: true },
    category: 'Fraude',
    subCategory: '',
    detailedDescription: 'Faits',
    incidentDates: '',
    incidentLocation: '',
    concernedEntity: 'ACTIVA',
    country: 'Cameroun',
    riskEvaluation: { financialImpact: 1, hierarchyLevel: 1, recidivism: 1, reputationRisk: 1, totalScore: 4, nocaThreshold: 'NOCA 1', priority: 'faible', expectedTreatment: '' },
    involvedPersons: [{ id: 'p', name: 'X', position: 'Y', hierarchyRole: 'Employé' }],
    witnesses: [],
    evidences: [],
    status: 'new',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...extra,
  } as AlertRecord;
}

const items = () => JSON.parse(store.get(KEY) ?? '[]');

beforeEach(() => {
  store.clear();
  alerts = [];
  mockSubmit.mockReset();
  mockLink.mockReset();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

const input = { category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA', description: 'Faits', reportingMode: 'anonymous' as const, confidentialityLevel: 'confidential' as const, details: { incidentLocation: 'Douala' } };

describe('flushSubmissionOutbox', () => {
  it('lie le dossier et vide la file en cas de succès', async () => {
    enqueueSubmission('alt-1', input);
    mockSubmit.mockResolvedValue({ ok: true, result: { caseId: 'case-1', caseNumber: 'CASE-2026-000009' } });
    await expect(flushSubmissionOutbox()).resolves.toBe(1);
    expect(mockLink).toHaveBeenCalledWith('alt-1', 'case-1', 'CASE-2026-000009');
    expect(pendingSubmissionCount()).toBe(0);
  });

  it('garde le signalement en cas d’erreur réseau', async () => {
    enqueueSubmission('alt-1', input);
    mockSubmit.mockResolvedValue({ ok: false, retryable: true });
    await flushSubmissionOutbox();
    expect(items()).toMatchObject([{ localId: 'alt-1', attempts: 1 }]);
  });

  it('après un refus, renvoie sans les détails puis conserve le signalement (jamais supprimé)', async () => {
    enqueueSubmission('alt-1', input);
    mockSubmit.mockResolvedValue({ ok: false, retryable: false });
    await flushSubmissionOutbox();
    expect(items()[0].detailsStripped).toBe(true);
    expect(items()[0].input.details).toBeUndefined();
    expect(items()[0].input.description).toBe('Faits');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    await flushSubmissionOutbox();
    expect(items()).toHaveLength(1);
    expect(items()[0].rejectedAt).toBeTruthy();

    // Refusé il y a moins de 24 h : pas de nouvel essai immédiat.
    mockSubmit.mockClear();
    await flushSubmissionOutbox();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('enqueueLocalOnlyReports', () => {
  it('ajoute une seule fois chaque signalement public jamais transmis', () => {
    alerts = [
      localAlert('alt-1759650000000'),
      localAlert('alt-1759650000001', { mirroredCaseId: 'case-1' }),
      localAlert('alt-001'),
      localAlert('alt-1759650000002', { channel: 'direct' }),
    ];
    expect(enqueueLocalOnlyReports()).toBe(1);
    expect(enqueueLocalOnlyReports()).toBe(0);
    const [item] = items();
    expect(item.localId).toBe('alt-1759650000000');
    expect(item.input).toMatchObject({ externalReference: 'AACMR-26-10-0001', submissionId: 'backfill-alt-1759650000000' });
    expect(item.input.details.persons).toEqual([{ kind: 'subject', name: 'X', position: 'Y', hierarchyLevel: 'employee' }]);
  });

  it('ne remplace pas un envoi déjà en file pour le même signalement', () => {
    alerts = [localAlert('alt-1759650000000')];
    enqueueSubmission('alt-1759650000000', input);
    expect(enqueueLocalOnlyReports()).toBe(0);
    expect(items()[0].input.submissionId).toBeUndefined();
  });
});
