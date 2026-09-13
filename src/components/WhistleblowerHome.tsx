import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserX,
  HeartHandshake,
  ChevronRight,
  ArrowRight,
  Send,
  Search,
  Quote,
  Lock,
  CheckCircle2,
  FileText,
  Shield,
  Users,
  Leaf,
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface WhistleblowerHomeProps {
  lang: Language;
  onStartNewAlert: () => void;
  onGoToTrack: () => void;
  onOpenDesk: () => void;
  // === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
  onGoToFaq: () => void;
}

export const WhistleblowerHome: React.FC<WhistleblowerHomeProps> = ({
  lang,
  onStartNewAlert,
  onGoToTrack,
  onOpenDesk,
  onGoToFaq,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (Phase 22 — carte de valeurs qui tourne) ===
  // Carte flottante sur la photo du hero, sur demande explicite : au lieu
  // d'afficher les 3 valeurs en permanence, une seule est visible à la
  // fois et la carte passe à la suivante toutes les 5 secondes, en boucle.
  const heroValues = [
    { icon: Shield, title: t.hero_value1_title, desc: t.hero_value1_desc },
    { icon: Users, title: t.hero_value2_title, desc: t.hero_value2_desc },
    { icon: Leaf, title: t.hero_value3_title, desc: t.hero_value3_desc },
  ];
  const [valueIndex, setValueIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setValueIndex((i) => (i + 1) % heroValues.length), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const currentValue = heroValues[valueIndex];
  const CurrentValueIcon = currentValue.icon;

  return (
    <div className="space-y-12 pb-8">
      {/* === AMÉLIORATION AJOUTÉE (Phase 20 — hero plein cadre) ===
          Retour à une photo en arrière-plan sur toute la largeur du hero
          (au lieu de la colonne dédiée Phase 17), avec un léger voile bleu
          ciel qui s'estompe vers la droite — la photo reste visible côté
          droit, le texte reste lisible côté gauche. QR code et lien "Comment
          ça marche ?" retirés d'ici (sur demande) ; le lien reste accessible
          depuis la section elle-même, plus bas sur la page. */}
      <div className="relative overflow-hidden border-b border-slate-200 min-h-[440px] sm:min-h-[540px] flex items-center">
        <img
          src="/brand/activa-hq.jpg"
          alt="Siège du Groupe ACTIVA"
          className="absolute inset-0 w-full h-full object-cover object-[75%_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-sky-50/75 to-transparent" />

        <div className="relative z-10 max-w-xl p-8 sm:p-12 lg:pl-[calc((100vw-80rem)/2+2rem)] space-y-5">
          <span className="block text-xs font-bold tracking-wider text-blue-700 uppercase">
            {t.hero_eyebrow}
          </span>

          {/* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle fourni) ===
              Titre en deux lignes bicolores, comme sur la maquette de
              référence, à la place du nom de produit utilisé jusqu'ici. */}
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            <span className="block text-[#0B2545]">{t.hero_headline_line1}</span>
            <span className="block text-blue-600">{t.hero_headline_line2}</span>
          </h1>

          <p className="text-base sm:text-lg font-semibold text-slate-800 leading-snug max-w-md">
            {t.hero_desc}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <button
              id="hero-btn-new-alert"
              onClick={onStartNewAlert}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>{t.btn_new_alert}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              id="hero-btn-track"
              onClick={onGoToTrack}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 transition whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              <span>{t.btn_track_existing}</span>
            </button>
          </div>

          <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 pt-1">
            <Lock className="w-4 h-4 text-blue-600 shrink-0" />
            {t.hero_anonymous_note}
          </p>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Phase 22 — carte de valeurs qui
            tourne) === Positionnée en haut à droite du hero, au-dessus de
            la photo. Contrairement à la bulle de citation, celle-ci garde
            un fond opaque (le contenu change toutes les 5 secondes, il a
            besoin de rester net dans tous les cas). */}
        <div className="hidden sm:block absolute top-6 right-6 z-10 w-64 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4">
          <div key={valueIndex} className="flex items-center gap-3 activa-fade-in">
            <span className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <CurrentValueIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="font-bold text-slate-900 text-sm">{currentValue.title}</div>
              <div className="text-xs text-slate-500">{currentValue.desc}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {heroValues.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === valueIndex ? 'w-4 bg-blue-600' : 'w-1.5 bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Phase 20) === bulle de citation sans
            fond (sur demande explicite) : plus de bloc bleu marine derrière
            le texte, juste une ombre portée sur le texte lui-même pour
            rester lisible par-dessus la photo. */}
        <div className="hidden sm:flex absolute right-8 bottom-8 z-10 items-start gap-2 max-w-xs text-white text-xs">
          <Quote className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' }} />
          <span className="leading-relaxed" style={{ textShadow: '0 1px 4px rgba(0,0,0,.65)' }}>{t.hero_quote}</span>
        </div>
      </div>

      <div className="space-y-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle fourni) ===
          Icônes rondes, texte centré sous chaque icône, simples séparateurs
          verticaux entre colonnes plutôt qu'une carte à bordure — comme sur
          la maquette de référence. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 flex flex-col items-center text-center gap-2">
          <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_confidentiality_title}</div>
            <div className="text-xs text-slate-500 max-w-[220px]">{t.hero_feature_confidentiality_desc}</div>
          </div>
        </div>
        <div className="p-5 flex flex-col items-center text-center gap-2">
          <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_anonymity_title}</div>
            <div className="text-xs text-slate-500 max-w-[220px]">{t.hero_feature_anonymity_desc}</div>
          </div>
        </div>
        <div className="p-5 flex flex-col items-center text-center gap-2">
          <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_no_retaliation_title}</div>
            <div className="text-xs text-slate-500 max-w-[220px]">{t.hero_feature_no_retaliation_desc}</div>
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
