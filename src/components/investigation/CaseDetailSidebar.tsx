/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-septième étape du refactor par section d'InvestigationDesk.tsx —
 * voir CaseDetailHeader.tsx/CaseTabBar.tsx (étapes précédentes) pour le
 * reste de l'historique. Extraction de la colonne de droite de la fiche
 * dossier ("Statut du dossier" — timeline verticale du workflow riche,
 * "Informations complémentaires", "Liens rapides") hors du composant
 * monolithique, sans aucun changement de comportement. Code strictement
 * déplacé, pas réécrit.
 *
 * `setActiveCaseTab` et `setShowPrintReport` restent possédés par
 * InvestigationDesk.tsx (le premier pilote aussi le switch de contenu par
 * onglet resté en place, le second déclenche l'impression réelle via
 * CaseReportPrintView.tsx) : passés en props tels quels.
 */
import React from 'react';
import { Clock, Check, Info, Lock, ShieldAlert, Link2, Printer, History } from 'lucide-react';
import { Language, AlertRecord } from '../../types';
import { CaseStatus } from '../../domain/caseTypes';

type CaseTab = 'overview' | 'messages' | 'corrective' | 'tasks' | 'interviews' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report';

interface CaseDetailSidebarProps {
  t: Record<string, string>;
  lang: Language;
  selectedAlert: AlertRecord;
  currentWorkflowStatus: CaseStatus | undefined;
  setActiveCaseTab: (v: CaseTab) => void;
  setShowPrintReport: (v: boolean) => void;
}

export const CaseDetailSidebar: React.FC<CaseDetailSidebarProps> = ({
  t,
  lang,
  selectedAlert,
  currentWorkflowStatus,
  setActiveCaseTab,
  setShowPrintReport,
}) => {
  return (
    <aside className="space-y-5">
      {/* === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow
          riche) === Statut du dossier — timeline verticale, dérivée
          du statut RICHE (workflowStatus, 14 valeurs,
          domain/workflow.ts) plutôt que du seul statut legacy
          (AlertStatus, 7 valeurs) : "En attente d'informations"
          (pending_information) et "En revue" (conclusion_pending +
          functional_review, une seule étape visuelle pour les deux
          sous-étapes du moteur riche) reflètent désormais l'état réel
          du dossier, via les actions "Demander des informations
          complémentaires"/"Envoyer en revue"/"Reprendre
          l'investigation" ci-dessus. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {t.case_status_title}
        </h3>
        {(() => {
          const isClosed = ['closed', 'archived'].includes(selectedAlert.status);
          const ws = currentWorkflowStatus;
          const isPendingInfo = ws === 'pending_information';
          const isInReview = ws === 'conclusion_pending' || ws === 'functional_review';
          // "En investigation" reste l'étape courante tant qu'aucune des
          // 2 étapes suivantes n'a été atteinte et que le dossier n'est
          // pas clos — un aller-retour (ex. reprise après "En attente
          // d'informations") y ramène naturellement l'affichage.
          const isInvestigating = !isClosed && !isPendingInfo && !isInReview
            ? ['investigation', 'corrective_action', 'reopened'].includes(selectedAlert.status) || ws === 'investigation' || ws === 'escalated'
            : false;
          // === AMÉLIORATION AJOUTÉE : "fait" uniquement si le dossier
          // est RÉELLEMENT passé par cette étape (pendingInfoReachedAt
          // / reviewReachedAt, horodatés une seule fois par
          // handleRequestInfo/handleSendToReview) — jamais déduit du
          // seul fait que le dossier a depuis avancé plus loin, pour
          // ne jamais cocher une étape qu'il n'a pas traversée.
          const pendingInfoDone = !!selectedAlert.pendingInfoReachedAt && (isInReview || isClosed);
          const reviewDone = !!selectedAlert.reviewReachedAt && isClosed;
          type StepState = 'done' | 'current' | 'pending';
          const steps: { label: string; state: StepState; date?: string }[] = [
            { label: t.case_status_received, state: 'done', date: selectedAlert.createdAt },
            {
              label: t.case_status_investigation,
              state: isClosed || isPendingInfo || isInReview ? 'done' : isInvestigating ? 'current' : 'pending',
              date: isInvestigating ? selectedAlert.updatedAt : undefined,
            },
            {
              label: t.case_status_pending_info,
              state: isPendingInfo ? 'current' : pendingInfoDone ? 'done' : 'pending',
              date: isPendingInfo ? selectedAlert.updatedAt : selectedAlert.pendingInfoReachedAt,
            },
            {
              label: t.case_status_review,
              state: isInReview ? 'current' : reviewDone ? 'done' : 'pending',
              date: isInReview ? selectedAlert.updatedAt : selectedAlert.reviewReachedAt,
            },
            { label: t.case_status_closed_step, state: isClosed ? 'done' : 'pending', date: selectedAlert.closedAt },
          ];
          return (
            <ol>
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      step.state === 'done' ? 'bg-emerald-500 text-white' : step.state === 'current' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {step.state === 'done' ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </span>
                    {i < steps.length - 1 && <span className="w-px flex-1 min-h-[22px] bg-slate-200" />}
                  </div>
                  <div className="pb-4">
                    <div className={`text-xs font-semibold ${step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{step.label}</div>
                    {step.date && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(step.date).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          );
        })()}
      </div>

      {/* Informations complémentaires */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          {t.case_additional_info_title}
        </h3>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3.5 h-3.5" />{t.case_origin_label}</span>
          <span className="font-semibold text-slate-800">
            {selectedAlert.whistleblower.isAnonymous ? t.case_origin_anonymous : t.case_origin_identified}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-slate-500"><ShieldAlert className="w-3.5 h-3.5" />{t.case_confidentiality_label}</span>
          <span className="font-semibold text-emerald-700">{t.case_confidentiality_high}</span>
        </div>
      </div>

      {/* Liens rapides */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-slate-400" />
          {t.case_quick_links_title}
        </h3>
        {/* === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête
            ACTIVA) === Même motif que Synthèse du dossier ci-dessus. */}
        <button
          onClick={() => setShowPrintReport(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <Printer className="w-3.5 h-3.5 text-blue-600" />
          {t.case_btn_generate_report}
        </button>
        <button
          onClick={() => setActiveCaseTab('timeline')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <History className="w-3.5 h-3.5 text-blue-600" />
          {t.case_btn_view_timeline}
        </button>
      </div>
    </aside>
  );
};
