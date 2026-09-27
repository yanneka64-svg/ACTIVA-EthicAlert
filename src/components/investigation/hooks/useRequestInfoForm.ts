/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Demander des informations complémentaires ».
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

export function useRequestInfoForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche —
  // étapes "En attente d'informations" et "En revue" désormais atteignables)
  // === `domain/workflow.ts`/`storage.transitionStatus()` existaient déjà,
  // entièrement testés (storage.transitionStatus.test.ts), mais n'étaient
  // appelés par aucun écran — ces deux étapes de la timeline "STATUT DU
  // DOSSIER" restaient donc en permanence grisées ("à venir"), quel que
  // soit le dossier. Ces 2 nouvelles actions les rendent réellement
  // franchissables, sans toucher à la logique de clôture existante
  // (handleCloseAlert), qui continue de fonctionner exactement comme avant.
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoReason, setRequestInfoReason] = useState<string>('');

  // "Demander des informations complémentaires" (investigation → pending_information).
  // Horodate `pendingInfoReachedAt` une seule fois (première visite réelle),
  // pour que la timeline puisse plus tard cocher cette étape honnêtement.
  const handleRequestInfo = () => {
    if (!selectedAlert || !requestInfoReason.trim()) return;
    const result = storage.transitionStatus(selectedAlert.id, 'pending_information', activeUser, requestInfoReason.trim());
    if (result.allowed) {
      const fresh = storage.getAlerts().find((a) => a.id === selectedAlert.id);
      if (fresh && !fresh.pendingInfoReachedAt) {
        storage.saveAlert({ ...fresh, pendingInfoReachedAt: new Date().toISOString() });
      }
    }
    setShowRequestInfoModal(false);
    setRequestInfoReason('');
  };

  return {
    showRequestInfoModal,
    setShowRequestInfoModal,
    requestInfoReason,
    setRequestInfoReason,
    handleRequestInfo,
  };
}
