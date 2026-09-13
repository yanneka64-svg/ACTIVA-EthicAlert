import React, { useRef, useState, useEffect } from 'react';
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
  Camera,
  RotateCcw,
  Upload,
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

  // === AMÉLIORATION AJOUTÉE (Phase 22, révisée Phase 25) ===
  // La carte affichait une seule valeur à la fois, en boucle toutes les 5
  // secondes. Sur nouvelle capture de référence montrant les 3 valeurs
  // affichées ensemble en permanence, revient à un affichage statique des
  // 3 lignes — la logique de rotation (état, minuteur) est retirée en
  // conséquence, elle n'a plus d'usage.
  const heroValues = [
    { icon: Shield, title: t.hero_value1_title, desc: t.hero_value1_desc },
    { icon: Users, title: t.hero_value2_title, desc: t.hero_value2_desc },
    { icon: Leaf, title: t.hero_value3_title, desc: t.hero_value3_desc },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [heroBg, setHeroBg] = useState<string>(() => {
    return localStorage.getItem('activa_custom_hero_bg') || '/brand/activa-hq.jpg';
  });
  const [isCustomBg, setIsCustomBg] = useState<boolean>(() => {
    return !!localStorage.getItem('activa_custom_hero_bg');
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        try {
          localStorage.setItem('activa_custom_hero_bg', result);
          setHeroBg(result);
          setIsCustomBg(true);
        } catch {
          // If localStorage is full, still display in memory
          setHeroBg(result);
          setIsCustomBg(true);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleResetBg = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem('activa_custom_hero_bg');
    setHeroBg('/brand/activa-hq.jpg');
    setIsCustomBg(false);
  };

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
      {/* Hero container with image drop support */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden border-b border-slate-200 min-h-[400px] sm:min-h-[460px] flex items-center transition-all ${
          isDragging ? 'ring-4 ring-blue-500 ring-inset bg-blue-50/20' : ''
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <img
          src={heroBg}
          alt="Siège du Groupe ACTIVA"
          className="absolute inset-0 w-full h-full object-cover object-right sm:object-[88%_center]"
          referrerPolicy="no-referrer"
        />
        {/* Voile doux blanc pour garantir la parfaite lisibilité des textes tout en respectant les teintes de la photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/35 to-transparent pointer-events-none" />

        {isDragging && (
          <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-xs flex items-center justify-center z-30 pointer-events-none">
            <div className="bg-white px-6 py-4 rounded-2xl shadow-xl border border-blue-200 flex items-center gap-3">
              <Upload className="w-6 h-6 text-blue-600 animate-bounce" />
              <span className="text-sm font-bold text-slate-800">
                Déposez votre photo ici pour l'appliquer en fond d'écran
              </span>
            </div>
          </div>
        )}

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

        {/* === AMÉLIORATION AJOUTÉE (Phase 25 — fidélité à la capture
            fournie) === Carte de valeurs statique : les 3 lignes
            (Intégrité/Transparence/Confiance) affichées ensemble en
            permanence, séparées par un fin trait, au lieu d'une rotation. */}
        <div className="hidden sm:block absolute top-6 right-6 z-10 w-64 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-4 space-y-3">
          {heroValues.map((v, i) => {
            const Icon = v.icon;
            return (
              <div key={i} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 border-t border-slate-100' : ''}`}>
                <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{v.title}</div>
                  <div className="text-xs text-slate-500">{v.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Phase 25) === bulle de citation avec
            fond opaque bleu marine à nouveau (remplace le fond transparent
            de la Phase 20, sur nouvelle capture de référence), avec le
            petit trait décoratif sous le texte comme sur la capture. */}
        <div className="hidden sm:flex flex-col absolute right-8 bottom-8 z-10 max-w-xs bg-[#0B2545]/95 text-white text-xs rounded-xl px-4 py-3 shadow-lg">
          <div className="flex items-start gap-2">
            <Quote className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{t.hero_quote}</span>
          </div>
          <div className="w-8 h-px bg-white/30 mt-2 ml-6" />
        </div>

        {/* Bouton discret pour changer la photo de fond ou glisser-déposer */}
        <div className="absolute left-6 bottom-3 sm:bottom-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-slate-700 hover:text-blue-700 text-xs font-semibold backdrop-blur-sm border border-slate-200/80 shadow-xs transition cursor-pointer"
            title="Sélectionnez votre fichier image ou glissez-le directement ici"
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>Changer la photo de fond</span>
          </button>
          {isCustomBg && (
            <button
              type="button"
              onClick={handleResetBg}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/85 hover:bg-white text-slate-500 hover:text-red-600 text-xs font-semibold backdrop-blur-sm border border-slate-200/80 shadow-xs transition cursor-pointer"
              title="Réinitialiser la photo"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          )}
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
