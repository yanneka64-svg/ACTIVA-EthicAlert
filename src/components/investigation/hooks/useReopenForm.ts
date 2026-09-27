/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Rouvrir le dossier » (motif obligatoire).
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import { useState } from 'react';
import { applyCaseStatus } from '../../../services/statusMapping';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

export function useReopenForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Reopen Alert (CDC 3.1.3: Rouvrir avec motif obligatoire)
  const handleReopenAlert = () => {
    if (!selectedAlert || !reopenReason.trim()) return;

    const updatedAlert: AlertRecord = {
      // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
      // cause racine) === `applyCaseStatus` remplace la construction
      // manuelle — même synchronisation que handleCloseAlert : un dossier
      // rouvert depuis 'conclusion_pending'/'functional_review' ne doit
      // plus afficher "En revue" comme étape courante.
      ...applyCaseStatus(selectedAlert, 'reopened'),
      reopenedAt: new Date().toISOString(),
      reopenedBy: activeUser.name,
      reopenReason: reopenReason.trim(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_REOPENED',
      `Réouverture du dossier ${selectedAlert.trackingNumber} par ${activeUser.name}. Motif obligatoire : "${reopenReason.trim()}".`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowReopenModal(false);
    setReopenReason('');
  };

  return {
    showReopenModal,
    setShowReopenModal,
    reopenReason,
    setReopenReason,
    handleReopenAlert,
  };
}
