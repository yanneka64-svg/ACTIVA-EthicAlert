/**
 * === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
 * enregistrés dans Firebase) ===
 *
 * Même convention que storage.staffAccounts.test.ts (vrai singleton
 * `storage`). Couvre la copie locale de l'annuaire Firebase :
 * - un compte Firebase ne peut jamais se connecter par la vérification
 *   locale (ni par le repli "demo") ;
 * - le remplacement de l'annuaire ne touche jamais aux comptes locaux et
 *   retire les comptes Firebase supprimés ;
 * - aucune empreinte de mot de passe n'est conservée pour un compte Firebase.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { UserProfile } from '../types';

let n = 0;
function firebaseAccount(overrides: Partial<UserProfile> = {}): UserProfile {
  n += 1;
  return {
    id: `fb-uid-${n}-${Date.now()}`,
    name: `Compte Firebase ${n}`,
    email: `firebase.${n}.${Date.now()}@group-activa.com`,
    username: `firebase.${n}.${Date.now()}`,
    role: 'investigator',
    roleTitle: 'Investigateur',
    entity: 'Toutes entités',
    country: 'Groupe ACTIVA',
    authSource: 'firebase',
    ...overrides,
  };
}

describe('storage — annuaire Firebase du personnel', () => {
  it('refuse la connexion locale d’un compte Firebase, même avec "demo"', async () => {
    const account = firebaseAccount();
    storage.replaceFirebaseDirectory([account]);
    expect(await storage.verifyStaffLogin(account.username, 'demo')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('remplace les comptes Firebase sans toucher aux comptes locaux', () => {
    const actor = storage.getActiveUser();
    const localId = `usr-local-${Date.now()}`;
    storage.addUser(
      { id: localId, name: 'Compte local', email: `local.${Date.now()}@group-activa.com`, username: `local.${Date.now()}`, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA' },
      actor
    );
    const a = firebaseAccount();
    const b = firebaseAccount();
    storage.replaceFirebaseDirectory([a, b]);
    expect(storage.getUsers().some((u) => u.id === a.id)).toBe(true);

    storage.replaceFirebaseDirectory([b]);
    const ids = storage.getUsers().map((u) => u.id);
    expect(ids).toContain(localId);
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(a.id);
  });

  it('marque les comptes reçus comme Firebase et retire toute empreinte de mot de passe', () => {
    const account = firebaseAccount({ authSource: undefined, passwordHash: 'x', passwordSalt: 'y' });
    storage.replaceFirebaseDirectory([account]);
    const stored = storage.getUsers().find((u) => u.id === account.id)!;
    expect(stored.authSource).toBe('firebase');
    expect(stored.passwordHash).toBeUndefined();
    expect(stored.passwordSalt).toBeUndefined();
  });

  it('met à jour la session active si son compte figure dans l’annuaire', () => {
    const previous = storage.getActiveUser();
    const account = firebaseAccount();
    storage.replaceFirebaseDirectory([account]);
    storage.setActiveUser(account);
    storage.replaceFirebaseDirectory([{ ...account, roleTitle: 'Investigateur senior' }]);
    expect(storage.getActiveUser().roleTitle).toBe('Investigateur senior');
    storage.setActiveUser(previous);
  });
});
