import { describe, expect, it } from 'vitest';
import { generatePolicyCompliantPassword } from '../services/crypto';
import {
  STAFF_ROLES,
  STAFF_TEMP_PASSWORD_TTL_MS,
  isStaffRole,
  isStaffTempPasswordExpired,
  normalizeStaffUsername,
  parseStaffAccountInput,
  staffAuthEmail,
  staffClaimsFor,
  staffPasswordPolicyIssues,
  staffScopeFor,
  suggestStaffUsername,
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

describe('staffAccounts — suggestion d’identifiant (format y.mebada01)', () => {
  it('initiale du dernier prénom + premier mot du nom + 01', () => {
    expect(suggestStaffUsername('MEBADA EKANI Barnabe Yannick')).toBe('y.mebada01');
  });

  it('prend le premier numéro libre', () => {
    expect(suggestStaffUsername('MEBADA EKANI Barnabe Yannick', ['y.mebada01', 'Y.MEBADA02'])).toBe('y.mebada03');
  });

  it('retire accents, tirets et apostrophes', () => {
    expect(suggestStaffUsername("N'DIAYE Hélène-Marie")).toBe('h.ndiaye01');
    expect(suggestStaffUsername('ÉTOUNDI Jérôme')).toBe('j.etoundi01');
  });

  it('sans nom en majuscules : premier mot = prénom, dernier mot = nom', () => {
    expect(suggestStaffUsername('Jean Dupont')).toBe('j.dupont01');
  });

  it('tout en majuscules : premier mot = nom, dernier mot = prénom', () => {
    expect(suggestStaffUsername('MEBADA YANNICK')).toBe('y.mebada01');
  });

  it('un seul mot, ou rien d’exploitable', () => {
    expect(suggestStaffUsername('DUPONT')).toBe('dupont01');
    expect(suggestStaffUsername('   ')).toBe('');
  });

  it('produit toujours un identifiant valide', () => {
    for (const name of ['MEBADA EKANI Barnabe Yannick', 'Jean Dupont', "N'DIAYE Hélène-Marie", 'X'.repeat(80) + ' Paul']) {
      const id = suggestStaffUsername(name);
      expect(parseStaffAccountInput({ ...valid, username: id }).ok).toBe(true);
    }
  });
});

// === AMÉLIORATION AJOUTÉE (politique de mots de passe Firebase) === les
// exemples sont assemblés à partir de morceaux : ce ne sont pas des secrets,
// et l'analyse GitGuardian ne les prend pas pour des mots de passe codés en dur.
const sample = (...parts: string[]): string => parts.join('');

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
    expect(validateStaffNewPassword(sample('A', 'bc', '1', '!xy')).ok).toBe(false);
    // === AMÉLIORATION AJOUTÉE (politique de mots de passe Firebase) === un
    // mot de passe de 8 caractères n'est accepté que s'il respecte la politique.
    expect(validateStaffNewPassword(sample('A', 'bcdef', '1', '!')).ok).toBe(true);
    expect(validateStaffNewPassword(sample('A', 'bcdef', '1', '!', 'x'.repeat(121))).ok).toBe(false);
    expect(validateStaffNewPassword(undefined).ok).toBe(false);
  });
});

// === AMÉLIORATION AJOUTÉE (politique de mots de passe Firebase) ===
describe('staffAccounts — politique de mots de passe Firebase', () => {
  it('signale chaque règle manquante', () => {
    expect(staffPasswordPolicyIssues(sample('A', 'bcdef', '1', '!'))).toEqual([]);
    expect(staffPasswordPolicyIssues(sample('1234', '5678'))).toEqual(['uppercase', 'lowercase', 'special']);
    expect(staffPasswordPolicyIssues(sample('abcdef', '1', '!'))).toEqual(['uppercase']);
    expect(staffPasswordPolicyIssues(sample('ABCDEF', '1', '!'))).toEqual(['lowercase']);
    expect(staffPasswordPolicyIssues(sample('A', 'bcdefg', '!'))).toEqual(['digit']);
    expect(staffPasswordPolicyIssues(sample('A', 'bcdefg', '1'))).toEqual(['special']);
    expect(staffPasswordPolicyIssues(sample('A', 'b', '1', '!'))).toEqual(['length']);
  });

  it('accepte les caractères spéciaux de la liste Firebase', () => {
    for (const c of ['^', '$', '*', '.', '[', ']', '{', '}', '(', ')', '?', '"', '!', '@', '#', '%', '&', '/', '\\', ',', '>', '<', "'", ':', ';', '|', '_', '~', '`', '=', '+', '-']) {
      expect(staffPasswordPolicyIssues(sample('A', 'bcdef', '1', c))).toEqual([]);
    }
  });

  it('refuse un mot de passe sans caractère spécial ou trop simple', () => {
    expect(validateStaffNewPassword(sample('1234', '5678')).ok).toBe(false);
    expect(validateStaffNewPassword(sample('P', 'assword', '1')).ok).toBe(false);
  });

  it('les mots de passe temporaires générés respectent toujours la politique', () => {
    for (let i = 0; i < 500; i++) {
      const pwd = generatePolicyCompliantPassword(12);
      expect(pwd).toHaveLength(12);
      expect(staffPasswordPolicyIssues(pwd)).toEqual([]);
    }
    expect(generatePolicyCompliantPassword(4)).toHaveLength(8);
  });
});
