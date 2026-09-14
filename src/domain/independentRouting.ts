// === AMÉLIORATION AJOUTÉE (Phase 3 — routage indépendant) ===
//
// Moteur de résolution d'autorité indépendante (brief §47-68) : lorsqu'une
// personne mise en cause (ou un témoin) d'un dossier est rattachée à un
// compte réel de la plateforme (InvolvedPerson.linkedUserId /
// Witness.linkedUserId, Phase 1-2), ce module calcule QUI doit en être
// exclu et VERS QUI le dossier doit être routé — logique pure, sans effet
// de bord, câblée dans storage.ts/useVisibleAlerts/assignmentEngine à la
// Phase 4.
//
// Chaîne de résolution (dans l'ordre) : conflit/implication → compte actif
// → niveau hiérarchique strictement supérieur au niveau maximal des
// personnes mises en cause → permission d'investigation (cases.edit OU
// cases.assign, jamais l'un sans l'autre — §63 "privilège technique ≠
// autorité d'investigation") → plafond de confidentialité suffisant →
// périmètre local (même pays/entité) prioritaire, repli Groupe sinon
// (§14/§44, même principe que l'escalade DARC Groupe existante).
//
// Réutilise volontairement l'existant plutôt que de le redériver :
// `scopeMatchFor` (domain/assignmentEngine.ts, Phase 4 du plan précédent,
// exportée pour cette phase), `userCan`/`canSeeAlertConfidentiality`
// (services/authz.ts).

import { AlertRecord, UserProfile, UserRole } from '../types';
import { HierarchyLevels } from '../data/activaConfig';
import { userCan, canSeeAlertConfidentiality } from '../services/authz';
import { roleHasPermission } from './permissions';
import { scopeMatchFor } from './assignmentEngine';

/**
 * Comptes réels rattachés aux PERSONNES MISES EN CAUSE de ce dossier
 * (InvolvedPerson.linkedUserId). Ce sont ces comptes-là, et uniquement
 * ceux-là, qui perdent tout accès au dossier (§49) — un témoin lié
 * n'est JAMAIS exclu de la visibilité, voir getConflictedUserIds
 * ci-dessous pour la distinction.
 */
export function getImplicatedUserIds(alert: Pick<AlertRecord, 'involvedPersons'>): string[] {
  const ids = alert.involvedPersons
    .map((p) => p.linkedUserId)
    .filter((id): id is string => !!id);
  return Array.from(new Set(ids));
}

/**
 * Comptes qui ne peuvent pas devenir la nouvelle autorité de ce dossier :
 * les personnes mises en cause ci-dessus, PLUS les témoins liés (un témoin
 * lié est un facteur de conflit pour une CIBLE de routage — on ne route
 * pas un dossier vers l'un de ses propres témoins — mais n'est pas exclu
 * de la visibilité du dossier lui-même, qu'il continue de voir s'il y a
 * accès par ailleurs).
 */
export function getConflictedUserIds(alert: Pick<AlertRecord, 'involvedPersons' | 'witnesses'>): string[] {
  const witnessIds = alert.witnesses
    .map((w) => w.linkedUserId)
    .filter((id): id is string => !!id);
  return Array.from(new Set([...getImplicatedUserIds(alert), ...witnessIds]));
}

// === AMÉLIORATION AJOUTÉE (Phase 3 — routage indépendant) ===
// Un rôle est éligible comme CIBLE de routage s'il peut réellement traiter
// un dossier (cases.edit OU cases.assign — jamais l'un sans l'autre : voir
// darc_compliance, qui a cases.assign sans cases.edit). Vérification par
// RÔLE SEUL (pas par UserProfile complet), réutilisée à la fois par
// resolveIndependentAuthority (sur un compte réel) et getRoutingMatrixView
// (sur la table de niveaux seule, sans compte réel en jeu).
function isRoutingEligibleRole(role: UserRole): boolean {
  return roleHasPermission(role, 'cases.edit') || roleHasPermission(role, 'cases.assign');
}

export interface IndependentAuthorityResolution {
  /** Candidats éligibles, triés du niveau le plus proche au plus élevé (voir tri ci-dessous). */
  candidates: UserProfile[];
  /** 'local' si au moins un candidat de périmètre local existe (toujours préféré) ; 'group' si repli Groupe uniquement ; null si aucun candidat. */
  scopeMatch: 'local' | 'group' | null;
  /** false = aucune autorité indépendante disponible (ex. le rôle opérationnel le plus élevé mis en cause lui-même) — nécessite une intervention manuelle, pas un bug. */
  found: boolean;
}

/**
 * Résout l'autorité indépendante d'un dossier. `users` doit être la
 * population complète des comptes de la plateforme (storage.getUsers()) ;
 * `hierarchyLevels` vient de storage.getHierarchyLevels() (ou
 * DEFAULT_HIERARCHY_LEVELS pour prévisualiser sans compte admin-édité).
 */
export function resolveIndependentAuthority(
  alert: AlertRecord,
  users: UserProfile[],
  hierarchyLevels: HierarchyLevels
): IndependentAuthorityResolution {
  const conflictedIds = new Set(getConflictedUserIds(alert));
  const implicatedIds = getImplicatedUserIds(alert);

  if (implicatedIds.length === 0) {
    // Rien à router : aucune personne mise en cause n'est liée à un compte.
    return { candidates: [], scopeMatch: null, found: false };
  }

  // Niveau hiérarchique maximal parmi les personnes mises en cause
  // effectivement rattachées à un compte réel connu (un linkedUserId
  // pointant vers un compte supprimé/inconnu est ignoré plutôt que de
  // faire échouer tout le calcul).
  const implicatedUsers = implicatedIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserProfile => !!u);
  if (implicatedUsers.length === 0) {
    return { candidates: [], scopeMatch: null, found: false };
  }
  const maxImplicatedLevel = Math.max(...implicatedUsers.map((u) => hierarchyLevels[u.role] ?? 0));

  const eligible = users.filter((u) => {
    if (conflictedIds.has(u.id)) return false; // implication ou conflit (témoin)
    if (u.active === false) return false; // compte marqué indisponible
    if ((hierarchyLevels[u.role] ?? 0) <= maxImplicatedLevel) return false; // niveau strictement supérieur requis
    if (!isRoutingEligibleRole(u.role)) return false; // cases.edit OU cases.assign
    if (!canSeeAlertConfidentiality(u, alert)) return false; // plafond de confidentialité
    return true;
  });

  const local = eligible.filter((u) => scopeMatchFor(u, alert) === 'local');
  const group = eligible.filter((u) => scopeMatchFor(u, alert) === 'global');

  // Trie chaque groupe par niveau hiérarchique croissant (l'autorité la
  // plus proche d'abord, pas nécessairement la plus haute), puis par nom
  // pour un résultat déterministe — storage.triggerIndependentRouting()
  // (Phase 4) retiendra le premier candidat de la liste retenue.
  const byLevelThenName = (a: UserProfile, b: UserProfile) =>
    (hierarchyLevels[a.role] ?? 0) - (hierarchyLevels[b.role] ?? 0) || a.name.localeCompare(b.name);
  local.sort(byLevelThenName);
  group.sort(byLevelThenName);

  if (local.length > 0) return { candidates: local, scopeMatch: 'local', found: true };
  if (group.length > 0) return { candidates: group, scopeMatch: 'group', found: true };
  return { candidates: [], scopeMatch: null, found: false };
}

export interface RoutingMatrixRow {
  role: UserRole;
  level: number;
  /** Rôle(s) au niveau hiérarchique immédiatement supérieur, parmi les rôles éligibles comme cible de routage. Vide = aucune autorité indépendante possible pour ce rôle (ex. darc_compliance). */
  nextLevelRoles: UserRole[];
}

/**
 * Vue dérivée en LECTURE SEULE de la table de niveaux, pour l'administration
 * (AdminConfigView.tsx, onglet Gouvernance, Phase 5) — jamais une seconde
 * table à maintenir à la main, qui pourrait diverger de hierarchyLevels.
 */
export function getRoutingMatrixView(hierarchyLevels: HierarchyLevels): RoutingMatrixRow[] {
  const roles = Object.keys(hierarchyLevels) as UserRole[];
  return roles.map((role) => {
    const level = hierarchyLevels[role];
    const eligibleAbove = roles.filter((r) => hierarchyLevels[r] > level && isRoutingEligibleRole(r));
    if (eligibleAbove.length === 0) {
      return { role, level, nextLevelRoles: [] };
    }
    const minLevelAbove = Math.min(...eligibleAbove.map((r) => hierarchyLevels[r]));
    const nextLevelRoles = eligibleAbove.filter((r) => hierarchyLevels[r] === minLevelAbove);
    return { role, level, nextLevelRoles };
  });
}
