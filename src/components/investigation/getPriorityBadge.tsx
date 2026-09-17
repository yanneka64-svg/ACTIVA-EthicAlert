/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Extrait tel quel depuis InvestigationDesk.tsx (fonction pure, sans
 * dépendance à la fermeture du composant — uniquement l'`AlertRecord`
 * passé en argument) pour être partagé entre la liste des dossiers, l'en-
 * tête du dossier sélectionné, et le nouvel onglet "Allégations" extrait
 * (voir TriageSection.tsx), sans duplication ni prop-drilling.
 */
import React from 'react';
import { AlertRecord } from '../../types';
import { PriorityBadge } from '../ui';

export function getPriorityBadge(alert: AlertRecord) {
  const p = alert.overridePriority || alert.riskEvaluation.priority;
  const labels: Record<typeof p, string> = {
    critique: 'CRITIQUE (48h)',
    tres_elevee: 'TRÈS ÉLEVÉE (7j)',
    elevee: 'ÉLEVÉE (15j)',
    faible: 'FAIBLE (30j)',
  };
  return <PriorityBadge priority={p} label={labels[p]} />;
}
