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

  // === AMÉLIORATION AJOUTÉE (FAQ — design modernisé) ===
  // En-tête animé (tuile « ? » noire sur fond blanc conservée, variante B),
  // questions présentées en cartes qui s'ouvrent/se ferment en douceur
  // (hauteur animée via `grid-template-rows`), numéro de question discret,
  // apparition en cascade, et bandeau d'appel à l'action en dégradé de
  // marque. Même contenu, même comportement (une question ouverte à la fois,
  // la première par défaut). Animations coupées si l'utilisateur limite les
  // animations (index.css).
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="max-w-2xl space-y-3">
        {/* === AMÉLIORATION AJOUTÉE === point d'interrogation noir sur fond
            blanc (variante « B » choisie par l'utilisateur) */}
        <div
          className="activa-enter w-12 h-12 rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_10px_24px_-14px_rgb(15_23_42/0.35)] flex items-center justify-center text-black"
          style={{ '--d': '0ms' } as React.CSSProperties}
        >
          <HelpCircle className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <h1 className="activa-enter text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ '--d': '100ms' } as React.CSSProperties}>
          {t.faq_title}
        </h1>
        <div className="activa-draw-x w-12 h-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-400" style={{ '--d': '250ms' } as React.CSSProperties} />
        <p className="activa-enter text-sm text-slate-600" style={{ '--d': '200ms' } as React.CSSProperties}>{t.faq_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
        {faqItems.map((item, idx) => {
          const open = openFaqIndex === idx;
          const panelId = `faq-panel-${idx}`;
          return (
            <div
              key={idx}
              className={`activa-enter group rounded-2xl border bg-white transition-all duration-300 ${
                open
                  ? 'border-blue-200 shadow-[0_18px_40px_-22px_rgb(37_99_235/0.45)]'
                  : 'border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgb(15_23_42/0.3)]'
              }`}
              style={{ '--d': `${250 + idx * 70}ms` } as React.CSSProperties}
            >
              <button
                onClick={() => setOpenFaqIndex(open ? null : idx)}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full flex items-center gap-4 px-5 py-4 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <span
                  className={`text-[11px] font-semibold tabular-nums tracking-[0.12em] shrink-0 transition-colors duration-300 ${
                    open ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'
                  }`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className={`flex-1 text-sm font-semibold transition-colors duration-300 ${open ? 'text-slate-900' : 'text-slate-800'}`}>{item.q}</span>
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    open
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30 rotate-180'
                      : 'bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200 group-hover:text-blue-600 group-hover:ring-blue-200'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" strokeWidth={2} />
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows,opacity] motion-reduce:transition-none duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="mx-5 mb-5 pt-3 border-t border-slate-100 pl-[calc(1.5rem+0.25rem)] text-xs text-slate-600 leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Même appel à l'action qu'ailleurs sur le site — jamais un cul-de-sac. */}
      <div
        className="activa-enter relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0B2545] via-[#0f3566] to-blue-700 p-6 sm:p-7 shadow-[0_24px_50px_-26px_rgb(11_37_69/0.7)]"
        style={{ '--d': '700ms' } as React.CSSProperties}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 w-64 h-64 rounded-full bg-sky-400/20 blur-3xl" />
        <p className="relative text-base sm:text-lg text-white font-semibold tracking-tight">{t.cta_band_desc}</p>
        <button
          onClick={onStartNewAlert}
          className="group relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-700 hover:text-blue-800 font-bold text-xs sm:text-sm shadow-lg shadow-black/20 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
        >
          <Send className="w-4 h-4" strokeWidth={1.75} />
          <span>{t.btn_new_alert}</span>
          <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
