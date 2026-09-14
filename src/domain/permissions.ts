/**
 * ACTIVA Hotline — RBAC permission model (Phase 2)
 *
 * Granular, atomic permissions (section 28 of the brief) instead of a single
 * `isAdmin` boolean, plus scope-based authorization (section 29): a user's
 * effective access to a given Case depends on Authentication ∧ Role holds the
 * permission ∧ country/entity scope covers the case ∧ (assigned OR role has
 * global visibility) ∧ confidentiality level the role is cleared for.
 *
 * This is pure, storage-agnostic logic — the real authority will be the
 * Cloud Functions / Firestore Security Rules built in Phase 3, which MUST
 * reuse this same table rather than re-deriving it, so client and server
 * never disagree about what a role can do.
 */

import { AppUser, Case, ConfidentialityLevel, Person, RoleId } from './caseTypes';

export type Permission =
  | 'cases.read'
  | 'cases.create'
  | 'cases.assign'
  | 'cases.reassign'
  | 'cases.edit'
  | 'cases.close'
  | 'cases.reopen'
  | 'cases.export'
  | 'evidence.read'
  | 'evidence.upload'
  | 'evidence.delete'
  | 'communications.read'
  | 'communications.send'
  | 'reports.read'
  | 'reports.export'
  | 'configuration.manage'
  | 'users.manage'
  | 'audit.read'
  // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu, rôle Security Admin) ===
  // Distinct de `configuration.manage` (système/utilisateurs) et de tout
  // accès aux dossiers : politiques de sécurité, authentification, MFA,
  // sessions — brief section 19 "SECURITY ADMIN".
  | 'security.manage';

/**
 * Role → permission set. Deliberately explicit and flat (no inheritance
 * magic) so it can be read and audited at a glance, and mirrored 1:1 into
 * Firestore custom claims / Security Rules later.
 */
export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  reporter: [], // reporters interact through a dedicated portal, never through case permissions
  investigator: ['cases.read', 'cases.edit', 'evidence.read', 'evidence.upload', 'communications.read', 'communications.send'],
  senior_investigator: [
    'cases.read',
    'cases.edit',
    'cases.reassign',
    'cases.close',
    'evidence.read',
    'evidence.upload',
    'evidence.delete',
    'communications.read',
    'communications.send',
    'reports.read',
  ],
  functional_admin: [
    'cases.read',
    'cases.create',
    'cases.assign',
    'cases.reassign',
    'cases.edit',
    'cases.close',
    'cases.reopen',
    'cases.export',
    'evidence.read',
    'evidence.upload',
    'evidence.delete',
    'communications.read',
    'communications.send',
    'reports.read',
    'reports.export',
    'audit.read',
  ],
  darc_compliance: [
    'cases.read',
    'cases.assign',
    'cases.reassign',
    'cases.close',
    'cases.reopen',
    'cases.export',
    'evidence.read',
    'communications.read',
    'reports.read',
    'reports.export',
    'audit.read',
  ],
  consultation: ['cases.read', 'evidence.read', 'communications.read', 'reports.read'],
  // System Administrator deliberately does NOT get cases.read / evidence.read / communications.read:
  // "System Administrator ≠ Case Access" (section 30 of the brief) — least privilege.
  system_admin: ['configuration.manage', 'users.manage', 'audit.read'],
  executive: ['reports.read'], // aggregated/anonymized dashboards only, never raw case content
  // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu à 10 rôles) ===
  // Security Admin: même principe de moindre privilège que system_admin —
  // aucun accès aux dossiers/preuves/communications, uniquement la gestion
  // des politiques de sécurité (brief section 19).
  security_admin: ['security.manage', 'audit.read'],
  // Audit Committee: lecture seule agrégée — jamais de cases.read direct
  // (accès uniquement via les rapports/l'Exécutif, comme `executive`),
  // mais avec en plus `audit.read` que `executive` n'a pas (brief section
  // 20 : "Executive Dashboard, Aggregated Reports... Audit information").
  // Interdiction explicite de modifier dossiers/preuves/permissions/
  // utilisateurs/workflows : obtenue simplement en n'accordant aucune de
  // ces permissions, jamais par une exception codée en dur.
  audit_committee: ['reports.read', 'audit.read'],
};

export function roleHasPermission(roleId: RoleId, permission: Permission): boolean {
  return ROLE_PERMISSIONS[roleId]?.includes(permission) ?? false;
}

/**
 * Confidentiality levels a given role is cleared to read, independent of
 * whether it otherwise has cases.read. A `consultation` user, for instance,
 * should not automatically see `highly_confidential` cases even though it
 * can read `restricted`/`confidential` ones.
 */
const ROLE_MAX_CONFIDENTIALITY: Record<RoleId, ConfidentialityLevel | null> = {
  reporter: null,
  investigator: 'confidential',
  senior_investigator: 'highly_confidential',
  functional_admin: 'highly_confidential',
  darc_compliance: 'highly_confidential',
  consultation: 'confidential',
  system_admin: null,
  executive: 'restricted',
  // === AMÉLIORATION AJOUTÉE (Phase 12) ===
  security_admin: null, // aucun accès aux dossiers, quel que soit leur niveau
  audit_committee: 'restricted', // même plafond qu'executive — vision agrégée, pas le contenu brut des dossiers
};

const CONFIDENTIALITY_RANK: Record<ConfidentialityLevel, number> = {
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // Nouveau palier le moins sensible (voir ConfidentialityLevel dans
  // caseTypes.ts). N'importe quel rôle déjà autorisé à voir des dossiers
  // (ROLE_MAX_CONFIDENTIALITY non-null) reste automatiquement autorisé à
  // voir un dossier "standard", sans changement à ROLE_MAX_CONFIDENTIALITY
  // lui-même.
  standard: 0,
  restricted: 1,
  confidential: 2,
  highly_confidential: 3,
};

// === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité des
// dossiers) === exportée (était privée) pour que `src/services/authz.ts`
// puisse l'appliquer au modèle local `AlertRecord`, maintenant qu'il porte
// lui aussi un `confidentialityLevel` réel.
export function isConfidentialityAllowed(roleId: RoleId, level: ConfidentialityLevel): boolean {
  const max = ROLE_MAX_CONFIDENTIALITY[roleId];
  if (!max) return false;
  return CONFIDENTIALITY_RANK[level] <= CONFIDENTIALITY_RANK[max];
}

// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
// Même comparaison que ci-dessus, mais contre un plafond explicite plutôt
// que le plafond par défaut du rôle — pour le nouveau champ
// `UserProfile.sensitivityClearance` (un compte peut avoir un plafond
// propre, distinct de celui de son rôle). Voir src/services/authz.ts
// `canSeeAlertConfidentiality`.
export function isConfidentialityAllowedForClearance(
  clearance: ConfidentialityLevel,
  level: ConfidentialityLevel
): boolean {
  return CONFIDENTIALITY_RANK[level] <= CONFIDENTIALITY_RANK[clearance];
}

/** True if the user's country/entity scope covers the case (empty scope = unrestricted, admin-style roles only). */
function isInScope(user: AppUser, kase: Pick<Case, 'country' | 'entity'>): boolean {
  const countryOk = user.countries.length === 0 || user.countries.includes(kase.country);
  const entityOk = user.entities.length === 0 || user.entities.includes(kase.entity);
  return countryOk && entityOk;
}

/** Global-visibility roles see every in-scope case; others only see cases they're explicitly assigned to. */
const GLOBAL_VISIBILITY_ROLES: RoleId[] = ['functional_admin', 'darc_compliance', 'consultation', 'executive'];

// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles
// dans l'app réelle) === Exposé pour que `src/services/authz.ts` (couche
// fine côté app locale) puisse répliquer "un rôle voit-il tous les
// dossiers ou seulement les siens" sans dupliquer GLOBAL_VISIBILITY_ROLES.
// N'évalue que le rôle, pas le périmètre pays/entité ni la confidentialité
// (voir `can()` ci-dessous pour la version complète, à contexte de dossier) —
// suffisant pour cette app locale tant qu'`AlertRecord` n'a pas de champ de
// confidentialité (prévu en Phase 12.5).
export function hasGlobalCaseVisibility(roleId: RoleId): boolean {
  return roleHasPermission(roleId, 'cases.read') && GLOBAL_VISIBILITY_ROLES.includes(roleId);
}

export interface CaseAccessContext {
  case: Pick<Case, 'country' | 'entity' | 'confidentialityLevel' | 'assignee'> & {
    additionalInvestigators: string[];
  };
  /** Persons linked to a user account and marked `kind = 'subject'` on this case. */
  implicatedUserIds?: string[];
}

/**
 * The single source of truth for "can this user do X on this case". Both the
 * future Cloud Functions and any client-side UI guard should call this
 * (never re-implement the logic locally) — see App.tsx's existing
 * `renderAccessDenied` guard for the kind of place this plugs into once the
 * new Case model lands in the UI (Phase 4+).
 */
export function can(user: AppUser, permission: Permission, context?: CaseAccessContext): boolean {
  if (!user.active) return false;
  if (!roleHasPermission(user.roleId, permission)) return false;

  // Non-case-scoped permissions (configuration, users, reports) stop here.
  if (!context) return true;

  // Rule #9 of the brief: a person implicated in a report must NEVER access
  // that case, regardless of role or assignment.
  if (context.implicatedUserIds?.includes(user.userId)) return false;

  if (!isInScope(user, context.case)) return false;
  if (!isConfidentialityAllowed(user.roleId, context.case.confidentialityLevel)) return false;

  const isAssigned = context.case.assignee === user.userId || context.case.additionalInvestigators.includes(user.userId);
  const hasGlobalVisibility = GLOBAL_VISIBILITY_ROLES.includes(user.roleId);

  return isAssigned || hasGlobalVisibility;
}

/** Convenience helper mirroring the linkedUserId rule from Person, for callers that already have the person list. */
export function implicatedUserIdsFromPersons(persons: Person[]): string[] {
  return persons.filter((p) => p.kind === 'subject' && p.linkedUserId).map((p) => p.linkedUserId as string);
}
