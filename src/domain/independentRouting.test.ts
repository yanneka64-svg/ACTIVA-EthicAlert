/**
 * === AMÉLIORATION AJOUTÉE (Phase 3 — routage indépendant) ===
 * Tests du moteur de résolution d'autorité indépendante.
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord, InvolvedPerson, UserProfile, Witness } from '../types';
import { DEFAULT_HIERARCHY_LEVELS } from '../data/activaConfig';
import {
  getImplicatedUserIds,
  getConflictedUserIds,
  resolveIndependentAuthority,
  getRoutingMatrixView,
} from './independentRouting';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    username: 'test.user',
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

function makePerson(overrides: Partial<InvolvedPerson> = {}): InvolvedPerson {
  return {
    id: 'per-1',
    name: 'Personne mise en cause',
    position: 'x',
    hierarchyRole: 'Cadre',
    ...overrides,
  };
}

function makeWitness(overrides: Partial<Witness> = {}): Witness {
  return {
    id: 'wit-1',
    name: 'Témoin',
    position: 'x',
    hierarchyRole: 'Employé',
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
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...overrides,
  };
}

describe('getImplicatedUserIds / getConflictedUserIds', () => {
  it('collects linkedUserId from involvedPersons only for getImplicatedUserIds', () => {
    const alert = makeAlert({
      involvedPersons: [makePerson({ linkedUserId: 'u-accused' })],
      witnesses: [makeWitness({ linkedUserId: 'u-witness' })],
    });
    expect(getImplicatedUserIds(alert)).toEqual(['u-accused']);
  });

  it('getConflictedUserIds includes both implicated persons and linked witnesses', () => {
    const alert = makeAlert({
      involvedPersons: [makePerson({ linkedUserId: 'u-accused' })],
      witnesses: [makeWitness({ linkedUserId: 'u-witness' })],
    });
    expect(getConflictedUserIds(alert).sort()).toEqual(['u-accused', 'u-witness']);
  });

  it('ignores persons/witnesses without a linkedUserId', () => {
    const alert = makeAlert({
      involvedPersons: [makePerson()],
      witnesses: [makeWitness()],
    });
    expect(getImplicatedUserIds(alert)).toEqual([]);
    expect(getConflictedUserIds(alert)).toEqual([]);
  });
});

describe('resolveIndependentAuthority', () => {
  it('finds no candidates and no routing when nobody is linked', () => {
    const alert = makeAlert();
    const result = resolveIndependentAuthority(alert, [], DEFAULT_HIERARCHY_LEVELS);
    expect(result).toEqual({ candidates: [], scopeMatch: null, found: false });
  });

  it('an implicated investigator finds a local senior_investigator', () => {
    const accused = makeUser({ id: 'u-accused', role: 'investigator' });
    const authority = makeUser({ id: 'u-senior', role: 'senior_investigator', name: 'Senior Local' });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, authority], DEFAULT_HIERARCHY_LEVELS);
    expect(result.found).toBe(true);
    expect(result.scopeMatch).toBe('local');
    expect(result.candidates.map((c) => c.id)).toEqual(['u-senior']);
  });

  it('falls back to a Group-scoped authority when no local one exists', () => {
    const accused = makeUser({ id: 'u-accused', role: 'senior_investigator', countries: ['CM'], entities: ['cm_assurances'] });
    // === AMÉLIORATION AJOUTÉE (règle métier explicite — chaîne
    // d'implication) === `darc_compliance` remplace `functional_admin` ici
    // (désormais exclu comme cible, voir isRoutingEligibleRole) — même
    // intention de test (repli Groupe générique), rôle toujours éligible.
    const groupAdmin = makeUser({
      id: 'u-group-admin',
      role: 'darc_compliance',
      name: 'DARC Groupe',
      countries: [],
      entities: [],
    });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, groupAdmin], DEFAULT_HIERARCHY_LEVELS);
    expect(result.found).toBe(true);
    expect(result.scopeMatch).toBe('group');
    expect(result.candidates.map((c) => c.id)).toEqual(['u-group-admin']);
  });

  // === AMÉLIORATION AJOUTÉE (règle métier explicite — chaîne d'implication)
  // === "Si l'alerte concerne le Responsable des Investigations, l'alerte
  // doit tomber directement dans le panier du Directeur Audit, Risques et
  // Conformité Groupe" : même en présence d'un functional_admin de niveau
  // intermédiaire (5, entre senior_investigator:4 et darc_compliance:6), le
  // routage doit sauter functional_admin et atteindre darc_compliance.
  it('routes a Responsable des Investigations (senior_investigator) implication directly to darc_compliance, skipping the intermediate functional_admin level', () => {
    const accused = makeUser({ id: 'u-accused', role: 'senior_investigator', countries: [], entities: [] });
    const pointOfContact = makeUser({ id: 'u-poc', role: 'functional_admin', name: 'Point de Contact', countries: [], entities: [] });
    const darc = makeUser({ id: 'u-darc', role: 'darc_compliance', name: 'DARC Groupe', countries: [], entities: [] });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, pointOfContact, darc], DEFAULT_HIERARCHY_LEVELS);
    expect(result.found).toBe(true);
    expect(result.candidates.map((c) => c.id)).toEqual(['u-darc']);
  });

  it('never proposes functional_admin as a routing target, even alone at the intermediate level', () => {
    const accused = makeUser({ id: 'u-accused', role: 'senior_investigator', countries: [], entities: [] });
    const pointOfContact = makeUser({ id: 'u-poc', role: 'functional_admin', countries: [], entities: [] });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, pointOfContact], DEFAULT_HIERARCHY_LEVELS);
    expect(result).toEqual({ candidates: [], scopeMatch: null, found: false });
  });

  // === AMÉLIORATION AJOUTÉE (règle métier explicite — chaîne d'implication)
  // === "Si l'alerte porte sur un enquêteur, l'alerte tombe directement chez
  // le Responsable des investigations" — déjà le comportement par défaut
  // (niveaux adjacents), verrouillé ici explicitement.
  it('routes an investigator implication directly to senior_investigator (Responsable des Investigations)', () => {
    const accused = makeUser({ id: 'u-accused', role: 'investigator', countries: [], entities: [] });
    const senior = makeUser({ id: 'u-senior', role: 'senior_investigator', name: 'Responsable des Investigations', countries: [], entities: [] });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, senior], DEFAULT_HIERARCHY_LEVELS);
    expect(result.found).toBe(true);
    expect(result.candidates.map((c) => c.id)).toEqual(['u-senior']);
  });

  it('finds no independent authority when darc_compliance (highest operational role) is implicated', () => {
    const accused = makeUser({ id: 'u-accused', role: 'darc_compliance', countries: [], entities: [] });
    // Roles above darc_compliance's level (executive/consultation/audit_committee)
    // have neither cases.edit nor cases.assign — never eligible as a target.
    const executive = makeUser({ id: 'u-exec', role: 'executive', countries: [], entities: [] });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, executive], DEFAULT_HIERARCHY_LEVELS);
    expect(result).toEqual({ candidates: [], scopeMatch: null, found: false });
  });

  it('excludes a linked witness from candidacy without excluding it from the conflict set', () => {
    const accused = makeUser({ id: 'u-accused', role: 'investigator' });
    // This senior_investigator is also linked as a witness on this very case:
    // a valid escalation target in general, but not for THIS case.
    const witnessAuthority = makeUser({ id: 'u-witness-senior', role: 'senior_investigator' });
    const otherAuthority = makeUser({ id: 'u-other-senior', role: 'senior_investigator', name: 'Autre Senior' });
    const alert = makeAlert({
      involvedPersons: [makePerson({ linkedUserId: 'u-accused' })],
      witnesses: [makeWitness({ linkedUserId: 'u-witness-senior' })],
    });
    const result = resolveIndependentAuthority(alert, [accused, witnessAuthority, otherAuthority], DEFAULT_HIERARCHY_LEVELS);
    expect(result.candidates.map((c) => c.id)).toEqual(['u-other-senior']);
  });

  it('never proposes system_admin or security_admin despite their hierarchy level', () => {
    const accused = makeUser({ id: 'u-accused', role: 'investigator' });
    const sysAdmin = makeUser({ id: 'u-sysadmin', role: 'system_admin', countries: [], entities: [] });
    const secAdmin = makeUser({ id: 'u-secadmin', role: 'security_admin', countries: [], entities: [] });
    const alert = makeAlert({ involvedPersons: [makePerson({ linkedUserId: 'u-accused' })] });
    const result = resolveIndependentAuthority(alert, [accused, sysAdmin, secAdmin], DEFAULT_HIERARCHY_LEVELS);
    expect(result).toEqual({ candidates: [], scopeMatch: null, found: false });
  });

  it('excludes a candidate whose confidentiality clearance is insufficient', () => {
    // reporter (level 1) implicated — the only role above it in this test
    // is investigator (level 3), whose confidentiality ceiling
    // ('confidential', domain/permissions.ts ROLE_MAX_CONFIDENTIALITY) is
    // below this highly_confidential case, so it must still be excluded
    // even though it otherwise clears the level/permission checks.
    const accused = makeUser({ id: 'u-accused', role: 'reporter' });
    const underCleared = makeUser({ id: 'u-inv', role: 'investigator' });
    const alert = makeAlert({
      involvedPersons: [makePerson({ linkedUserId: 'u-accused' })],
      confidentialityLevel: 'highly_confidential',
    });
    const result = resolveIndependentAuthority(alert, [accused, underCleared], DEFAULT_HIERARCHY_LEVELS);
    expect(result).toEqual({ candidates: [], scopeMatch: null, found: false });
  });
});

describe('getRoutingMatrixView', () => {
  it('maps investigator to senior_investigator as the immediately superior eligible role', () => {
    const view = getRoutingMatrixView(DEFAULT_HIERARCHY_LEVELS);
    const investigatorRow = view.find((r) => r.role === 'investigator');
    expect(investigatorRow?.nextLevelRoles).toEqual(['senior_investigator']);
  });

  it('darc_compliance has no eligible role above it', () => {
    const view = getRoutingMatrixView(DEFAULT_HIERARCHY_LEVELS);
    const darcRow = view.find((r) => r.role === 'darc_compliance');
    expect(darcRow?.nextLevelRoles).toEqual([]);
  });

  // === AMÉLIORATION AJOUTÉE (règle métier explicite — chaîne d'implication)
  // === maps senior_investigator directly to darc_compliance, skipping the
  // intermediate functional_admin level (5, between 4 and 6).
  it('maps senior_investigator to darc_compliance, skipping the intermediate functional_admin level', () => {
    const view = getRoutingMatrixView(DEFAULT_HIERARCHY_LEVELS);
    const seniorRow = view.find((r) => r.role === 'senior_investigator');
    expect(seniorRow?.nextLevelRoles).toEqual(['darc_compliance']);
  });

  it('never lists functional_admin as a nextLevelRoles target for any role', () => {
    const view = getRoutingMatrixView(DEFAULT_HIERARCHY_LEVELS);
    expect(view.some((r) => r.nextLevelRoles.includes('functional_admin'))).toBe(false);
  });
});
