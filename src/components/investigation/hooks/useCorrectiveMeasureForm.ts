/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Formulaire « Ajouter une mesure corrective ».
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 */
import React, { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, CorrectiveMeasure } from '../../../types';

export function useCorrectiveMeasureForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // Corrective Measure form inputs
  const [showAddMeasureModal, setShowAddMeasureModal] = useState(false);
  const [measureTitle, setMeasureTitle] = useState('');
  const [measureDesc, setMeasureDesc] = useState('');
  const [measureResp, setMeasureResp] = useState('');
  const [measureDueDate, setMeasureDueDate] = useState('');
  const [measureStatus, setMeasureStatus] = useState<CorrectiveMeasure['status']>('planned');

  const handleAddCorrectiveMeasure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!measureTitle.trim() || !selectedAlert) return;

    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des
    // recommandations) === `closedAt` renseignée uniquement si la mesure
    // est créée directement au statut "Vérifiée" — aucun autre point du
    // code ne change le statut d'une mesure existante aujourd'hui, donc
    // c'est le seul moment où cette transition peut réellement survenir.
    const now = new Date().toISOString();
    const newMeasure: CorrectiveMeasure = {
      id: 'cm-' + Date.now(),
      title: measureTitle.trim(),
      description: measureDesc.trim(),
      responsiblePerson: measureResp.trim() || 'Direction Concernée',
      dueDate: measureDueDate || now.split('T')[0],
      status: measureStatus,
      documentedBy: activeUser.name,
      documentedAt: now,
      closedAt: measureStatus === 'verified' ? now : undefined,
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      correctiveMeasures: [...selectedAlert.correctiveMeasures, newMeasure],
      status: selectedAlert.status === 'investigation' ? 'corrective_action' : selectedAlert.status,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'CORRECTIVE_MEASURE_ADDED',
      `Mesure corrective documentée sur ${selectedAlert.trackingNumber} : "${newMeasure.title}".`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    // `addCorrectiveAction` (Cloud Function) exige une priorité, absente du
    // modèle local `CorrectiveMeasure` — réutilise la priorité du DOSSIER
    // lui-même, exactement comme data-access/migrateLegacy.ts le fait déjà
    // pour la même raison (jamais une valeur inventée).
    if (selectedAlert.mirroredCaseId) {
      const mirroredCaseId = selectedAlert.mirroredCaseId;
      const localPriority = selectedAlert.overridePriority ?? selectedAlert.riskEvaluation.priority;
      import('../../../services/caseMirrorSync')
        .then(({ mirrorAddCorrectiveAction, LOCAL_PRIORITY_TO_CASE_PRIORITY }) =>
          mirrorAddCorrectiveAction({
            caseId: mirroredCaseId,
            description: newMeasure.title ? `${newMeasure.title} — ${newMeasure.description}` : newMeasure.description,
            owner: newMeasure.responsiblePerson,
            dueDate: newMeasure.dueDate,
            priority: LOCAL_PRIORITY_TO_CASE_PRIORITY[localPriority],
          })
        )
        .catch(() => {});
    }

    setMeasureTitle('');
    setMeasureDesc('');
    setMeasureResp('');
    // === AMÉLIORATION AJOUTÉE (remise à zéro complète après envoi) === sur
    // demande de l'utilisateur : l'échéance et le statut restaient
    // pré-remplis avec les valeurs de la mesure précédente — ils reviennent
    // désormais à leur valeur initiale, comme les trois champs ci-dessus.
    setMeasureDueDate('');
    setMeasureStatus('planned');
    setShowAddMeasureModal(false);
  };

  return {
    showAddMeasureModal,
    setShowAddMeasureModal,
    measureTitle,
    setMeasureTitle,
    measureDesc,
    setMeasureDesc,
    measureResp,
    setMeasureResp,
    measureDueDate,
    setMeasureDueDate,
    measureStatus,
    setMeasureStatus,
    handleAddCorrectiveMeasure,
  };
}
