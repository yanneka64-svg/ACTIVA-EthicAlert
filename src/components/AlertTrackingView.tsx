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
  Calendar
} from 'lucide-react';
import { Language, AlertRecord, CaseMessage } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';

interface AlertTrackingViewProps {
  lang: Language;
  initialTrackingNumber?: string;
  onGoToNewAlert: () => void;
}

export const AlertTrackingView: React.FC<AlertTrackingViewProps> = ({
  lang,
  initialTrackingNumber = '',
  onGoToNewAlert,
}) => {
  const t = TRANSLATIONS[lang];

  // Tracking login state
  const [trackingNumberInput, setTrackingNumberInput] = useState(initialTrackingNumber);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertRecord | null>(null);

  // Messaging state
  const [replyContent, setReplyContent] = useState('');
  const [supplementText, setSupplementText] = useState('');
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedNum = trackingNumberInput.trim().toUpperCase();
    const alert = storage.getAlertByTracking(trimmedNum);

    if (!alert) {
      setLoginError('Numéro de dossier introuvable. Veuillez vérifier votre saisie.');
      return;
    }

    if (alert.accessCodeHash && passwordInput !== alert.accessCodeHash) {
      setLoginError('Mot de passe incorrect pour ce numéro de dossier.');
      return;
    }

    setActiveAlert(alert);
    storage.logAudit(
      'ALERT_ACCESSED',
      `Accès au dossier ${alert.trackingNumber} via code d'accès sécurisé par le lanceur d'alerte.`,
      { id: alert.id, trackingNumber: alert.trackingNumber }
    );
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

  // Render Status Badge
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
      case 'reopened':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-200 flex items-center gap-1.5">
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
      <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-700">
              <Search className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.track_title}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {t.track_subtitle}
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.label_enter_number} *
              </label>
              <input
                type="text"
                id="input-tracking-number"
                value={trackingNumberInput}
                onChange={(e) => setTrackingNumberInput(e.target.value)}
                placeholder="Ex: ACT-2026-0418"
                className="w-full px-3 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.label_enter_pwd} *
              </label>
              <input
                type="password"
                id="input-tracking-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Votre mot de passe confidentiel"
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              id="btn-submit-tracking-login"
              className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{t.btn_login_tracking}</span>
            </button>
          </form>

          {/* Helper demo chips */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium block mb-2">Exemples de dossiers de test disponibles :</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setTrackingNumberInput('ACT-2026-0418');
                  setPasswordInput('Activa2026!');
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
              >
                ACT-2026-0418 (mdp: Activa2026!)
              </button>
              <button
                onClick={() => {
                  setTrackingNumberInput('ACT-2026-0391');
                  setPasswordInput('Secret2026!');
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px]"
              >
                ACT-2026-0391 (mdp: Secret2026!)
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={onGoToNewAlert}
                className="text-blue-700 hover:underline font-medium text-xs"
              >
                Vous souhaitez plutôt déposer un nouveau signalement ?
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Alert Tracking Detail View
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Bar with Case summary & Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xl font-extrabold text-[#0B2545]">
                {activeAlert.trackingNumber}
              </span>
              {renderStatusBadge(activeAlert.status)}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                activeAlert.whistleblower.isAnonymous 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {activeAlert.whistleblower.isAnonymous ? (
                  <span className="flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Anonyme
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Identifié
                  </span>
                )}
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
              <span>Compléter la déclaration</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Imprimer le récépissé officiel"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setActiveAlert(null);
                setPasswordInput('');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Status progression bar */}
        <div className="mt-6 pt-2">
          <div className="text-xs font-semibold text-slate-700 mb-2">Avancement de votre dossier :</div>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className={`p-2 rounded-lg border ${
              activeAlert.status === 'new' 
                ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
            }`}>
              1. Enregistré & Reçu
            </div>
            <div className={`p-2 rounded-lg border ${
              activeAlert.status === 'under_review' 
                ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold' 
                : ['investigation', 'corrective_action', 'closed'].includes(activeAlert.status)
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                : 'border-slate-200 text-slate-400'
            }`}>
              2. Analyse DARC
            </div>
            <div className={`p-2 rounded-lg border ${
              activeAlert.status === 'investigation' 
                ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold' 
                : ['corrective_action', 'closed'].includes(activeAlert.status)
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                : 'border-slate-200 text-slate-400'
            }`}>
              3. Investigation
            </div>
            <div className={`p-2 rounded-lg border ${
              activeAlert.status === 'closed' 
                ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold' 
                : 'border-slate-200 text-slate-400'
            }`}>
              4. Clôturé & Mesures prises
            </div>
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

      {/* Two columns: Left Details, Right Secure Messaging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary of declaration */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
            Contenu de la déclaration
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Catégorie :</span>
              <span className="font-semibold text-slate-800">{activeAlert.category}</span>
              <div className="text-[11px] text-slate-500">{activeAlert.subCategory}</div>
            </div>

            <div>
              <span className="text-slate-500 block">Dates des faits :</span>
              <span className="font-medium text-slate-800">{activeAlert.incidentDates}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Lieu constaté :</span>
              <span className="font-medium text-slate-800">{activeAlert.incidentLocation}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Description des faits :</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed mt-1">
                {activeAlert.detailedDescription}
              </div>
            </div>

            {/* Attached evidences */}
            <div>
              <span className="text-slate-500 block mb-1">Pièces justificatives jointes :</span>
              {activeAlert.evidences.length === 0 ? (
                <span className="text-slate-400 italic text-[11px]">Aucune pièce déposée</span>
              ) : (
                <div className="space-y-1.5">
                  {activeAlert.evidences.map((ev) => (
                    <div key={ev.id} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 truncate">{ev.name}</span>
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Option to delete declaration if brand new and not yet reviewed */}
            {activeAlert.status === 'new' && (
              <div className="pt-4 border-t border-slate-100">
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer ma déclaration</span>
                  </button>
                ) : (
                  <div className="p-2 bg-rose-50 rounded border border-rose-200 text-center">
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
        </div>

        {/* Right: SECURE MESSAGING WITH INVESTIGATORS (CDC 3.1.2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[540px]">
          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                {t.msg_box_title}
              </h3>
              <p className="text-[11px] text-slate-500">
                Échanges chiffrés et anonymisés avec l'équipe d'investigation DARC.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              Canal Chiffré Sécurisé
            </span>
          </div>

          {/* Messages scroll box */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
            {activeAlert.messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Aucun message pour le moment. Vous pouvez poser une question ou ajouter des éléments aux enquêteurs.
              </div>
            ) : (
              activeAlert.messages.map((m) => {
                const isMe = m.sender === 'whistleblower';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                      <span className="font-semibold text-slate-600">{m.senderDisplayName}</span>
                      <span>•</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-md p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed ${
                        isMe
                          ? 'bg-[#0B2545] text-white rounded-tr-none'
                          : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message form */}
          <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                id="input-tracking-reply"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={t.msg_placeholder}
                className="flex-1 px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                id="btn-tracking-send"
                disabled={!replyContent.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>{t.btn_send_msg}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL: COMPLÉTER SA DÉCLARATION */}
      {showSupplementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Apporter un complément d'information formel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ce texte sera annexé à votre dossier officiel et notifié immédiatement aux auditeurs.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Détail du complément
              </label>
              <textarea
                rows={5}
                value={supplementText}
                onChange={(e) => setSupplementText(e.target.value)}
                placeholder="Précisez un nouveau fait, une nouvelle date, un montant rectifié ou le nom d'un autre témoin..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
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
                className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white text-xs font-bold"
              >
                Valider et transmettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
