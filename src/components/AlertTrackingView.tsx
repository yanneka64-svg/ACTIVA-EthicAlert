import React, { useState, useEffect } from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
// section) === les icônes de chaque bloc sont désormais importées par leur
// composant (src/components/tracking/*). Seul le bouton « Retour », resté
// ici, en utilise encore une. (`Plus`, déjà inutilisé avant ce changement,
// part avec les autres.)
import { ArrowLeft } from 'lucide-react';
import { Language, AlertRecord, CaseMessage, AuditLogEntry, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE : vérification par hash salé + limitation du débit des tentatives ===
import { verifyPassword } from '../services/crypto';
import { getLockStatus, recordFailedAttempt, clearAttempts, formatRemaining } from '../services/rateLimiter';
// === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
// section) === chaque bloc de rendu vit désormais dans son propre composant
// (src/components/tracking/) ; ce fichier garde l'état, la connexion (hash
// salé + verrou anti-brute-force), les handlers et le calcul de la frise.
import { TrackingLogin } from './tracking/TrackingLogin';
import { TrackingSidebar } from './tracking/TrackingSidebar';
import { TrackingOverviewTab } from './tracking/TrackingOverviewTab';
import { TrackingMessagesTab } from './tracking/TrackingMessagesTab';
import { TrackingDocumentsTab } from './tracking/TrackingDocumentsTab';
import { TrackingUpdatesTab } from './tracking/TrackingUpdatesTab';
import type { TimelineEntry } from './tracking/TrackingUpdatesTab';
import { TrackingSupplementModal } from './tracking/TrackingSupplementModal';

interface AlertTrackingViewProps {
  lang: Language;
  initialTrackingNumber?: string;
  onGoToNewAlert: () => void;
  // === AMÉLIORATION AJOUTÉE (Phase 34 — navigation latérale) === optionnel
  // et rétrocompatible : si non fourni, le lien "Besoin d'aide ?" du menu
  // latéral ne s'affiche simplement pas, plutôt que de planter.
  onGoToContact?: () => void;
}

/**
 * === AMÉLIORATION AJOUTÉE (Phase 34 — nouvelle maquette du portail de
 * suivi, préférée à celle de la Phase 33) ===
 *
 * Écran de connexion : panneau photo à gauche (même image que le hero de
 * l'accueil) avec message de confiance, formulaire à droite. Une fois
 * connecté : navigation latérale persistante (Vue d'ensemble / Messages /
 * Pièces jointes / Historique + lien d'aide vers Contact) plutôt que des
 * onglets horizontaux ; le résumé du dossier (numéro, badges, étapes) ne
 * s'affiche plus que dans l'onglet Vue d'ensemble, les autres onglets ayant
 * leur propre titre. L'onglet Historique devient une vraie frise
 * chronologique mêlant les événements réels (messages, changements de
 * statut) et les étapes du pipeline pas encore atteintes.
 *
 * Toute la logique métier (connexion par hash salé + verrou anti-brute-force,
 * messagerie, complément d'information, suppression de déclaration,
 * ajout/suppression de pièces jointes) reste strictement identique à la
 * Phase 33 — seule la présentation change.
 */
export const AlertTrackingView: React.FC<AlertTrackingViewProps> = ({
  lang,
  initialTrackingNumber = '',
  onGoToNewAlert,
  onGoToContact,
}) => {
  const t = TRANSLATIONS[lang];

  // Tracking login state
  const [trackingNumberInput, setTrackingNumberInput] = useState(initialTrackingNumber);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertRecord | null>(null);

  // Messaging state
  const [replyContent, setReplyContent] = useState('');
  const [supplementText, setSupplementText] = useState('');
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Attachments state
  const [isDocDragging, setIsDocDragging] = useState(false);
  const [openFileMenuId, setOpenFileMenuId] = useState<string | null>(null);

  // === AMÉLIORATION AJOUTÉE (Phase 3 — reporter portal tabbed layout) ===
  const [activeTrackTab, setActiveTrackTab] = useState<'overview' | 'messages' | 'documents' | 'updates'>('overview');

  // Sync if initial tracking number passed
  useEffect(() => {
    if (initialTrackingNumber) {
      setTrackingNumberInput(initialTrackingNumber);
      const found = storage.getAlertByTracking(initialTrackingNumber);
      if (found) {
        // In demo preview, allow auto-viewing freshly created alerts or prompt
        setActiveAlert(found);
      }
    }
  }, [initialTrackingNumber]);

  // Subscribe to storage updates for real-time messages
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      if (activeAlert) {
        const updated = storage.getAlertById(activeAlert.id);
        if (updated) setActiveAlert(updated);
      }
    });
    return unsub;
  }, [activeAlert]);

  // === AMÉLIORATION AJOUTÉE : handler asynchrone (vérification hash) + verrou anti-brute-force ===
  const [isVerifying, setIsVerifying] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedNum = trackingNumberInput.trim().toUpperCase();

    // Rate limiting: block further attempts once the threshold is reached, regardless of
    // whether the tracking number exists (avoids leaking existence via timing/behavior).
    const lockStatus = getLockStatus(trimmedNum);
    if (lockStatus.locked) {
      setLoginError(
        t.track_error_locked_retry.replace('{time}', formatRemaining(lockStatus.remainingMs))
      );
      return;
    }

    setIsVerifying(true);
    const alert = storage.getAlertByTracking(trimmedNum);

    if (!alert) {
      recordFailedAttempt(trimmedNum);
      setLoginError(t.track_error_not_found);
      setIsVerifying(false);
      return;
    }

    const passwordOk = alert.accessCodeSalt
      ? await verifyPassword(passwordInput, alert.accessCodeSalt, alert.accessCodeHash)
      : passwordInput === alert.accessCodeHash; // fallback for legacy unsalted demo records

    if (!passwordOk) {
      const status = recordFailedAttempt(trimmedNum);
      storage.logAudit(
        'ACCESS_DENIED',
        `Tentative d'accès refusée (mot de passe incorrect) au dossier ${alert.trackingNumber}. Tentatives restantes : ${status.attemptsRemaining}.`,
        { id: alert.id, trackingNumber: alert.trackingNumber }
      );
      setLoginError(
        status.locked
          ? t.track_error_locked.replace('{time}', formatRemaining(status.remainingMs))
          : t.track_error_wrong_password
      );
      setIsVerifying(false);
      return;
    }

    clearAttempts(trimmedNum);
    // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === code d'accès prouvé :
    // une empreinte héritée est recalculée en PBKDF2, sans effet visible.
    void storage.upgradeAccessCodeHashIfNeeded(alert.id, passwordInput);
    setActiveAlert(alert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `Accès au dossier ${alert.trackingNumber} via code d'accès sécurisé par le lanceur d'alerte.`,
      { id: alert.id, trackingNumber: alert.trackingNumber }
    );
    setIsVerifying(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeAlert) return;

    const newMsg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'whistleblower',
      senderDisplayName: activeAlert.whistleblower.isAnonymous
        ? 'Lanceur d’alerte (Anonyme)'
        : (activeAlert.whistleblower.fullName || 'Déclarant'),
      content: replyContent.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedAlert: AlertRecord = {
      ...activeAlert,
      messages: [...activeAlert.messages, newMsg],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'MESSAGE_SENT',
      `Message envoyé par le lanceur d'alerte sur le dossier ${activeAlert.trackingNumber}.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );

    setActiveAlert(updatedAlert);
    setReplyContent('');
  };

  // Add supplementary information (Compléter sa déclaration - CDC 3.1.1)
  const handleAddSupplement = () => {
    if (!supplementText.trim() || !activeAlert) return;

    const timestampStr = new Date().toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR');
    const updatedDesc = `${activeAlert.detailedDescription}\n\n--- [Complément apporté le ${timestampStr}] ---\n${supplementText.trim()}`;

    const updatedAlert: AlertRecord = {
      ...activeAlert,
      detailedDescription: updatedDesc,
      updatedAt: new Date().toISOString(),
      messages: [
        ...activeAlert.messages,
        {
          id: 'msg-sup-' + Date.now(),
          sender: 'whistleblower',
          senderDisplayName: 'Lanceur d’alerte (Complément)',
          content: `Complément d'information formel apporté au dossier :\n"${supplementText.trim()}"`,
          createdAt: new Date().toISOString(),
        }
      ],
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `Complément d'information ajouté par le lanceur d'alerte sur le dossier ${activeAlert.trackingNumber}.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );

    setActiveAlert(updatedAlert);
    setSupplementText('');
    setShowSupplementModal(false);
  };

  // Delete declaration if new (Supprimer sa déclaration - CDC 3.1.1)
  const handleDeleteAlert = () => {
    if (!activeAlert) return;
    storage.deleteAlert(activeAlert.id);
    storage.logAudit(
      'STATUS_CHANGED',
      `Déclaration ${activeAlert.trackingNumber} supprimée par le lanceur d'alerte.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );
    setActiveAlert(null);
    setTrackingNumberInput('');
    setPasswordInput('');
    setDeleteConfirm(false);
  };

  // === AMÉLIORATION AJOUTÉE (Phase 33 — zone de dépôt de pièces jointes) ===
  // Même schéma de persistance que partout ailleurs dans l'application
  // (storage.saveAlert + logAudit) — aucun nouveau mécanisme introduit.
  const addEvidenceFiles = (files: FileList) => {
    if (!activeAlert) return;
    const newFiles: EvidenceFile[] = Array.from(files).map((file) => ({
      id: 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: file.name,
      size: file.size,
      type: file.type || 'document',
      uploadedAt: new Date().toISOString(),
    }));

    const updatedAlert: AlertRecord = {
      ...activeAlert,
      evidences: [...activeAlert.evidences, ...newFiles],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `${newFiles.length} pièce(s) jointe(s) ajoutée(s) par le lanceur d'alerte sur le dossier ${activeAlert.trackingNumber}.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );
    setActiveAlert(updatedAlert);
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addEvidenceFiles(e.target.files);
    e.target.value = '';
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDocDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addEvidenceFiles(e.dataTransfer.files);
  };

  // === AMÉLIORATION AJOUTÉE (bouton "Télécharger" sans action) === Le
  // menu d'une pièce jointe avait un bouton "Télécharger" sans `onClick`
  // (ne faisait rien au clic) — utilise le `dataUrl` déjà stocké sur
  // l'EvidenceFile (même mécanisme que le dépôt de fichier), sans
  // introduire de nouveau stockage.
  const handleDownloadEvidence = (ev: AlertRecord['evidences'][number]) => {
    if (!ev.dataUrl) return;
    const link = document.createElement('a');
    link.href = ev.dataUrl;
    link.download = ev.name;
    link.click();
  };

  const handleDeleteEvidence = (id: string) => {
    if (!activeAlert) return;
    const updatedAlert: AlertRecord = {
      ...activeAlert,
      evidences: activeAlert.evidences.filter((ev) => ev.id !== id),
      updatedAt: new Date().toISOString(),
    };
    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `Pièce jointe supprimée par le lanceur d'alerte sur le dossier ${activeAlert.trackingNumber}.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );
    setActiveAlert(updatedAlert);
    setOpenFileMenuId(null);
  };

  // === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
  // section) === `renderStatusBadge` déplacé tel quel dans
  // src/components/tracking/TrackingOverviewTab.tsx (seul utilisateur).

  // If not logged in into a case
  if (!activeAlert) {
    // === AMÉLIORATION AJOUTÉE (alignement avec l'accueil des espaces
    // StaffSpaceHome.tsx) === max-w-3xl → max-w-5xl, p-8 → p-8 sm:p-10 :
    // mêmes dimensions que l'écran "Espaces de travail", sur demande
    // explicite de l'utilisateur (les deux écrans doivent avoir le même
    // gabarit). min-h-[460px] était déjà identique aux deux écrans.
    // === AMÉLIORATION AJOUTÉE (même réduction que StaffSpaceHome.tsx,
    // "page similaire") === sur demande explicite de l'utilisateur
    // (« appliquer la même chose sur les pages similaires ») : largeur
    // `max-w-5xl`→`max-w-3xl`, hauteur `min-h-[460px]`→`min-h-[260px]`,
    // padding `p-10`→`p-8`, icône `w-5 h-5`→`w-4 h-4`, textes justifiés —
    // mêmes valeurs exactes que la carte "Espaces de travail". */}
    // === AMÉLIORATION AJOUTÉE (position verticale de la carte, "page
    // similaire" de StaffSpaceHome.tsx) === même correctif que l'accueil
    // des espaces : `min-h-[70vh] flex items-center` centre la carte
    // verticalement au lieu de la laisser collée en haut avec un grand vide
    // en dessous — sur demande explicite de l'utilisateur.
    return (
      <TrackingLogin
        t={t}
        trackingNumberInput={trackingNumberInput}
        setTrackingNumberInput={setTrackingNumberInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        loginError={loginError}
        isVerifying={isVerifying}
        handleLogin={handleLogin}
        onGoToNewAlert={onGoToNewAlert}
      />
    );
  }

  // === AMÉLIORATION AJOUTÉE (Phase 3) === real, derived "Updates" timeline
  // for the reporter — a whitelist of audit-log action types that are safe
  // to show externally (never internal notes, priority reasoning, or who
  // accessed the case), scoped to this case's trackingNumber. Computed
  // live from storage.getAuditLogs(), never a separate stored list.
  const REPORTER_SAFE_ACTIONS: AuditLogEntry['actionType'][] = [
    'ALERT_SUBMITTED',
    'STATUS_CHANGED',
    'CORRECTIVE_MEASURE_ADDED',
    'ALERT_CLOSED',
    'ALERT_REOPENED',
    'ALERT_ARCHIVED',
  ];
  const reporterUpdates = activeAlert
    ? storage
        .getAuditLogs()
        .filter((log) => log.trackingNumber === activeAlert.trackingNumber && REPORTER_SAFE_ACTIONS.includes(log.actionType))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR');

  // === AMÉLIORATION AJOUTÉE (Phase 33-34) === étapes numérotées, calculées
  // à partir du même `activeAlert.status` qu'avant.
  const trackSteps = [t.track_step1, t.track_step2, t.track_step3, t.track_step4];
  const currentStepNumber =
    activeAlert.status === 'new' || activeAlert.status === 'reopened'
      ? 1
      : activeAlert.status === 'under_review'
      ? 2
      : activeAlert.status === 'investigation'
      ? 3
      : activeAlert.status === 'corrective_action' || activeAlert.status === 'closed'
      ? 4
      : 1;

  // === AMÉLIORATION AJOUTÉE (Phase 34 — frise chronologique) === combine
  // les événements réels (messages, changements de statut réellement
  // survenus) avec les étapes du pipeline pas encore atteintes, affichées
  // en gris comme un aperçu de ce qui reste à venir — jamais un événement
  // inventé, seulement les 4 étapes déjà connues du statut (mêmes
  // `trackSteps` que l'en-tête).
  // === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
  // section) === type `TimelineEntry` déplacé dans
  // src/components/tracking/TrackingUpdatesTab.tsx (importé ci-dessus).
  const timelineItems: TimelineEntry[] = [
    {
      title: t.track_step1,
      desc: currentStepNumber === 1 ? undefined : undefined,
      time: formatDateTime(activeAlert.createdAt),
      state: currentStepNumber === 1 ? 'current' : 'done',
    },
  ];
  const realEvents = [
    ...activeAlert.messages.map((m) => ({
      title: m.sender === 'whistleblower' ? t.track_event_msg_sent : t.track_event_msg_received,
      sortTime: new Date(m.createdAt).getTime(),
    })),
    ...reporterUpdates
      .filter((log) => log.actionType !== 'ALERT_SUBMITTED')
      .map((log) => ({ title: log.details, sortTime: new Date(log.timestamp).getTime() })),
  ].sort((a, b) => a.sortTime - b.sortTime);
  realEvents.forEach((ev) => {
    timelineItems.push({ title: ev.title, time: formatDateTime(new Date(ev.sortTime).toISOString()), state: 'done' });
  });
  const remainingStages = trackSteps
    .map((label, i) => ({ label, n: i + 1 }))
    .filter((s) => s.n !== 1 && s.n >= currentStepNumber);
  remainingStages.forEach((s, i) => {
    // === AMÉLIORATION AJOUTÉE (Phase 34) === l'étape correspondant au
    // statut actuel du dossier (currentStepNumber) est réellement en cours
    // — elle doit apparaître comme "current" (pastille bleue), pas comme
    // une étape future grisée ; seules les étapes suivantes sont "à venir".
    const isCurrent = s.n === currentStepNumber;
    const desc = isCurrent ? t.track_step_in_progress : i === remainingStages.length - 1 ? t.track_step_upcoming : t.track_step_pending;
    timelineItems.push({ title: s.label, desc, state: isCurrent ? 'current' : 'pending' });
  });

  const goBackToLogin = () => {
    setActiveAlert(null);
    setPasswordInput('');
  };

  // === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
  // section) === `sidebarItems` déplacé tel quel dans
  // src/components/tracking/TrackingSidebar.tsx (seul utilisateur).

  // Active Alert Tracking Detail View
  return (
    // === AMÉLIORATION AJOUTÉE (suivi — design modernisé) === `activa-form` :
    // styles et animations partagés avec le formulaire (index.css) ; menu et
    // contenu apparaissent en douceur, chaque onglet s'affiche en fondu.
    <div className="activa-form max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <button
        onClick={goBackToLogin}
        className="activa-enter group flex items-center gap-1.5 px-2.5 py-1.5 -ml-2.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white transition-all mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={2} />
        {t.track_back}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Sidebar navigation */}
        <div className="activa-enter lg:sticky lg:top-6" style={{ '--d': '60ms' } as React.CSSProperties}>
        <TrackingSidebar
          t={t}
          activeAlert={activeAlert}
          activeTrackTab={activeTrackTab}
          setActiveTrackTab={setActiveTrackTab}
          onGoToContact={onGoToContact}
        />
        </div>

        {/* Content — `key` : l'onglet choisi rejoue l'apparition en fondu. */}
        <div key={activeTrackTab} className="activa-enter space-y-5" style={{ '--d': '120ms' } as React.CSSProperties}>
          {/* --- Overview tab --- */}
          {activeTrackTab === 'overview' && (
            <TrackingOverviewTab
              t={t}
              lang={lang}
              activeAlert={activeAlert}
              setShowSupplementModal={setShowSupplementModal}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              handleDeleteAlert={handleDeleteAlert}
              trackSteps={trackSteps}
              currentStepNumber={currentStepNumber}
            />
          )}

          {/* --- Messages tab (CDC 3.1.2) --- */}
          {activeTrackTab === 'messages' && (
            <TrackingMessagesTab
              t={t}
              activeAlert={activeAlert}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              setActiveTrackTab={setActiveTrackTab}
              handleSendMessage={handleSendMessage}
              formatDateTime={formatDateTime}
            />
          )}

          {/* --- Documents tab --- */}
          {activeTrackTab === 'documents' && (
            <TrackingDocumentsTab
              t={t}
              lang={lang}
              activeAlert={activeAlert}
              isDocDragging={isDocDragging}
              setIsDocDragging={setIsDocDragging}
              openFileMenuId={openFileMenuId}
              setOpenFileMenuId={setOpenFileMenuId}
              handleDocFileChange={handleDocFileChange}
              handleDocDrop={handleDocDrop}
              handleDownloadEvidence={handleDownloadEvidence}
              handleDeleteEvidence={handleDeleteEvidence}
            />
          )}

          {/* --- Updates tab: real timeline merging past events + upcoming pipeline stages --- */}
          {activeTrackTab === 'updates' && (
            <TrackingUpdatesTab
              t={t}
              timelineItems={timelineItems}
            />
          )}
        </div>
      </div>

      {/* MODAL: COMPLÉTER SA DÉCLARATION */}
      {showSupplementModal && (
        <TrackingSupplementModal
          t={t}
          supplementText={supplementText}
          setSupplementText={setSupplementText}
          setShowSupplementModal={setShowSupplementModal}
          handleAddSupplement={handleAddSupplement}
        />
      )}
    </div>
  );
};
