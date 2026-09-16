/**
 * === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
 * Tests de `userCan()` contre le pont domain/permissionOverrides.ts :
 * comportement par défaut (table ROLE_PERMISSIONS) inchangé tant que rien
 * n'a été poussé, puis reflet immédiat d'une édition poussée par
 * storage.ts (simulée ici directement, sans singleton `storage`, pour
 * rester un test unitaire pur).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { UserProfile } from '../types';
import { userCan } from './authz';
import { ROLE_PERMISSIONS } from '../domain/permissions';
import { setRolePermissionOverrides } from '../domain/permissionOverrides';

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
    ...overrides,
  };
}

// Toujours revenir à la table par défaut après chaque test — le registre
// domain/permissionOverrides.ts est un module-level singleton partagé par
// tous les tests de ce fichier (même worker).
afterEach(() => {
  setRolePermissionOverrides(ROLE_PERMISSIONS);
});

describe('userCan — default behavior (no override pushed)', () => {
  it('reflects the hardcoded ROLE_PERMISSIONS table', () => {
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.edit')).toBe(true);
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.assign')).toBe(false);
    expect(userCan(makeUser({ role: 'system_admin' }), 'configuration.manage')).toBe(true);
    expect(userCan(makeUser({ role: 'system_admin' }), 'cases.read')).toBe(false);
  });
});

describe('userCan — reflects an override pushed by storage.ts', () => {
  it('grants a permission a role did not have by default, once overridden', () => {
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.assign')).toBe(false);
    setRolePermissionOverrides({ ...ROLE_PERMISSIONS, investigator: [...ROLE_PERMISSIONS.investigator, 'cases.assign'] });
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.assign')).toBe(true);
  });

  it('revokes a permission a role had by default, once overridden', () => {
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.edit')).toBe(true);
    setRolePermissionOverrides({ ...ROLE_PERMISSIONS, investigator: ROLE_PERMISSIONS.investigator.filter((p) => p !== 'cases.edit') });
    expect(userCan(makeUser({ role: 'investigator' }), 'cases.edit')).toBe(false);
  });

  it('leaves other roles untouched by a single-role override', () => {
    setRolePermissionOverrides({ ...ROLE_PERMISSIONS, investigator: [] });
    expect(userCan(makeUser({ role: 'senior_investigator' }), 'cases.edit')).toBe(true);
  });
});
