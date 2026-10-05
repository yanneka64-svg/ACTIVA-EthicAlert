/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Escalader le dossier ».
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import { useState } from 'react';
import { evaluateEscalationCriteria } from '../../../domain/escalationCriteria';
import { notifyEscalationRecipient } from '../../../services/emailNotify';
// === AMÉLIORATION AJOUTÉE (un seul envoi d'e-mail à l'escalade) ===
const ESCALATION_EMAIL_FROM_BROWSER = false;
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

export function useEscalateForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [escalateOwnerId, setEscalateOwnerId] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === `escalateOwnerId` référence désormais un
  // EscalationRecipient.id (registre admin-éditable) — storage.escalateAlert
  // gère lui-même l'octroi d'accès réel (compte lié) et retourne le
  // destinataire complet pour la notification e-mail ci-dessous.
  const handleEscalate = () => {
    if (!selectedAlert || !escalateReason.trim() || !escalateOwnerId) return;
    const criteriaMatched = evaluateEscalationCriteria(selectedAlert).map((c) => c.label);
    const result = storage.escalateAlert(selectedAlert.id, escalateReason.trim(), criteriaMatched, escalateOwnerId, activeUser);
    if (result.allowed) {
      // === AMÉLIORATION AJOUTÉE (un seul envoi d'e-mail à l'escalade) ===
      // L'escalade est désormais notifiée par le serveur (applyPortalUpdate →
      // e-mails « Dossier escaladé » selon Administration → Notifications
      // e-mail). L'ancien envoi depuis le navigateur vers le registre
      // Gouvernance est coupé pour éviter les e-mails en double ; il reste
      // réactivable par ESCALATION_EMAIL_FROM_BROWSER.
      if (result.recipient && ESCALATION_EMAIL_FROM_BROWSER) {
        notifyEscalationRecipient(result.recipient, selectedAlert, activeUser, 'Dossier escaladé');
      }
      setShowEscalateModal(false);
      setEscalateReason('');
      setEscalateOwnerId('');
    }
    // En cas de refus (transition invalide), la modale reste ouverte —
    // aucun message d'erreur dédié n'est encore affiché ici, comme pour les
    // autres actions de ce fichier qui échouent silencieusement plutôt que
    // de casser l'écran ; `result.reason` est disponible pour un futur
    // affichage si besoin.
  };

  return {
    showEscalateModal,
    setShowEscalateModal,
    escalateReason,
    setEscalateReason,
    escalateOwnerId,
    setEscalateOwnerId,
    handleEscalate,
  };
}
