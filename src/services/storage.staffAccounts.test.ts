/**
 * === AMÉLIORATION AJOUTÉE (création de comptes par l'admin — mot de passe
 * temporaire, expiration 24h) ===
 *
 * Test d'intégration léger contre le vrai singleton `storage`, même
 * convention que storage.generateCaseNumber.test.ts /
 * storage.escalateAlert.test.ts. Couvre le cycle de vie complet du mot de
 * passe d'un compte staff : repli "demo" pour les comptes de démonstration
 * préexistants (jamais passés par le nouveau flux), génération/vérification
 * réelle pour un compte créé par un admin, obligation de changement à la
 * première connexion, expiration 24h, changement de mot de passe, et
 * régénération admin.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { generateAccessPassword, generateSalt, hashPassword } from './crypto';

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `test.staff.${counter}.${Date.now()}@group-activa.com`;
}

describe('storage — comptes staff (identifiant + mot de passe)', () => {
  it('vérifie un compte de démonstration préexistant avec le mot de passe fixe "demo" (repli documenté)', async () => {
    const demoUser = storage.getUsers()[0];
    const ok = await storage.verifyStaffLogin(demoUser.email, 'demo');
    expect(ok).toEqual({ ok: true, user: demoUser, mustChangePassword: false });

    const wrong = await storage.verifyStaffLogin(demoUser.email, 'n_importe_quoi');
    expect(wrong).toEqual({ ok: false, reason: 'wrong_password' });
  });

  it('retourne "not_found" pour un identifiant inconnu', async () => {
    const result = await storage.verifyStaffLogin('inconnu@group-activa.com', 'peu importe');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('vérifie un compte créé par un admin avec son mot de passe temporaire réel, et exige un changement', async () => {
    const actor = storage.getUsers()[0];
    const email = uniqueEmail();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      {
        id,
        name: 'Compte de test',
        email,
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

    const wrongPw = await storage.verifyStaffLogin(email, 'mauvais-mot-de-passe');
    expect(wrongPw).toEqual({ ok: false, reason: 'wrong_password' });

    const ok = await storage.verifyStaffLogin(email, tempPassword);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.mustChangePassword).toBe(true);
      expect(ok.user.id).toBe(id);
    }
  });

  it('refuse un mot de passe temporaire vieux de plus de 24h ("expired")', async () => {
    const actor = storage.getUsers()[0];
    const email = uniqueEmail();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    storage.addUser(
      {
        id,
        name: 'Compte expiré',
        email,
        role: 'investigator',
        roleTitle: 'Investigateur',
        entity: 'Toutes entités',
        country: 'Groupe ACTIVA',
        passwordHash: hash,
        passwordSalt: salt,
        mustChangePassword: true,
        passwordSetAt: twentyFiveHoursAgo,
      },
      actor
    );

    const result = await storage.verifyStaffLogin(email, tempPassword);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('changePassword lève l’obligation de changement et invalide l’ancien mot de passe', async () => {
    const actor = storage.getUsers()[0];
    const email = uniqueEmail();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      { id, name: 'Compte test', email, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA', passwordHash: hash, passwordSalt: salt, mustChangePassword: true, passwordSetAt: new Date().toISOString() },
      actor
    );

    await storage.changePassword(id, 'MonNouveauMdp1', actor);

    const oldPasswordResult = await storage.verifyStaffLogin(email, tempPassword);
    expect(oldPasswordResult).toEqual({ ok: false, reason: 'wrong_password' });

    const newPasswordResult = await storage.verifyStaffLogin(email, 'MonNouveauMdp1');
    expect(newPasswordResult).toEqual(expect.objectContaining({ ok: true, mustChangePassword: false }));
  });

  it('resetUserPassword régénère un nouveau mot de passe temporaire et invalide l’ancien', async () => {
    const actor = storage.getUsers()[0];
    const email = uniqueEmail();
    const tempPassword = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(tempPassword, salt);
    const id = 'usr-test-' + counter;

    storage.addUser(
      { id, name: 'Compte test', email, role: 'investigator', roleTitle: 'Investigateur', entity: 'Toutes entités', country: 'Groupe ACTIVA', passwordHash: hash, passwordSalt: salt, mustChangePassword: false, passwordSetAt: new Date().toISOString() },
      actor
    );

    const newPlaintext = await storage.resetUserPassword(id, actor);
    expect(newPlaintext).not.toBe(tempPassword);

    const oldPasswordResult = await storage.verifyStaffLogin(email, tempPassword);
    expect(oldPasswordResult).toEqual({ ok: false, reason: 'wrong_password' });

    const newPasswordResult = await storage.verifyStaffLogin(email, newPlaintext);
    expect(newPasswordResult).toEqual(expect.objectContaining({ ok: true, mustChangePassword: true }));
  });
});
