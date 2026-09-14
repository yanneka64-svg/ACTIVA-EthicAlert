// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
//
// Charge de travail par enquêteur, extraite de `ControlPanel.tsx` (où ce
// calcul vivait auparavant en interne) pour que le futur moteur
// d'attribution (`assignmentEngine.ts`) et le Centre de Pilotage
// partagent EXACTEMENT les mêmes chiffres, au lieu de deux calculs
// indépendants qui pourraient diverger. Comportement du calcul lui-même
// inchangé — seule sa localisation change (`ACTIVE_STATUSES` devient la
// définition canonique, ControlPanel.tsx l'importe désormais au lieu de la
// redéclarer).

import { AlertRecord, UserProfile } from '../types';
import { computeSlaStatus } from '../services/statusMapping';

export const ACTIVE_STATUSES: AlertRecord['status'][] = ['new', 'under_review', 'investigation', 'corrective_action', 'reopened'];

export interface WorkloadRow {
  investigator: UserProfile;
  active: number;
  overdue: number;
  critical: number;
}

/**
 * Charge actuelle de chaque enquêteur passé en paramètre, sur l'ensemble
 * des dossiers passés en paramètre (pas de filtrage de périmètre/scope
 * ici — à la charge de l'appelant, comme c'était déjà le cas dans
 * ControlPanel.tsx qui calculait sur `alerts`, pas `visible`, pour une
 * vision Groupe de la charge de travail). Ne filtre ni ne trie les
 * enquêteurs à charge nulle : chaque appelant applique ses propres choix
 * d'affichage (ControlPanel masque les enquêteurs à 0 dossier actif ;
 * le moteur d'attribution, à l'inverse, a justement besoin de les voir —
 * un enquêteur disponible à 0 dossier est souvent le meilleur candidat).
 */
export function computeWorkload(investigators: UserProfile[], alerts: AlertRecord[]): WorkloadRow[] {
  return investigators.map((inv) => {
    const assigned = alerts.filter((a) => a.assignedInvestigators.includes(inv.id) && ACTIVE_STATUSES.includes(a.status));
    return {
      investigator: inv,
      active: assigned.length,
      overdue: assigned.filter((a) => computeSlaStatus(a) === 'overdue').length,
      critical: assigned.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'critique').length,
    };
  });
}
