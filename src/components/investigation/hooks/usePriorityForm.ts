/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Modifier la priorité & le délai SLA ».
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, PriorityLevel } from '../../../types';

export function usePriorityForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [newPriority, setNewPriority] = useState<PriorityLevel>('elevee');
  const [newSlaDays, setNewSlaDays] = useState<number>(15);
  const [priorityOverrideReason, setPriorityOverrideReason] = useState<string>('');

  const handleUpdatePriority = () => {
    if (!selectedAlert) return;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + newSlaDays);

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      overridePriority: newPriority,
      overrideReason: priorityOverrideReason.trim() || undefined,
      targetCompletionDate: targetDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'PRIORITY_MODIFIED',
      `Priorité du dossier ${selectedAlert.trackingNumber} ajustée à ${newPriority.toUpperCase()} (Délai : ${newSlaDays}j). Motif : ${priorityOverrideReason || 'Ajustement DARC'}`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    // Même correspondance de champs que data-access/migrateLegacy.ts pour
    // exactement ce même cas (branche `alert.overridePriority`) : les 4
    // sous-scores et le score total ne sont jamais recalculés par ce
    // formulaire local (seule la priorité finale est surchargée) — on les
    // reporte donc tels quels, avec `isOverride: true`.
    const risk = selectedAlert.riskEvaluation;
    if (selectedAlert.mirroredCaseId) {
      const mirroredCaseId = selectedAlert.mirroredCaseId;
      import('../../../services/caseMirrorSync')
        .then(({ mirrorRecordRiskAssessment, LOCAL_PRIORITY_TO_CASE_PRIORITY }) =>
          mirrorRecordRiskAssessment({
            caseId: mirroredCaseId,
            financialImpact: risk.financialImpact,
            hierarchicalLevel: risk.hierarchyLevel,
            recurrence: risk.recidivism,
            reputationRisk: risk.reputationRisk,
            totalScore: risk.totalScore,
            priority: LOCAL_PRIORITY_TO_CASE_PRIORITY[newPriority],
            isOverride: true,
            originalScore: risk.totalScore,
            overrideReason: priorityOverrideReason.trim() || undefined,
          })
        )
        .catch(() => {});
    }

    setShowPriorityModal(false);
    // === AMÉLIORATION AJOUTÉE (remise à zéro complète après envoi) === même
    // demande que pour les mesures correctives : délai SLA et motif
    // reviennent à leurs valeurs initiales (la priorité elle-même est de
    // toute façon pré-remplie à l'ouverture depuis le dossier). Le miroir
    // backend ci-dessus a déjà capturé les valeurs envoyées.
    setNewPriority('elevee');
    setNewSlaDays(15);
    setPriorityOverrideReason('');
  };

  return {
    showPriorityModal,
    setShowPriorityModal,
    newPriority,
    setNewPriority,
    newSlaDays,
    setNewSlaDays,
    priorityOverrideReason,
    setPriorityOverrideReason,
    handleUpdatePriority,
  };
}
