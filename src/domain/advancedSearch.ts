// === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
//
// Jusqu'ici, les routes /operator/search et /investigator/search
// réouvraient simplement l'écran Dossiers (InvestigationDesk) avec sa
// barre de recherche mot-clé existante — aucun formulaire multicritère
// dédié. Ce module fournit la logique pure de filtrage (testable sans
// React), réutilisée par le nouvel écran AdvancedSearchView.tsx.
//
// Filtre TOUJOURS un ensemble de dossiers déjà réduit par
// useVisibleAlerts (jamais l'ensemble brut storage.getAlerts()) — la
// recherche avancée ne doit jamais devenir un moyen de contourner le
// périmètre RBAC/pays/entité/confidentialité/routage indépendant déjà
// appliqué partout ailleurs.

import { AlertRecord, AlertStatus, NocaThreshold, PriorityLevel, SeverityLevel } from '../types';
import { ConfidentialityLevel } from './caseTypes';

export interface AdvancedSearchCriteria {
  /** Mot-clé : référence, catégorie, sous-catégorie, description, entité, lieu. */
  keyword?: string;
  /** ACTIVA_COUNTRIES.code / CountryDef.code — comparé à AlertRecord.countryId. */
  countryId?: string;
  /** ACTIVA_ENTITIES.id / EntityDef.id — comparé à AlertRecord.entityId. */
  entityId?: string;
  /** Nom de catégorie (AlertRecord.category est un nom, pas un id — aucun categoryId n'existe sur ce modèle). */
  category?: string;
  subCategory?: string;
  status?: AlertStatus;
  noca?: NocaThreshold;
  severity?: SeverityLevel;
  /** Comparé avec le même repli que partout ailleurs (authz.canSeeAlertConfidentiality) : absent = 'restricted'. */
  confidentiality?: ConfidentialityLevel;
  channel?: AlertRecord['channel'];
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — filtre "Urgence") ===
  // Comparé à la priorité EFFECTIVE (voir `effectivePriority` ci-dessous),
  // exactement la même règle que `InvestigationDesk.getPriorityBadge` :
  // l'ajustement manuel (`overridePriority`) prime toujours sur le score
  // NOCA calculé à la soumission.
  priority?: PriorityLevel;
  /** Dates ISO (yyyy-mm-dd, format natif d'un <input type="date">), comparées à AlertRecord.createdAt. */
  dateFrom?: string;
  dateTo?: string;
}

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === Priorité effective
// d'un dossier (Urgence) — extrait de `InvestigationDesk.getPriorityBadge`
// pour être réutilisable en dehors de ce composant, sans dupliquer la règle.
export function effectivePriority(alert: AlertRecord): PriorityLevel {
  return alert.overridePriority || alert.riskEvaluation.priority;
}

function matchesKeyword(alert: AlertRecord, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return [
    alert.trackingNumber,
    alert.category,
    alert.subCategory,
    alert.detailedDescription,
    alert.concernedEntity,
    alert.incidentLocation,
  ].some((field) => (field ?? '').toLowerCase().includes(q));
}

export function searchAlerts(alerts: AlertRecord[], criteria: AdvancedSearchCriteria): AlertRecord[] {
  return alerts.filter((alert) => {
    if (criteria.keyword && !matchesKeyword(alert, criteria.keyword)) return false;
    if (criteria.countryId && alert.countryId !== criteria.countryId) return false;
    if (criteria.entityId && alert.entityId !== criteria.entityId) return false;
    if (criteria.category && alert.category !== criteria.category) return false;
    if (criteria.subCategory && alert.subCategory !== criteria.subCategory) return false;
    if (criteria.status && alert.status !== criteria.status) return false;
    if (criteria.noca && alert.riskEvaluation.nocaThreshold !== criteria.noca) return false;
    if (criteria.severity && alert.severity !== criteria.severity) return false;
    if (criteria.confidentiality && (alert.confidentialityLevel ?? 'restricted') !== criteria.confidentiality) return false;
    if (criteria.channel && alert.channel !== criteria.channel) return false;
    if (criteria.priority && effectivePriority(alert) !== criteria.priority) return false;
    if (criteria.dateFrom && alert.createdAt < criteria.dateFrom) return false;
    // Borne inclusive : compare contre le lendemain de dateTo (createdAt porte une heure, dateTo n'en a pas).
    if (criteria.dateTo && alert.createdAt.slice(0, 10) > criteria.dateTo) return false;
    return true;
  });
}

/** Un critère au moins est renseigné — sert à afficher "Réinitialiser" et un état vide plus parlant. */
export function hasActiveCriteria(criteria: AdvancedSearchCriteria): boolean {
  return Object.values(criteria).some((v) => !!v);
}
