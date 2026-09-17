// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) ===
//
// Petit module partagé qui centralise "quels espaces (Opérateur/Enquêteur/
// Administration) un compte peut-il voir ?" — jusqu'ici cette logique
// n'existait qu'à un seul endroit (StaffPortalLayout.tsx, pour construire
// son sélecteur en barre latérale). La nouvelle page d'accueil des espaces
// (StaffSpaceHome.tsx) et la redirection post-connexion (App.tsx) ont
// besoin exactement du même calcul : plutôt que de le dupliquer à 3
// endroits (risque réel de désynchronisation, ex. un compte verrait un
// espace dans un menu mais pas dans l'autre), il est extrait ici une seule
// fois. Comportement strictement identique à avant — aucune règle
// d'habilitation n'est modifiée, seulement déplacée.
import { UserProfile } from '../types';
import { isGlobalCaseViewer, canManageConfiguration, userCan } from '../services/authz';

export type SpaceKey = 'operator' | 'investigator' | 'admin' | 'general';

// === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === BUG
// PRÉEXISTANT CORRIGÉ (déjà documenté dans StaffPortalLayout.tsx avant
// cette extraction) : `cases.assign` seul ne suffit plus à garantir l'accès
// à l'espace Opérateur depuis que la matrice de permissions est éditable en
// administration — la vraie garde de `/operator/dashboard` (App.tsx) est
// `isGlobalViewer`, une table séparée. Alignée ici sur la garde réelle.
// === AMÉLIORATION AJOUTÉE : `senior_investigator` (Responsable des
// Investigations Groupe) retiré de l'exclusion — il obtient désormais
// `cases.assign` + la vision globale de son périmètre par défaut
// (domain/permissions.ts), donc passe naturellement le test générique
// ci-dessous, exactement comme functional_admin/darc_compliance.
// `investigator` (enquêteur simple) reste strictement exclu — comportement
// inchangé.
export function canSeeOperatorSpace(user: UserProfile): boolean {
  if (user.role === 'investigator') {
    return false;
  }
  return userCan(user, 'cases.assign') && isGlobalCaseViewer(user);
}
export function canSeeInvestigatorSpace(user: UserProfile): boolean {
  return userCan(user, 'cases.edit') || user.role === 'investigator' || user.role === 'senior_investigator';
}
export function canSeeAdminSpace(user: UserProfile): boolean {
  if (user.role === 'investigator' || user.role === 'senior_investigator') {
    return false;
  }
  return canManageConfiguration(user);
}

/** Espaces réellement disponibles pour ce compte, dans un ordre de priorité stable. */
export function computeAvailableSpaces(user: UserProfile): SpaceKey[] {
  // Pour les investigateurs simples, afficher strictement et uniquement le bouton Espace Enquêteur.
  // === AMÉLIORATION AJOUTÉE : `senior_investigator` (Responsable des
  // Investigations Groupe) retiré de ce cas particulier — il doit voir à la
  // fois Espace Opérateur et Espace Enquêteur par défaut, donc passe par le
  // calcul générique ci-dessous (canSeeOperatorSpace/canSeeInvestigatorSpace/
  // canSeeAdminSpace) au lieu d'être court-circuité sur Enquêteur seul.
  if (user.role === 'investigator') {
    return ['investigator'];
  }
  return [
    ...(canSeeOperatorSpace(user) ? (['operator'] as const) : []),
    ...(canSeeInvestigatorSpace(user) ? (['investigator'] as const) : []),
    ...(canSeeAdminSpace(user) ? (['admin'] as const) : []),
  ];
}

/** Onglet "tableau de bord" de chacun des 3 espaces réels (pas `general`, qui dépend du repli propre à chaque appelant). */
export const SPACE_DASHBOARD_TAB: Record<'operator' | 'investigator' | 'admin', string> = {
  operator: 'op_dashboard',
  investigator: 'inv_dashboard',
  admin: 'settings',
};

// === AMÉLIORATION AJOUTÉE (Accueil des espaces — étendu à tous les
// profils) === Un compte sans aucun des 3 espaces réels (consultation,
// executive, audit_committee, security_admin — lecture globale sans
// attribution ni investigation ni administration) reçoit un unique espace
// "general" de repli. Cette fonction reprend exactement la logique qui
// vivait jusqu'ici dans `App.tsx` (`handleLogin`) — extraite ici pour que
// `StaffSpaceHome.tsx` puisse déterminer la destination de cette carte
// sans dupliquer la règle.
export function computeGeneralDashboardTab(user: UserProfile): string {
  return isGlobalCaseViewer(user) ? 'control_panel' : 'reports';
}
