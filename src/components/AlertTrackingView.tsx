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
  ShieldCheck,
  MapPin,
  Tag,
  Upload,
  X,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Language, AlertRecord, CaseMessage, AuditLogEntry, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE : vérification par hash salé + limitation du débit des tentatives ===
import { verifyPassword } from '../services/crypto';
import { getLockStatus, recordFailedAttempt, clearAttempts, formatRemaining } from '../services/rateLimiter';

interface AlertTrackingViewProps {
  lang: Language;
  initialTrackingNumber?: string;
  onGoToNewAlert: () => void;
}

/**
 * === AMÉLIORATION AJOUTÉE (Phase 33 — refonte du portail de suivi, fidèle
 * aux 4 captures de référence fournies) ===
 *
 * Restructure visuellement l'écran de connexion (deux colonnes : formulaire
 * + panneau de confidentialité), l'en-tête du dossier (lien Retour, étapes
 * numérotées reliées par des traits au lieu d'une grille de cases), l'onglet
 * Vue d'ensemble (deux cartes : informations générales à icônes + description
 * et encart confidentiel), l'onglet Messages (bandeau vert + avatars) et
 * l'onglet Pièces jointes (nouvelle zone de dépôt permettant au lanceur
 * d'alerte d'ajouter lui-même des pièces, liste avec date/taille/suppression)
 * ainsi que la modale de complément d'information (compteur de caractères,
 * avertissement anonymat, bouton avec icône d'envoi). Toute la logique
 * métier existante (connexion par hash salé + verrou anti-brute-force,
 * messagerie, complément d'information, suppression de déclaration,
 * historique dérivé de l'audit log) reste strictement identique — seule la
 * présentation change, et l'ajout/la suppression de pièces jointes ici
 * suivent exactement le même schéma storage.saveAlert()+logAudit() que le
 * reste de l'application.
 */
export const AlertTrackingView: React.FC<AlertTrackingViewProps> = ({
  lang,
  initialTrackingNumber = '',
  onGoToNewAlert,
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

  // === AMÉLIORATION AJOUTÉE (Phase 33) === zone de dépôt de pièces jointes.
  const [isDocDragging, setIsDocDragging] = useState(false);

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
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t.track_title}</h2>
          <p className="text-sm text-slate-600">{t.track_subtitle}</p>
        </div>

        {loginError && (
          <div className="max-w-md mx-auto mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {loginError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Login form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
              </div>

              <button
                type="submit"
                id="btn-submit-tracking-login"
                disabled={isVerifying}
                className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-60 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>{isVerifying ? 'Vérification…' : t.btn_login_tracking}</span>
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

            <div className="mt-5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>{t.track_login_help}</p>
            </div>
          </div>

          {/* Confidentiality panel */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6 sm:p-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-center font-bold text-slate-900">{t.sidebar_confidentiality_title}</h3>
            <ul className="space-y-2.5 pt-4">
              {[t.track_confidentiality_tip1, t.track_confidentiality_tip2, t.track_confidentiality_tip3].map((tip, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
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

  // === AMÉLIORATION AJOUTÉE (Phase 33) === étapes numérotées reliées par
  // des traits (remplace la grille de 4 cases de la Phase précédente),
  // calculées à partir du même `activeAlert.status` qu'avant.
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

  const goBackToLogin = () => {
    setActiveAlert(null);
    setPasswordInput('');
  };

  // Active Alert Tracking Detail View
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-4">
      <button
        onClick={goBackToLogin}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t.track_back}
      </button>

      {/* Top Bar with Case summary & Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="font-mono text-xl font-extrabold text-[#0B2545]">
                {activeAlert.trackingNumber}
              </span>
              {renderStatusBadge(activeAlert.status)}
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                activeAlert.whistleblower.isAnonymous
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
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
              <span>{activeAlert.concernedEntity} ({activeAlert.country})</span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Déposé le {new Date(activeAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
            </p>
          </div>

          {/* Whistleblower Case Actions (CDC 3.1.1: Compléter, modifier, supprimer) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSupplementModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 transition"
              title="Ajouter des informations complémentaires au dossier"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.track_complete_declaration}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Imprimer le récépissé officiel"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={goBackToLogin}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
            >
              {t.track_logout}
            </button>
          </div>
        </div>

        {/* Status progression — étapes numérotées reliées par des traits */}
        <div className="mt-6 pt-2">
          <div className="text-xs font-semibold text-slate-700 mb-3">{t.track_progress_label} :</div>
          <div className="flex items-start">
            {trackSteps.map((label, idx) => {
              const n = idx + 1;
              const done = n < currentStepNumber;
              const active = n === currentStepNumber;
              return (
                <React.Fragment key={idx}>
                  <div className="flex flex-col items-center text-center w-20 sm:w-28">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 3 — reporter portal tabbed layout) ===
          Overview / Messages / Documents / Updates, per the frontend-completion
          brief's target IA for this screen. Every piece of content that was
          in the old two-column layout is still here — none of it was
          removed, only re-organized into tabs — and all handlers/state are
          unchanged. */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTrackTab('overview')}
            className={`shrink-0 whitespace-nowrap py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTrackTab === 'overview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> {t.track_tab_overview}
          </button>
          <button
            onClick={() => setActiveTrackTab('messages')}
            className={`shrink-0 whitespace-nowrap py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTrackTab === 'messages' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> {t.track_tab_messages}
            {activeAlert.messages.length > 0 && (
              <span className="px-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{activeAlert.messages.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTrackTab('documents')}
            className={`shrink-0 whitespace-nowrap py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTrackTab === 'documents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" /> {t.track_tab_documents}
            {activeAlert.evidences.length > 0 && (
              <span className="px-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{activeAlert.evidences.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTrackTab('updates')}
            className={`shrink-0 whitespace-nowrap py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTrackTab === 'updates' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" /> {t.track_tab_updates}
          </button>
        </div>

        <div className="p-6">
          {/* --- Overview tab --- */}
          {activeTrackTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200 p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">{t.track_general_info_title}</h4>
                {[
                  { icon: FileText, label: t.track_field_case_number, value: activeAlert.trackingNumber },
                  { icon: Building2, label: t.track_field_entity, value: `${activeAlert.concernedEntity} (${activeAlert.country})` },
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
                <div className="rounded-xl border border-slate-200 p-5">
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
              </div>
            </div>
          )}

          {/* --- Messages tab (CDC 3.1.2) --- */}
          {activeTrackTab === 'messages' && (
            <div className="flex flex-col h-[480px]">
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
                            <span className="font-semibold text-slate-600">{m.senderDisplayName}</span>
                            <span>•</span>
                            <span>{new Date(m.createdAt).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
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
                    className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
                    title={t.btn_send_msg}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">{t.track_message_input_helper}</p>
              </form>
            </div>
          )}

          {/* --- Documents tab --- */}
          {activeTrackTab === 'documents' && (
            <div className="space-y-4">
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

              <div className="space-y-1.5">
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{t.track_docs_metadata_warning}</p>
              </div>
            </div>
          )}

          {/* --- Updates tab (real, derived from the case's own audit log) --- */}
          {activeTrackTab === 'updates' && (
            <div>
              {reporterUpdates.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">{t.track_updates_empty}</div>
              ) : (
                <ol className="relative border-l-2 border-slate-200 ml-2 space-y-5">
                  {reporterUpdates.map((log) => (
                    <li key={log.id} className="ml-4">
                      <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full -left-[5px] border-2 border-white" />
                      <time className="text-[10px] font-semibold text-slate-400">
                        {new Date(log.timestamp).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                      </time>
                      <p className="text-xs text-slate-700 mt-0.5">{log.details}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: COMPLÉTER SA DÉCLARATION */}
      {showSupplementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.track_supplement_title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.track_supplement_desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplementModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
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
