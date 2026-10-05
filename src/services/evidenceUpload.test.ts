/** === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 2) === */
import { describe, expect, it } from 'vitest';
import { base64Size, dataUrlToBase64, pendingSubmissionFiles } from './evidenceUpload';

describe('evidenceUpload', () => {
  it('extrait le contenu base64 et sa taille réelle', () => {
    const b64 = dataUrlToBase64('data:application/pdf;base64,SGVsbG8=');
    expect(b64).toBe('SGVsbG8=');
    expect(base64Size(b64)).toBe(5);
  });

  it('ne retient que les fichiers avec contenu, pas encore transmis', () => {
    const alert = {
      trackingNumber: 'aacmr-26-10-0005',
      evidences: [
        { id: 'e1', name: 'a.pdf', size: 1, type: 'application/pdf', uploadedAt: '', dataUrl: 'data:x;base64,QQ==' },
        { id: 'e2', name: 'b.pdf', size: 1, type: 'application/pdf', uploadedAt: '', dataUrl: 'data:x;base64,QQ==' },
        { id: 'e3', name: 'c.pdf', size: 1, type: 'application/pdf', uploadedAt: '' },
        { id: 'e4', name: 'd.pdf', size: 1, type: 'application/pdf', uploadedAt: '', dataUrl: 'data:x;base64,QQ==', cloudCaseId: 'c' },
      ],
    };
    expect(pendingSubmissionFiles(alert, { 'AACMR-26-10-0005': ['e2'] }).map((e) => e.id)).toEqual(['e1']);
    expect(pendingSubmissionFiles(undefined, {})).toEqual([]);
  });
});
