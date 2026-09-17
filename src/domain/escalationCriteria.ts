// === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
//
// Critères d'escalade configurables vers la DARC Groupe (brief §14/§44) :
// implication d'un membre de la Direction, catégorie corruption, niveau de
// sensibilité maximal, impact financier maximal, risque réputationnel
// maximal, et lanceur d'alerte rattaché à une entité/un pays différent de
// celui du dossier (le seul signal "multi-pays/multi-filiale" qu'un
// AlertRecord peut honnêtement porter — il n'y a pas de liste
// d'allégations/entités multiples séparée dans ce modèle).
//
// `evaluateEscalationCriteria` ne déclenche RIEN automatiquement : c'est
// une SUGGESTION affichée à l'opérateur/enquêteur dans la modale
// "Escalader" d'InvestigationDesk.tsx, qui reste seul décisionnaire.

import { AlertRecord } from '../types';

export interface EscalationCriterion {
  key: string;
  label: string;
}

const SENIOR_HIERARCHY_ROLES = ['Sous-Directeur', 'Directeur+'];

export function evaluateEscalationCriteria(alert: AlertRecord): EscalationCriterion[] {
  const criteria: EscalationCriterion[] = [];

  if (alert.involvedPersons.some((p) => SENIOR_HIERARCHY_ROLES.includes(p.hierarchyRole))) {
    criteria.push({ key: 'senior_management', label: 'Implication d’un membre de la Direction' });
  }

  if (/corruption|pots-de-vin/i.test(alert.category)) {
    criteria.push({ key: 'corruption', label: 'Catégorie Fraude, Corruption et pots-de-vin' });
  }

  if ((alert.confidentialityLevel ?? 'restricted') === 'highly_confidential') {
    criteria.push({ key: 'highest_sensitivity', label: 'Niveau de confidentialité le plus élevé' });
  }

  if (alert.riskEvaluation.financialImpact >= 4) {
    criteria.push({ key: 'financial_threshold', label: 'Impact financier au niveau maximal (>20k€)' });
  }

  if (alert.riskEvaluation.reputationRisk >= 4) {
    criteria.push({ key: 'reputational_risk', label: 'Risque réputationnel maximal' });
  }

  if (alert.whistleblower.entity && alert.whistleblower.entity !== alert.concernedEntity) {
    criteria.push({ key: 'multi_entity', label: 'Lanceur d’alerte rattaché à une entité différente du dossier' });
  }

  if (alert.whistleblower.declarantCountry && alert.whistleblower.declarantCountry !== alert.country) {
    criteria.push({ key: 'multi_country', label: 'Lanceur d’alerte situé dans un pays différent du dossier' });
  }

  return criteria;
}
