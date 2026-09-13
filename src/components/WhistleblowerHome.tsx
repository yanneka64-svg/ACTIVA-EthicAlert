import React from 'react';
import {
  ShieldCheck,
  UserX,
  QrCode,
  HeartHandshake,
  ChevronRight,
  ArrowRight,
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
  // === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
  onGoToFaq: () => void;
}

export const WhistleblowerHome: React.FC<WhistleblowerHomeProps> = ({
  lang,
  onStartNewAlert,
  onGoToTrack,
  onOpenQrModal,
  onOpenDesk,
  onGoToFaq,
}) => {
  const t = TRANSLATIONS[lang];

  return (
    <div className="space-y-12 pb-8">
      {/* === AMÉLIORATION AJOUTÉE (Phase 17 — réorganisation de l'accueil) ===
          Hero repris en deux colonnes (texte / photo) façon maquette
          adoptée, coins nets partout (aucune forme arrondie, sur demande
          explicite) : boutons, carte photo et bulle de citation passent
          tous de `rounded-*` à des angles droits. Photo, titre, description
          et logo restent ceux déjà en place (Phase 16/13) — seule la mise
          en page change. */}
      <div className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <span className="block text-xs font-bold tracking-wider text-blue-700 uppercase">
              {t.hero_eyebrow}
            </span>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0B2545] leading-tight">
              {t.hero_title}
            </h1>

            <p className="text-base sm:text-lg font-semibold text-slate-800 leading-snug max-w-md">
              {t.hero_desc}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <button
                id="hero-btn-new-alert"
                onClick={onStartNewAlert}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition"
              >
                <Send className="w-4 h-4" />
                <span>{t.btn_new_alert}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                id="hero-btn-track"
                onClick={onGoToTrack}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 transition"
              >
                <Search className="w-4 h-4" />
                <span>{t.btn_track_existing}</span>
              </button>

              <button
                id="hero-btn-qr"
                onClick={onOpenQrModal}
                className="p-3 bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 transition self-start sm:self-auto"
                title="Afficher le QR code pour smartphone"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </div>

            <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 pt-1">
              <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              {t.hero_anonymous_note}
            </p>

            <button
              onClick={() => document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-blue-700 transition"
            >
              <PlayCircle className="w-5 h-5" />
              {t.hero_how_it_works_link}
            </button>
          </div>

          {/* Photo réelle du siège (Phase 16), coins nets, bulle de citation superposée */}
          <div className="relative min-h-[320px] sm:min-h-[420px]">
            <img
              src="/brand/activa-hq.jpg"
              alt="Siège du Groupe ACTIVA"
              className="absolute inset-0 w-full h-full object-cover object-[75%_35%]"
            />
            <div className="hidden sm:flex absolute right-4 bottom-4 items-start gap-2 max-w-xs bg-[#0B2545]/90 backdrop-blur text-white text-xs px-4 py-3 shadow-lg">
              <Quote className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{t.hero_quote}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Feature strip — coins nets (plus de rounded-2xl/overflow-hidden) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border border-slate-200 bg-white">
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_confidentiality_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_confidentiality_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_anonymity_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_anonymity_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-11 h-11 bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_no_retaliation_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_no_retaliation_desc}</div>
          </div>
        </div>
      </div>

      {/* "Comment ça marche ?" — cartes à coins nets, libellé de l'étape 4
          et sous-titre alignés sur la maquette adoptée (Phase 17). */}
      <div id="how-it-works-section" className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-blue-600">
            {t.process_label}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {t.process_heading}
            </h3>
            <button
              onClick={onGoToFaq}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline shrink-0"
            >
              {t.process_view_faq}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">{t.process_subtitle}</p>
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
              <div key={idx} className="bg-white p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className={`w-10 h-10 flex items-center justify-center shrink-0 ${toneClasses[step.tone]}`}>
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 19) === section "Des sujets qui
          comptent" et bandeau d'appel à l'action final (Phase 17) retirés
          de la page d'accueil sur demande explicite — le contenu ne
          change pas ailleurs, ils sont simplement retirés d'ici. */}

      {/* === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
          La FAQ vit désormais dans son propre onglet public (`/faq`, voir
          FaqView.tsx et App.tsx) plutôt qu'ici — le bouton "Voir la FAQ" de
          la section précédente y navigue directement (onGoToFaq). */}
      </div>
    </div>
  );
};
