/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Rédiger le rapport d'investigation » (texte et/ou fichier importé).
 *
 * État de la modale et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * menu Actions, modales et sections qui les reçoivent sont inchangés.
 */
import React, { useState, useRef } from 'react';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, EvidenceFile } from '../../../types';

export function useInvestigationReportForm(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  // === AMÉLIORATION AJOUTÉE (Rapport d'investigation obligatoire avant
  // l'envoi en revue) === "Envoyer en revue" n'apparaît dans le menu
  // Actions qu'une fois ce rapport renseigné (texte ET/OU fichier importé —
  // selectedAlert.investigationReport / investigationReportFile).
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDraft, setReportDraft] = useState('');
  const [reportFile, setReportFile] = useState<EvidenceFile | undefined>(undefined);
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  // === AMÉLIORATION AJOUTÉE (Rapport d'investigation obligatoire avant
  // l'envoi en revue) === "Rédiger le rapport d'investigation" — texte et/ou
  // fichier importé (au moins l'un des deux), horodaté/attribué (pas de
  // statut ni de transition, juste du contenu documentant le dossier),
  // condition d'apparition de "Envoyer en revue" dans le menu Actions
  // ci-dessous. Toujours le même libellé "Rédiger", qu'un rapport existe
  // déjà ou non — rédiger de nouveau REMPLACE le contenu précédent plutôt
  // que de prétendre à une distinction "création"/"modification" qui
  // n'apporte rien ici (pas d'historique de versions).
  const handleSaveInvestigationReport = () => {
    if (!selectedAlert || (!reportDraft.trim() && !reportFile)) return;
    storage.saveAlert({
      ...selectedAlert,
      investigationReport: reportDraft.trim() || undefined,
      investigationReportFile: reportFile,
      investigationReportBy: activeUser.name,
      investigationReportAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    storage.logAudit(
      'INVESTIGATION_REPORT_SAVED',
      `Rapport d'investigation rédigé pour le dossier ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );
    setShowReportModal(false);
    setReportDraft('');
    setReportFile(undefined);
  };

  // === AMÉLIORATION AJOUTÉE (Import d'un rapport d'investigation en
  // fichier) === Même mécanique de lecture que handleAddEvidenceFile
  // ci-dessus (FileReader → dataUrl) mais reste local à la modale
  // (`reportFile`, pas storage.saveAlert direct) : le fichier n'est
  // persisté qu'au clic sur "Enregistrer le rapport", comme le texte.
  const handleImportReportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReportFile({
        id: 'ev-report-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        uploadedBy: activeUser.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return {
    showReportModal,
    setShowReportModal,
    reportDraft,
    setReportDraft,
    reportFile,
    setReportFile,
    reportFileInputRef,
    handleSaveInvestigationReport,
    handleImportReportFile,
  };
}
