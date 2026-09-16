/**
 * === AMÉLIORATION AJOUTÉE (création de comptes par l'admin — mot de passe
 * temporaire, expiration 4h) ===
 *
 * Test d'intégration léger contre le vrai singleton `storage`, même
 * convention que storage.generateCaseNumber.test.ts /
 * storage.escalateAlert.test.ts. Couvre le cycle de vie complet du mot de
 * passe d'un compte staff : repli "demo" pour un compte sans passwordHash,
 * génération/vérification réelle pour un compte créé par un admin,
 * obligation de changement à la première connexion, expiration 4h,
 * changement de mot de passe, et régénération admin.
 *
 * === AMÉLIORATION AJOUTÉE (identifiant de connexion distinct de l'email) ===
 * La connexion se fait désormais par `username`, jamais par `email`
 * directement — tous les appels `verifyStaffLogin` ci-dessous portent sur
 * l'identifiant.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { storage } from './storage';
import { generateAccessPassword, generateSalt, hashPassword } from './crypto';

// === AMÉLIORATION AJOUTÉE (correctif — verrouillage total hors recours) ===
// Même clé littérale que STORAGE_KEYS.USERS dans storage.ts (non exportée).
const USERS_STORAGE_KEY = 'activa_ethicalert_users_v1';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `test.staff.${counter}.${Date.now()}@group-activa.com`;
}
function uniqueUsername(): string {
  return `test.staff.${counter}.${Date.now()}`;
}

describe('storage — comptes staff (identifiant + mot de passe)', () => {
  it('vérifie un compte sans passwordHash avec le mot de passe fixe "demo" (repli documenté)', async () => {
    const actor = storage.getActiveUser();
    const username = uniqueUsername();
    const email = uniqueEmail();
    const id = 'usr-test-' + counter;
    storage.addUser(
      { id, name: 'Compte legacy de test', email, username, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA' },
      actor
    );
    const demoUser = storage.getUsers().find((u) => u.id === id)!;

    const ok = await storage.verifyStaffLogin(username, 'demo');
    expect(ok).toEqual({ ok: true, user: demoUser, mustChangePassword: false });

    const wrong = await storage.verifyStaffLogin(username, 'n_importe_quoi');
    expect(wrong).toEqual({ ok: false, reason: 'wrong_password' });
  });

  it('retourne "not_found" pour un identifiant inconnu', async () => {
    const result = await storage.verifyStaffLogin('identifiant-inconnu', 'peu importe');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('vérifie un compte créé par un admin avec son mot de passe temporaire réel, et exige un changement', async () => {
    const actor = storage.getActiveUser();
    const email = uniqueEmail();
    const username = uniqueUsername();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      {
        id,
        name: 'Compte de test',
        email,
        username,
        role: 'investigator',
        roleTitle: 'Investigateur',
        entity: 'Toutes entités',
        country: 'Groupe ACTIVA',
        passwordHash: hash,
        passwordSalt: salt,
        mustChangePassword: true,
        passwordSetAt: new Date().toISOString(),
      },
      actor
    );

    const wrongPw = await storage.verifyStaffLogin(username, 'mauvais-mot-de-passe');
    expect(wrongPw).toEqual({ ok: false, reason: 'wrong_password' });

    const ok = await storage.verifyStaffLogin(username, tempPassword);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.mustChangePassword).toBe(true);
      expect(ok.user.id).toBe(id);
    }
  });

  it('refuse un mot de passe temporaire vieux de plus de 4h ("expired")', async () => {
    const actor = storage.getActiveUser();
    const email = uniqueEmail();
    const username = uniqueUsername();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

    storage.addUser(
      {
        id,
        name: 'Compte expiré',
        email,
        username,
        role: 'investigator',
        roleTitle: 'Investigateur',
        entity: 'Toutes entités',
        country: 'Groupe ACTIVA',
        passwordHash: hash,
        passwordSalt: salt,
        mustChangePassword: true,
        passwordSetAt: fiveHoursAgo,
      },
      actor
    );

    const result = await storage.verifyStaffLogin(username, tempPassword);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('changePassword lève l’obligation de changement et invalide l’ancien mot de passe', async () => {
    const actor = storage.getActiveUser();
    const email = uniqueEmail();
    const username = uniqueUsername();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      { id, name: 'Compte test', email, username, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA', passwordHash: hash, passwordSalt: salt, mustChangePassword: true, passwordSetAt: new Date().toISOString() },
      actor
    );

    await storage.changePassword(id, 'MonNouveauMdp1', actor);

    const oldPasswordResult = await storage.verifyStaffLogin(username, tempPassword);
    expect(oldPasswordResult).toEqual({ ok: false, reason: 'wrong_password' });

    const newPasswordResult = await storage.verifyStaffLogin(username, 'MonNouveauMdp1');
    expect(newPasswordResult).toEqual(expect.objectContaining({ ok: true, mustChangePassword: false }));
  });

  it('resetUserPassword régénère un nouveau mot de passe temporaire et invalide l’ancien', async () => {
    const actor = storage.getActiveUser();
    const email = uniqueEmail();
    const username = uniqueUsername();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      { id, name: 'Compte test', email, username, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA', passwordHash: hash, passwordSalt: salt, mustChangePassword: false, passwordSetAt: new Date().toISOString() },
      actor
    );

    const newPlaintext = await storage.resetUserPassword(id, actor);
    expect(newPlaintext).not.toBe(tempPassword);

    const oldPasswordResult = await storage.verifyStaffLogin(username, tempPassword);
    expect(oldPasswordResult).toEqual({ ok: false, reason: 'wrong_password' });

    const newPasswordResult = await storage.verifyStaffLogin(username, newPlaintext);
    expect(newPasswordResult).toEqual(expect.objectContaining({ ok: true, mustChangePassword: true }));
  });

  // === AMÉLIORATION AJOUTÉE (correctif — verrouillage total hors recours) ===
  // Cet environnement de test n'a pas de `localStorage` global (ni jsdom
  // installé, ni polyfill Node) : storage.ts le sait déjà et retombe sur un
  // état en mémoire (voir son try/catch "Storage init failed or running in
  // strict sandbox"). Pour vérifier le VRAI chemin localStorage (celui qui a
  // causé le verrouillage en production), on fournit ici un mock minimal via
  // vi.stubGlobal plutôt que d'ajouter une dépendance jsdom.
  describe('réamorçage de secours après suppression de tous les comptes', () => {
    function makeLocalStorageMock() {
      const data = new Map<string, string>();
      return {
        getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
        removeItem: (key: string) => {
          data.delete(key);
        },
        clear: () => data.clear(),
      };
    }

    beforeEach(() => {
      vi.resetModules();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("réamorce un compte admin réel unique, avec mot de passe par défaut à changement obligatoire, quand localStorage contient un tableau vide", async () => {
      const mockLocalStorage = makeLocalStorageMock();
      mockLocalStorage.setItem(USERS_STORAGE_KEY, '[]');
      vi.stubGlobal('localStorage', mockLocalStorage);

      const { storage: freshStorage } = await import('./storage');

      const users = freshStorage.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('by.ekani@group-activa.com');
      expect(users[0].username).toBe('y.mebadaekani');
      expect(users[0].name).toBe('MEBADA EKANI Yannick');
      expect(users[0].role).toBe('system_admin');
      expect(users[0].active).toBe(true);
      // === AMÉLIORATION AJOUTÉE (mot de passe par défaut à changement
      // obligatoire, demande explicite) === Ce compte a désormais un vrai
      // mot de passe par défaut (pas le repli "demo") : la connexion
      // n'aboutit qu'avec ce mot de passe précis, ET exige aussitôt un
      // changement — jamais un accès admin durable sur un mot de passe
      // connu de tous.
      expect(users[0].passwordHash).toBeTruthy();
      expect(users[0].mustChangePassword).toBe(true);

      const wrongDemo = await freshStorage.verifyStaffLogin('y.mebadaekani', 'demo');
      expect(wrongDemo).toEqual({ ok: false, reason: 'wrong_password' });

      const login = await freshStorage.verifyStaffLogin('y.mebadaekani', 'ActivaForensic2026!');
      expect(login.ok).toBe(true);
      if (login.ok) expect(login.mustChangePassword).toBe(true);

      // L'état vide cassé a bien été remplacé en localStorage (pas seulement en mémoire).
      expect(JSON.parse(mockLocalStorage.getItem(USERS_STORAGE_KEY) || '[]')).toHaveLength(1);
    });
  });
});
