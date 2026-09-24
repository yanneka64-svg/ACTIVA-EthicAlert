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
import { currentT } from '../../i18n/currentLang';

export function getPriorityBadge(alert: AlertRecord) {
  const p = alert.overridePriority || alert.riskEvaluation.priority;
  // === AMÉLIORATION AJOUTÉE : libellés traduits selon la langue courante (FR/EN/PT) ===
  const t = currentT();
  const labels: Record<typeof p, string> = {
    critique: t.inv_prio_critical,
    tres_elevee: t.inv_prio_very_high,
    elevee: t.inv_prio_high,
    faible: t.inv_prio_low,
  };
  return <PriorityBadge priority={p} label={labels[p]} />;
}
