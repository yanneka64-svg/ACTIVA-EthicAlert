/**
 * === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
 * Tests de la logique pure de recherche multicritère.
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord } from '../types';
import { searchAlerts, hasActiveCriteria } from './advancedSearch';

function makeAlert(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'alt-1',
    trackingNumber: 'ACT-2026-0001',
    accessCodeHash: 'x',
    accessCodeSalt: 'y',
    channel: 'web',
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-06-15T10:00:00Z',
    whistleblower: { isAnonymous: true },
    category: 'Fraude, Corruption et pots-de-vin',
    subCategory: 'Corruption, pots-de-vin',
    detailedDescription: 'Soupçon de versement occulte à un fournisseur.',
    incidentDates: '2026-06-01',
    incidentLocation: 'Siège Douala',
    concernedEntity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countryId: 'CM',
    entityId: 'cm_assurances',
    riskEvaluation: {
      financialImpact: 2,
      hierarchyLevel: 2,
      recidivism: 1,
      reputationRisk: 2,
      totalScore: 7,
      nocaThreshold: 'NOCA 2',
      priority: 'elevee',
      expectedTreatment: 'x',
    },
    impactType: 'x',
    involvedPersons: [],
    witnesses: [],
    evidences: [],
    status: 'investigation',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...overrides,
  };
}

describe('searchAlerts — keyword', () => {
  it('matches on tracking number, category, description, entity or location', () => {
    const alert = makeAlert();
    expect(searchAlerts([alert], { keyword: 'ACT-2026-0001' })).toHaveLength(1);
    expect(searchAlerts([alert], { keyword: 'corruption' })).toHaveLength(1);
    expect(searchAlerts([alert], { keyword: 'fournisseur' })).toHaveLength(1);
    expect(searchAlerts([alert], { keyword: 'douala' })).toHaveLength(1);
    expect(searchAlerts([alert], { keyword: 'no-match-here' })).toEqual([]);
  });

  it('is case-insensitive and trims whitespace', () => {
    const alert = makeAlert();
    expect(searchAlerts([alert], { keyword: '  CORRUPTION  ' })).toHaveLength(1);
  });
});

describe('searchAlerts — structured filters', () => {
  it('filters by countryId / entityId (stable FKs, not free-text)', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_assurances' });
    expect(searchAlerts([alert], { countryId: 'CM' })).toHaveLength(1);
    expect(searchAlerts([alert], { countryId: 'GH' })).toEqual([]);
    expect(searchAlerts([alert], { entityId: 'cm_assurances' })).toHaveLength(1);
    expect(searchAlerts([alert], { entityId: 'gh_activa' })).toEqual([]);
  });

  it('filters by category name (no categoryId exists on this model)', () => {
    const alert = makeAlert({ category: 'Fraude, Corruption et pots-de-vin' });
    expect(searchAlerts([alert], { category: 'Fraude, Corruption et pots-de-vin' })).toHaveLength(1);
    expect(searchAlerts([alert], { category: 'Autres manquements graves' })).toEqual([]);
  });

  it('filters by status, NOCA threshold, and channel', () => {
    const alert = makeAlert({ status: 'closed', channel: 'qr_code' });
    expect(searchAlerts([alert], { status: 'closed' })).toHaveLength(1);
    expect(searchAlerts([alert], { status: 'new' })).toEqual([]);
    expect(searchAlerts([alert], { noca: 'NOCA 2' })).toHaveLength(1);
    expect(searchAlerts([alert], { noca: 'NOCA 4' })).toEqual([]);
    expect(searchAlerts([alert], { channel: 'qr_code' })).toHaveLength(1);
    expect(searchAlerts([alert], { channel: 'direct' })).toEqual([]);
  });

  it('treats a missing confidentialityLevel as restricted, same fallback as authz.canSeeAlertConfidentiality', () => {
    const alert = makeAlert({ confidentialityLevel: undefined });
    expect(searchAlerts([alert], { confidentiality: 'restricted' })).toHaveLength(1);
    expect(searchAlerts([alert], { confidentiality: 'confidential' })).toEqual([]);
  });

  it('filters by severity only when explicitly set on the record', () => {
    const alert = makeAlert({ severity: 'majeure' });
    expect(searchAlerts([alert], { severity: 'majeure' })).toHaveLength(1);
    expect(searchAlerts([makeAlert({ severity: undefined })], { severity: 'majeure' })).toEqual([]);
  });
});

describe('searchAlerts — date range', () => {
  it('includes an alert on the boundary dates (inclusive range)', () => {
    const alert = makeAlert({ createdAt: '2026-06-15T23:59:00Z' });
    expect(searchAlerts([alert], { dateFrom: '2026-06-15', dateTo: '2026-06-15' })).toHaveLength(1);
  });

  it('excludes an alert outside the range', () => {
    const alert = makeAlert({ createdAt: '2026-06-15T10:00:00Z' });
    expect(searchAlerts([alert], { dateFrom: '2026-06-20' })).toEqual([]);
    expect(searchAlerts([alert], { dateTo: '2026-06-10' })).toEqual([]);
  });
});

describe('searchAlerts — combined criteria (AND)', () => {
  it('requires every set criterion to match', () => {
    const alert = makeAlert({ status: 'investigation', countryId: 'CM' });
    expect(searchAlerts([alert], { status: 'investigation', countryId: 'CM' })).toHaveLength(1);
    expect(searchAlerts([alert], { status: 'investigation', countryId: 'GH' })).toEqual([]);
  });
});

describe('hasActiveCriteria', () => {
  it('is false for an empty criteria object', () => {
    expect(hasActiveCriteria({})).toBe(false);
  });

  it('is true once any single criterion is set', () => {
    expect(hasActiveCriteria({ keyword: 'x' })).toBe(true);
    expect(hasActiveCriteria({ status: 'new' })).toBe(true);
  });
});
