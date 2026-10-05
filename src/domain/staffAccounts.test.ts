import { describe, expect, it } from 'vitest';
import {
  STAFF_ROLES,
  STAFF_TEMP_PASSWORD_TTL_MS,
  isStaffRole,
  isStaffTempPasswordExpired,
  normalizeStaffUsername,
  parseStaffAccountInput,
  staffAuthEmail,
  staffClaimsFor,
  staffScopeFor,
  validateStaffNewPassword,
} from './staffAccounts';

const valid = {
  name: ' Jean Dupont ',
  email: 'Jean.Dupont@Group-Activa.com',
  username: ' Jean.Dupont ',
  role: 'investigator',
  roleTitle: 'Investigateur DARC',
  entity: 'ACTIVA Assurances',
  country: 'Cameroun',
};

describe('staffAccounts — identifiant et adresse technique', () => {
  it('normalise l’identifiant (casse, espaces)', () => {
    expect(normalizeStaffUsername('  J.Dupont ')).toBe('j.dupont');
    expect(normalizeStaffUsername(42)).toBe('');
  });

  it('dérive une adresse Firebase Auth stable du projet, indépendante de la casse saisie', () => {
    expect(staffAuthEmail('J.Dupont', 'activa-ethicalert-47246')).toBe('j.dupont@staff.activa-ethicalert-47246.firebaseapp.com');
    expect(staffAuthEmail(' j.dupont ', 'p')).toBe(staffAuthEmail('J.DUPONT', 'p'));
  });
});

describe('staffAccounts — parseStaffAccountInput', () => {
  it('accepte et nettoie une création complète', () => {
    const r = parseStaffAccountInput(valid);
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Jean Dupont',
        email: 'jean.dupont@group-activa.com',
        username: 'jean.dupont',
        role: 'investigator',
        roleTitle: 'Investigateur DARC',
        entity: 'ACTIVA Assurances',
        country: 'Cameroun',
      },
    });
  });

  it('refuse un rôle inconnu ou `reporter`', () => {
    expect(parseStaffAccountInput({ ...valid, role: 'superuser' }).ok).toBe(false);
    expect(parseStaffAccountInput({ ...valid, role: 'reporter' }).ok).toBe(false);
    expect(isStaffRole('reporter')).toBe(false);
    expect(STAFF_ROLES).not.toContain('reporter');
  });

  it('refuse un identifiant hors format (espaces internes, trop court, caractères spéciaux)', () => {
    for (const username of ['jd', 'jean dupont', 'jean@dupont', '.jean', 'jean.', 'a'.repeat(65)]) {
      expect(parseStaffAccountInput({ ...valid, username }).ok).toBe(false);
    }
    expect(parseStaffAccountInput({ ...valid, username: 'j-d_1.x' }).ok).toBe(true);
  });

  it('refuse un e-mail invalide et un nom vide', () => {
    expect(parseStaffAccountInput({ ...valid, email: 'pas-un-email' }).ok).toBe(false);
    expect(parseStaffAccountInput({ ...valid, name: '   ' }).ok).toBe(false);
    expect(parseStaffAccountInput(null).ok).toBe(false);
  });

  it('en modification, ne valide et ne renvoie que les champs fournis', () => {
    expect(parseStaffAccountInput({ role: 'senior_investigator' }, true)).toEqual({ ok: true, value: { role: 'senior_investigator' } });
    expect(parseStaffAccountInput({ username: 'x' }, true).ok).toBe(false);
  });
});

describe('staffAccounts — portée et claims', () => {
  it('rôle à vision Groupe : aucune restriction, quel que soit le pays saisi', () => {
    expect(staffScopeFor('functional_admin', 'Cameroun', 'ACTIVA Vie')).toEqual({ countries: [], entities: [] });
  });

  it('rôle local : restreint au pays/à l’entité, sauf libellés « tout le Groupe »', () => {
    expect(staffScopeFor('investigator', 'Cameroun', 'ACTIVA Vie')).toEqual({ countries: ['Cameroun'], entities: ['ACTIVA Vie'] });
    expect(staffScopeFor('investigator', 'Groupe ACTIVA', 'Toutes entités')).toEqual({ countries: [], entities: [] });
    expect(staffScopeFor('investigator', '', '')).toEqual({ countries: [], entities: [] });
  });

  it('ajoute `pwdTemp` uniquement tant que le mot de passe temporaire n’a pas été changé', () => {
    expect(staffClaimsFor('investigator', 'Cameroun', '', true)).toEqual({ role: 'investigator', countries: ['Cameroun'], entities: [], pwdTemp: true });
    expect(staffClaimsFor('investigator', 'Cameroun', '', false)).toEqual({ role: 'investigator', countries: ['Cameroun'], entities: [] });
  });
});

describe('staffAccounts — mot de passe', () => {
  const setAt = '2026-10-04T10:00:00.000Z';
  const t0 = new Date(setAt).getTime();

  it('un mot de passe temporaire expire après 4 heures', () => {
    expect(isStaffTempPasswordExpired(true, setAt, t0 + STAFF_TEMP_PASSWORD_TTL_MS)).toBe(false);
    expect(isStaffTempPasswordExpired(true, setAt, t0 + STAFF_TEMP_PASSWORD_TTL_MS + 1)).toBe(true);
  });

  it('un mot de passe définitif n’expire jamais ; une date illisible est traitée comme expirée', () => {
    expect(isStaffTempPasswordExpired(false, setAt, t0 + 10 * STAFF_TEMP_PASSWORD_TTL_MS)).toBe(false);
    expect(isStaffTempPasswordExpired(true, 'pas une date', t0)).toBe(true);
  });

  it('impose 8 à 128 caractères', () => {
    expect(validateStaffNewPassword('1234567').ok).toBe(false);
    expect(validateStaffNewPassword('12345678').ok).toBe(true);
    expect(validateStaffNewPassword('x'.repeat(129)).ok).toBe(false);
    expect(validateStaffNewPassword(undefined).ok).toBe(false);
  });
});
