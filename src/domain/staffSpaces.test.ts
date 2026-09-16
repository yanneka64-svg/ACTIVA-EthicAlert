/**
 * === AMÉLIORATION AJOUTÉE (Responsable des Investigations = Opérateur +
 * Enquêteur par défaut) ===
 *
 * `computeAvailableSpaces` n'avait jamais de test dédié — seulement vérifié
 * manuellement (voir historique de session). Couvre ici le contrat exact
 * demandé : seul `senior_investigator` combine Opérateur + Enquêteur par
 * défaut ; `investigator` (enquêteur simple) reste strictement limité à
 * l'espace Enquêteur ; ni l'un ni l'autre n'accède à l'Administration.
 */
import { describe, expect, it } from 'vitest';
import { UserProfile } from '../types';
import { canSeeAdminSpace, canSeeInvestigatorSpace, canSeeOperatorSpace, computeAvailableSpaces } from './staffSpaces';

function staffUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    username: 'test.user',
    role: 'investigator',
    roleTitle: 'Test',
    entity: 'ACTIVA Assurances',
    country: 'Cameroun',
    ...overrides,
  };
}

describe('computeAvailableSpaces', () => {
  it('limits a plain investigator strictly to the Espace Enquêteur', () => {
    const u = staffUser({ role: 'investigator' });
    expect(computeAvailableSpaces(u)).toEqual(['investigator']);
    expect(canSeeOperatorSpace(u)).toBe(false);
    expect(canSeeAdminSpace(u)).toBe(false);
  });

  it('grants senior_investigator (Responsable des Investigations) both Espace Opérateur and Espace Enquêteur, but not Administration', () => {
    const u = staffUser({ role: 'senior_investigator' });
    const spaces = computeAvailableSpaces(u);
    expect(spaces).toContain('operator');
    expect(spaces).toContain('investigator');
    expect(spaces).not.toContain('admin');
    expect(canSeeOperatorSpace(u)).toBe(true);
    expect(canSeeInvestigatorSpace(u)).toBe(true);
    expect(canSeeAdminSpace(u)).toBe(false);
  });

  // === AMÉLIORATION AJOUTÉE : le Directeur Audit, Risques et Conformité
  // Groupe (darc_compliance) obtient désormais les mêmes habilitations
  // Opérateur + Enquêteur que le Responsable des Investigations — comme
  // avant, jamais l'Administration.
  it('grants darc_compliance (Directeur Audit, Risques et Conformité Groupe) both Espace Opérateur and Espace Enquêteur, but not Administration', () => {
    const u = staffUser({ role: 'darc_compliance' });
    const spaces = computeAvailableSpaces(u);
    expect(spaces).toContain('operator');
    expect(spaces).toContain('investigator');
    expect(spaces).not.toContain('admin');
  });

  it('leaves system_admin behavior unchanged (Administration only — "System Administrator ≠ Case Access")', () => {
    const u = staffUser({ role: 'system_admin' });
    expect(computeAvailableSpaces(u)).toEqual(['admin']);
  });
});
