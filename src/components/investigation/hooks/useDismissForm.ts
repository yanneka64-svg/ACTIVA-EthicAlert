/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Classer sans suite » (doublon / hors périmètre).
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

export function useDismissForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
  // périmètre) === `CaseStatus` (domain/caseTypes.ts, 14 valeurs) prévoyait
  // déjà 'duplicate'/'out_of_scope', structurellement atteignables depuis
  // 'new' (ALLOWED_TRANSITIONS, domain/workflow.ts) — mais aucun écran ne
  // les proposait, les rendant de fait inaccessibles (constat de l'analyse
  // critique du frontend). Réutilise storage.transitionStatus(), déjà réel
  // pour pending_information/conclusion_pending/functional_review, jamais
  // un nouveau mécanisme parallèle.
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [dismissTargetStatus, setDismissTargetStatus] = useState<'duplicate' | 'out_of_scope'>('duplicate');
  const [dismissReason, setDismissReason] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
  // périmètre) === Structurellement valide uniquement depuis 'new'
  // (ALLOWED_TRANSITIONS), donc réservé aux dossiers pas encore attribués —
  // évite tout chevauchement avec la clôture normale (handleCloseAlert),
  // qui exige au moins une allégation documentée (§25) : un doublon/hors
  // périmètre n'a par nature rien à documenter.
  const handleDismissCase = () => {
    if (!selectedAlert || !dismissReason.trim()) return;
    const result = storage.transitionStatus(selectedAlert.id, dismissTargetStatus, activeUser, dismissReason.trim());
    if (result.allowed) {
      setShowDismissModal(false);
      setDismissReason('');
      setDismissTargetStatus('duplicate');
    }
  };

  return {
    showDismissModal,
    setShowDismissModal,
    dismissTargetStatus,
    setDismissTargetStatus,
    dismissReason,
    setDismissReason,
    handleDismissCase,
  };
}
