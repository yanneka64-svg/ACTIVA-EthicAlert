/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Clôturer le dossier ».
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 * `t` et `setActiveCaseTab` (onglet actif, resté dans InvestigationDesk.tsx) sont passés en
 * paramètres : sans mesure corrective, la clôture bascule toujours sur l'onglet
 * « Mesures correctives » après l'alerte navigateur, comme avant.
 */
import React, { useState } from 'react';
import { applyCaseStatus } from '../../../services/statusMapping';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

type CaseTab = 'overview' | 'messages' | 'corrective' | 'tasks' | 'interviews' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report';

export function useCloseForm(selectedAlert: AlertRecord | null, activeUser: UserProfile, t: Record<string, string>, setActiveCaseTab: React.Dispatch<React.SetStateAction<CaseTab>>) {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closureSummary, setClosureSummary] = useState<string>('');
  const [closureMessageToWb, setClosureMessageToWb] = useState<string>('');

  // Close Alert (CDC 3.1.3: Vérifier complétude, clôturer, informer le lanceur)
  const handleCloseAlert = () => {
    if (!selectedAlert) return;

    if (selectedAlert.correctiveMeasures.length === 0) {
      alert(t.desk_closure_requires_measure);
      setActiveCaseTab('corrective');
      setShowCloseModal(false);
      return;
    }

    const updatedAlert: AlertRecord = {
      // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
      // cause racine) === `applyCaseStatus` remplace la construction
      // manuelle `status: 'closed', workflowStatus: 'closed'` — mêmes deux
      // champs, mais désormais écrits ensemble par construction (voir
      // services/statusMapping.ts) : sans cela, un dossier dont
      // `workflowStatus` a été renseigné par le moteur riche (ex. passé par
      // "Envoyer en revue") restait figé sur 'conclusion_pending'/
      // 'functional_review' après sa clôture legacy — la timeline "STATUT
      // DU DOSSIER" affichait alors "En revue" comme étape courante en même
      // temps que "Clôturé" comme faite, une incohérence visuelle réelle
      // (bug déjà corrigé, ce refactor n'en change pas le comportement).
      ...applyCaseStatus(selectedAlert, 'closed'),
      closedAt: new Date().toISOString(),
      closedBy: activeUser.name,
      closureSummary: closureSummary.trim() || 'Dossier traité et investigué avec succès conformément aux directives de la DARC Groupe ACTIVA.',
      closureMessageToWhistleblower: closureMessageToWb.trim() || 'L\'investigation relative à votre signalement est désormais menée à son terme. Toutes les mesures conservatoires et correctives requises ont été engagées. Nous vous remercions pour votre démarche civique garantissant l\'intégrité du Groupe ACTIVA.',
      messages: [
        ...selectedAlert.messages,
        {
          id: 'msg-close-' + Date.now(),
          sender: 'admin',
          senderDisplayName: 'DARC Groupe ACTIVA (Clôture formelle)',
          content: closureMessageToWb.trim() || 'L\'investigation relative à votre signalement est désormais menée à son terme. Toutes les mesures conservatoires et correctives requises ont été engagées. Votre anonymat demeure garanti.',
          createdAt: new Date().toISOString(),
        }
      ],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_CLOSED',
      `Clôture formelle du dossier ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowCloseModal(false);
    // === AMÉLIORATION AJOUTÉE (remise à zéro complète après envoi) === sur
    // demande de l'utilisateur : la synthèse et le message au lanceur
    // d'alerte sont vidés une fois la clôture RÉELLEMENT enregistrée. En cas
    // de refus (aucune mesure corrective, branche plus haut), le texte saisi
    // est volontairement conservé : ce n'est pas un envoi, et l'utilisateur
    // revient clôturer juste après avoir documenté la mesure demandée.
    setClosureSummary('');
    setClosureMessageToWb('');
  };

  return {
    showCloseModal,
    setShowCloseModal,
    closureSummary,
    setClosureSummary,
    closureMessageToWb,
    setClosureMessageToWb,
    handleCloseAlert,
  };
}
