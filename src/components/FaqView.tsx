import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Send, ChevronRight } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface FaqViewProps {
  lang: Language;
  onStartNewAlert: () => void;
}

/**
 * === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
 *
 * Extrait de la page d'accueil (WhistleblowerHome.tsx) vers son propre
 * onglet public, sur demande explicite. Même contenu, mêmes clés de
 * traduction, même comportement d'accordéon (une question ouverte par
 * défaut) — seule la page qui l'héberge change : `/faq` plutôt qu'une
 * ancre de défilement sur `/`. Style cohérent avec la refonte Phase 17
 * (coins nets, mêmes couleurs).
 */
export const FaqView: React.FC<FaqViewProps> = ({ lang, onStartNewAlert }) => {
  const t = TRANSLATIONS[lang];
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const faqItems: { q: string; a: string }[] = [
    { q: t.faq_q1, a: t.faq_a1 },
    { q: t.faq_q2, a: t.faq_a2 },
    { q: t.faq_q3, a: t.faq_a3 },
    { q: t.faq_q4, a: t.faq_a4 },
    { q: t.faq_q5, a: t.faq_a5 },
    { q: t.faq_q6, a: t.faq_a6 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="max-w-2xl space-y-2">
        {/* === AMÉLIORATION AJOUTÉE === point d'interrogation noir sur fond
            blanc (variante « B » choisie par l'utilisateur) */}
        <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center text-black">
          <HelpCircle className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.faq_title}</h1>
        <p className="text-sm text-slate-600">{t.faq_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 border border-slate-200 bg-white divide-y sm:divide-y-0 divide-slate-100">
        {faqItems.map((item, idx) => {
          const open = openFaqIndex === idx;
          return (
            <div
              key={idx}
              className={`bg-white sm:border-slate-100 ${idx % 2 === 0 ? 'sm:border-r' : ''} ${idx < faqItems.length - 2 ? 'border-b sm:border-b-0' : ''}`}
            >
              <button
                onClick={() => setOpenFaqIndex(open ? null : idx)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
              >
                <span className="text-sm font-semibold text-slate-800">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Même appel à l'action qu'ailleurs sur le site — jamais un cul-de-sac. */}
      <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-6">
        <p className="text-sm text-slate-700 font-medium">{t.cta_band_desc}</p>
        <button
          onClick={onStartNewAlert}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>{t.btn_new_alert}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
