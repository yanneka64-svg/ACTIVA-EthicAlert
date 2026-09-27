/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 3 — informations sur l'incident (contexte, personnes impliquées,
 * témoins, description, qualification).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { Calendar, Building2, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Language, InvolvedPerson, Witness } from '../../types';
import { EntityDef, CategoryDef, IMPACT_TYPES } from '../../data/activaConfig';
import { Button } from '../ui';
import { trData } from '../../i18n/dataLabels';

interface Step3IncidentProps {
  t: Record<string, string>;
  lang: Language;
  entities: EntityDef[];
  incidentDates: string;
  setIncidentDates: (v: string) => void;
  incidentLocation: string;
  setIncidentLocation: (v: string) => void;
  concernedEntity: string;
  setConcernedEntity: (v: string) => void;
  customEntityInput: string;
  setCustomEntityInput: (v: string) => void;
  involvedPersons: InvolvedPerson[];
  addInvolvedPerson: () => void;
  updateInvolvedPerson: (id: string, field: keyof InvolvedPerson, val: any) => void;
  removeInvolvedPerson: (id: string) => void;
  witnesses: Witness[];
  addWitness: () => void;
  updateWitness: (id: string, field: keyof Witness, val: any) => void;
  removeWitness: (id: string) => void;
  detailedDescription: string;
  setDetailedDescription: (v: string) => void;
  selectedSubCategory: string;
  setSelectedSubCategory: (v: string) => void;
  currentCategoryDef: CategoryDef | undefined;
  impactType: string;
  setImpactType: (v: string) => void;
  selectedCategory: string;
  customViolation: string;
  setCustomViolation: (v: string) => void;
  estimatedImpactValue: string;
  setEstimatedImpactValue: (v: string) => void;
  isOngoing: boolean;
  setIsOngoing: (v: boolean) => void;
  setErrorMsg: (v: string) => void;
  setCurrentStep: (v: number) => void;
}

export const Step3Incident: React.FC<Step3IncidentProps> = ({
  t,
  lang,
  entities,
  incidentDates,
  setIncidentDates,
  incidentLocation,
  setIncidentLocation,
  concernedEntity,
  setConcernedEntity,
  customEntityInput,
  setCustomEntityInput,
  involvedPersons,
  addInvolvedPerson,
  updateInvolvedPerson,
  removeInvolvedPerson,
  witnesses,
  addWitness,
  updateWitness,
  removeWitness,
  detailedDescription,
  setDetailedDescription,
  selectedSubCategory,
  setSelectedSubCategory,
  currentCategoryDef,
  impactType,
  setImpactType,
  selectedCategory,
  customViolation,
  setCustomViolation,
  estimatedImpactValue,
  setEstimatedImpactValue,
  isOngoing,
  setIsOngoing,
  setErrorMsg,
  setCurrentStep,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{t.wizard_step_of.replace('{n}', '3')}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step3_title}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step3_desc}</p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (organisation du formulaire —
          sections visuelles) === Sur demande explicite : les
          champs de contexte (date/lieu/entité) sont regroupés
          sous un même intitulé, même convention que "Personnes
          impliquées"/"Témoins éventuels" plus bas — aucun
          champ, aucune logique n'est modifié. */}
      <div className="space-y-4">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.sub_incident_context}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-incident-dates" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {t.label_dates} *
            </label>
            <input
              id="input-incident-dates"
              type="text"
              value={incidentDates}
              onChange={(e) => setIncidentDates(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_dates}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">{t.no_future_dates_warning}</p>
          </div>
          <div>
            <label htmlFor="input-incident-location" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_location} *</label>
            <input
              id="input-incident-location"
              type="text"
              value={incidentLocation}
              onChange={(e) => setIncidentLocation(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_location}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-concerned-entity" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-700" />
              {t.label_entity} *
            </label>
            <select
              id="input-concerned-entity"
              value={concernedEntity}
              onChange={(e) => setConcernedEntity(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
            >
              {entities.map((ent) => (
                <option key={ent.id} value={ent.name}>
                  {ent.flag} {ent.name} ({trData(ent.country, lang)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="input-custom-entity" className="block text-xs font-semibold text-slate-700 mb-1">{t.sub_other_entity}</label>
            <input
              id="input-custom-entity"
              type="text"
              value={customEntityInput}
              onChange={(e) => setCustomEntityInput(e.target.value)}
              placeholder={t.sub_ph_other_entity}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Personnes impliquées — liste dynamique conservée (Phase 26 : relocalisée ici) */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t.label_involved_persons_optional}
          </span>
          <button
            type="button"
            id="btn-add-involved"
            onClick={addInvolvedPerson}
            className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.btn_add_involved}</span>
          </button>
        </div>

        {involvedPersons.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            {t.sub_no_persons}
          </div>
        ) : (
          involvedPersons.map((p, idx) => (
            <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{t.sub_person_n.replace('{n}', String(idx + 1))}</span>
                <button
                  type="button"
                  onClick={() => removeInvolvedPerson(p.id)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`input-person-${p.id}-name`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_full_name}</label>
                  <input
                    id={`input-person-${p.id}-name`}
                    type="text"
                    value={p.name}
                    onChange={(e) => updateInvolvedPerson(p.id, 'name', e.target.value)}
                    placeholder={t.sub_ph_person_name}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor={`input-person-${p.id}-position`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_position_function}</label>
                  <input
                    id={`input-person-${p.id}-position`}
                    type="text"
                    value={p.position}
                    onChange={(e) => updateInvolvedPerson(p.id, 'position', e.target.value)}
                    placeholder={t.sub_ph_position}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor={`input-person-${p.id}-hierarchy`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_hierarchy}</label>
                  <select
                    id={`input-person-${p.id}-hierarchy`}
                    value={p.hierarchyRole}
                    onChange={(e: any) => updateInvolvedPerson(p.id, 'hierarchyRole', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Employé">{t.sub_hier_employee}</option>
                    <option value="Cadre">{t.sub_hier_manager}</option>
                    <option value="Sous-Directeur">{t.sub_hier_deputy_director}</option>
                    <option value="Directeur+">{t.sub_hier_director}</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Témoins éventuels — liste dynamique conservée */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.sub_witnesses_optional}</span>
          <button
            type="button"
            id="btn-add-witness"
            onClick={addWitness}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.btn_add_witness}</span>
          </button>
        </div>

        {witnesses.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            {t.sub_no_witnesses}
          </div>
        ) : (
          witnesses.map((w, idx) => (
            <div key={w.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{t.sub_witness_n.replace('{n}', String(idx + 1))}</span>
                <button
                  type="button"
                  onClick={() => removeWitness(w.id)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`input-witness-${w.id}-name`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_full_name}</label>
                  <input
                    id={`input-witness-${w.id}-name`}
                    type="text"
                    value={w.name}
                    onChange={(e) => updateWitness(w.id, 'name', e.target.value)}
                    placeholder={t.sub_ph_witness_name}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor={`input-witness-${w.id}-position`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_position}</label>
                  <input
                    id={`input-witness-${w.id}-position`}
                    type="text"
                    value={w.position}
                    onChange={(e) => updateWitness(w.id, 'position', e.target.value)}
                    placeholder={t.sub_ph_position}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label htmlFor={`input-witness-${w.id}-hierarchy`} className="block text-[11px] font-medium text-slate-600 mb-1">{t.sub_hierarchy}</label>
                  <select
                    id={`input-witness-${w.id}-hierarchy`}
                    value={w.hierarchyRole}
                    onChange={(e: any) => updateWitness(w.id, 'hierarchyRole', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Employé">{t.sub_hier_employee}</option>
                    <option value="Cadre">{t.sub_hier_manager}</option>
                    <option value="Sous-Directeur">{t.sub_hier_deputy_director}</option>
                    <option value="Directeur+">{t.sub_hier_director}</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (organisation du formulaire —
          sections visuelles) === Séparateur avant la
          description, cohérent avec les sections ci-dessus/
          dessous — le libellé du champ reste suffisamment
          explicite pour ne pas dupliquer un intitulé de
          section ici. */}
      <div className="pt-2 border-t border-slate-100">
        <label htmlFor="input-detailed-description" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_description} *</label>
        <textarea
          id="input-detailed-description"
          rows={5}
          value={detailedDescription}
          onChange={(e) => setDetailedDescription(e.target.value)}
          placeholder={t.desc_placeholder}
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
        />
      </div>

      {/* === AMÉLIORATION AJOUTÉE (organisation du formulaire —
          sections visuelles) === Catégorie/Impact/mesure
          financière/situation en cours regroupés sous un même
          intitulé "Qualification" — même convention que les
          sections ci-dessus. */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.sub_incident_qualification}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-subcategory" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_incident_category} *</label>
            <select
              id="input-subcategory"
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              {currentCategoryDef?.subCategories.map((sub, idx) => (
                <option key={idx} value={sub}>
                  {trData(sub, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="input-impact-type" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_impact_potential}</label>
            <select
              id="input-impact-type"
              value={impactType}
              onChange={(e) => setImpactType(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {IMPACT_TYPES.map((imp, idx) => (
                <option key={idx} value={imp}>
                  {trData(imp, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCategory.includes('Autres') && (
          <div>
            <label htmlFor="input-custom-violation" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_custom_violation}</label>
            <input
              id="input-custom-violation"
              type="text"
              value={customViolation}
              onChange={(e) => setCustomViolation(e.target.value)}
              placeholder={t.sub_ph_custom_violation}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label htmlFor="input-estimated-impact" className="block text-xs font-semibold text-slate-700 mb-1">
            {t.sub_estimated_impact}
          </label>
          <input
            id="input-estimated-impact"
            type="text"
            value={estimatedImpactValue}
            onChange={(e) => setEstimatedImpactValue(e.target.value)}
            /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_impact}) */
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        {/* Toggle « situation en cours » — nouveau champ additif (Phase 26) */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div>
            <div className="text-xs font-semibold text-slate-800">{t.label_situation_ongoing}</div>
            <div className="text-[11px] text-slate-500">{t.label_situation_ongoing_desc}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isOngoing}
            id="toggle-situation-ongoing"
            onClick={() => setIsOngoing(!isOngoing)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ${
              isOngoing ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                isOngoing ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE : matrice de risque DARC (Annexe
          9) retirée de l'affichage sur demande explicite —
          cette classification automatique reste calculée
          (`liveRisk`, mêmes facteurs par défaut qu'avant :
          finFactor/hierFactor/reputFactor=2, recidFactor=1) et
          enregistrée avec le signalement (riskEvaluation),
          exactement comme avant ; seule son exposition et son
          édition interactive au lanceur d'alerte disparaissent
          du formulaire public. La classification reste
          ajustable ensuite par le personnel habilité via
          "Modifier la priorité / Délais" (InvestigationDesk.tsx). */}

      <div className="flex justify-between pt-4">
        <Button type="button" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(2)}>
          <span>{t.common_previous}</span>
        </Button>

        <Button
          type="button"
          id="btn-step3-next"
          onClick={() => {
            if (!detailedDescription.trim() || !incidentDates.trim() || !incidentLocation.trim()) {
              setErrorMsg(t.err_missing_desc_date_location);
              return;
            }
            setErrorMsg('');
            setCurrentStep(4);
          }}
        >
          <span>{t.common_next}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
