/**
 * === AMÉLIORATION AJOUTÉE (Repère visuel — reproduction fidèle des maquettes
 * Tableau de bord / Liste des dossiers) ===
 *
 * La maquette de référence regroupe les dossiers en 5 catégories visuelles
 * simples — "À traiter", "En cours", "En attente", "Clôturés", "Rejetés" —
 * aussi bien sur le Tableau de bord (répartition par statut) que sur
 * l'écran Dossiers (onglets de filtre). Le modèle de données réel
 * (`AlertStatus`, src/types.ts) a 7 valeurs plus fines
 * (new/under_review/investigation/corrective_action/closed/reopened/
 * archived) et AUCUNE valeur "rejeté" — ce concept n'existe simplement pas
 * dans le modèle actuel. Ce fichier centralise UNE SEULE FOIS le mapping
 * entre les deux, pour que le Tableau de bord (ControlPanel.tsx) et la
 * liste Dossiers (InvestigationDesk.tsx) affichent exactement les mêmes
 * regroupements sans dupliquer cette logique ni risquer qu'ils divergent.
 *
 * Mapping retenu (chaque valeur réelle appartient à exactement un panier) :
 * - à traiter   : 'new' (reçu, pas encore pris en main)
 * - en cours    : 'under_review', 'investigation', 'reopened' (traitement actif)
 * - en attente  : 'corrective_action' (attend la clôture des mesures correctives)
 * - clôturés    : 'closed', 'archived'
 * - rejetés     : aucune valeur réelle n'y correspond aujourd'hui — voir
 *   `isRejectedBucket` ci-dessous, qui reste honnêtement à `false` pour tout
 *   dossier réel plutôt que de réutiliser à tort un statut existant pour un
 *   sens qu'il n'a pas (brief §32, règle de non-hallucination).
 */
import { AlertStatus } from '../types';

export type AlertStatusBucket = 'a_traiter' | 'en_cours' | 'en_attente' | 'clotures' | 'rejetes';

const BUCKET_OF_STATUS: Record<AlertStatus, AlertStatusBucket> = {
  new: 'a_traiter',
  under_review: 'en_cours',
  investigation: 'en_cours',
  reopened: 'en_cours',
  corrective_action: 'en_attente',
  closed: 'clotures',
  archived: 'clotures',
};

export function getAlertStatusBucket(status: AlertStatus): AlertStatusBucket {
  return BUCKET_OF_STATUS[status];
}

// Toujours `false` aujourd'hui — voir le commentaire en tête de fichier.
// Isolé dans sa propre fonction (plutôt qu'un simple `false` en ligne) pour
// que le jour où un vrai statut "rejeté"/"hors périmètre" rejoint
// `AlertStatus`, un seul endroit change.
export function isRejectedBucket(_status: AlertStatus): boolean {
  return false;
}

// Les libellés affichés (À traiter/En cours/En attente/Clôturés/Rejetés)
// viennent de i18n/translations.ts (clés `db_bucket_*`), comme tout le
// reste du Tableau de bord et de l'écran Dossiers — pas de libellé en dur
// ici pour que ces écrans restent réellement multilingues (fr/en/pt).
