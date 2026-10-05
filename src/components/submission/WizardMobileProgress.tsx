/**
 * === AMÉLIORATION AJOUTÉE (formulaire sur portable — évolution du
 * remplissage) ===
 *
 * Sur téléphone, la liste verticale des 6 étapes (WizardSidebar) et l'encart
 * de confidentialité occupaient tout le premier écran : le formulaire
 * commençait sous la ligne de flottaison et l'avancement disparaissait dès
 * qu'on faisait défiler. Cette barre compacte la remplace sous `lg` :
 * collée en haut de la zone de défilement, elle montre en permanence
 * l'étape en cours, le pourcentage d'avancement, les 6 segments (étapes
 * faites / en cours / à venir, touchables comme la liste) et l'étape
 * suivante. Sur ordinateur, rien ne change (WizardSidebar).
 */
import React from 'react';
import { Check, Lock } from 'lucide-react';
import { AlertRecord } from '../../types';

interface WizardMobileProgressProps {
  t: Record<string, string>;
  currentStep: number;
  submittedAlert: AlertRecord | null;
  setCurrentStep: (v: number) => void;
}

const TOTAL = 6;
const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

export const WizardMobileProgress: React.FC<WizardMobileProgressProps> = ({ t, currentStep, submittedAlert, setCurrentStep }) => {
  const titles = [
    t.wizard_step1_title,
    t.wizard_step2_title_optional,
    t.wizard_step3_title,
    t.wizard_step4_title_optional,
    t.wizard_step5_title,
    t.wizard_step6_title,
  ];
  const step = submittedAlert ? TOTAL : Math.min(Math.max(currentStep, 1), TOTAL);
  // Étape 1 en cours = 0 % fait ; accusé de réception = 100 %.
  const percent = submittedAlert ? 100 : Math.round(((step - 1) / (TOTAL - 1)) * 100);
  const next = !submittedAlert && step < TOTAL ? titles[step] : null;

  return (
    <div className="lg:hidden sticky top-0 z-30 -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 pt-3 pb-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_8px_24px_-18px_rgb(15_23_42/0.35)]">
      <div className="flex items-center gap-3">
        {/* Anneau d'avancement */}
        <div
          className="relative w-11 h-11 shrink-0"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={(t.wizard_step_of || 'Étape {n} sur 6').replace('{n}', String(step))}
        >
          <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r={RING_R} fill="none" strokeWidth="4" className="stroke-slate-100" />
            <circle
              cx="22"
              cy="22"
              r={RING_R}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className={`transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${submittedAlert ? 'stroke-emerald-500' : 'stroke-blue-600'}`}
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - percent / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-800">
            {submittedAlert ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> : `${percent}%`}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
            {(t.wizard_step_of || 'Étape {n} sur 6').replace('{n}', String(step))}
          </div>
          <div key={step} className="activa-enter text-sm font-bold text-slate-900 leading-snug truncate">
            {titles[step - 1]}
          </div>
        </div>

        <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 px-2 py-1 text-[10px] font-semibold">
          <Lock className="w-3 h-3" strokeWidth={2.5} />
          {t.wizard_mobile_secure || 'Confidentiel'}
        </span>
      </div>

      {/* 6 segments : faits / en cours / à venir (touchables comme la liste des étapes) */}
      <ol className="mt-3 grid grid-cols-6 gap-1.5" aria-label={t.wizard_sidebar_title}>
        {titles.map((title, i) => {
          const n = i + 1;
          const status = step > n || submittedAlert ? 'done' : step === n ? 'active' : 'pending';
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => !submittedAlert && setCurrentStep(n)}
                disabled={!!submittedAlert}
                aria-label={`${n}. ${title}`}
                aria-current={status === 'active' ? 'step' : undefined}
                className="group block w-full py-1.5 -my-1.5 focus:outline-none"
              >
                <span
                  className={`block h-1.5 rounded-full overflow-hidden transition-colors duration-500 group-focus-visible:ring-2 group-focus-visible:ring-blue-400 group-focus-visible:ring-offset-1 ${
                    status === 'done' ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  {status === 'active' && <span className="activa-draw-x block h-full w-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {next && (
        <div className="mt-2 text-[11px] text-slate-500 truncate">
          <span className="font-semibold text-slate-600">{t.wizard_mobile_next || 'Ensuite'} :</span> {next}
        </div>
      )}
    </div>
  );
};
