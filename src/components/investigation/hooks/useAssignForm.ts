/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Attribuer le dossier » (sélection des enquêteurs).
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 * `investigatorUsers` (calculé dans InvestigationDesk.tsx) est passé en paramètre.
 */
import { useState } from 'react';
import { notifyAssignmentToInvestigators } from '../../../services/emailNotify';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

export function useAssignForm(selectedAlert: AlertRecord | null, activeUser: UserProfile, investigatorUsers: UserProfile[]) {
  // Interactive modal / action states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedInvestigatorIds, setSelectedInvestigatorIds] = useState<string[]>([]);

  // Handlers
  const handleAssignInvestigators = () => {
    if (!selectedAlert) return;

    const assignedNames = investigatorUsers
      .filter(u => selectedInvestigatorIds.includes(u.id))
      .map(u => u.name);

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      assignedInvestigators: selectedInvestigatorIds,
      assignedInvestigatorNames: assignedNames,
      status: selectedAlert.status === 'new' ? 'investigation' : selectedAlert.status,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'INVESTIGATOR_ASSIGNED',
      `Attribution du dossier ${selectedAlert.trackingNumber} à : ${assignedNames.join(', ') || 'Aucun'}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Notifications e-mail) === notifie
    // uniquement les enquêteurs NOUVELLEMENT attribués (jamais ceux déjà
    // attribués avant ce changement, pour ne pas les renotifier à chaque
    // modification mineure de l'attribution).
    const previouslyAssigned = new Set(selectedAlert.assignedInvestigators);
    const newlyAssignedUsers = investigatorUsers.filter(
      (u) => selectedInvestigatorIds.includes(u.id) && !previouslyAssigned.has(u.id)
    );
    if (newlyAssignedUsers.length > 0) {
      notifyAssignmentToInvestigators(newlyAssignedUsers, { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber }, activeUser);
    }

    setShowAssignModal(false);
  };

  return {
    showAssignModal,
    setShowAssignModal,
    selectedInvestigatorIds,
    setSelectedInvestigatorIds,
    handleAssignInvestigators,
  };
}
