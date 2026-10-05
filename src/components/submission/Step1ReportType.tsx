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
import { Info, ArrowRight, Briefcase, Coins, Users, Leaf, MoreHorizontal, Check } from 'lucide-react';
import { Language } from '../../types';
import { CategoryDef } from '../../data/activaConfig';
import { Button } from '../ui';
import { trData } from '../../i18n/dataLabels';

// === AMÉLIORATION AJOUTÉE (Phase 26 — visuel des cartes de catégorie, maquette
// de référence) === Association icône/couleur par mot-clé plutôt que par index
// figé, pour rester cohérent même si un administrateur renomme/ajoute une
// catégorie (Phase 7 — catégories éditables) : une catégorie inconnue retombe
// simplement sur l'icône/couleur par défaut au lieu de planter.
// === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) === `solid` :
// teinte pleine qui remplit la tuile d'icône au survol et à la sélection ;
// `ring` : contour fin de la tuile au repos.
const CATEGORY_VISUALS: { match: RegExp; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; bg: string; text: string; solid?: string; ring?: string }[] = [
  { match: /fraude|corruption/i, icon: Coins, bg: 'bg-rose-50', text: 'text-rose-600', solid: 'bg-gradient-to-br from-rose-500 to-pink-600', ring: 'ring-rose-200/70' },
  { match: /ressources humaines|diversit/i, icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600', solid: 'bg-gradient-to-br from-emerald-500 to-teal-600', ring: 'ring-emerald-200/70' },
  { match: /environnement|sant[ée]|s[ée]curit[ée]/i, icon: Leaf, bg: 'bg-green-50', text: 'text-green-600', solid: 'bg-gradient-to-br from-green-500 to-emerald-600', ring: 'ring-green-200/70' },
  { match: /autres/i, icon: MoreHorizontal, bg: 'bg-slate-100', text: 'text-slate-600', solid: 'bg-gradient-to-br from-slate-500 to-slate-700', ring: 'ring-slate-200' },
];
function getCategoryVisual(name: string) {
  const found = CATEGORY_VISUALS.find((v) => v.match.test(name));
  return found || { icon: Briefcase, bg: 'bg-blue-50', text: 'text-blue-600', solid: 'bg-gradient-to-br from-blue-500 to-blue-700', ring: 'ring-blue-200/70' };
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
        <span className="text-xs font-bold text-blue-700 uppercase tracking-[0.14em]">{t.wizard_step_of.replace('{n}', '1')}</span>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1">{t.wizard_step1_title}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step1_hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:[&>label:last-child:nth-child(odd)]:col-span-2">
        {categories.map((cat, i) => {
          const visual = getCategoryVisual(cat.name);
          const Icon = visual.icon;
          const active = selectedCategory === cat.name;
          return (
            // === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) ===
            // apparition décalée, soulèvement au survol, halo bleu et tuile
            // remplie quand la catégorie est choisie.
            <label
              key={cat.id}
              className={`activa-enter group p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ease-out flex items-start gap-3 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200 ${
                active
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50/70 to-white shadow-[0_14px_30px_-16px_rgb(37_99_235/0.45)]'
                  : 'border-slate-200 bg-white hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(15_23_42/0.25)]'
              }`}
              style={{ '--d': `${i * 60}ms` } as React.CSSProperties}
            >
              <input
                type="radio"
                name="alert_category"
                className="sr-only"
                checked={active}
                onChange={() => setSelectedCategory(cat.name)}
              />
              <span
                className={`relative overflow-hidden w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset transition-all duration-500 ease-out ${visual.bg} ${visual.ring ?? ''} ${
                  active ? 'text-white scale-105 shadow-lg' : `${visual.text} group-hover:text-white group-hover:scale-105 group-hover:-rotate-3`
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 transition-opacity duration-500 ${visual.solid ?? ''} ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                />
                <Icon className="relative w-5 h-5" strokeWidth={1.75} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-slate-900 text-sm">{trData(cat.name, lang)}</span>
                <span className="block text-xs text-slate-500 mt-1">{cat.subCategories.map((s) => trData(s, lang)).join(', ')}.</span>
              </span>
              <span
                className={`mt-1 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-300 ${
                  active ? 'border-blue-600 bg-blue-600' : 'border-slate-300 group-hover:border-blue-300'
                }`}
              >
                {active && <Check className="activa-pop w-3 h-3 text-white" strokeWidth={3.5} />}
              </span>
            </label>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50/50 border border-blue-100 text-xs text-blue-900 flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-white text-blue-700 ring-1 ring-inset ring-blue-200/70 shadow-sm flex items-center justify-center shrink-0">
          <Info className="w-4 h-4" strokeWidth={1.75} />
        </span>
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
