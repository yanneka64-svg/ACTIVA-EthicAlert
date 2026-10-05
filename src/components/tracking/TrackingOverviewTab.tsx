/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Onglet « Vue d'ensemble » (résumé, étapes, informations, description,
 * suppression d'une déclaration non encore traitée).
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 * `renderStatusBadge` déplacé ici (seul utilisateur).
 */
import React from 'react';
import { Search, CheckCircle2, Clock, FileText, Download, Trash2, Building2, UserCheck, UserX, FileCheck2, Calendar, ShieldCheck, MapPin, Tag, Pencil, Check } from 'lucide-react';
import { Language, AlertRecord } from '../../types';
import { storage } from '../../services/storage';
import { formatCountryLabel } from '../../data/activaConfig';
import { trData } from '../../i18n/dataLabels';
// === AMÉLIORATION AJOUTÉE (accusé de réception imprimable) ===
import { ReceiptPrintView } from '../ReceiptPrintView';

interface TrackingOverviewTabProps {
  t: Record<string, string>;
  lang: Language;
  activeAlert: AlertRecord;
  setShowSupplementModal: React.Dispatch<React.SetStateAction<boolean>>;
  deleteConfirm: boolean;
  // === AMÉLIORATION AJOUTÉE (suivi depuis n'importe quel appareil) === faux
  // pour un dossier ouvert depuis Firebase : le serveur ne permet pas au
  // déclarant de supprimer un dossier déjà transmis à l'équipe.
  canDelete?: boolean;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteAlert: () => void;
  trackSteps: string[];
  currentStepNumber: number;
}

export const TrackingOverviewTab: React.FC<TrackingOverviewTabProps> = ({
  t,
  lang,
  activeAlert,
  setShowSupplementModal,
  deleteConfirm,
  canDelete = true,
  setDeleteConfirm,
  handleDeleteAlert,
  trackSteps,
  currentStepNumber,
}) => {
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

  return (
    <>
      {/* === AMÉLIORATION AJOUTÉE (suivi — design modernisé) === carte à
          ombre douce, étapes avec halo pulsé sur l'étape en cours, coche
          animée pour les étapes franchies et traits de liaison qui se
          tracent ; cartes d'informations aux coins plus arrondis. */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_40px_-20px_rgb(15_23_42/0.18)] p-6">
        <div className="pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="font-mono text-xl font-extrabold tracking-tight text-[#0B2545]">
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
            <span>{t.track_submitted_on.replace('{date}', new Date(activeAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'))}</span>
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
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-500 ${
                        done
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : active
                          ? 'activa-pulse-dot bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30'
                          : 'bg-white ring-2 ring-inset ring-slate-200 text-slate-400'
                      }`}
                    >
                      {done ? <Check className="activa-pop w-4 h-4" strokeWidth={3} style={{ animationDelay: `${idx * 120}ms` }} /> : n}
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
                    <div className="flex-1 h-1 mt-4 rounded-full bg-slate-100 overflow-hidden">
                      {n < currentStepNumber && (
                        <div
                          className="activa-draw-x h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                          style={{ '--d': `${200 + idx * 150}ms` } as React.CSSProperties}
                        />
                      )}
                    </div>
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
              {t.track_final_conclusion}
            </h4>
            <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed">
              {activeAlert.closureMessageToWhistleblower}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_14px_32px_-20px_rgb(15_23_42/0.18)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgb(15_23_42/0.04),0_20px_40px_-20px_rgb(15_23_42/0.25)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">{t.track_general_info_title}</h4>
            <button
              type="button"
              onClick={() => setShowSupplementModal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              title={t.track_add_info_title}
            >
              <Pencil className="w-3 h-3" />
              {t.btn_modify}
            </button>
          </div>
          {[
            { icon: FileText, label: t.track_field_case_number, value: activeAlert.trackingNumber },
            { icon: Building2, label: t.track_field_entity, value: `${activeAlert.concernedEntity} (${formatCountryLabel(storage.getCountries(), activeAlert.country)})` },
            { icon: Tag, label: t.track_field_category, value: trData(activeAlert.category, lang), sub: trData(activeAlert.subCategory, lang) },
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
          {canDelete && activeAlert.status === 'new' && (
            <div className="pt-3 border-t border-slate-100">
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.track_delete_report}</span>
                </button>
              ) : (
                <div className="p-2 bg-rose-50 rounded border border-rose-200 text-center max-w-xs">
                  <p className="text-[11px] text-rose-800 font-semibold mb-2">{t.track_delete_confirm}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleDeleteAlert}
                      className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                    >
                      {t.track_delete_yes}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px]"
                    >
                      {t.btn_cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_14px_32px_-20px_rgb(15_23_42/0.18)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgb(15_23_42/0.04),0_20px_40px_-20px_rgb(15_23_42/0.25)] p-5">
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
            {t.track_download_receipt}
          </button>
        </div>
      </div>
      {/* === AMÉLIORATION AJOUTÉE (accusé de réception imprimable) === seul contenu imprimé par « Télécharger le récépissé » (sans mot de passe, inconnu ici). */}
      <ReceiptPrintView t={t} alert={activeAlert} />
    </>
  );
};
