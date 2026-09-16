/**
 * === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
 * Intégration contre le singleton `storage` réel, même convention que
 * storage.escalateAlert.test.ts / storage.triggerIndependentRouting.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { userCan } from './authz';
import { UserProfile } from '../types';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-test',
    name: 'Test User',
    email: 't@example.com',
    username: 'test.user',
    role: 'consultation',
    roleTitle: 'Consultation',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    ...overrides,
  };
}

describe('storage.updateRolePermissions', () => {
  it('persists a permission change and reflects it immediately in authz.userCan', () => {
    // consultation never has cases.edit by default (read-only role).
    expect(userCan(makeUser({ role: 'consultation' }), 'cases.edit')).toBe(false);

    const before = storage.getRolePermissions();
    storage.updateRolePermissions('consultation', [...before.consultation, 'cases.edit'], storage.getActiveUser());

    expect(storage.getRolePermissions().consultation).toContain('cases.edit');
    expect(userCan(makeUser({ role: 'consultation' }), 'cases.edit')).toBe(true);

    // Revert so this file's other tests (and any re-run) see a clean baseline.
    storage.updateRolePermissions('consultation', before.consultation, storage.getActiveUser());
    expect(userCan(makeUser({ role: 'consultation' }), 'cases.edit')).toBe(false);
  });

  it('logs a CONFIG_UPDATED audit entry naming the edited role', () => {
    const before = storage.getRolePermissions();
    const auditCountBefore = storage.getAuditLogs().length;

    storage.updateRolePermissions('executive', [...before.executive], storage.getActiveUser());

    expect(storage.getAuditLogs().length).toBe(auditCountBefore + 1);
    expect(storage.getAuditLogs()[0].actionType).toBe('CONFIG_UPDATED');
    expect(storage.getAuditLogs()[0].details).toContain('executive');
  });

  it('does not affect other roles', () => {
    const before = storage.getRolePermissions();
    storage.updateRolePermissions('security_admin', [], storage.getActiveUser());

    expect(storage.getRolePermissions().system_admin).toEqual(before.system_admin);
    expect(userCan(makeUser({ role: 'system_admin' }), 'configuration.manage')).toBe(true);

    // Revert.
    storage.updateRolePermissions('security_admin', before.security_admin, storage.getActiveUser());
  });
});
