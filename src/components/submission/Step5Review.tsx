/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 5 — récapitulatif et confirmation (bouton de soumission finale,
 * `type="submit"`, toujours rendu à l'intérieur du <form onSubmit> parent).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 * `notProvided` déplacé ici (seule utilisatrice).
 */
import React from 'react';
import { Briefcase, Pencil, User, AlertTriangle, Paperclip, Info, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Language, AlertRecord, InvolvedPerson, Witness, EvidenceFile } from '../../types';
import { Button } from '../ui';
import { trData } from '../../i18n/dataLabels';

interface Step5ReviewProps {
  t: Record<string, string>;
  lang: Language;
  selectedCategory: string;
  declarantName: string;
  declarantJob: string;
  declarantDept: string;
  declarantCountry: string;
  isAnonymous: boolean;
  declarantEntity: string;
  declarantEmail: string;
  declarantPhone: string;
  incidentDates: string;
  incidentLocation: string;
  involvedPersons: InvolvedPerson[];
  witnesses: Witness[];
  selectedSubCategory: string;
  impactType: string;
  isOngoing: boolean;
  detailedDescription: string;
  liveRisk: AlertRecord['riskEvaluation'];
  evidences: EvidenceFile[];
  isSubmitting: boolean;
  setCurrentStep: (v: number) => void;
}

export const Step5Review: React.FC<Step5ReviewProps> = ({
  t,
  lang,
  selectedCategory,
  declarantName,
  declarantJob,
  declarantDept,
  declarantCountry,
  isAnonymous,
  declarantEntity,
  declarantEmail,
  declarantPhone,
  incidentDates,
  incidentLocation,
  involvedPersons,
  witnesses,
  selectedSubCategory,
  impactType,
  isOngoing,
  detailedDescription,
  liveRisk,
  evidences,
  isSubmitting,
  setCurrentStep,
}) => {
  const notProvided = <span className="text-slate-400 italic">{t.review_not_provided}</span>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{t.wizard_step_of.replace('{n}', '5')}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step5_title}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step5_hint}</p>
      </div>

      {/* Type de signalement */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Briefcase className="w-4 h-4 text-blue-600" />
            {t.wizard_step1_title}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            {t.btn_modify}
          </button>
        </div>
        <div className="p-4 text-xs">
          <span className="text-slate-500">{t.label_category}</span>
          <div className="font-medium text-slate-800 mt-0.5">{trData(selectedCategory, lang)}</div>
        </div>
      </div>

      {/* Informations sur le lanceur d'alerte */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <User className="w-4 h-4 text-blue-600" />
            {t.wizard_step2_title}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            {t.btn_modify}
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">{t.label_first_name} / {t.label_last_name}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantName || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_job_title}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantJob || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_department}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantDept || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_country}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantCountry || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_entity}</span>
            <div className="font-medium text-slate-800 mt-0.5">{isAnonymous ? notProvided : declarantEntity}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_email}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantEmail || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_phone}</span>
            <div className="font-medium text-slate-800 mt-0.5">{declarantPhone || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.sub_review_mode}</span>
            <div className="font-medium text-slate-800 mt-0.5">
              {isAnonymous ? t.choice_anonymous : t.choice_identified}
            </div>
          </div>
        </div>
      </div>

      {/* Informations sur l'incident */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            {t.wizard_step3_title}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            {t.btn_modify}
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">{t.label_dates}</span>
            <div className="font-medium text-slate-800 mt-0.5">{incidentDates || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_location}</span>
            <div className="font-medium text-slate-800 mt-0.5">{incidentLocation || notProvided}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_involved_persons_optional}</span>
            <div className="font-medium text-slate-800 mt-0.5">
              {involvedPersons.length > 0 || witnesses.length > 0
                ? t.sub_review_persons_count.replace('{n}', String(involvedPersons.length + witnesses.length))
                : notProvided}
            </div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_incident_category}</span>
            <div className="font-medium text-slate-800 mt-0.5">{trData(selectedSubCategory, lang)}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_impact_potential}</span>
            <div className="font-medium text-slate-800 mt-0.5">{trData(impactType, lang)}</div>
          </div>
          <div>
            <span className="text-slate-500">{t.label_situation_ongoing}</span>
            <div className="font-medium text-slate-800 mt-0.5">{isOngoing ? t.common_yes : t.common_no}</div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-500">{t.label_description}</span>
            <div className="font-medium text-slate-800 mt-0.5 line-clamp-3">
              {detailedDescription || notProvided}
            </div>
          </div>
          <div className="sm:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-slate-500">{t.sub_auto_classification}</span>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                liveRisk.nocaThreshold === 'NOCA 4'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : liveRisk.nocaThreshold === 'NOCA 3'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : liveRisk.nocaThreshold === 'NOCA 2'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {liveRisk.nocaThreshold} - {liveRisk.priority.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Pièces jointes */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Paperclip className="w-4 h-4 text-blue-600" />
            {t.wizard_step4_title_optional}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            {t.btn_modify}
          </button>
        </div>
        <div className="p-4 text-xs">
          {evidences.length === 0 ? (
            <span className="text-slate-400 italic">{t.evidence_no_files}</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {evidences.map((f) => (
                <span key={f.id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                  {f.name} ({Math.round(f.size / 1024)} Ko)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <span>{t.review_submit_note}</span>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(4)}>
          <span>{t.common_previous}</span>
        </Button>

        {/* === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 2, design
            system) === Volontairement laissé hors du composant
            <Button> partagé : ce bouton de soumission finale utilise
            une couleur émeraude distincte (succès), pas la navy
            "primaire" — un choix sémantique différent, pas une
            dérive de copier-coller comme les boutons migrés
            ci-dessus. */}
        <button
          type="submit"
          id="btn-submit-final"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isSubmitting ? t.sub_submitting : t.btn_send_report}</span>
        </button>
      </div>
    </div>
  );
};
