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

  // === AMÉLIORATION AJOUTÉE (Phase 22, révisée Phase 25, révisée à nouveau
  // Phase 30) === La carte de valeurs et la bulle de citation étaient deux
  // encarts statiques séparés (Phase 25). Sur nouvelle demande explicite
  // (« je veux que les messages défilent »), ils sont fusionnés en un seul
  // encart qui fait défiler les 3 valeurs puis la citation, un message à la
  // fois, toutes les 4 secondes — la logique de rotation réapparaît donc
  // volontairement ici (elle avait été retirée en Phase 25).
  const heroMessages: { icon: React.ComponentType<{ className?: string }>; title: string; desc?: string }[] = [
    { icon: Shield, title: t.hero_value1_title, desc: t.hero_value1_desc },
    { icon: Users, title: t.hero_value2_title, desc: t.hero_value2_desc },
    { icon: Leaf, title: t.hero_value3_title, desc: t.hero_value3_desc },
    { icon: Quote, title: t.hero_quote },
  ];
  const [heroMsgIndex, setHeroMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setHeroMsgIndex((i) => (i + 1) % heroMessages.length);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeHeroMessage = heroMessages[heroMsgIndex];
  const ActiveHeroIcon = activeHeroMessage.icon;

  return (
    <div className="space-y-8 pb-6">
      {/* === AMÉLIORATION AJOUTÉE (Phase 20 — hero plein cadre) ===
          Retour à une photo en arrière-plan sur toute la largeur du hero
          (au lieu de la colonne dédiée Phase 17), avec un léger voile bleu
          ciel qui s'estompe vers la droite — la photo reste visible côté
          droit, le texte reste lisible côté gauche. QR code et lien "Comment
          ça marche ?" retirés d'ici (sur demande) ; le lien reste accessible
          depuis la section elle-même, plus bas sur la page. */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 28 — trop d'espace vide signalé) ===
          Hauteur minimale réduite (540px → 460px en desktop) : le contenu du
          hero laissait un grand vide sous la note "signalement anonyme"
          avant le bord inférieur du bandeau photo. */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 32) === La fonctionnalité de
          téléversement/glisser-déposer d'une photo de fond personnalisée
          (introduite par un commit poussé directement sur `main`, hors de
          cette session — voir Phase 29) est retirée sur demande explicite
          (« supprime le bouton changer de photos ») : bouton, bouton de
          réinitialisation, zone de dépôt et état associé disparaissent ;
          l'image du hero redevient fixe comme sur toutes les maquettes de
          référence fournies depuis la Phase 17. */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 33 — nouvelle photo du siège) ===
          Photo authentique du siège ACTIVA fournie directement par
          l'utilisateur (vue en contre-plongée, ciel bleu, tour vitrée),
          recadrée en bandeau large et servie depuis
          public/brand/activa-hq-hero.jpg (1600px de large, JPEG qualité 85),
          en remplacement de activa-hq.jpg. */}
      <div className="relative overflow-hidden border-b border-slate-200 min-h-[400px] sm:min-h-[460px] flex items-center">
        <img
          src="/brand/activa-hq-hero.jpg"
          alt="Siège du Groupe ACTIVA"
          className="absolute inset-0 w-full h-full object-cover object-right sm:object-[75%_45%]"
        />
        {/* Voile doux blanc pour garantir la parfaite lisibilité des textes tout en respectant les teintes de la photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/35 to-transparent pointer-events-none" />

        {/* === AMÉLIORATION AJOUTÉE (Phase 36 — correction largeur du texte
            du hero sur grand écran) === BUG PRÉEXISTANT CORRIGÉ : le padding
            gauche de positionnement (`lg:pl-[calc((100vw-80rem)/2+2rem)]`,
            qui grandit avec la largeur d'écran) vivait sur le même élément
            que `max-w-xl`. Sur un écran large, ce padding pouvait à lui seul
            dépasser la largeur max autorisée, ne laissant presque plus de
            place au texte (ex. 186px de large à 1900px de large d'écran,
            faisant passer chaque mot du titre sur sa propre ligne). Le
            padding de positionnement vit désormais sur un conteneur SANS
            max-width ; `max-w-xl` ne contraint plus que le contenu réel, à
            l'intérieur. */}
        <div className="relative z-10 p-8 sm:p-12 lg:pl-[calc((100vw-80rem)/2+2rem)]">
          <div className="max-w-xl space-y-5">
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
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Palette « confiance & conformité » —
            carte de valeurs du hero) === Nouvelle palette demandée
            explicitement (bleu profond #0B4F8A, bleu clair #3B82C4, bleu
            translucide, blanc, blanc translucide, or « intégrité »
            #F4C430) : un dégradé bleu profond → bleu clair, tous deux à
            faible opacité, remplace l'aplat marine uni précédent — plus
            "premium" qu'une seule teinte plate, tout en restant
            suffisamment transparent pour laisser deviner la photo derrière
            (jamais un effet de verre trop opaque). L'or reste un accent
            sobre, réservé à l'icône et au repère de progression actif —
            jamais la couleur dominante de la carte. Valeurs exactes en
            style inline (hors palette Tailwind par défaut), le reste des
            classes utilitaires est inchangé. */}
        <div
          className="hidden sm:block absolute top-6 right-6 z-10 w-64 backdrop-blur-md rounded-2xl shadow-lg p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(11, 79, 138, 0.4) 0%, rgba(59, 130, 196, 0.22) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
          }}
        >
          <div key={heroMsgIndex} className="flex items-start gap-3 activa-fade-in min-h-[2.75rem]">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)', color: '#F4C430' }}
            >
              <ActiveHeroIcon className="w-4 h-4" />
            </span>
            <div>
              <div className="font-bold text-white text-sm leading-snug drop-shadow-sm">{activeHeroMessage.title}</div>
              {activeHeroMessage.desc && (
                <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{activeHeroMessage.desc}</div>
              )}
            </div>
          </div>
          {/* Puces de progression, un point par message — l'or (« intégrité »)
              marque le message actif, un accent sobre plutôt qu'une couleur dominante. */}
          <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.25)' }}>
            {heroMessages.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === heroMsgIndex ? '1rem' : '0.375rem',
                  backgroundColor: i === heroMsgIndex ? '#F4C430' : 'rgba(255, 255, 255, 0.35)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 28) === space-y-12 → space-y-8 :
          resserre l'écart entre le bandeau de confiance et "Comment ça
          marche ?", jugé trop vide sur la capture de référence. */}
      <div className="space-y-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* === AMÉLIORATION AJOUTÉE (Phase 25 — fidélité à la capture
          fournie) === Retour à une carte à bordure/ombre (Phase 17), icône
          rond plein (fond bleu, glyphe blanc) à gauche du texte plutôt
          qu'icône pâle centrée au-dessus (Phase 23) — taille d'icône
          reprise précisément de la capture (rond de 36px, glyphe de 16px). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <div className="p-5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_confidentiality_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_confidentiality_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <UserX className="w-4 h-4" />
          </span>
          <div>
            <div className="font-bold text-slate-900 text-sm">{t.hero_feature_anonymity_title}</div>
            <div className="text-xs text-slate-500">{t.hero_feature_anonymity_desc}</div>
          </div>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <HeartHandshake className="w-4 h-4" />
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
