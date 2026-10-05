/**
 * === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
 * enregistrés dans Firebase) ===
 *
 * Règles PURES partagées par les Cloud Functions de gestion des comptes
 * (functions/src/staffAccounts.ts), par le portail (StaffLoginView.tsx,
 * admin/UsersTab.tsx) et par le script d'amorçage du premier administrateur
 * (scripts/bootstrapStaffAdmin.ts) : validation d'un compte, rôles
 * autorisés, portée pays/entités posée en custom claims, identifiant de
 * connexion Firebase Auth et expiration du mot de passe temporaire. Aucun
 * accès Firebase ici : importable depuis le navigateur comme depuis Node.
 *
 * Identifiant de connexion : le personnel se connecte avec un IDENTIFIANT
 * (`username`), jamais son adresse e-mail (demande explicite, inchangée).
 * Firebase Auth exigeant une adresse, le compte Auth porte une adresse
 * technique DÉRIVÉE de l'identifiant (`staffAuthEmail`), sur un sous-domaine
 * du projet qui ne reçoit aucun courrier. L'adresse e-mail réelle du
 * collaborateur (notifications) reste dans son profil Firestore. Résultat :
 * aucune fonction publique « identifiant → e-mail » n'est nécessaire (pas
 * d'énumération possible), et la protection anti-force brute de Firebase
 * Auth s'applique telle quelle.
 */
import { RoleId } from './caseTypes';

/** Rôles qu'un compte du personnel peut recevoir (tous sauf `reporter`, qui n'a jamais de compte). */
export const STAFF_ROLES: RoleId[] = [
  'investigator',
  'senior_investigator',
  'functional_admin',
  'darc_compliance',
  'consultation',
  'executive',
  'system_admin',
  'security_admin',
  'audit_committee',
];

/**
 * Rôles à vision Groupe : pays/entités vides = aucune restriction (même liste
 * que scripts/setupAuthUsers.ts, et que GLOBAL_VISIBILITY_ROLES côté
 * permissions.ts pour les rôles concernés).
 */
export const GLOBAL_SCOPE_ROLES: RoleId[] = ['functional_admin', 'darc_compliance', 'consultation', 'executive', 'system_admin'];

/** Libellés « tout le Groupe » utilisés par l'écran Utilisateurs quand aucun pays/entité n'est choisi. */
const ALL_COUNTRIES_LABELS = ['', 'groupe activa'];
const ALL_ENTITIES_LABELS = ['', 'toutes entités', 'toutes entites'];

/** Même durée que storage.ts (TEMP_PASSWORD_TTL_MS) : 4 heures. */
export const STAFF_TEMP_PASSWORD_TTL_MS = 4 * 60 * 60 * 1000;

export const STAFF_PASSWORD_MIN_LENGTH = 8;
export const STAFF_PASSWORD_MAX_LENGTH = 128;

/** 3 à 64 caractères : lettres minuscules, chiffres, `.`, `_`, `-` ; commence et finit par une lettre ou un chiffre. */
export const STAFF_USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,62})[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStaffUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Adresse technique du compte Firebase Auth, dérivée de l'identifiant (voir l'en-tête). */
export function staffAuthEmail(username: string, projectId: string): string {
  return `${normalizeStaffUsername(username)}@staff.${projectId}.firebaseapp.com`;
}

export function isStaffRole(value: unknown): value is RoleId {
  return typeof value === 'string' && (STAFF_ROLES as string[]).includes(value);
}

/** Données d'un compte saisies dans l'écran Utilisateurs. */
export interface StaffAccountInput {
  name: string;
  email: string;
  username: string;
  role: RoleId;
  roleTitle: string;
  entity: string;
  country: string;
}

/** Profil enregistré dans Firestore (`staff_users/{uid}`) — jamais de mot de passe ni d'empreinte. */
export interface StaffAccountProfile extends StaffAccountInput {
  id: string;
  countries: string[];
  entities: string[];
  active: boolean;
  mustChangePassword: boolean;
  passwordSetAt: string;
  createdAt: string;
  updatedAt: string;
}

export type StaffParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Valide la saisie d'un compte (création, ou modification si `partial`).
 * En modification, seuls les champs présents sont validés et renvoyés.
 */
export function parseStaffAccountInput(raw: unknown, partial = false): StaffParseResult<Partial<StaffAccountInput>> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid account data.' };
  const input = raw as Record<string, unknown>;
  const out: Partial<StaffAccountInput> = {};
  const has = (key: string) => !partial || input[key] !== undefined;

  if (has('name')) {
    const name = cleanText(input.name, 120);
    if (!name) return { ok: false, error: 'Name is required.' };
    out.name = name;
  }
  if (has('email')) {
    const email = cleanText(input.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email address is required.' };
    out.email = email;
  }
  if (has('username')) {
    const username = normalizeStaffUsername(input.username);
    if (!STAFF_USERNAME_RE.test(username)) {
      return { ok: false, error: 'Username must be 3-64 characters: lowercase letters, digits, ".", "_" or "-".' };
    }
    out.username = username;
  }
  if (has('role')) {
    if (!isStaffRole(input.role)) return { ok: false, error: 'Unknown staff role.' };
    out.role = input.role;
  }
  if (has('roleTitle')) out.roleTitle = cleanText(input.roleTitle, 120);
  if (has('entity')) out.entity = cleanText(input.entity, 120);
  if (has('country')) out.country = cleanText(input.country, 120);
  return { ok: true, value: out };
}

/**
 * Portée posée en custom claims (`countries`/`entities`), au format attendu
 * par `requireAppUser` et `can()` : vide pour un rôle à vision Groupe ou
 * pour « Groupe ACTIVA » / « Toutes entités », sinon le pays/l'entité choisi.
 */
export function staffScopeFor(role: RoleId, country: string, entity: string): { countries: string[]; entities: string[] } {
  if (GLOBAL_SCOPE_ROLES.includes(role)) return { countries: [], entities: [] };
  const c = country.trim();
  const e = entity.trim();
  return {
    countries: ALL_COUNTRIES_LABELS.includes(c.toLowerCase()) ? [] : [c],
    entities: ALL_ENTITIES_LABELS.includes(e.toLowerCase()) ? [] : [e],
  };
}

/** Custom claims d'un compte. `pwdTemp` : mot de passe temporaire pas encore changé (refusé par les fonctions métier). */
export function staffClaimsFor(
  role: RoleId,
  country: string,
  entity: string,
  pwdTemp: boolean
): { role: RoleId; countries: string[]; entities: string[]; pwdTemp?: true } {
  const scope = staffScopeFor(role, country, entity);
  return pwdTemp ? { role, ...scope, pwdTemp: true } : { role, ...scope };
}

/** Vrai si un mot de passe temporaire a dépassé sa durée de validité. */
export function isStaffTempPasswordExpired(mustChangePassword: boolean, passwordSetAt: string | undefined, now: number): boolean {
  if (!mustChangePassword || !passwordSetAt) return false;
  const setAt = new Date(passwordSetAt).getTime();
  if (Number.isNaN(setAt)) return true;
  return now - setAt > STAFF_TEMP_PASSWORD_TTL_MS;
}

// === AMÉLIORATION AJOUTÉE (format d'identifiant demandé : « y.mebada01 ») ===
function asciiLower(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isUpperCaseWord(word: string): boolean {
  return /\p{L}/u.test(word) && word === word.toUpperCase();
}

/**
 * Suggestion d'identifiant au format demandé : initiale du DERNIER prénom,
 * « . », premier mot du nom de famille, numéro à 2 chiffres (01, 02… : le
 * premier libre parmi `taken`). Ex. « MEBADA EKANI Barnabe Yannick » →
 * `y.mebada01`.
 *
 * Nom de famille = mots en MAJUSCULES en tête du nom complet ; prénoms = la
 * suite (tout en majuscules : premier mot = nom, dernier = prénom). Sans
 * nom en majuscules (« Jean Dupont »), le premier mot est pris
 * comme prénom et le dernier comme nom. Accents et caractères spéciaux
 * retirés. Renvoie '' si le nom ne permet aucune suggestion.
 */
export function suggestStaffUsername(fullName: string, taken: string[] = []): string {
  const words = fullName.trim().split(/\s+/).filter((w) => asciiLower(w));
  if (words.length === 0) return '';

  let surname: string;
  let givenName: string;
  const leadingUpper = words.findIndex((w) => !isUpperCaseWord(w));
  // Tout en majuscules (« MEBADA YANNICK ») : même convention NOM Prénom.
  if (leadingUpper > 0 || (leadingUpper === -1 && words.length >= 2)) {
    surname = words[0];
    givenName = words[words.length - 1];
  } else if (words.length >= 2) {
    givenName = words[0];
    surname = words[words.length - 1];
  } else {
    surname = words[0];
    givenName = '';
  }

  const initial = asciiLower(givenName).charAt(0);
  const base = (initial ? `${initial}.` : '') + asciiLower(surname).slice(0, 50);
  const used = new Set(taken.map((t) => normalizeStaffUsername(t)));
  for (let n = 1; n <= 99; n += 1) {
    const candidate = `${base}${String(n).padStart(2, '0')}`;
    if (!used.has(candidate) && STAFF_USERNAME_RE.test(candidate)) return candidate;
  }
  return '';
}

/** Nouveau mot de passe choisi par l'utilisateur. */
export function validateStaffNewPassword(value: unknown): StaffParseResult<string> {
  if (typeof value !== 'string' || value.length < STAFF_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters.` };
  }
  if (value.length > STAFF_PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${STAFF_PASSWORD_MAX_LENGTH} characters.` };
  }
  return { ok: true, value };
}
