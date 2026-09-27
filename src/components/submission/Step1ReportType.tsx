/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 1 — type de signalement (cartes de catégorie).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 * `CATEGORY_VISUALS`/`getCategoryVisual` déplacés ici avec elle (seule
 * utilisatrice).
 */
import React from 'react';
import { Info, ArrowRight, Briefcase, Coins, Users, Leaf, MoreHorizontal } from 'lucide-react';
import { Language } from '../../types';
import { CategoryDef } from '../../data/activaConfig';
import { Button } from '../ui';
import { trData } from '../../i18n/dataLabels';

// === AMÉLIORATION AJOUTÉE (Phase 26 — visuel des cartes de catégorie, maquette
// de référence) === Association icône/couleur par mot-clé plutôt que par index
// figé, pour rester cohérent même si un administrateur renomme/ajoute une
// catégorie (Phase 7 — catégories éditables) : une catégorie inconnue retombe
// simplement sur l'icône/couleur par défaut au lieu de planter.
const CATEGORY_VISUALS: { match: RegExp; icon: React.ComponentType<{ className?: string }>; bg: string; text: string }[] = [
  { match: /fraude|corruption/i, icon: Coins, bg: 'bg-rose-50', text: 'text-rose-600' },
  { match: /ressources humaines|diversit/i, icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { match: /environnement|sant[ée]|s[ée]curit[ée]/i, icon: Leaf, bg: 'bg-green-50', text: 'text-green-600' },
  { match: /autres/i, icon: MoreHorizontal, bg: 'bg-slate-100', text: 'text-slate-600' },
];
function getCategoryVisual(name: string) {
  const found = CATEGORY_VISUALS.find((v) => v.match.test(name));
  return found || { icon: Briefcase, bg: 'bg-blue-50', text: 'text-blue-600' };
}

interface Step1ReportTypeProps {
  t: Record<string, string>;
  lang: Language;
  categories: CategoryDef[];
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  onCancel: () => void;
  setCurrentStep: (v: number) => void;
}

export const Step1ReportType: React.FC<Step1ReportTypeProps> = ({
  t,
  lang,
  categories,
  selectedCategory,
  setSelectedCategory,
  onCancel,
  setCurrentStep,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{t.wizard_step_of.replace('{n}', '1')}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step1_title}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step1_hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:[&>label:last-child:nth-child(odd)]:col-span-2">
        {categories.map((cat) => {
          const visual = getCategoryVisual(cat.name);
          const Icon = visual.icon;
          const active = selectedCategory === cat.name;
          return (
            <label
              key={cat.id}
              className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                active ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="alert_category"
                className="sr-only"
                checked={active}
                onChange={() => setSelectedCategory(cat.name)}
              />
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${visual.bg} ${visual.text}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-slate-900 text-sm">{trData(cat.name, lang)}</span>
                <span className="block text-xs text-slate-500 mt-1">{cat.subCategories.map((s) => trData(s, lang)).join(', ')}.</span>
              </span>
              <span
                className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  active ? 'border-blue-600' : 'border-slate-300'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-blue-600" />}
              </span>
            </label>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">{t.choice_anonymous}</strong>
          <p className="mt-0.5 text-blue-800">{t.wizard_step2_hint}</p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.btn_cancel}
        </Button>
        <Button type="button" id="btn-step1-next" onClick={() => setCurrentStep(2)}>
          <span>{t.common_next}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
