/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
 *
 * Fine couche-pont entre le `UserProfile` réellement utilisé par
 * l'application (src/types.ts, désormais basé sur `RoleId`) et le modèle
 * RBAC réel (src/domain/permissions.ts). Chaque écran importe ces
 * fonctions au lieu de comparer `activeUser.role === '...'` à la main —
 * une seule implémentation de "qui a le droit de voir/faire quoi",
 * partagée par tous les écrans, au lieu de la même logique à 3 branches
 * dupliquée dans ~9 fichiers comme c'était le cas avant cette phase.
 *
 * IMPORTANT (limite assumée) : ces fonctions n'évaluent que le RÔLE — pas
 * encore le périmètre pays/entité, la confidentialité du dossier, ni
 * l'assignation (voir `can()` dans domain/permissions.ts pour la version
 * complète, prévue pour le futur modèle `Case`). Le modèle local
 * `AlertRecord` n'a pas encore de champ de confidentialité (Phase 12.5) ;
 * en attendant, la visibilité par dossier assigné continue d'utiliser la
 * vérification `assignedInvestigators.includes(activeUser.id)` déjà
 * existante dans chaque écran, inchangée.
 */
import { UserProfile, AlertRecord } from '../types';
import {
  Permission,
  roleHasPermission,
  hasGlobalCaseVisibility,
  isConfidentialityAllowed,
  isConfidentialityAllowedForClearance,
} from '../domain/permissions';

export function userCan(user: UserProfile, permission: Permission): boolean {
  return roleHasPermission(user.role, permission);
}

/**
 * Remplace l'ancien `isGlobalViewer` codé en dur (
 * `role === 'functional_admin' || role === 'system_admin' || role === 'auditor'`)
 * répété dans App.tsx, Navbar.tsx, StaffPortalLayout.tsx, ControlPanel.tsx,
 * InvestigationDesk.tsx et les 4 registres transverses. Diffère
 * volontairement de l'ancien comportement sur un point précis et documenté
 * par le brief lui-même (section 30, « System Administrator ≠ Case
 * Access ») : `system_admin` n'a plus accès aux dossiers.
 */
export function isGlobalCaseViewer(user: UserProfile): boolean {
  return hasGlobalCaseVisibility(user.role);
}

/** Piste d'audit — désormais une vraie permission (`audit.read`), pas seulement "un des 3 rôles admin". */
export function canSeeAuditTrail(user: UserProfile): boolean {
  return userCan(user, 'audit.read');
}

/** Administration système (configuration, comptes utilisateurs). */
export function canManageConfiguration(user: UserProfile): boolean {
  return userCan(user, 'configuration.manage');
}

/** Un utilisateur "collaborateur" (pas le lanceur d'alerte public) — remplace `role !== 'whistleblower'`. */
export function isStaffUser(user: UserProfile): boolean {
  return user.role !== 'reporter';
}

/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
 * Vraie application (pas seulement un badge décoratif) du plafond de
 * confidentialité déjà défini par rôle dans domain/permissions.ts,
 * maintenant qu'`AlertRecord` porte un `confidentialityLevel` réel. Un
 * dossier sans valeur (créé avant cette phase) est traité comme
 * `restricted` — le niveau le moins sensible, donc jamais restrictif pour
 * personne rétroactivement.
 */
export function canSeeAlertConfidentiality(user: UserProfile, alert: Pick<AlertRecord, 'confidentialityLevel'>): boolean {
  const level = alert.confidentialityLevel ?? 'restricted';
  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // Un compte avec un plafond propre (sensitivityClearance) est évalué
  // contre CE plafond plutôt que celui, par défaut, de son rôle. Absent
  // (cas de tous les comptes aujourd'hui) → comportement strictement
  // inchangé.
  if (user.sensitivityClearance) {
    return isConfidentialityAllowedForClearance(user.sensitivityClearance, level);
  }
  return isConfidentialityAllowed(user.role, level);
}

// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
/**
 * Le périmètre pays/entité (`UserProfile.countries`/`entities`, Phase 1)
 * couvre-t-il ce dossier (`AlertRecord.countryId`/`entityId`, Phase 1) ?
 * Reprend exactement la logique déjà éprouvée d'`isInScope()` dans
 * `domain/permissions.ts` (périmètre vide = illimité), avec UNE différence
 * volontaire : un dossier qui n'a pas encore de `countryId`/`entityId`
 * (tout dossier créé avant cette phase) n'est JAMAIS restreint par cette
 * dimension — le rattachement pays/entité "structurant" ne s'applique
 * simplement pas encore à lui, il reste visible exactement comme avant
 * cette phase.
 */
export function isInScope(user: UserProfile, alert: Pick<AlertRecord, 'countryId' | 'entityId'>): boolean {
  const countries = user.countries ?? [];
  const entities = user.entities ?? [];
  const countryOk = countries.length === 0 || !alert.countryId || countries.includes(alert.countryId);
  const entityOk = entities.length === 0 || !alert.entityId || entities.includes(alert.entityId);
  return countryOk && entityOk;
}
