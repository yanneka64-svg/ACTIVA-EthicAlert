/**
 * === AMÉLIORATION AJOUTÉE ===
 *
 * Real automated tests for the RBAC model (src/domain/permissions.ts).
 * Same rationale as workflow.test.ts: this logic was previously verified
 * only by manual/live testing against the real Firebase project
 * (docs/SECURITY.md) and by `tsc`. These tests exercise the same "conjunction
 * of five checks" docs/PERMISSIONS.md documents — authentication, role
 * permission, scope, confidentiality clearance, assigned-or-global-visibility
 * — and rule #9 (implicated person, checked first, overrides everything)
 * specifically, since that is the single most security-critical branch in
 * this file.
 */
import { describe, expect, it } from 'vitest';

import { AppUser, Case, Person } from './caseTypes';
import { can, CaseAccessContext, implicatedUserIdsFromPersons, roleHasPermission } from './permissions';

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    userId: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    roleId: 'investigator',
    countries: ['Cameroun'],
    entities: ['ACTIVA Assurances'],
    active: true,
    mfaEnabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function caseContext(overrides: Partial<CaseAccessContext['case']> = {}, implicatedUserIds: string[] = []): CaseAccessContext {
  return {
    case: {
      country: 'Cameroun',
      entity: 'ACTIVA Assurances',
      confidentialityLevel: 'confidential',
      assignee: 'u-1',
      additionalInvestigators: [],
      ...overrides,
    },
    implicatedUserIds,
  };
}

describe('roleHasPermission', () => {
  it('matches the documented ROLE_PERMISSIONS table for a representative sample', () => {
    expect(roleHasPermission('reporter', 'cases.read')).toBe(false);
    expect(roleHasPermission('investigator', 'cases.read')).toBe(true);
    expect(roleHasPermission('investigator', 'cases.close')).toBe(false);
    expect(roleHasPermission('senior_investigator', 'cases.close')).toBe(true);
    expect(roleHasPermission('functional_admin', 'cases.create')).toBe(true);
    expect(roleHasPermission('darc_compliance', 'evidence.upload')).toBe(false);
    expect(roleHasPermission('consultation', 'cases.edit')).toBe(false);
    expect(roleHasPermission('executive', 'reports.read')).toBe(true);
    expect(roleHasPermission('executive', 'cases.read')).toBe(false);
  });

  it('never grants a case-scoped permission to system_admin — "System Administrator ≠ Case Access" (section 30)', () => {
    expect(roleHasPermission('system_admin', 'cases.read')).toBe(false);
    expect(roleHasPermission('system_admin', 'evidence.read')).toBe(false);
    expect(roleHasPermission('system_admin', 'communications.read')).toBe(false);
    expect(roleHasPermission('system_admin', 'configuration.manage')).toBe(true);
  });

  // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu à 10 rôles) ===
  it('never grants a case-scoped permission to security_admin either — same least-privilege principle', () => {
    expect(roleHasPermission('security_admin', 'cases.read')).toBe(false);
    expect(roleHasPermission('security_admin', 'evidence.read')).toBe(false);
    expect(roleHasPermission('security_admin', 'security.manage')).toBe(true);
    expect(roleHasPermission('security_admin', 'configuration.manage')).toBe(false);
  });

  it('grants audit_committee read-only reporting + audit access, and nothing that modifies data', () => {
    expect(roleHasPermission('audit_committee', 'reports.read')).toBe(true);
    expect(roleHasPermission('audit_committee', 'audit.read')).toBe(true);
    expect(roleHasPermission('audit_committee', 'cases.read')).toBe(false);
    expect(roleHasPermission('audit_committee', 'cases.edit')).toBe(false);
    expect(roleHasPermission('audit_committee', 'evidence.delete')).toBe(false);
    expect(roleHasPermission('audit_committee', 'users.manage')).toBe(false);
    expect(roleHasPermission('audit_committee', 'configuration.manage')).toBe(false);
  });
});

describe('can — basic gates', () => {
  it('denies an inactive user regardless of role/permission', () => {
    expect(can(user({ active: false }), 'cases.read', caseContext())).toBe(false);
  });

  it('denies a role that simply does not hold the permission', () => {
    expect(can(user({ roleId: 'executive' }), 'cases.edit')).toBe(false);
  });

  it('allows a non-case-scoped permission with no context once the role holds it', () => {
    expect(can(user({ roleId: 'system_admin' }), 'configuration.manage')).toBe(true);
  });
});

describe('can — rule #9: implicated person is denied even over global visibility', () => {
  it('denies an assigned investigator who is also the implicated subject', () => {
    const ctx = caseContext({ assignee: 'u-1' }, ['u-1']);
    expect(can(user({ userId: 'u-1' }), 'cases.read', ctx)).toBe(false);
  });

  it('denies a global-visibility functional_admin who is the implicated subject', () => {
    const ctx = caseContext({ assignee: 'someone-else' }, ['u-1']);
    expect(can(user({ userId: 'u-1', roleId: 'functional_admin', countries: [], entities: [] }), 'cases.read', ctx)).toBe(false);
  });

  it('allows the same case read for a different user not on the implicated list', () => {
    const ctx = caseContext({ assignee: 'u-1' }, ['someone-else']);
    expect(can(user({ userId: 'u-1' }), 'cases.read', ctx)).toBe(true);
  });
});

describe('can — scope (isInScope)', () => {
  it('denies access when the case country is outside the user\'s countries', () => {
    const ctx = caseContext({ country: 'Ghana' });
    expect(can(user({ countries: ['Cameroun'] }), 'cases.read', ctx)).toBe(false);
  });

  it('denies access when the case entity is outside the user\'s entities', () => {
    const ctx = caseContext({ entity: 'ACTIVA Vie' });
    expect(can(user({ entities: ['ACTIVA Assurances'] }), 'cases.read', ctx)).toBe(false);
  });

  it('treats an empty countries/entities array as unrestricted (admin-style roles only)', () => {
    const ctx = caseContext({ country: 'Ghana', entity: 'ACTIVA International Ghana', assignee: 'someone-else' });
    expect(can(user({ roleId: 'functional_admin', countries: [], entities: [] }), 'cases.read', ctx)).toBe(true);
  });
});

describe('can — confidentiality clearance', () => {
  it('denies a consultation user a highly_confidential case even though they hold cases.read (capped at confidential)', () => {
    const ctx = caseContext({ confidentialityLevel: 'highly_confidential', assignee: 'someone-else' });
    expect(can(user({ roleId: 'consultation', countries: [], entities: [] }), 'cases.read', ctx)).toBe(false);
  });

  it('denies an assigned investigator a highly_confidential case (also capped at confidential)', () => {
    const ctx = caseContext({ confidentialityLevel: 'highly_confidential', assignee: 'u-1' });
    expect(can(user({ userId: 'u-1', roleId: 'investigator' }), 'cases.read', ctx)).toBe(false);
  });

  it('allows a senior_investigator a highly_confidential case (cleared up to highly_confidential)', () => {
    const ctx = caseContext({ confidentialityLevel: 'highly_confidential', assignee: 'u-1' });
    expect(can(user({ userId: 'u-1', roleId: 'senior_investigator' }), 'cases.read', ctx)).toBe(true);
  });

  it('allows the same assigned investigator once the case is only "confidential" (at their clearance ceiling)', () => {
    const ctx = caseContext({ confidentialityLevel: 'confidential', assignee: 'u-1' });
    expect(can(user({ userId: 'u-1', roleId: 'investigator' }), 'cases.read', ctx)).toBe(true);
  });
});

describe('can — assigned vs. global visibility', () => {
  it('denies an investigator (no global visibility) who is not assigned', () => {
    const ctx = caseContext({ assignee: 'someone-else' });
    expect(can(user({ userId: 'u-1', roleId: 'investigator' }), 'cases.read', ctx)).toBe(false);
  });

  it('allows an investigator assigned as an additional investigator, not just the primary assignee', () => {
    const ctx = caseContext({ assignee: 'someone-else', additionalInvestigators: ['u-1'] });
    expect(can(user({ userId: 'u-1', roleId: 'investigator' }), 'cases.read', ctx)).toBe(true);
  });

  it('allows a global-visibility role (darc_compliance) to read an in-scope case with no assignment at all', () => {
    const ctx = caseContext({ assignee: 'someone-else', additionalInvestigators: [] });
    expect(can(user({ userId: 'u-1', roleId: 'darc_compliance' }), 'cases.read', ctx)).toBe(true);
  });

  it('denies system_admin even when technically "assigned" — it has no cases.read permission at all', () => {
    const ctx = caseContext({ assignee: 'u-1' });
    expect(can(user({ userId: 'u-1', roleId: 'system_admin' }), 'cases.read', ctx)).toBe(false);
  });

  // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu à 10 rôles) ===
  it('denies audit_committee direct case read even when assigned — reports/audit only, never raw case content', () => {
    const ctx = caseContext({ assignee: 'u-1' });
    expect(can(user({ userId: 'u-1', roleId: 'audit_committee' }), 'cases.read', ctx)).toBe(false);
  });

  it('denies security_admin direct case read under any circumstance', () => {
    const ctx = caseContext({ assignee: 'u-1', additionalInvestigators: [] });
    expect(can(user({ userId: 'u-1', roleId: 'security_admin', countries: [], entities: [] }), 'cases.read', ctx)).toBe(false);
  });
});

describe('implicatedUserIdsFromPersons', () => {
  function person(overrides: Partial<Person> = {}): Person {
    return {
      personId: 'p-1',
      caseId: 'case-1',
      kind: 'witness',
      name: 'Someone',
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'tester',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'tester',
      ...overrides,
    };
  }

  it('includes only subjects with a linkedUserId', () => {
    const persons = [
      person({ kind: 'subject', linkedUserId: 'u-implicated' }),
      person({ personId: 'p-2', kind: 'witness', linkedUserId: 'u-witness' }), // witness, even if linked, must not count
      person({ personId: 'p-3', kind: 'subject' }), // subject with no linked account
    ];
    expect(implicatedUserIdsFromPersons(persons)).toEqual(['u-implicated']);
  });

  it('returns an empty array when there are no linked subjects', () => {
    expect(implicatedUserIdsFromPersons([person({ kind: 'witness' })])).toEqual([]);
  });
});
