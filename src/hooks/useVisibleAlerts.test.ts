/**
 * === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
 *
 * Tests de `computeVisibleAlerts` (logique pure derrière `useVisibleAlerts`),
 * la seule implémentation désormais partagée par les 6 écrans qui
 * dupliquaient auparavant ce filtre. Mêmes conventions que
 * domain/permissions.test.ts : un compte/dossier minimal par défaut,
 * surchargé par cas de test.
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord, UserProfile } from '../types';
import { computeVisibleAlerts } from './useVisibleAlerts';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    role: 'investigator',
    roleTitle: 'Investigateur',
    entity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countries: ['CM'],
    entities: ['cm_assurances'],
    active: true,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'alt-1',
    trackingNumber: 'ACT-2026-0001',
    accessCodeHash: 'x',
    accessCodeSalt: 'y',
    channel: 'web',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    whistleblower: { isAnonymous: true },
    category: 'Fraude',
    subCategory: 'Fraude sur les sinistres',
    detailedDescription: 'x',
    incidentDates: '2026-01-01',
    incidentLocation: 'x',
    concernedEntity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countryId: 'CM',
    entityId: 'cm_assurances',
    riskEvaluation: {
      financialImpact: 1,
      hierarchyLevel: 1,
      recidivism: 1,
      reputationRisk: 1,
      totalScore: 4,
      nocaThreshold: 'NOCA 1',
      priority: 'faible',
      expectedTreatment: 'x',
    },
    impactType: 'x',
    involvedPersons: [],
    witnesses: [],
    evidences: [],
    status: 'new',
    assignedInvestigators: ['u-1'],
    assignedInvestigatorNames: ['Test User'],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...overrides,
  };
}

describe('computeVisibleAlerts — assignment / global visibility', () => {
  it('shows a non-global-viewer only their assigned alerts', () => {
    const assigned = makeAlert({ id: 'a', assignedInvestigators: ['u-1'] });
    const notAssigned = makeAlert({ id: 'b', assignedInvestigators: ['someone-else'] });
    const result = computeVisibleAlerts([assigned, notAssigned], makeUser());
    expect(result.map((a) => a.id)).toEqual(['a']);
  });

  it('shows a global-visibility role (functional_admin) every in-scope case, assigned or not', () => {
    const notAssigned = makeAlert({ id: 'a', assignedInvestigators: [] });
    const result = computeVisibleAlerts(
      [notAssigned],
      makeUser({ role: 'functional_admin', countries: [], entities: [] })
    );
    expect(result.map((a) => a.id)).toEqual(['a']);
  });
});

describe('computeVisibleAlerts — country/entity scope', () => {
  it('hides an alert outside the user country scope even when assigned', () => {
    const alert = makeAlert({ countryId: 'GH', entityId: 'gh_activa', assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser({ countries: ['CM'], entities: ['cm_assurances'] }));
    expect(result).toEqual([]);
  });

  it('hides an alert in the right country but wrong entity', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_vie', assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser({ countries: ['CM'], entities: ['cm_assurances'] }));
    expect(result).toEqual([]);
  });

  it('shows an alert in-scope for country and entity', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_assurances', assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser({ countries: ['CM'], entities: ['cm_assurances'] }));
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });

  it('treats an empty user scope as unrestricted (global roles)', () => {
    const alert = makeAlert({ countryId: 'GH', entityId: 'gh_activa', assignedInvestigators: [] });
    const result = computeVisibleAlerts(
      [alert],
      makeUser({ role: 'darc_compliance', countries: [], entities: [] })
    );
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });

  it('never hides a pre-Phase-1 alert that has no countryId/entityId yet, even for a scoped user', () => {
    const alert = makeAlert({ countryId: undefined, entityId: undefined, assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser({ countries: ['CM'], entities: ['cm_assurances'] }));
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });
});

describe('computeVisibleAlerts — sensitivity ceiling', () => {
  it('hides a highly_confidential alert from a plain investigator (role ceiling: confidential)', () => {
    const alert = makeAlert({ confidentialityLevel: 'highly_confidential', assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser());
    expect(result).toEqual([]);
  });

  it('shows a highly_confidential alert to a senior_investigator (role ceiling: highly_confidential)', () => {
    const alert = makeAlert({ confidentialityLevel: 'highly_confidential', assignedInvestigators: ['u-1'] });
    const result = computeVisibleAlerts([alert], makeUser({ role: 'senior_investigator' }));
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });

  it('honors a per-account sensitivityClearance over the role default', () => {
    const alert = makeAlert({ confidentialityLevel: 'highly_confidential', assignedInvestigators: ['u-1'] });
    // Plain investigator, but explicitly cleared to highly_confidential on this account.
    const result = computeVisibleAlerts(
      [alert],
      makeUser({ role: 'investigator', sensitivityClearance: 'highly_confidential' })
    );
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });
});

describe('computeVisibleAlerts — combined', () => {
  it('an assigned, in-scope, sufficiently-clear alert is visible', () => {
    const alert = makeAlert({
      countryId: 'CM',
      entityId: 'cm_assurances',
      confidentialityLevel: 'confidential',
      assignedInvestigators: ['u-1'],
    });
    const result = computeVisibleAlerts([alert], makeUser());
    expect(result.map((a) => a.id)).toEqual(['alt-1']);
  });

  it('an in-scope but unassigned alert is hidden from a non-global-visibility role', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_assurances', assignedInvestigators: [] });
    const result = computeVisibleAlerts([alert], makeUser());
    expect(result).toEqual([]);
  });
});
