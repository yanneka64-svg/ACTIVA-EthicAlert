import React, { useState } from 'react';
import {
  ShieldCheck,
  UserX,
  QrCode,
  HeartHandshake,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  HelpCircle,
  Send,
  Search,
  PlayCircle,
  Quote,
  Lock,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface WhistleblowerHomeProps {
  lang: Language;
  onStartNewAlert: () => void;
  onGoToTrack: () => void;
  onOpenQrModal: () => void;
  onOpenDesk: () => void;
}

export const WhistleblowerHome: React.FC<WhistleblowerHomeProps> = ({
  lang,
  onStartNewAlert,
  onGoToTrack,
  onOpenQrModal,
  onOpenDesk,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (Phase 2 — FAQ section, absente jusqu'ici) ===
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
    <div className="space-y-12 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* === AMÉLIORATION AJOUTÉE (Phase 13 — reproduction fidèle de la
          nouvelle maquette d'accueil, photo) === Hero plein largeur : tags,
          titre, sous-titre, paragraphe, 2 boutons + lien "Comment ça
          marche ?", bulle de citation. Le fond est un dégradé décoratif en
          remplacement de la photographie (bâtiment + palmiers) de la
          maquette, dont l'asset réel n'est pas disponible dans ce dépôt. */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-xl min-h-[480px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-sky-50 to-emerald-100" />
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />

        <div className="relative z-10 max-w-xl p-8 sm:p-12 space-y-4">
          <span className="inline-block px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-slate-200 text-[11px] font-bold tracking-wider text-slate-600">
            {t.hero_tags}
          </span>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0B2545] leading-tight">
            {t.hero_title}
          </h1>

          <p className="text-base sm:text-lg font-semibold text-slate-800 leading-snug">
            {t.hero_desc}
          </p>

          <p className="text-sm text-slate-600 leading-relaxed max-w-md">
            {t.hero_paragraph}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="hero-btn-new-alert"
              onClick={onStartNewAlert}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              <span>{t.btn_new_alert}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              id="hero-btn-track"
              onClick={onGoToTrack}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 transition"
            >
              <Search className="w-4 h-4" />
              <span>{t.btn_track_existing}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              id="hero-btn-qr"
              onClick={onOpenQrModal}
              className="p-3 rounded-xl bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 transition"
              title="Afficher le QR code pour smartphone"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-blue-700 transition"
          >
            <PlayCircle className="w-5 h-5" />
            {t.hero_how_it_works_link}
          </button>
        </div>

        {/* Quote bubble (bottom-right, over the decorative visual) */}
        <div className="hidden lg:flex absolute right-8 bottom-8 z-10 items-start gap-2 max-w-xs bg-[#0B2545]/90 backdrop-blur text-white text-xs rounded-2xl px-4 py-3 shadow-lg">
          <Quote className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{t.hero_quote}</span>
        </div>
      </div>

      {/* Feature strip — exact match with the reference mockup's 3 icons row below the hero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden">
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_confidentiality_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_confidentiality_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_anonymity_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_anonymity_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_no_retaliation_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_no_retaliation_desc}</div>
          </div>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 13) === "Comment ça marche ?" —
          section claire à 4 cartes numérotées, en remplacement du bloc
          sombre précédent, id ciblé par le lien "Comment ça marche ?" de la
          Navbar et par le bouton "▷ Comment ça marche ?" du hero. */}
      <div id="how-it-works-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-blue-600">
              {t.process_label}
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              {t.process_heading}
            </h3>
          </div>
          <button
            onClick={() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline shrink-0"
          >
            {t.process_view_faq}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: FileText, title: t.process_step1_title, desc: t.process_step1_desc, tone: 'blue' as const },
            { icon: Lock, title: t.process_step2_title, desc: t.process_step2_desc, tone: 'amber' as const },
            { icon: Search, title: t.process_step3_title, desc: t.process_step3_desc, tone: 'purple' as const },
            { icon: CheckCircle2, title: t.process_step4_title, desc: t.process_step4_desc, tone: 'emerald' as const },
          ].map((step, idx) => {
            const Icon = step.icon;
            const toneClasses: Record<string, string> = {
              blue: 'bg-blue-50 text-blue-600',
              amber: 'bg-amber-50 text-amber-600',
              purple: 'bg-purple-50 text-purple-600',
              emerald: 'bg-emerald-50 text-emerald-600',
            };
            return (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[step.tone]}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 2 — section FAQ) === id targeted by the Navbar's "FAQ" link */}
      <div id="faq-section" className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{t.faq_title}</h3>
          <p className="text-xs text-slate-600">{t.faq_subtitle}</p>
        </div>

        <div className="max-w-3xl mx-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {faqItems.map((item, idx) => {
            const open = openFaqIndex === idx;
            return (
              <div key={idx} className="bg-white">
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
      </div>
    </div>
  );
};
