// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
//
// Moteur de compatibilité d'attribution (brief §11-13/§37) : avant de
// permettre l'attribution d'un dossier à un enquêteur, l'opérateur doit
// voir en priorité les enquêteurs dont le périmètre (pays+entité) COÏNCIDE
// avec le dossier ("compatibles"), puis, séparément et en second plan, les
// enquêteurs à vision Groupe ("autorisés Groupe") — jamais, par défaut, un
// enquêteur dont le périmètre ne correspond ni à l'un ni à l'autre.
//
// Diffère volontairement de `authz.isInScope()` (Phase 2, utilisé pour la
// VISIBILITÉ d'un dossier) : là-bas, un périmètre vide ET un dossier
// scopé-différemment sont tous deux "dans le périmètre" au sens large
// (rôle à vision globale). Ici, il faut distinguer les deux cas pour les
// répartir dans deux listes distinctes — voir `scopeMatchFor` ci-dessous.
import { AlertRecord, UserProfile } from '../types';
import { canSeeAlertConfidentiality, userCan } from '../services/authz';
import { WorkloadRow } from './workloadCalc';

export type ScopeMatch = 'local' | 'global' | 'mismatch';

// === AMÉLIORATION AJOUTÉE (Phase 3 — routage indépendant) ===
// Exportée (auparavant privée à ce module) pour que
// domain/independentRouting.ts réutilise exactement la même logique de
// périmètre local/Groupe plutôt que de la redériver — aucun changement de
// comportement ici, uniquement la visibilité du symbole.
export function scopeMatchFor(user: UserProfile, alert: Pick<AlertRecord, 'countryId' | 'entityId'>): ScopeMatch {
  const countries = user.countries ?? [];
  const entities = user.entities ?? [];
  if (countries.length === 0 && entities.length === 0) return 'global';
  // Un dossier sans countryId/entityId (créé avant la Phase 1) ne permet
  // pas de confirmer honnêtement une correspondance locale — un enquêteur
  // à périmètre restreint n'apparaît alors ni "compatible" ni "autorisé
  // Groupe" (il n'est pas Groupe), plutôt que d'être affiché par défaut
  // sur une correspondance qu'on ne peut pas vérifier.
  if (!alert.countryId || !alert.entityId) return 'mismatch';
  const countryOk = countries.length === 0 || countries.includes(alert.countryId);
  const entityOk = entities.length === 0 || entities.includes(alert.entityId);
  return countryOk && entityOk ? 'local' : 'mismatch';
}

export interface AssignmentCandidate {
  user: UserProfile;
  workload: WorkloadRow;
  scopeMatch: ScopeMatch;
}

export interface AssignmentCandidates {
  /** Périmètre pays+entité identique au dossier — à proposer en premier. */
  compatible: AssignmentCandidate[];
  /** Vision Groupe (périmètre vide) — proposé en second, jamais par défaut avant les compatibles. */
  groupAuthorized: AssignmentCandidate[];
}

/**
 * Calcule les candidats à l'attribution pour UN dossier. `users` doit déjà
 * être la population d'enquêteurs potentiels (typiquement
 * `storage.getUsers().filter(u => userCan(u, 'cases.edit'))`, comme
 * ailleurs dans l'app) ; `workloadRows` vient de
 * `computeWorkload()` (domain/workloadCalc.ts) sur ces mêmes utilisateurs.
 *
 * Facteurs appliqués, tous requis (brief §12 — "moteur de compatibilité") :
 * rôle habilité à investiguer (`cases.edit`) ∧ compte actif ∧ disponible
 * (UserProfile.active, Phase 1) ∧ plafond de confidentialité suffisant ∧
 * aucun conflit d'intérêts déclaré sur CE dossier par CET enquêteur.
 * Seul le périmètre pays/entité déplace ensuite le candidat entre les deux
 * listes — il ne l'exclut jamais à lui seul (un enquêteur hors périmètre
 * local ET non-Groupe est simplement absent des deux listes, jamais une
 * troisième liste "incompatible" à afficher par erreur).
 */
export function computeCandidates(
  alert: AlertRecord,
  users: UserProfile[],
  workloadRows: WorkloadRow[]
): AssignmentCandidates {
  const workloadByUserId = new Map(workloadRows.map((w) => [w.investigator.id, w]));
  const emptyWorkload = (u: UserProfile): WorkloadRow => ({ investigator: u, active: 0, overdue: 0, critical: 0 });

  const hasConflict = (u: UserProfile) =>
    (alert.conflictDeclarations ?? []).some((c) => c.userId === u.id && c.outcome === 'conflict_identified');

  const compatible: AssignmentCandidate[] = [];
  const groupAuthorized: AssignmentCandidate[] = [];

  for (const user of users) {
    if (!userCan(user, 'cases.edit')) continue; // doit réellement pouvoir investiguer
    if (user.active === false) continue; // explicitement marqué indisponible
    if (!canSeeAlertConfidentiality(user, alert)) continue; // plafond de confidentialité insuffisant
    if (hasConflict(user)) continue; // conflit d'intérêts déclaré sur ce dossier

    const scopeMatch = scopeMatchFor(user, alert);
    if (scopeMatch === 'mismatch') continue;

    const candidate: AssignmentCandidate = {
      user,
      workload: workloadByUserId.get(user.id) ?? emptyWorkload(user),
      scopeMatch,
    };
    (scopeMatch === 'local' ? compatible : groupAuthorized).push(candidate);
  }

  const byWorkloadAsc = (a: AssignmentCandidate, b: AssignmentCandidate) =>
    a.workload.active - b.workload.active || a.workload.overdue - b.workload.overdue;

  return {
    compatible: compatible.sort(byWorkloadAsc),
    groupAuthorized: groupAuthorized.sort(byWorkloadAsc),
  };
}
