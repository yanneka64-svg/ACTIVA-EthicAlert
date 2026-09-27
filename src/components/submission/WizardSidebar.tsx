/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Barre latérale de navigation entre les 6 étapes + encart confidentialité.
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { AlertRecord } from '../../types';

interface WizardSidebarProps {
  t: Record<string, string>;
  currentStep: number;
  submittedAlert: AlertRecord | null;
  setCurrentStep: (v: number) => void;
}

export const WizardSidebar: React.FC<WizardSidebarProps> = ({
  t,
  currentStep,
  submittedAlert,
  setCurrentStep,
}) => {
  // === AMÉLIORATION AJOUTÉE (Phase 26 — sidebar de navigation en 6 étapes,
  // fidèle à la maquette de référence) === déplacé tel quel depuis
  // AlertSubmissionFlow.tsx (seul utilisateur de ces deux valeurs).
  const wizardSteps = [
    { num: 1, title: t.wizard_step1_title, desc: t.wizard_step1_desc },
    { num: 2, title: t.wizard_step2_title_optional, desc: t.wizard_step2_desc },
    { num: 3, title: t.wizard_step3_title, desc: t.wizard_step3_desc },
    { num: 4, title: t.wizard_step4_title_optional, desc: t.wizard_step4_desc },
    { num: 5, title: t.wizard_step5_title, desc: t.wizard_step5_desc },
    { num: 6, title: t.wizard_step6_title, desc: t.wizard_step6_desc },
  ];
  const displayStep = submittedAlert ? 6 : currentStep;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">{t.wizard_sidebar_title}</h2>
        </div>
        <ol className="space-y-1">
          {wizardSteps.map((s) => {
            const status = displayStep > s.num ? 'done' : displayStep === s.num ? 'active' : 'pending';
            return (
              <li key={s.num}>
                <button
                  type="button"
                  onClick={() => !submittedAlert && setCurrentStep(s.num)}
                  disabled={!!submittedAlert}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition ${
                    status === 'active' ? 'bg-blue-50' : submittedAlert ? '' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      status === 'done'
                        ? 'bg-emerald-500 text-white'
                        : status === 'active'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {status === 'done' ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </span>
                  <span>
                    <span className={`block text-sm font-semibold ${status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
                      {s.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">{s.desc}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-slate-900">{t.sidebar_confidentiality_title}</div>
          <p className="text-xs text-slate-600 mt-1">{t.sidebar_confidentiality_desc}</p>
        </div>
      </div>
    </aside>
  );
};
