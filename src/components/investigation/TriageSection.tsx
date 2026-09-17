/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dixième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106 pour les étapes précédentes.
 * Extraction du contenu de l'onglet "Allégations" (récit, éléments clés,
 * classification, matrice de risque 4 axes, priorité calculée/forcée) hors
 * du composant monolithique, sans aucun changement de comportement. Code
 * strictement déplacé, pas réécrit.
 *
 * `RISK_AXIS_LABELS` (constante pure, sans dépendance à la fermeture du
 * composant, uniquement utilisée ici) est déplacée telle quelle plutôt que
 * dupliquée. `getPriorityBadge` est importé depuis son propre fichier
 * (voir getPriorityBadge.tsx), partagé avec la liste des dossiers et l'en-
 * tête du dossier sélectionné dans InvestigationDesk.tsx, non extraits.
 * `setShowAssignModal`/`setNewPriority`/`setPriorityOverrideReason`/
 * `setShowPriorityModal` restent possédés par InvestigationDesk.tsx (les
 * modales "Attribuer" et "Modifier la priorité" ne sont pas encore
 * extraites) : passés en props tels quels.
 */
import React from 'react';
import { UserPlus, SlidersHorizontal } from 'lucide-react';
import { AlertRecord, PriorityLevel } from '../../types';
import { getPriorityBadge } from './getPriorityBadge';

// === AMÉLIORATION AJOUTÉE (Phase 6 — Triage) === exact wording already
// used at submission time (AlertSubmissionFlow's step 4), reused here so
// the Triage tab reads the same axis scores with the same labels.
const RISK_AXIS_LABELS: Record<'financialImpact' | 'hierarchyLevel' | 'recidivism' | 'reputationRisk', Record<1 | 2 | 3 | 4, string>> = {
  financialImpact: { 1: 'Faible (01) : < 5 000 Euro', 2: 'Élevé (02) : 5 000 - 10 000 Euro', 3: 'Très élevé (03) : 10 000 - 20 000 Euro', 4: 'Critique (04) : > 20 000 Euro' },
  hierarchyLevel: { 1: 'Faible (01) : Employé', 2: 'Élevé (02) : Cadre', 3: 'Très élevé (03) : Sous Directeur', 4: 'Critique (04) : Directeur' },
  recidivism: { 1: 'Faible (01) : Aucune', 2: 'Élevé (02) : Possible', 3: 'Très élevé (03) : Confirmée', 4: 'Critique (04) : Confirmée (Majeure)' },
  reputationRisk: { 1: 'Faible (01) : Négligeable', 2: 'Élevé (02) : Modéré', 3: 'Très élevé (03) : Élevé', 4: 'Critique (04) : Élevé / Médiatique' },
};

interface TriageSectionProps {
  selectedAlert: AlertRecord;
  t: Record<string, string>;
  setShowAssignModal: (v: boolean) => void;
  setNewPriority: (v: PriorityLevel) => void;
  setPriorityOverrideReason: (v: string) => void;
  setShowPriorityModal: (v: boolean) => void;
}

export const TriageSection: React.FC<TriageSectionProps> = ({
  selectedAlert,
  t,
  setShowAssignModal,
  setNewPriority,
  setPriorityOverrideReason,
  setShowPriorityModal,
}) => {
  return (
    <div className="p-6 space-y-5 max-h-[640px] overflow-y-auto text-xs">
      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Onglet Allégations) ===
          "Récit de l'allégation" + bouton "Réattribuer" façon
          maquette — réutilise la modale d'attribution déjà
          existante (Actions > Assigner), jamais une seconde
          modale dupliquée. */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">{t.allegation_narrative_title}</h3>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition"
        >
          <UserPlus className="w-3.5 h-3.5" /> {t.allegation_reassign}
        </button>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 11) === résumé de la
          qualification (catégorie/sous-catégorie/description),
          pour que l'onglet "Allégations" présente d'abord ce que
          le dossier reproche avant la matrice de risque. */}
      <div className="p-4 rounded-xl border border-slate-200 space-y-2">
        <div className="font-bold text-slate-900">{selectedAlert.category}</div>
        <div className="text-slate-600">{selectedAlert.subCategory}</div>
        {selectedAlert.customViolationType && (
          <div className="text-slate-500 italic">{selectedAlert.customViolationType}</div>
        )}
        <p className="pt-2 border-t border-slate-100 leading-relaxed text-slate-700 whitespace-pre-wrap">
          {selectedAlert.detailedDescription}
        </p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Onglet Allégations) ===
          "Éléments clés" / "Classification" façon maquette —
          chaque champ réutilise une donnée réelle déjà existante
          sur AlertRecord (jamais une valeur fabriquée) ; "—"
          quand la donnée est absente (ex. dossier créé avant
          qu'un champ optionnel n'existe). Pas de ligne
          "Mots-clés" : aucun champ de ce type n'existe sur
          AlertRecord aujourd'hui — ajoutée uniquement si un vrai
          champ voit le jour, plutôt que d'inventer des tags
          (brief §32). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
            {t.allegation_key_elements}
          </div>
          {[
            [t.allegation_type, selectedAlert.customViolationType || selectedAlert.subCategory],
            [t.allegation_estimated_amount, selectedAlert.estimatedImpactValue || '—'],
            [t.allegation_period, selectedAlert.incidentDates || '—'],
            [t.allegation_location, selectedAlert.incidentLocation || '—'],
            [t.allegation_persons_cited, String(selectedAlert.involvedPersons.length)],
            [t.allegation_entities_concerned, selectedAlert.concernedEntity],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-900 text-right truncate max-w-[55%]">{value}</span>
            </div>
          ))}
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
            {t.allegation_classification}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">{t.allegation_noca}</span>
            <span className="font-semibold text-slate-900">{selectedAlert.riskEvaluation.nocaThreshold}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">{t.allegation_severity}</span>
            <span className="font-semibold text-slate-900">
              {selectedAlert.severity ? t[`severity_${selectedAlert.severity}` as keyof typeof t] ?? selectedAlert.severity : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">{t.allegation_sensitivity}</span>
            <span className="font-semibold text-slate-900">
              {t[`confidentiality_${selectedAlert.confidentialityLevel ?? 'restricted'}` as keyof typeof t] ?? (selectedAlert.confidentialityLevel ?? 'restricted')}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          {t.triage_matrix_title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[11px]">{t.triage_axis_financial}</div>
            <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.financialImpact[selectedAlert.riskEvaluation.financialImpact]}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[11px]">{t.triage_axis_hierarchy}</div>
            <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.hierarchyLevel[selectedAlert.riskEvaluation.hierarchyLevel]}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[11px]">{t.triage_axis_recidivism}</div>
            <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.recidivism[selectedAlert.riskEvaluation.recidivism]}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[11px]">{t.triage_axis_reputation}</div>
            <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.reputationRisk[selectedAlert.riskEvaluation.reputationRisk]}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-center">
          <div className="text-2xl font-extrabold text-[#0B2545]">{selectedAlert.riskEvaluation.totalScore}/16</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{t.triage_total_score}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-center">
          <div className="text-2xl font-extrabold text-[#0B2545]">{selectedAlert.riskEvaluation.nocaThreshold}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{selectedAlert.riskEvaluation.expectedTreatment}</div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">{t.triage_computed_priority}</span>
          {getPriorityBadge({ ...selectedAlert, overridePriority: undefined } as AlertRecord)}
        </div>
        {selectedAlert.overridePriority && (
          <div className="flex items-center justify-between pt-2 border-t border-amber-100">
            <span className="font-semibold text-amber-800">{t.triage_override_priority}</span>
            {getPriorityBadge(selectedAlert)}
          </div>
        )}
        {selectedAlert.overrideReason && (
          <p className="text-[11px] text-slate-500 pt-1">
            <span className="font-semibold">{t.triage_override_reason}:</span> {selectedAlert.overrideReason}
          </p>
        )}
      </div>

      <button
        onClick={() => {
          setNewPriority(selectedAlert.overridePriority || selectedAlert.riskEvaluation.priority);
          setPriorityOverrideReason('');
          setShowPriorityModal(true);
        }}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {t.triage_btn_adjust}
      </button>
    </div>
  );
};
