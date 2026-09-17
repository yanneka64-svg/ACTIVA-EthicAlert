import React, { useState, useEffect } from 'react';
import {
  Search,
  Lock,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Download,
  Trash2,
  Building2,
  UserCheck,
  UserX,
  FileCheck2,
  Calendar,
  LayoutGrid,
  MessageSquare,
  Paperclip,
  History,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Tag,
  Upload,
  X,
  Info,
  ChevronRight,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { Language, AlertRecord, CaseMessage, AuditLogEntry, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE : vérification par hash salé + limitation du débit des tentatives ===
import { verifyPassword } from '../services/crypto';
import { getLockStatus, recordFailedAttempt, clearAttempts, formatRemaining } from '../services/rateLimiter';
import { formatCountryLabel } from '../data/activaConfig';

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
        `Trop de tentatives incorrectes. Réessayez dans ${formatRemaining(lockStatus.remainingMs)}.`
      );
      return;
    }

    setIsVerifying(true);
    const alert = storage.getAlertByTracking(trimmedNum);

    if (!alert) {
      recordFailedAttempt(trimmedNum);
      setLoginError('Numéro de dossier introuvable. Veuillez vérifier votre saisie.');
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
          ? `Trop de tentatives incorrectes. Accès verrouillé ${formatRemaining(status.remainingMs)}.`
          : 'Mot de passe incorrect pour ce numéro de dossier.'
      );
      setIsVerifying(false);
      return;
    }

    clearAttempts(trimmedNum);
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

    const timestampStr = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
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

  // Render Status Badge
  const renderStatusBadge = (status: AlertRecord['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-700" />
            {t.status_new}
          </span>
        );
      case 'under_review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            {t.status_under_review}
          </span>
        );
      case 'investigation':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-purple-700" />
            {t.status_investigation}
          </span>
        );
      case 'corrective_action':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-700" />
            {t.status_corrective_action}
          </span>
        );
      case 'closed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            {t.status_closed}
          </span>
        );
      case 'reopened':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-700" />
            {t.status_reopened}
          </span>
        );
      default:
        return null;
    }
  };

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
      <div className="min-h-[70vh] flex items-center justify-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-3xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          {/* === AMÉLIORATION AJOUTÉE (nouvelle photo de fond, fournie par
              l'utilisateur) === Remplace la photo du siège par une photo de
              bureau avec vue sur skyline, servie depuis
              public/brand/track-login-bg.jpg. */}
          {/* === AMÉLIORATION AJOUTÉE (photo de fond lente à l'affichage) ===
              BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : couleur de
              repli (`bg-[#0B2545]`, même teinte que le voile ci-dessous) le
              temps du chargement au lieu d'un flash blanc, + priorité de
              chargement explicite sur l'image. */}
          <div className="relative hidden lg:flex flex-col justify-end p-6 sm:p-8 min-h-[260px] text-white overflow-hidden bg-[#0B2545]">
            <img
              src="/brand/track-login-bg.jpg"
              alt="Espace de travail avec vue sur la ville"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-left"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545]/90 via-[#0B2545]/55 to-[#0B2545]/15" />
            <div className="relative z-10 space-y-5">
              {/* === AMÉLIORATION AJOUTÉE (texte du bandeau photo) === Remplace
                  l'accroche générique par le même texte explicatif que le
                  formulaire ("Consultez l'avancement de votre dossier...",
                  `t.track_subtitle`), sur demande explicite de l'utilisateur.
                  `track_login_tagline` reste défini dans translations.ts
                  (non supprimé) mais n'est plus utilisé ici. */}
              <p className="text-2xl font-bold leading-snug max-w-xs">{t.track_subtitle}</p>
              <div className="w-10 h-px bg-white/40" />
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold">{t.sidebar_confidentiality_title}</div>
                  <div className="text-xs text-white/80">{t.track_login_photo_note}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="bg-white p-6 sm:p-8 flex flex-col justify-center">
            {/* === AMÉLIORATION AJOUTÉE (alignement avec l'accueil des
                espaces) === Cadenas retiré et titre aligné à gauche
                (au lieu de centré) — même style que le titre "Espaces de
                travail" de StaffSpaceHome.tsx, sur demande explicite. */}
            {/* === AMÉLIORATION AJOUTÉE (retrait du doublon de texte) ===
                Le sous-titre (`t.track_subtitle`) était répété ici alors
                qu'il s'affiche désormais aussi sur le bandeau photo à
                gauche — retiré ici sur demande explicite de l'utilisateur,
                la clé de traduction reste inchangée et utilisée côté photo. */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">{t.track_title}</h2>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="activa-caret-blink space-y-4">
              <div>
                <label htmlFor="input-tracking-number" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.track_label_case_number} *
                </label>
                <input
                  type="text"
                  id="input-tracking-number"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  placeholder={t.track_placeholder_case_number}
                  className="w-full px-3 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                />
              </div>

              <div>
                <label htmlFor="input-tracking-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.track_label_password} *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="input-tracking-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={t.track_placeholder_password}
                    className="w-full px-3 py-2.5 pr-9 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* === AMÉLIORATION AJOUTÉE (Audit frontend — correction élevée) ===
                    BUG PRÉEXISTANT CORRIGÉ : `track_login_help` existait déjà dans
                    les traductions (avertissement sur la non-récupérabilité des
                    accès) mais n'était affiché nulle part dans l'application. */}
                <p className="mt-1.5 text-[11px] text-slate-500">{t.track_login_help}</p>
              </div>

              <button
                type="submit"
                id="btn-submit-tracking-login"
                disabled={isVerifying}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
              >
                <span>{isVerifying ? 'Vérification…' : t.btn_login_tracking}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 uppercase font-semibold">{t.track_divider_or}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              onClick={onGoToNewAlert}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-semibold transition"
            >
              <span>{t.track_switch_to_new_alert}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </div>
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
  type TimelineEntry = { title: string; desc?: string; time?: string; state: 'done' | 'current' | 'pending' };
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
      title: m.sender === 'whistleblower' ? 'Message envoyé' : 'Message reçu',
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
    const desc = isCurrent ? 'En cours de traitement.' : i === remainingStages.length - 1 ? 'À venir.' : 'En attente.';
    timelineItems.push({ title: s.label, desc, state: isCurrent ? 'current' : 'pending' });
  });

  const goBackToLogin = () => {
    setActiveAlert(null);
    setPasswordInput('');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 34 — navigation latérale) ===
  const sidebarItems: { key: typeof activeTrackTab; icon: React.ComponentType<{ className?: string }>; label: string; count: number }[] = [
    { key: 'overview', icon: LayoutGrid, label: t.track_tab_overview, count: 0 },
    { key: 'messages', icon: MessageSquare, label: t.track_tab_messages, count: activeAlert.messages.length },
    { key: 'documents', icon: Paperclip, label: t.track_tab_documents, count: activeAlert.evidences.length },
    { key: 'updates', icon: History, label: t.track_tab_updates, count: 0 },
  ];

  // Active Alert Tracking Detail View
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <button
        onClick={goBackToLogin}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t.track_back}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Sidebar navigation */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = activeTrackTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTrackTab(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count > 0 && (
                      <span
                        className={`px-1.5 rounded-full text-[10px] font-bold ${
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {onGoToContact && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="text-xs font-bold text-slate-800">{t.sidebar_help_title}</div>
              <button
                type="button"
                onClick={onGoToContact}
                className="text-xs text-blue-700 hover:underline font-semibold mt-1"
              >
                {t.footer_contact}
              </button>
            </div>
          )}
        </aside>

        {/* Content */}
        <div className="space-y-5">
          {/* --- Overview tab --- */}
          {activeTrackTab === 'overview' && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-xl font-extrabold text-[#0B2545]">
                      {activeAlert.trackingNumber}
                    </span>
                    {renderStatusBadge(activeAlert.status)}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                        activeAlert.whistleblower.isAnonymous
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {activeAlert.whistleblower.isAnonymous ? (
                        <UserX className="w-3 h-3" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      {activeAlert.whistleblower.isAnonymous ? t.track_id_anonymous : t.track_id_identified}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeAlert.concernedEntity} ({formatCountryLabel(storage.getCountries(), activeAlert.country)})</span>
                    <span>•</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Déposé le {new Date(activeAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
                  </p>
                </div>

                {/* Status progression — étapes numérotées reliées par des traits */}
                <div className="mt-6 pt-2">
                  <div className="flex items-start">
                    {trackSteps.map((label, idx) => {
                      const n = idx + 1;
                      const done = n < currentStepNumber;
                      const active = n === currentStepNumber;
                      return (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col items-center text-center w-20 sm:w-28">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 ${
                                done
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : active
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                            >
                              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
                            </span>
                            <span
                              className={`mt-1.5 text-[10px] sm:text-[11px] leading-tight ${
                                active ? 'font-bold text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                          {idx < trackSteps.length - 1 && (
                            <div className={`flex-1 h-0.5 mt-4 ${n < currentStepNumber ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Closure message to Whistleblower if closed */}
                {activeAlert.status === 'closed' && activeAlert.closureMessageToWhistleblower && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Conclusion formelle transmise par la DARC
                    </h4>
                    <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">
                      {activeAlert.closureMessageToWhistleblower}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">{t.track_general_info_title}</h4>
                    <button
                      type="button"
                      onClick={() => setShowSupplementModal(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      title="Ajouter des informations complémentaires au dossier"
                    >
                      <Pencil className="w-3 h-3" />
                      {t.btn_modify}
                    </button>
                  </div>
                  {[
                    { icon: FileText, label: t.track_field_case_number, value: activeAlert.trackingNumber },
                    { icon: Building2, label: t.track_field_entity, value: `${activeAlert.concernedEntity} (${formatCountryLabel(storage.getCountries(), activeAlert.country)})` },
                    { icon: Tag, label: t.track_field_category, value: activeAlert.category, sub: activeAlert.subCategory },
                    { icon: Calendar, label: t.track_field_dates, value: activeAlert.incidentDates },
                    { icon: MapPin, label: t.track_field_location, value: activeAlert.incidentLocation },
                  ].map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500">{f.label}</div>
                          <div className="text-xs font-semibold text-slate-800">{f.value}</div>
                          {f.sub && <div className="text-[11px] text-slate-500">{f.sub}</div>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500 mb-0.5">{t.track_field_status}</div>
                      {renderStatusBadge(activeAlert.status)}
                    </div>
                  </div>

                  {/* Option to delete declaration if brand new and not yet reviewed */}
                  {activeAlert.status === 'new' && (
                    <div className="pt-3 border-t border-slate-100">
                      {!deleteConfirm ? (
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer ma déclaration</span>
                        </button>
                      ) : (
                        <div className="p-2 bg-rose-50 rounded border border-rose-200 text-center max-w-xs">
                          <p className="text-[11px] text-rose-800 font-semibold mb-2">Confirmer la suppression irréversible ?</p>
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={handleDeleteAlert}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                            >
                              Oui, supprimer
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(false)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px]"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-2">{t.track_field_description}</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {activeAlert.detailedDescription}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-blue-900">{t.track_confidential_note_title}</div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">{t.track_confidential_note_desc}</p>
                    </div>
                  </div>

                  {/* Attachment/print action preserved (was previously in the
                      persistent header): kept reachable here rather than
                      dropped, since the new reference doesn't show it but
                      never asked for its removal. */}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger le récépissé
                  </button>
                </div>
              </div>
            </>
          )}

          {/* --- Messages tab (CDC 3.1.2) --- */}
          {activeTrackTab === 'messages' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{t.track_tab_messages}</h3>

              <div className="flex flex-col h-[440px]">
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 shrink-0">
                  <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-emerald-900">{t.msg_box_title}</div>
                    <div className="text-[11px] text-emerald-700">{t.msg_box_subtitle}</div>
                  </div>
                </div>

                {/* Messages scroll box */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                  {activeAlert.messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Aucun message pour le moment. Vous pouvez poser une question ou ajouter des éléments aux enquêteurs.
                    </div>
                  ) : (
                    activeAlert.messages.map((m) => {
                      const isMe = m.sender === 'whistleblower';
                      const initials = isMe ? 'L' : m.senderDisplayName.slice(0, 2).toUpperCase();
                      return (
                        <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                              isMe ? 'bg-blue-600' : 'bg-[#0B2545]'
                            }`}
                          >
                            {initials}
                          </span>
                          <div className={`flex flex-col max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                              <span className="font-semibold text-slate-600">{isMe ? t.track_you_label : m.senderDisplayName}</span>
                              <span>•</span>
                              <span>{formatDateTime(m.createdAt)}</span>
                            </div>

                            <div
                              className={`p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed border ${
                                isMe
                                  ? 'bg-blue-50 border-blue-100 text-slate-800 rounded-br-none'
                                  : 'bg-slate-50 border-slate-100 text-slate-800 rounded-bl-none'
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message form */}
                <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 shrink-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="input-tracking-reply"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={t.msg_placeholder}
                      className="flex-1 px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveTrackTab('documents')}
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition shrink-0"
                      title={t.track_message_input_helper}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      id="btn-tracking-send"
                      disabled={!replyContent.trim()}
                      className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
                      title={t.btn_send_msg}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">{t.track_message_input_helper}</p>
                </form>
              </div>
            </div>
          )}

          {/* --- Documents tab --- */}
          {activeTrackTab === 'documents' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900">{t.track_tab_documents}</h3>
              <p className="text-xs text-slate-500 mb-4">{t.track_docs_subtitle}</p>

              {/* === AMÉLIORATION AJOUTÉE (Phase 33) === le lanceur d'alerte
                  peut désormais ajouter lui-même des pièces jointes depuis
                  son espace de suivi (glisser-déposer ou sélection), pas
                  seulement au moment du dépôt initial. */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDocDragging(true);
                }}
                onDragLeave={() => setIsDocDragging(false)}
                onDrop={handleDocDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                  isDocDragging ? 'border-blue-500 bg-blue-50/40' : 'border-slate-300 bg-slate-50/50 hover:border-blue-400'
                }`}
              >
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">{t.track_docs_upload_title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{t.track_docs_upload_hint}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t.track_docs_upload_formats}</p>
                <input
                  type="file"
                  id="track-doc-file-input"
                  multiple
                  onChange={handleDocFileChange}
                  className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 mt-4">
                {activeAlert.evidences.length === 0 ? (
                  <span className="text-slate-400 italic text-[11px]">Aucune pièce déposée</span>
                ) : (
                  activeAlert.evidences.map((ev) => (
                    <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-slate-700 truncate flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{ev.name}</span>
                      </span>
                      <span className="text-slate-400 shrink-0 hidden sm:inline">
                        {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}
                      </span>
                      <span className="text-slate-400 shrink-0">{(ev.size / 1024).toFixed(0)} Ko</span>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpenFileMenuId(openFileMenuId === ev.id ? null : ev.id)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
                          title="Options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {openFileMenuId === ev.id && (
                          <div
                            className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 text-xs"
                            onMouseLeave={() => setOpenFileMenuId(null)}
                          >
                            <button
                              type="button"
                              onClick={() => { handleDownloadEvidence(ev); setOpenFileMenuId(null); }}
                              disabled={!ev.dataUrl}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                              <Download className="w-3.5 h-3.5" /> Télécharger
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvidence(ev.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2.5 mt-4">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{t.track_docs_metadata_warning}</p>
              </div>
            </div>
          )}

          {/* --- Updates tab: real timeline merging past events + upcoming pipeline stages --- */}
          {activeTrackTab === 'updates' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900">{t.track_updates_title}</h3>
              <p className="text-xs text-slate-500 mb-6">{t.track_updates_subtitle}</p>

              <ol className="space-y-6">
                {timelineItems.map((item, i) => (
                  <li key={i} className="relative pl-9">
                    {i < timelineItems.length - 1 && (
                      <span className="absolute left-[11px] top-6 h-[calc(100%+0.5rem)] w-px bg-slate-200" />
                    )}
                    <span
                      className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        item.state === 'done'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : item.state === 'current'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-300'
                      }`}
                    >
                      {item.state === 'done' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${item.state === 'current' ? 'bg-white' : 'bg-slate-300'}`} />
                      )}
                    </span>
                    <div className={item.state === 'pending' ? 'opacity-60' : ''}>
                      {item.time && <time className="text-[10px] font-semibold text-slate-400 block">{item.time}</time>}
                      <div className="text-xs font-bold text-slate-900">{item.title}</div>
                      {item.desc && <div className="text-[11px] text-slate-500">{item.desc}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: COMPLÉTER SA DÉCLARATION */}
      {showSupplementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <button
              type="button"
              onClick={() => setShowSupplementModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-3 border-b border-slate-100 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.track_supplement_title}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">{t.track_supplement_desc}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.track_supplement_label} *
              </label>
              <textarea
                rows={5}
                maxLength={2000}
                value={supplementText}
                onChange={(e) => setSupplementText(e.target.value)}
                placeholder={t.track_supplement_placeholder}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="text-right text-[10px] text-slate-400 mt-0.5">{supplementText.length} / 2000</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>{t.track_supplement_warning}</p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSupplementModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddSupplement}
                disabled={!supplementText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                {t.track_supplement_submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
