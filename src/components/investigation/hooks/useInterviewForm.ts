/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Formulaire « + Nouvel entretien ».
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 */
import React, { useState } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, CaseInterview } from '../../../types';

export function useInterviewForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Onglet Entretiens — branchement de
  // storage.addInterview(), jusqu'ici écrit et testé mais jamais appelé par
  // aucun écran) === même gabarit que le formulaire "+Nouvelle tâche"
  // ci-dessus.
  const [showAddInterviewModal, setShowAddInterviewModal] = useState(false);
  const [interviewIntervieweeName, setInterviewIntervieweeName] = useState('');
  const [interviewLinkedPersonId, setInterviewLinkedPersonId] = useState('');
  const [interviewScheduledAt, setInterviewScheduledAt] = useState('');
  const [interviewSummary, setInterviewSummary] = useState('');
  const [interviewStatus, setInterviewStatus] = useState<CaseInterview['status']>('planned');

  // === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === storage.addInterview,
  // même motif audit que handleAddTask ci-dessus. La personne entendue peut
  // être liée à une entrée réelle de "Personnes impliquées"/"Témoins" (son
  // nom est alors repris tel quel, jamais dupliqué à la main) ou saisie
  // librement (entretien avec un tiers externe au dossier).
  const handleAddInterview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    const linkedPerson = interviewLinkedPersonId
      ? [...selectedAlert.involvedPersons, ...selectedAlert.witnesses].find((p) => p.id === interviewLinkedPersonId)
      : undefined;
    const intervieweeName = linkedPerson?.name ?? interviewIntervieweeName.trim();
    if (!intervieweeName) return;

    const newInterview: CaseInterview = {
      id: 'itv-' + Date.now(),
      intervieweeName,
      intervieweePersonId: linkedPerson?.id,
      scheduledAt: interviewScheduledAt || undefined,
      conductedAt: interviewStatus === 'completed' ? new Date().toISOString() : undefined,
      conductedBy: activeUser.name,
      summary: interviewSummary.trim() || undefined,
      status: interviewStatus,
    };

    storage.addInterview(selectedAlert.id, newInterview, activeUser);

    setInterviewIntervieweeName('');
    setInterviewLinkedPersonId('');
    setInterviewScheduledAt('');
    setInterviewSummary('');
    setInterviewStatus('planned');
    setShowAddInterviewModal(false);
  };

  return {
    showAddInterviewModal,
    setShowAddInterviewModal,
    interviewIntervieweeName,
    setInterviewIntervieweeName,
    interviewLinkedPersonId,
    setInterviewLinkedPersonId,
    interviewScheduledAt,
    setInterviewScheduledAt,
    interviewSummary,
    setInterviewSummary,
    interviewStatus,
    setInterviewStatus,
    handleAddInterview,
  };
}
