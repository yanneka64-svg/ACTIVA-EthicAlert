/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 4 — pièces jointes (facultatives).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { FileUp, Trash2, Info, ArrowLeft, ArrowRight } from 'lucide-react';
import { EvidenceFile } from '../../types';
import { Button } from '../ui';

interface Step4EvidenceProps {
  t: Record<string, string>;
  evidences: EvidenceFile[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeEvidence: (id: string) => void;
  setCurrentStep: (v: number) => void;
}

export const Step4Evidence: React.FC<Step4EvidenceProps> = ({
  t,
  evidences,
  handleFileUpload,
  removeEvidence,
  setCurrentStep,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{t.wizard_step_of.replace('{n}', '4')}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step4_title_optional}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step4_hint}</p>
      </div>

      <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition bg-slate-50/50">
        <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-700">{t.drag_drop_evidence}</p>
        <p className="text-[11px] text-slate-500 mt-1">{t.max_file_note}</p>
        <input
          type="file"
          id="evidence-file-input"
          multiple
          onChange={handleFileUpload}
          className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">
          {t.evidence_files_added} ({evidences.length})
        </span>
        {evidences.length === 0 && (
          <span className="text-[11px] text-slate-500">{t.evidence_no_files}</span>
        )}
      </div>

      {evidences.length > 0 && (
        <div className="space-y-2">
          {evidences.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                  {f.type.split('/')[1] || 'Doc'}
                </span>
                <span className="font-medium text-slate-800 truncate">{f.name}</span>
                <span className="text-slate-400 text-[11px]">({Math.round(f.size / 1024)} Ko)</span>
              </div>
              <button
                type="button"
                onClick={() => removeEvidence(f.id)}
                className="text-slate-400 hover:text-rose-600 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <span>{t.evidence_tips_optional_note}</span>
      </div>

      <div className="text-xs text-slate-600">
        <div className="font-semibold text-slate-800 mb-1">{t.evidence_tips_title}</div>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>{t.evidence_tip_1}</li>
          <li>{t.evidence_tip_2}</li>
          <li>{t.evidence_tip_3}</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(3)}>
          <span>{t.common_previous}</span>
        </Button>

        <Button type="button" id="btn-step4-next" onClick={() => setCurrentStep(5)}>
          <span>{t.common_next}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
