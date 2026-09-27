/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Saisie d'une note interne et d'un message au lanceur d'alerte.
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import React, { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, InternalNote, CaseMessage } from '../../../types';

export function useCaseMessaging(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // Note & Message inputs
  const [internalNoteText, setInternalNoteText] = useState<string>('');
  const [investigatorMsgText, setInvestigatorMsgText] = useState<string>('');

  const handleAddInternalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim() || !selectedAlert) return;

    const newNote: InternalNote = {
      id: 'not-' + Date.now(),
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorRole: activeUser.roleTitle,
      content: internalNoteText.trim(),
      createdAt: new Date().toISOString(),
      isPrivate: true,
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      internalNotes: [...selectedAlert.internalNotes, newNote],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'INTERNAL_NOTE_ADDED',
      `Note interne d'investigation ajoutée sur ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14 : miroir
    // des mutations secondaires) === best-effort, jamais attendu, jamais
    // bloquant, uniquement si ce dossier porte un lien réel actif.
    if (selectedAlert.mirroredCaseId) {
      const mirroredCaseId = selectedAlert.mirroredCaseId;
      import('../../../services/caseMirrorSync')
        .then(({ mirrorAddInvestigationNote }) => mirrorAddInvestigationNote({ caseId: mirroredCaseId, content: newNote.content }))
        .catch(() => {});
    }

    setInternalNoteText('');
  };

  const handleSendInvestigatorMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigatorMsgText.trim() || !selectedAlert) return;

    const newMsg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'investigator',
      senderDisplayName: `DARC (${activeUser.name})`,
      content: investigatorMsgText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      messages: [...selectedAlert.messages, newMsg],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'MESSAGE_SENT',
      `Message sécurisé transmis au lanceur d'alerte pour le dossier ${selectedAlert.trackingNumber}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    if (selectedAlert.mirroredCaseId) {
      const mirroredCaseId = selectedAlert.mirroredCaseId;
      import('../../../services/caseMirrorSync')
        .then(({ mirrorAddCommunication }) => mirrorAddCommunication({ caseId: mirroredCaseId, content: newMsg.content }))
        .catch(() => {});
    }

    setInvestigatorMsgText('');
  };

  return {
    internalNoteText,
    setInternalNoteText,
    investigatorMsgText,
    setInvestigatorMsgText,
    handleAddInternalNote,
    handleSendInvestigatorMessage,
  };
}
