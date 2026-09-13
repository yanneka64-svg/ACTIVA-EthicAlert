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
  ShieldCheck,
  AlertTriangle,
  LogOut,
  Info,
  ChevronRight,
  Shield,
  FileUp,
  X,
  HelpCircle,
} from 'lucide-react';
import { Language, AlertRecord, CaseMessage, AuditLogEntry, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { verifyPassword } from '../services/crypto';
import { getLockStatus, recordFailedAttempt, clearAttempts, formatRemaining } from '../services/rateLimiter';

interface WhistleblowerPortalProps {
  lang: Language;
  initialTrackingNumber?: string;
  onGoToNewAlert: () => void;
  onNavigateHome?: () => void;
}

export const WhistleblowerPortal: React.FC<WhistleblowerPortalProps> = ({
  lang,
  initialTrackingNumber = '',
  onGoToNewAlert,
  onNavigateHome,
}) => {
  const t = TRANSLATIONS[lang];

  // Login credentials state
  const [trackingNumberInput, setTrackingNumberInput] = useState(initialTrackingNumber);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AlertRecord | null>(null);

  // Active portal sidebar tab
  const [activeTab, setActiveTab] = useState<'overview' | 'status' | 'messages' | 'evidence' | 'profile'>('overview');

  // Interactive modal and message states
  const [replyContent, setReplyContent] = useState('');
  const [supplementText, setSupplementText] = useState('');
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Additional file upload in portal
  const [newFiles, setNewFiles] = useState<EvidenceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Sync if initial tracking number provided
  useEffect(() => {
    if (initialTrackingNumber) {
      setTrackingNumberInput(initialTrackingNumber);
      const found = storage.getAlertByTracking(initialTrackingNumber);
      if (found) {
        setActiveAlert(found);
      }
    }
  }, [initialTrackingNumber]);

  // Real-time updates subscription
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      if (activeAlert) {
        const updated = storage.getAlertById(activeAlert.id);
        if (updated) setActiveAlert(updated);
      }
    });
    return unsub;
  }, [activeAlert]);

  // Handle Authentication with Brute-Force Rate Limiting
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedNum = trackingNumberInput.trim().toUpperCase();
    if (!trimmedNum) {
      setLoginError('Veuillez renseigner votre numéro de dossier.');
      return;
    }

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
      setIsVerifying(false);
      setLoginError('Numéro de dossier ou mot de passe incorrect.');
      return;
    }

    const passwordValid = await verifyPassword(
      passwordInput,
      alert.accessCodeHash,
      alert.accessCodeSalt
    );

    if (passwordValid) {
      clearAttempts(trimmedNum);
      setActiveAlert(alert);
      setPasswordInput('');
      setLoginError('');
      storage.logAudit(
        'ALERT_ACCESSED',
        `Espace sécurisé consulté par le lanceur d'alerte pour le dossier ${alert.trackingNumber}.`,
        { id: alert.id, trackingNumber: alert.trackingNumber }
      );
    } else {
      recordFailedAttempt(trimmedNum);
      setLoginError('Numéro de dossier ou mot de passe incorrect.');
    }
    setIsVerifying(false);
  };

  // Send message to DARC
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeAlert) return;

    const newMsg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'whistleblower',
      senderDisplayName: activeAlert.whistleblower.isAnonymous
        ? 'Lanceur d’alerte (Anonyme)'
        : (activeAlert.whistleblower.fullName || 'Lanceur d’alerte'),
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

  // Add supplementary information to declaration
  const handleAddSupplement = () => {
    if (!supplementText.trim() || !activeAlert) return;

    const timestampStr = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
    const updatedDesc = `${activeAlert.detailedDescription}\n\n--- [Complément d'information formel apporté le ${timestampStr}] ---\n${supplementText.trim()}`;

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

  // Upload supplementary evidence
  const handleUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !activeAlert) return;

    const uploaded: EvidenceFile[] = Array.from(files).map((file) => ({
      id: 'evi-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    }));

    const updatedAlert: AlertRecord = {
      ...activeAlert,
      evidences: [...activeAlert.evidences, ...uploaded],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `${uploaded.length} pièce(s) jointe(s) complémentaire(s) versée(s) par le lanceur d'alerte sur le dossier ${activeAlert.trackingNumber}.`,
      { id: activeAlert.id, trackingNumber: activeAlert.trackingNumber }
    );

    setActiveAlert(updatedAlert);
    setShowUploadModal(false);
  };

  // Delete declaration if still in new status
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

  // Safe whitelist of events shown to whistleblower (no internal investigator reasoning or notes)
  const REPORTER_SAFE_ACTIONS: AuditLogEntry['actionType'][] = [
    'ALERT_SUBMITTED',
    'STATUS_CHANGED',
    'CORRECTIVE_MEASURE_ADDED',
    'ALERT_CLOSED',
    'ALERT_REOPENED',
    'ALERT_ARCHIVED',
  ];

  const timelineEvents = activeAlert
    ? storage
        .getAuditLogs()
        .filter(
          (log) =>
            log.trackingNumber === activeAlert.trackingNumber &&
            REPORTER_SAFE_ACTIONS.includes(log.actionType)
        )
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const renderStatusBadge = (status: AlertRecord['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-700" />
            {t.status_new}
          </span>
        );
      case 'under_review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            {t.status_under_review}
          </span>
        );
      case 'investigation':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-purple-700" />
            {t.status_investigation}
          </span>
        );
      case 'corrective_action':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-700" />
            {t.status_corrective_action}
          </span>
        );
      case 'closed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            {t.status_closed}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION / LOGIN VIEW FOR WHISTLEBLOWER
  // -------------------------------------------------------------
  if (!activeAlert) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 relative overflow-hidden">
          <div className="text-center space-y-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#0B2545]/10 border border-[#0B2545]/20 flex items-center justify-center mx-auto text-[#0B2545] shadow-sm">
              <Lock className="w-7 h-7 text-[#0B2545]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Espace Sécurisé Lanceur d’Alerte
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              Consultez l’état d’avancement de votre signalement, échangez avec les auditeurs DARC en toute confidentialité et versez des compléments d’information.
            </p>
          </div>

          {loginError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Numéro de dossier (Case ID)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex : ACT-2026-0418"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono uppercase transition bg-slate-50/50"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mot de passe de sécurisation ou Code d'accès
              </label>
              <input
                type="password"
                required
                placeholder="Votre mot de passe défini lors du dépôt"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-60 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 mt-2"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{isVerifying ? 'Vérification sécurisée…' : 'Accéder à mon espace sécurisé'}</span>
            </button>
          </form>

          {/* Demonstration assistance pills */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-2.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Dossiers de test préconfigurés :</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrackingNumberInput('ACT-2026-0418');
                  setPasswordInput('Activa2026!');
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-700 text-left transition font-mono text-[11px]"
              >
                <div className="font-bold text-[#0B2545]">ACT-2026-0418</div>
                <div className="text-[10px] text-slate-500 font-sans">Mot de passe : Activa2026!</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackingNumberInput('ACT-2026-0391');
                  setPasswordInput('Secret2026!');
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-700 text-left transition font-mono text-[11px]"
              >
                <div className="font-bold text-[#0B2545]">ACT-2026-0391</div>
                <div className="text-[10px] text-slate-500 font-sans">Mot de passe : Secret2026!</div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onGoToNewAlert}
                className="text-blue-700 hover:text-blue-900 font-semibold text-xs inline-flex items-center gap-1.5"
              >
                <span>Vous souhaitez plutôt transmettre un nouveau signalement ?</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: AUTHENTICATED WHISTLEBLOWER PORTAL (DEDICATED SEPARATE LAYOUT)
  // -------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner with Reassurance and Logout */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="font-mono text-xl font-extrabold text-[#0B2545]">
              {activeAlert.trackingNumber}
            </span>
            {renderStatusBadge(activeAlert.status)}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                activeAlert.whistleblower.isAnonymous
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {activeAlert.whistleblower.isAnonymous ? (
                <span className="flex items-center gap-1">
                  <UserX className="w-3 h-3" /> Signalement Anonyme
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Signalement Identifié
                </span>
              )}
            </span>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {activeAlert.concernedEntity} ({activeAlert.country})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Soumis le {new Date(activeAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}
            </span>
            <span>•</span>
            <span className="text-amber-700 font-medium">
              Classification DARC : {activeAlert.riskEvaluation.nocaThreshold}
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSupplementModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 transition"
            title="Ajouter un complément d'information formel"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Compléter la déclaration</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Imprimer / Sauvegarder le récépissé officiel"
          >
            <Download className="w-4 h-4" />
          </button>

          {activeAlert.status === 'new' && (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
              title="Supprimer définitivement ma déclaration"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              setActiveAlert(null);
              setPasswordInput('');
              if (onNavigateHome) onNavigateHome();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Main Whistleblower Workspace: Sidebar + Canvas */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Whistleblower Portal Sidebar */}
        <aside className="w-full lg:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 shrink-0 space-y-1">
          <div className="px-3 py-2.5 border-b border-slate-100 mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Espace Dossier
            </span>
            <div className="text-xs font-bold text-slate-900 truncate">
              {activeAlert.category}
            </div>
          </div>

          {[
            { id: 'overview', label: 'Mon signalement', icon: <FileText className="w-4 h-4" /> },
            { id: 'status', label: 'Statut & Timeline', icon: <History className="w-4 h-4" />, count: timelineEvents.length },
            { id: 'messages', label: 'Messages & Dialogue DARC', icon: <MessageSquare className="w-4 h-4" />, count: activeAlert.messages.length },
            { id: 'evidence', label: 'Pièces jointes', icon: <Paperclip className="w-4 h-4" />, count: activeAlert.evidences.length },
            { id: 'profile', label: 'Profil & Sécurité', icon: <Shield className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                activeTab === item.id
                  ? 'bg-[#0B2545] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === item.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}

          <div className="pt-4 border-t border-slate-100 px-3 mt-4 text-[11px] text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Chiffrement certifié</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Vos échanges avec la DARC ne révèlent ni votre adresse IP ni votre identité réelle sans votre accord.
            </p>
          </div>
        </aside>

        {/* Content Canvas */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Détail du signalement transmis
                  </h3>
                  <p className="text-xs text-slate-500">
                    Récapitulatif des faits communiqués à la Direction d'Audit et de Conformité.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Réf : {activeAlert.trackingNumber}
                </span>
              </div>

              {/* Categorization card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Catégorie</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block">{activeAlert.category}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{activeAlert.subCategory}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Entité & Pays</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block">{activeAlert.concernedEntity}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{activeAlert.country}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lieu & Période</span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block">{activeAlert.incidentLocation || 'Non spécifié'}</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">{activeAlert.incidentDates}</span>
                </div>
              </div>

              {/* Facts description */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description détaillée des faits constatés
                </span>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {activeAlert.detailedDescription}
                </div>
              </div>

              {/* Implicated persons */}
              {activeAlert.involvedPersons.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Personnes impliquées déclarées ({activeAlert.involvedPersons.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeAlert.involvedPersons.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.position}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {p.hierarchyRole}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STATUS & TIMELINE */}
          {activeTab === 'status' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Statut de traitement & Chronologie DARC
                </h3>
                <p className="text-xs text-slate-500">
                  Suivi des étapes franchies par le dossier depuis sa transmission initiale.
                </p>
              </div>

              {/* Current Status banner */}
              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-blue-950 text-sm flex items-center gap-2">
                    <span>Statut actuel :</span>
                    {renderStatusBadge(activeAlert.status)}
                  </div>
                  <p className="text-blue-900 leading-relaxed">
                    {activeAlert.status === 'new' &&
                      'Votre signalement a été reçu par la DARC et est en attente de qualification initiale.'}
                    {activeAlert.status === 'under_review' &&
                      'Le dossier fait actuellement l’objet d’un examen de recevabilité par les auditeurs assermentés.'}
                    {activeAlert.status === 'investigation' &&
                      'Une enquête interne est en cours conformément à la charte d’investigation du Groupe ACTIVA.'}
                    {activeAlert.status === 'corrective_action' &&
                      'Les constatations ont donné lieu à des mesures correctives en cours de déploiement.'}
                    {activeAlert.status === 'closed' &&
                      'Le traitement du dossier est achevé et ses conclusions ont été validées par la direction DARC.'}
                  </p>
                  {activeAlert.targetCompletionDate && (
                    <div className="pt-1 text-[11px] text-blue-800">
                      Échéance indicative de réponse / traitement :{' '}
                      <span className="font-bold">
                        {new Date(activeAlert.targetCompletionDate).toLocaleDateString(
                          lang === 'en' ? 'en-US' : 'fr-FR'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline list */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Journal des étapes de traitement ({timelineEvents.length})
                </span>

                <div className="border-l-2 border-slate-200 ml-3 space-y-6 pl-4">
                  {timelineEvents.map((ev, idx) => (
                    <div key={ev.id || idx} className="relative">
                      <div className="w-3 h-3 rounded-full bg-blue-600 absolute -left-[23px] top-1 ring-4 ring-white" />
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(ev.timestamp).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">{ev.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MESSAGES & DIALOGUE DARC */}
          {activeTab === 'messages' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dialogue chiffré avec la DARC
                  </h3>
                  <p className="text-xs text-slate-500">
                    Échangez directement avec les auditeurs en charge de votre dossier sans compromettre votre anonymat.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Canal sécurisé
                </div>
              </div>

              {/* Messages Thread */}
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
                {activeAlert.messages.map((msg) => {
                  const isWhistleblower = msg.sender === 'whistleblower';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isWhistleblower ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-slate-400 mb-1 px-1">
                        {msg.senderDisplayName} •{' '}
                        {new Date(msg.createdAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </div>
                      <div
                        className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${
                          isWhistleblower
                            ? 'bg-[#0B2545] text-white rounded-tr-none'
                            : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendMessage} className="pt-4 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Répondre ou transmettre un nouveau message aux auditeurs
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    required
                    placeholder="Saisissez votre message ici en toute confidentialité…"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-slate-800"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Les pièces jointes peuvent être ajoutées dans l'onglet « Pièces jointes ».
                  </span>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold transition shadow"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Envoyer le message</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: EVIDENCE / PIECES JOINTES */}
          {activeTab === 'evidence' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pièces justificatives & Preuves ({activeAlert.evidences.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Documents transmis pour appuyer l'investigation DARC.
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Ajouter une pièce jointe</span>
                </button>
              </div>

              {activeAlert.evidences.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                  <Paperclip className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700">Aucune pièce jointe versée</div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Vous pouvez verser des documents (PDF, captures d'écran, factures) à tout moment pour étayer votre dossier.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#0B2545] text-white text-xs font-semibold"
                  >
                    Ajouter un document
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeAlert.evidences.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs hover:border-blue-300 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate" title={f.name}>
                            {f.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {(f.size / 1024).toFixed(1)} Ko • Versé le{' '}
                            {new Date(f.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          alert(`Téléchargement sécurisé du fichier « ${f.name} »`);
                        }}
                        className="p-2 rounded-lg hover:bg-white text-slate-600 transition"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Profil & Paramètres de Sécurité
                </h3>
                <p className="text-xs text-slate-500">
                  Identifiants et statut de confidentialité de votre dossier.
                </p>
              </div>

              {/* Identifiers card */}
              <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Vos identifiants d’accès confidentiels
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Numéro de dossier (Case ID)
                    </span>
                    <span className="font-mono text-sm font-bold text-[#0B2545] select-all block mt-0.5">
                      {activeAlert.trackingNumber}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Canal de transmission
                    </span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      Portail Web Sécurisé (TLS 1.3)
                    </span>
                  </div>
                </div>
              </div>

              {/* Whistleblower details */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mode de déclaration choisi
                </span>
                {activeAlert.whistleblower.isAnonymous ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <UserX className="w-4 h-4 text-emerald-700" />
                      Anonymat Strict Confirmé
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Aucune donnée personnelle (nom, prénom, email, téléphone) n'est associée à ce dossier dans le système DARC.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-700" />
                      Déclaration Nominative Protégée
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/60">
                      <div>
                        <span className="text-blue-700 font-semibold block">Nom complet :</span>
                        <span>{activeAlert.whistleblower.fullName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-semibold block">Poste & Département :</span>
                        <span>
                          {activeAlert.whistleblower.jobTitle} - {activeAlert.whistleblower.department}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-semibold block">Email de contact :</span>
                        <span>{activeAlert.whistleblower.email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-semibold block">Type de déclarant :</span>
                        <span>{activeAlert.whistleblower.declarantType}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Security recommendations */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-700" />
                  Recommandations de sécurité
                </span>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                  <li>Ne communiquez jamais votre mot de passe ni votre numéro de dossier à des tiers.</li>
                  <li>Déconnectez-vous systématiquement après chaque session sur cet espace.</li>
                  <li>Effacez l'historique du navigateur si vous utilisez un terminal partagé.</li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: COMPLÉMENT D'INFORMATION FORMEL */}
      {showSupplementModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-700" />
                Compléter ma déclaration
              </h3>
              <button
                onClick={() => setShowSupplementModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Ajoutez des faits nouveaux, des précisions de dates ou des éléments complémentaires. Ils seront intégrés au dossier et transmis aux auditeurs.
            </p>

            <textarea
              rows={5}
              required
              placeholder="Décrivez ici les nouveaux éléments…"
              value={supplementText}
              onChange={(e) => setSupplementText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-xs"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSupplementModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddSupplement}
                disabled={!supplementText.trim()}
                className="px-4 py-2 rounded-xl bg-[#0B2545] text-white text-xs font-bold disabled:opacity-50"
              >
                Enregistrer le complément
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD EVIDENCE */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-700" />
                Verser une nouvelle pièce jointe
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5">Avertissement sur les métadonnées :</span>
              Les fichiers peuvent comporter des métadonnées (auteur, nom de périphérique, localisation GPS) susceptibles de vous identifier.
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center transition">
              <input
                type="file"
                multiple
                id="portal-file-upload"
                onChange={(e) => handleUploadFiles(e.target.files)}
                className="hidden"
              />
              <label
                htmlFor="portal-file-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <FileUp className="w-8 h-8 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Cliquez ou glissez-déposez vos fichiers
                </span>
                <span className="text-[10px] text-slate-400">PDF, PNG, JPG, DOCX, XLSX (max 15 Mo)</span>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETION */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                Supprimer votre déclaration ?
              </h4>
              <p className="text-xs text-slate-500">
                Cette action est irréversible. Toutes les données, pièces jointes et messages de ce dossier seront supprimés définitivement.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAlert}
                className="flex-1 py-2 rounded-xl text-xs text-white bg-rose-600 hover:bg-rose-700 font-bold shadow"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
