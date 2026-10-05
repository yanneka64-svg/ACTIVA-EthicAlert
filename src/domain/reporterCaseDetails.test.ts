/**
 * === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER dans Firebase) ===
 */
import { describe, expect, it } from 'vitest';
import { parseHashedAccessCode, REPORTER_DETAILS_LIMITS, sanitizeReporterCaseDetails } from './reporterCaseDetails';
import { parseReporterCaseInput } from './reporterCaseInput';

const NOW = Date.parse('2026-10-05T10:00:00Z');

const full = {
  incidentDates: '2026-09-12',
  incidentLocation: 'Douala, siège',
  isOngoing: true,
  impactType: 'Financier',
  estimatedImpactValue: '5 000 000 XAF',
  customViolationType: 'Détournement de primes',
  slaDueAt: '2026-10-20T10:00:00.000Z',
  risk: { financialImpact: 3, hierarchicalLevel: 2, recurrence: 1, reputationRisk: 2, totalScore: 8, priority: 'high' },
  persons: [
    { kind: 'subject', name: 'J. Dupont', position: 'Chef comptable', hierarchyLevel: 'manager' },
    { kind: 'witness', name: 'A. Martin' },
  ],
  identity: { fullName: 'Marie N.', email: 'marie@example.com', phone: '+237 600 000 000' },
  evidence: [{ name: 'facture.pdf', type: 'application/pdf', size: 1024 }],
};

describe('sanitizeReporterCaseDetails', () => {
  it('conserve tous les champs valides du formulaire', () => {
    expect(sanitizeReporterCaseDetails(full, 'identified', NOW)).toEqual(full);
  });

  it("n'enregistre l'identité qu'en mode identifié", () => {
    const d = sanitizeReporterCaseDetails(full, 'anonymous', NOW);
    expect(d.identity).toBeUndefined();
    expect(d.persons).toHaveLength(2);
  });

  it('tronque les textes trop longs au lieu de refuser', () => {
    const d = sanitizeReporterCaseDetails({ incidentLocation: 'x'.repeat(5000) }, 'anonymous', NOW);
    expect(d.incidentLocation).toHaveLength(REPORTER_DETAILS_LIMITS.text);
  });

  it('ignore les entrées invalides sans rejeter le reste', () => {
    const d = sanitizeReporterCaseDetails(
      {
        incidentDates: 42,
        risk: { financialImpact: 9, hierarchicalLevel: 1, recurrence: 1, reputationRisk: 1, totalScore: 4, priority: 'low' },
        persons: [{ kind: 'boss', name: 'X' }, { kind: 'subject', name: '   ' }, { kind: 'witness', name: 'Témoin', hierarchyLevel: 'king' }],
        evidence: [{ name: '' }, { name: 'photo.jpg', size: -5 }],
        slaDueAt: '2099-01-01',
        status: 'closed',
      },
      'anonymous',
      NOW
    );
    expect(d).toEqual({
      persons: [{ kind: 'witness', name: 'Témoin' }],
      evidence: [{ name: 'photo.jpg', type: 'application/octet-stream', size: 0 }],
    });
  });

  it('borne le nombre de personnes et de pièces', () => {
    const d = sanitizeReporterCaseDetails(
      {
        persons: Array.from({ length: 100 }, (_, i) => ({ kind: 'subject', name: `P${i}` })),
        evidence: Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 })),
      },
      'anonymous',
      NOW
    );
    expect(d.persons).toHaveLength(REPORTER_DETAILS_LIMITS.persons);
    expect(d.evidence).toHaveLength(REPORTER_DETAILS_LIMITS.evidence);
  });

  it('renvoie un objet vide pour une entrée inutilisable', () => {
    expect(sanitizeReporterCaseDetails(null, 'anonymous', NOW)).toEqual({});
    expect(sanitizeReporterCaseDetails('x', 'anonymous', NOW)).toEqual({});
    expect(sanitizeReporterCaseDetails([full], 'anonymous', NOW)).toEqual({});
  });
});

describe('parseHashedAccessCode', () => {
  const hex = 'a'.repeat(64);
  it('accepte une empreinte PBKDF2 standard ou ancienne, avec un sel hexadécimal', () => {
    expect(parseHashedAccessCode(`pbkdf2_sha256$600000$${hex}`, 'abcdef0123456789')).not.toBeNull();
    expect(parseHashedAccessCode(hex, 'abcdef0123456789')).not.toBeNull();
  });
  it("refuse un nombre d'itérations choisi par l'appelant ou un format inconnu", () => {
    expect(parseHashedAccessCode(`pbkdf2_sha256$99999999$${hex}`, 'abcdef0123456789')).toBeNull();
    expect(parseHashedAccessCode('plaintext', 'abcdef0123456789')).toBeNull();
    expect(parseHashedAccessCode(hex, 'not-hex!')).toBeNull();
    expect(parseHashedAccessCode(hex, undefined)).toBeNull();
  });
});

describe('parseReporterCaseInput — détails', () => {
  const base = { category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA Assurances', description: 'Faits.' };

  it('transmet les détails nettoyés et ne refuse jamais à cause d’eux', () => {
    const r = parseReporterCaseInput({ ...base, reportingMode: 'identified', details: { ...full, persons: 'oops' } });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.details?.identity?.fullName).toBe('Marie N.');
    expect(r.ok && r.value.details?.persons).toBeUndefined();
  });

  it("accepte l'empreinte d'un signalement ancien seulement sans code en clair", () => {
    const hash = `pbkdf2_sha256$600000$${'b'.repeat(64)}`;
    const ok = parseReporterCaseInput({ ...base, accessCodeHash: hash, accessCodeSalt: '0123456789abcdef' });
    expect(ok.ok && ok.value.accessCodeHash).toBe(hash);
    const withCode = parseReporterCaseInput({ ...base, accessCode: 'Hk7mPq2Rz', accessCodeHash: hash, accessCodeSalt: '0123456789abcdef' });
    expect(withCode.ok && withCode.value.accessCodeHash).toBeUndefined();
    const bad = parseReporterCaseInput({ ...base, accessCodeHash: 'x', accessCodeSalt: 'y' });
    expect(bad.ok && bad.value.accessCodeHash).toBeUndefined();
  });
});
