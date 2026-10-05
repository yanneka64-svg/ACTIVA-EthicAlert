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
import { CheckCircle2, ShieldCheck, Check } from 'lucide-react';
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
    // === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) === étapes
    // reliées par un fil vertical qui se colore au fil de l'avancement,
    // étape active avec halo pulsé, coche animée pour les étapes faites.
    <aside className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_40px_-20px_rgb(15_23_42/0.18)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">{t.wizard_sidebar_title}</h2>
        </div>
        <ol className="space-y-1">
          {wizardSteps.map((s, i) => {
            const status = displayStep > s.num ? 'done' : displayStep === s.num ? 'active' : 'pending';
            return (
              <li key={s.num} className="relative">
                {i < wizardSteps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[23px] top-[42px] bottom-[-10px] w-px transition-colors duration-500 ${
                      status === 'done' ? 'bg-emerald-300' : 'bg-slate-200'
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => !submittedAlert && setCurrentStep(s.num)}
                  disabled={!!submittedAlert}
                  className={`relative w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all duration-300 ${
                    status === 'active'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-50/30 ring-1 ring-blue-100'
                      : submittedAlert
                      ? ''
                      : 'hover:bg-slate-50 hover:translate-x-0.5'
                  }`}
                >
                  <span
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors duration-300 ${
                      status === 'done'
                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                        : status === 'active'
                        ? 'activa-pulse-dot bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30'
                        : 'bg-white text-slate-400 ring-1 ring-inset ring-slate-200'
                    }`}
                  >
                    {status === 'done' ? <Check key="done" className="activa-pop w-3.5 h-3.5" strokeWidth={3} /> : s.num}
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

      <div className="bg-gradient-to-br from-blue-50 to-sky-50/60 border border-blue-100 rounded-2xl p-5 flex gap-3">
        <span className="w-9 h-9 rounded-xl bg-white text-blue-700 ring-1 ring-inset ring-blue-200/70 shadow-sm flex items-center justify-center shrink-0">
          <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        <div>
          <div className="font-bold text-sm text-slate-900">{t.sidebar_confidentiality_title}</div>
          <p className="text-xs text-slate-600 mt-1">{t.sidebar_confidentiality_desc}</p>
        </div>
      </div>
    </aside>
  );
};
