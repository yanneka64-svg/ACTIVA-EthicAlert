/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Formulaire « Déclarer un conflit d'intérêt ».
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 */
import React, { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, ConflictDeclaration } from '../../../types';

export function useConflictForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Phase 6 — Triage & Conflit d'intérêt) ===
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictOutcome, setConflictOutcome] = useState<ConflictDeclaration['outcome']>('no_conflict');
  const [conflictDetails, setConflictDetails] = useState('');

  // === AMÉLIORATION AJOUTÉE (Phase 6 — Conflit d'intérêt) === uses Phase
  // 1's ConflictDeclaration type + storage.declareConflict (already built,
  // unused until now) — same mutate + persist + notify + logAudit pattern.
  const handleDeclareConflict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    if (conflictOutcome === 'conflict_identified' && !conflictDetails.trim()) return;
    const declaration: ConflictDeclaration = {
      id: 'cod-' + Date.now(),
      userId: activeUser.id,
      userName: activeUser.name,
      declaredAt: new Date().toISOString(),
      outcome: conflictOutcome,
      details: conflictOutcome === 'conflict_identified' ? conflictDetails.trim() : undefined,
    };
    storage.declareConflict(selectedAlert.id, declaration, activeUser);
    setShowConflictModal(false);
    setConflictOutcome('no_conflict');
    setConflictDetails('');
  };

  return {
    showConflictModal,
    setShowConflictModal,
    conflictOutcome,
    setConflictOutcome,
    conflictDetails,
    setConflictDetails,
    handleDeclareConflict,
  };
}
