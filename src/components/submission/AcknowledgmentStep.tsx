/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 6 — accusé de réception (numéro de suivi + mot de passe généré).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { CheckCircle2, Copy, Lock, Search, Clock, Download, ArrowRight } from 'lucide-react';
import { AlertRecord } from '../../types';
import { Button } from '../ui';
// === AMÉLIORATION AJOUTÉE (accusé de réception imprimable) ===
import { ReceiptPrintView } from '../ReceiptPrintView';

interface AcknowledgmentStepProps {
  t: Record<string, string>;
  submittedAlert: AlertRecord;
  password: string;
  copiedTracking: boolean;
  copyToClipboard: (text: string) => void;
  handlePrintReceipt: () => void;
  onSuccessNavigateToTrack: (trackingNumber: string) => void;
}

export const AcknowledgmentStep: React.FC<AcknowledgmentStepProps> = ({
  t,
  submittedAlert,
  password,
  copiedTracking,
  copyToClipboard,
  handlePrintReceipt,
  onSuccessNavigateToTrack,
}) => {
  return (
    <div className="space-y-8 text-center animate-fadeIn">
      <div>
        <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.ack_success_title}</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto">{t.ack_success_desc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">{t.ack_tracking_num}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-mono font-extrabold text-[#0B2545] select-all truncate">
              {submittedAlert.trackingNumber}
            </span>
            <button
              type="button"
              id="btn-copy-tracking"
              onClick={() => copyToClipboard(submittedAlert.trackingNumber)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">{t.ack_password_label}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-mono font-extrabold text-[#0B2545] select-all truncate">
              {password}
            </span>
            <button
              type="button"
              id="btn-copy-password"
              onClick={() => copyToClipboard(password)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {copiedTracking && (
        <p className="text-xs text-emerald-600 font-semibold -mt-4">{t.btn_copy_password} ✓</p>
      )}

      <div className="max-w-xl mx-auto p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3 text-left">
        <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <p>{t.ack_credentials_note}</p>
      </div>

      <div className="text-left">
        <h3 className="text-sm font-bold text-slate-900 mb-3">{t.ack_next_heading}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-slate-900 text-sm">{t.ack_next_track_title}</div>
              <div className="text-xs text-slate-500">{t.ack_next_track_desc}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-slate-900 text-sm">{t.ack_next_anon_title}</div>
              <div className="text-xs text-slate-500">{t.ack_next_anon_desc}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-slate-900 text-sm">{t.ack_next_informed_title}</div>
              <div className="text-xs text-slate-500">{t.ack_next_informed_desc}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          id="btn-print-receipt"
          onClick={handlePrintReceipt}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <Download className="w-4 h-4" />
          {t.btn_download_ack}
        </button>

        <Button
          type="button"
          id="btn-go-to-tracking"
          onClick={() => onSuccessNavigateToTrack(submittedAlert.trackingNumber)}
          className="w-full sm:w-auto"
        >
          <span>{t.btn_go_to_tracking}</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </Button>
      </div>
      {/* === AMÉLIORATION AJOUTÉE (accusé de réception imprimable) === seul contenu imprimé par « Télécharger l'Accusé de Réception ». */}
      <ReceiptPrintView t={t} alert={submittedAlert} password={password} />
    </div>
  );
};
