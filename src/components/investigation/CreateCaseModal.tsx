/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-troisième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115/#116 pour les étapes précédentes. Extraction de la modale
 * "Créer un nouveau dossier" (assistant à 3 étapes) hors du composant
 * monolithique, sans aucun changement de comportement. Code strictement
 * déplacé, pas réécrit — y compris les deux listes dérivées
 * (`newCaseEntityOptions`/`newCaseSubCategoryOptions`), qui n'étaient
 * utilisées que par cette modale.
 *
 * `handleCreateCase` reste possédé par InvestigationDesk.tsx (ferme sur
 * activeUser/la persistance/le mirroring backend Phase 13) : passé en prop
 * tel quel.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { Language } from '../../types';
import { EntityDef, CountryDef, CategoryDef } from '../../data/activaConfig';
import { trData } from '../../i18n/dataLabels';

interface CreateCaseModalProps {
  t: Record<string, string>;
  lang: Language;
  entities: EntityDef[];
  countries: CountryDef[];
  categoriesConfig: CategoryDef[];
  createCaseStep: 1 | 2 | 3;
  setCreateCaseStep: (v: 1 | 2 | 3 | ((s: 1 | 2 | 3) => 1 | 2 | 3)) => void;
  newCaseObjet: string;
  setNewCaseObjet: (v: string) => void;
  newCaseCountry: string;
  setNewCaseCountry: (v: string) => void;
  newCaseEntity: string;
  setNewCaseEntity: (v: string) => void;
  newCaseCategory: string;
  setNewCaseCategory: (v: string) => void;
  newCaseSubCategory: string;
  setNewCaseSubCategory: (v: string) => void;
  isCreatingCase: boolean;
  setShowCreateCaseModal: (v: boolean) => void;
  handleCreateCase: () => void;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  t,
  lang,
  entities,
  countries,
  categoriesConfig,
  createCaseStep,
  setCreateCaseStep,
  newCaseObjet,
  setNewCaseObjet,
  newCaseCountry,
  setNewCaseCountry,
  newCaseEntity,
  setNewCaseEntity,
  newCaseCategory,
  setNewCaseCategory,
  newCaseSubCategory,
  setNewCaseSubCategory,
  isCreatingCase,
  setShowCreateCaseModal,
  handleCreateCase,
}) => {
  const newCaseEntityOptions = newCaseCountry ? entities.filter((e) => e.country === newCaseCountry) : entities;
  const newCaseSubCategoryOptions = categoriesConfig.find((c) => c.name === newCaseCategory)?.subCategories ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau
          dossier) === un <div>, pas un <form> : avec 2 boutons qui
          partagent la même position mais changent de `type`
          (button → submit) selon l'étape, un <form> déclenchait une
          soumission native imprévue au moment même où React réécrit
          l'attribut `type` du bouton en place (juste avant l'action
          par défaut du clic) — bug confirmé en test Playwright, corrigé
          en gérant la validation "Suivant"/"Créer" entièrement par
          handlers, sans jamais dépendre de la sémantique native d'un
          formulaire. */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.create_case_title}</h3>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2.5">
            {([1, 2, 3] as const).map((step) => (
              <React.Fragment key={step}>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === createCaseStep
                      ? 'bg-blue-600 text-white'
                      : step < createCaseStep
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step < createCaseStep ? <Check className="w-3 h-3" /> : step}
                </span>
                <span className={`text-[10px] font-semibold ${step === createCaseStep ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step === 1 ? t.create_case_step_info : step === 2 ? t.create_case_step_classification : t.create_case_step_validation}
                </span>
                {step < 3 && <span className="flex-1 h-px bg-slate-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {createCaseStep === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.create_case_objet} *</label>
              <textarea
                autoFocus
                rows={3}
                value={newCaseObjet}
                onChange={(e) => setNewCaseObjet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.create_case_country} *</label>
                <select
                  value={newCaseCountry}
                  onChange={(e) => {
                    setNewCaseCountry(e.target.value);
                    setNewCaseEntity('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  required
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.name}>{c.flag} {trData(c.name, lang)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.create_case_entity} *</label>
                <select
                  value={newCaseEntity}
                  onChange={(e) => setNewCaseEntity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  required
                >
                  <option value="">—</option>
                  {newCaseEntityOptions.map((en) => (
                    <option key={en.id} value={en.name}>{en.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {createCaseStep === 2 && (
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.create_case_category} *</label>
              <select
                value={newCaseCategory}
                onChange={(e) => {
                  setNewCaseCategory(e.target.value);
                  setNewCaseSubCategory('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                required
              >
                <option value="">—</option>
                {categoriesConfig.map((c) => (
                  <option key={c.name} value={c.name}>{trData(c.name, lang)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.create_case_subcategory} *</label>
              <select
                value={newCaseSubCategory}
                onChange={(e) => setNewCaseSubCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                disabled={!newCaseCategory}
                required
              >
                <option value="">—</option>
                {newCaseSubCategoryOptions.map((sc) => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              {t.create_case_default_risk_notice}
            </p>
          </div>
        )}

        {createCaseStep === 3 && (
          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">{t.create_case_objet}</span><span className="font-semibold text-slate-900 text-right max-w-[60%] truncate">{newCaseObjet}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t.create_case_country}</span><span className="font-semibold text-slate-900">{newCaseCountry}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t.create_case_entity}</span><span className="font-semibold text-slate-900">{newCaseEntity}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t.create_case_category}</span><span className="font-semibold text-slate-900">{newCaseCategory}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t.create_case_subcategory}</span><span className="font-semibold text-slate-900">{newCaseSubCategory}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500">{t.create_case_default_risk_label}</span><span className="font-bold text-amber-700">NOCA 2</span></div>
            </div>
            <p className="text-[11px] text-slate-500">{t.create_case_validation_notice}</p>
          </div>
        )}

        <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              if (createCaseStep === 1) setShowCreateCaseModal(false);
              else setCreateCaseStep((s) => (s - 1) as 1 | 2 | 3);
            }}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {createCaseStep === 1 ? t.btn_cancel : t.create_case_back}
          </button>
          {createCaseStep < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (createCaseStep === 1 && (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity)) return;
                setCreateCaseStep((s) => (s + 1) as 1 | 2 | 3);
              }}
              disabled={createCaseStep === 1 && (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold"
            >
              {t.create_case_next}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleCreateCase()}
              disabled={isCreatingCase || !newCaseCategory || !newCaseSubCategory}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold"
            >
              {isCreatingCase ? t.create_case_creating : t.create_case_confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
