import React from 'react';
import {
  ShieldCheck,
  UserX,
  HeartHandshake,
  ChevronRight,
  ArrowRight,
  Send,
  Search,
  Lock,
  CheckCircle2,
  FileText,
  // === AMÉLIORATION AJOUTÉE (icônes plus fines et modernes) ===
  EyeOff,
  KeyRound,
  MessagesSquare,
  BadgeCheck,
  PenLine,
  RotateCw,
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (effet « ralenti » au défilement) ===
import { useScrollMotion } from '../hooks/useScrollMotion';
// === AMÉLIORATION AJOUTÉE (vitrine de confiance animée) ===
import { UserCheck, Clock3 } from 'lucide-react';

// === AMÉLIORATION AJOUTÉE (cartes "Comment ça marche ?" à effet flip 3D)
// === Sur demande explicite : chaque carte pivote à 180° au clic/tap pour
// révéler une explication plus détaillée au dos, avec un bouton "← Retour".
// Technique CSS `backface-visibility` + `transform-style: preserve-3d` +
// `rotateY(180deg)`, standard et sans dépendance — la face avant reprend
// EXACTEMENT le balisage/classes d'origine (dimensions, couleurs, icône,
// typographie, survol), seule la face arrière est nouvelle. Les deux
// faces partagent la même cellule de grille (`[grid-area:1/1]`) plutôt
// qu'un positionnement `absolute` : le conteneur s'ajuste naturellement à
// la plus haute des deux faces, sans mesure JS ni saut de mise en page,
// et reste responsive à toutes les tailles d'écran par construction.
interface HowItWorksCardProps {
  idx: number;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  toneClass: string;
  category: string;
  backTitle: string;
  backDesc: string;
  backButtonLabel: string;
  // === AMÉLIORATION AJOUTÉE : « Étape n · catégorie » traduit par l'appelant ===
  stepLabel?: string;
  // === AMÉLIORATION AJOUTÉE (design modernisé) === teinte pleine qui se
  // fond sur la tuile d'icône au survol, et mention « En savoir plus » qui
  // signale que la carte se retourne.
  toneSolidClass?: string;
  flipHint?: string;
  // === AMÉLIORATION AJOUTÉE (cartes colorées — proposition 2) === couleur
  // du pictogramme (sur tuile blanche) et de l'étiquette d'étape.
  toneTextClass?: string;
  toneChipClass?: string;
}

function HowItWorksCard({ idx, Icon, title, desc, toneClass, category, backTitle, backDesc, backButtonLabel, stepLabel = `Étape ${idx + 1} · ${category}`, toneSolidClass = 'bg-gradient-to-br from-blue-500 to-blue-700', flipHint, toneTextClass = 'text-blue-600', toneChipClass = 'bg-blue-50 text-blue-700' }: HowItWorksCardProps) {
  const [flipped, setFlipped] = React.useState(false);

  return (
    <div
      className="group [perspective:1200px] cursor-pointer h-full"
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div
        className="grid h-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Face avant
            === AMÉLIORATION AJOUTÉE (cartes colorées — proposition 2) ===
            Sur demande explicite (les bulles « manquaient quelque chose ») :
            bandeau de couleur en tête avec le numéro d'étape en grand
            filigrane et le pictogramme sur tuile blanche, puis l'étiquette
            « Étape n · catégorie », le titre, le texte et « En savoir plus »
            aligné en bas. Retournement au clic inchangé. */}
        <div className="[grid-area:1/1] h-full [backface-visibility:hidden] bg-white rounded-2xl overflow-hidden border border-slate-200/70 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_14px_34px_-22px_rgb(15_23_42/0.4)] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgb(15_23_42/0.04),0_26px_50px_-18px_rgb(15_23_42/0.35)]">
          <div className={`relative h-[104px] p-5 ${toneSolidClass}`}>
            <span aria-hidden="true" className="absolute right-4 -top-2 text-[96px] font-extrabold leading-none tracking-[-0.05em] text-white/20 tabular-nums select-none transition-transform duration-500 group-hover:-translate-y-1">
              {idx + 1}
            </span>
            <span className={`relative w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-[0_10px_20px_-12px_rgb(15_23_42/0.6)] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-105 ${toneTextClass}`}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-2 p-5 pt-4">
            <span className={`self-start px-2.5 py-1 rounded-full text-[11px] font-bold ${toneChipClass}`}>{stepLabel}</span>
            <h4 className="font-bold text-[#12305F] text-base tracking-tight">{title}</h4>
            <p className="text-[13px] text-slate-500 leading-relaxed flex-1">{desc}</p>
            {flipHint && (
              <span className={`inline-flex items-center gap-1.5 pt-1 text-xs font-semibold ${toneTextClass}`}>
                {flipHint}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </span>
            )}
          </div>
        </div>

        {/* Face arrière */}
        <div
          className="[grid-area:1/1] h-full [backface-visibility:hidden] bg-gradient-to-br from-white to-blue-50/60 p-6 rounded-2xl border border-blue-100 shadow-[0_10px_28px_-14px_rgb(37_99_235/0.25)] flex flex-col gap-2"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            {stepLabel}
          </span>
          <h4 className="font-bold text-slate-900 text-sm">{backTitle}</h4>
          <p className="text-xs text-slate-600 leading-relaxed flex-1 text-justify">{backDesc}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
            }}
            className="self-start px-3 py-1.5 rounded-full bg-white text-blue-700 text-xs font-semibold ring-1 ring-blue-200 hover:bg-blue-600 hover:text-white hover:ring-blue-600 transition-all duration-300"
          >
            {backButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// === AMÉLIORATION AJOUTÉE (vitrine de confiance animée, côté droit du haut
// de page) === Sur demande explicite : les garanties s'affichent l'une après
// l'autre, en boucle. Un emblème bouclier (ondes lumineuses, orbite lente)
// change d'icône à chaque étape ; dessous, une carte présente la garantie en
// cours avec une barre de progression, et des points permettent d'en choisir
// une. Pause au survol ; si l'utilisateur limite les animations, toutes les
// garanties s'affichent en liste, sans défilement.
interface TrustItem {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  live?: boolean;
}

function HeroTrustShowcase({ items, liveLabel }: { items: TrustItem[]; liveLabel: string }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const reduced = React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const STEP_MS = 3800;
  React.useEffect(() => {
    if (reduced || paused) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % items.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, items.length]);

  if (reduced) {
    return (
      <ul className="space-y-3">
        {items.map(({ Icon, title, desc }) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/95 p-4 shadow-lg">
            <span className="w-10 h-10 rounded-xl bg-[#1449B0] text-white flex items-center justify-center shrink-0"><Icon className="w-5 h-5" strokeWidth={1.9} /></span>
            <div><div className="text-sm font-bold text-[#0B2545]">{title}</div><div className="text-xs text-slate-600 mt-0.5">{desc}</div></div>
          </li>
        ))}
      </ul>
    );
  }

  const current = items[index];
  const CurrentIcon = current.Icon;
  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      {/* Emblème : ondes lumineuses + orbite + icône de la garantie en cours */}
      <div className="relative w-56 h-56 flex items-center justify-center" aria-hidden="true">
        <span className="activa-ripple absolute inset-6 rounded-full border-2 border-white/40" />
        <span className="activa-ripple absolute inset-6 rounded-full border-2 border-white/40" style={{ animationDelay: '1.2s' }} />
        <span className="activa-ripple absolute inset-6 rounded-full border-2 border-white/40" style={{ animationDelay: '2.4s' }} />
        <span className="activa-orbit absolute inset-0 rounded-full border border-dashed border-white/30">
          <span className="absolute -top-1.5 left-1/2 -ml-1.5 w-3 h-3 rounded-full bg-[#7FBC0A] shadow-[0_0_14px_4px_rgb(127_188_10/0.6)]" />
          <span className="absolute top-1/2 -right-1 -mt-1 w-2 h-2 rounded-full bg-white/80" />
        </span>
        <span className="relative w-32 h-32 rounded-[2rem] bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-md ring-1 ring-inset ring-white/40 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] flex items-center justify-center">
          <span key={index} className="activa-trust-pop w-20 h-20 rounded-2xl bg-white text-[#1449B0] flex items-center justify-center shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)]">
            <CurrentIcon className="w-10 h-10" strokeWidth={1.8} />
          </span>
        </span>
      </div>

      {/* Carte de la garantie en cours */}
      <div className="relative mt-6 w-full max-w-[420px] min-h-[132px]">
        <div key={index} className="activa-trust-in rounded-2xl bg-white p-5 pr-6 shadow-[0_30px_60px_-28px_rgb(0_0_0/0.6)]">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-xl bg-[#1449B0] text-white flex items-center justify-center shrink-0 shadow-[0_8px_18px_-8px_rgb(20_73_176/0.9)]">
              <CurrentIcon className="w-5 h-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#0B2545]">{current.title}</span>
                {current.live && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <span className="activa-live-dot w-2 h-2 rounded-full bg-emerald-500" />
                    {liveLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">{current.desc}</p>
            </div>
          </div>
          <div className="mt-4 h-1 rounded-full bg-slate-100 overflow-hidden">
            <span
              className="activa-trust-progress block h-full rounded-full bg-gradient-to-r from-[#1449B0] to-[#5A86DD]"
              style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
            />
          </div>
        </div>
      </div>

      {/* Points de navigation */}
      <div className="mt-5 flex items-center gap-2">
        {items.map((it, i) => (
          <button
            key={it.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={it.title}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
          />
        ))}
      </div>
    </div>
  );
}

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
  // === AMÉLIORATION AJOUTÉE (effet « ralenti » au défilement) === voir useScrollMotion.ts
  const motionRootRef = React.useRef<HTMLDivElement>(null);
  useScrollMotion(motionRootRef);

  // === AMÉLIORATION AJOUTÉE (retrait de la carte de valeurs flottante) ===
  // Carte "Transparence / Une culture d'ouverture" (et les 3 autres
  // messages défilants qu'elle affichait tour à tour) retirée du hero de
  // l'accueil public, sur demande explicite de l'utilisateur.

  return (
    <div ref={motionRootRef} className="space-y-8 pb-6">
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
      {/* === AMÉLIORATION AJOUTÉE (photo de fond lente à l'affichage) ===
          BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur (photo lente à
          l'affichage après déconnexion — cette page est la destination
          publique naturelle). `bg-slate-100` évite un flash blanc/vide
          pendant le chargement ; `fetchPriority="high"` + `decoding="async"`
          sur l'image, combinés au préchargement ajouté dans index.html,
          accélèrent son affichage réel. */}
      {/* === AMÉLIORATION AJOUTÉE (design modernisé — hero animé) ===
          Entrée orchestrée au chargement : la photo se pose (léger dézoom),
          puis le texte apparaît ligne par ligne, la barre d'accent se trace
          et les valeurs glissent depuis la droite (classes `activa-*` dans
          index.css, désactivées si l'utilisateur limite les animations).
          Marge basse agrandie : le bandeau de confiance vient désormais
          chevaucher le bas de la photo. */}
      {/* === AMÉLIORATION AJOUTÉE (accueil — version « B » retenue) ===
          Sur demande explicite (maquette B choisie) : voile bleu marine sur
          toute la photo, texte blanc centré, libellé « Canal de gestion des
          alertes du Groupe ACTIVA » en surtitre. Les valeurs du Groupe ne
          sont plus affichées sur l'accueil (demande explicite). */}
      {/* === AMÉLIORATION AJOUTÉE (haut de page sans photo — proposition 2
          retenue) === Sur demande explicite : fond bleu ACTIVA net sur tous
          les écrans (dégradé + grands cercles décoratifs), texte aligné à
          gauche, et à droite la vitrine de confiance animée (garanties en
          boucle). La photo du siège n'est plus affichée ici ; les images
          restent dans public/brand. Boutons, `id` et actions inchangés. */}
      <div className="relative overflow-hidden bg-[radial-gradient(1200px_700px_at_85%_10%,#2B63D6_0%,#1449B0_45%,#0D357F_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border-2"
              style={{ right: `${-260 + i * 85}px`, top: `${-120 + i * 85}px`, width: `${900 - i * 170}px`, height: `${900 - i * 170}px`, borderColor: `rgb(255 255 255 / ${0.08 + i * 0.03})` }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-10 lg:px-14 pt-14 pb-36 sm:pt-20 sm:pb-40 lg:pt-20 lg:pb-44 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div className="activa-parallax-text max-w-2xl">
            <p className="activa-enter text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] leading-relaxed text-[#C9DAF8]" style={{ '--d': '100ms' } as React.CSSProperties}>
              <span aria-hidden="true" className="activa-pulse-dot inline-block align-middle w-2 h-2 rounded-full bg-white mr-2.5 -mt-0.5" />
              {t.hero_eyebrow}
            </p>

            <h1 className="mt-5 text-[40px] sm:text-6xl lg:text-[64px] xl:text-[72px] font-extrabold tracking-[-0.035em] leading-[1.04] text-white">
              <span className="activa-enter block" style={{ '--d': '200ms' } as React.CSSProperties}>{t.hero_headline_line1}</span>
              <span className="activa-enter block pb-1" style={{ '--d': '300ms' } as React.CSSProperties}>{t.hero_headline_line2}</span>
            </h1>

            <p className="activa-enter mt-5 text-lg sm:text-xl text-[#DCE7FA] leading-relaxed max-w-xl" style={{ '--d': '520ms' } as React.CSSProperties}>
              {t.hero_desc_line1}{' '}{t.hero_desc_line2}{' '}
              <span className="font-bold text-white">{t.hero_desc_cta}</span>
            </p>

            <div className="activa-enter mt-8 flex flex-col sm:flex-row sm:items-center gap-3" style={{ '--d': '620ms' } as React.CSSProperties}>
              <button
                id="hero-btn-new-alert"
                onClick={onStartNewAlert}
                className="activa-shine group flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-[#0F3C93] hover:bg-[#0C3176] ring-1 ring-inset ring-white/15 text-white font-bold text-[15px] sm:text-base shadow-[0_14px_28px_-14px_rgb(0_0_0/0.7)] hover:-translate-y-0.5 transition-all duration-300 ease-out whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                <span>{t.btn_new_alert}</span>
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </button>

              <button
                id="hero-btn-track"
                onClick={onGoToTrack}
                className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-white hover:bg-[#F1F5FD] text-[#1449B0] font-bold text-[15px] sm:text-base shadow-[0_14px_28px_-16px_rgb(0_0_0/0.55)] hover:-translate-y-0.5 transition-all duration-300 ease-out whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
              >
                <Search className="w-4 h-4" strokeWidth={1.75} />
                <span>{t.btn_track_existing}</span>
              </button>
            </div>

            <p className="activa-enter mt-6 text-sm sm:text-base font-medium text-white" style={{ '--d': '720ms' } as React.CSSProperties}>
              <Lock className="inline-block align-[-3px] w-4 h-4 mr-2 text-white" strokeWidth={2} />
              {t.hero_anonymous_note}
            </p>
          </div>

          <div className="activa-enter hidden lg:block" style={{ '--d': '500ms' } as React.CSSProperties}>
            <HeroTrustShowcase
              liveLabel={t.hero_trust_live}
              items={[
                { Icon: ShieldCheck, title: t.hero_trust_1_title, desc: t.hero_trust_1_desc },
                { Icon: EyeOff, title: t.hero_trust_2_title, desc: t.hero_trust_2_desc },
                { Icon: UserCheck, title: t.hero_trust_3_title, desc: t.hero_trust_3_desc },
                { Icon: KeyRound, title: t.hero_trust_4_title, desc: t.hero_trust_4_desc },
                { Icon: Clock3, title: t.hero_trust_5_title, desc: t.hero_trust_5_desc, live: true },
              ]}
            />
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
          reprise précisément de la capture (rond de 36px, glyphe de 16px).
          === AMÉLIORATION AJOUTÉE (éclat + réaction au survol des bulles)
          === sur demande explicite de l'utilisateur : dégradé + ombre
          portée colorée (au lieu du bleu plat d'origine) pour plus d'éclat.
          === AMÉLIORATION AJOUTÉE (réaction de toute la bulle, pas
          seulement l'icône) === précision explicite de l'utilisateur : la
          réaction au survol (mise à l'échelle de l'icône + fond légèrement
          teinté) se déclenche désormais en survolant N'IMPORTE OÙ sur toute
          la carte (icône + texte, via `group`/`group-hover`), pas
          uniquement en pointant précisément l'icône.
          === AMÉLIORATION AJOUTÉE (réaction plus marquée de chaque bande)
          === précision explicite de l'utilisateur : le fond légèrement
          teinté seul passait pour "seule l'icône réagit" — chaque bande se
          soulève désormais (`hover:-translate-y-1`) avec une ombre propre
          (`hover:shadow-md`), même traitement que les cartes "Comment ça
          marche ?" ci-dessous ; `relative z-10` évite que l'ombre soit
          coupée par les séparateurs du conteneur. */}
      {/* === AMÉLIORATION AJOUTÉE (design modernisé — bandeau de confiance
          en verre) === Le bandeau chevauche le bas de la photo du hero
          (verre dépoli, ombre portée ample). Tuiles d'icône « squircle »
          dont la teinte pleine se fond au survol ; icône Anonymat plus
          parlante (œil barré). Soulèvement + ombre au survol de chaque
          bande conservés. */}
      {/* === AMÉLIORATION AJOUTÉE (couleurs ACTIVA — variante « tout bleu »)
          === Les trois garanties prennent le bleu ACTIVA (#1449B0).
          === AMÉLIORATION AJOUTÉE (bulles « cartes colorées » — proposition 2)
          === Sur demande explicite : chaque garantie a sa propre couleur
          (bleu, violet, vert) sur la tuile d'icône et un trait de couleur
          sous le bloc. Mêmes textes, même chevauchement de la photo, même
          réaction au survol (soulèvement, teinte pleine qui se fond). */}
      <div
        className="activa-enter relative z-20 -mt-[4.5rem] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_24px_60px_-26px_rgb(15_23_42/0.45)]"
        style={{ '--d': '820ms' } as React.CSSProperties}
      >
        {[
          { Icon: ShieldCheck, title: t.hero_feature_confidentiality_title, desc: t.hero_feature_confidentiality_desc, tile: 'bg-[#1449B0] text-white ring-[#1449B0] shadow-[0_8px_18px_-10px_rgb(20_73_176/0.9)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
          { Icon: EyeOff, title: t.hero_feature_anonymity_title, desc: t.hero_feature_anonymity_desc, tile: 'bg-[#1449B0] text-white ring-[#1449B0] shadow-[0_8px_18px_-10px_rgb(20_73_176/0.9)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
          { Icon: HeartHandshake, title: t.hero_feature_no_retaliation_title, desc: t.hero_feature_no_retaliation_desc, tile: 'bg-[#1449B0] text-white ring-[#1449B0] shadow-[0_8px_18px_-10px_rgb(20_73_176/0.9)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
        ].map(({ Icon, title, desc, tile, solid, bar }, i) => (
          <div
            key={title}
            data-reveal
            style={{ '--rd': `${i * 110}ms` } as React.CSSProperties}
            className="group relative z-0 hover:z-10 p-5 sm:p-6 flex items-start gap-4 rounded-2xl transition-all duration-300 ease-out hover:bg-white hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/5"
          >
            <span className={`relative overflow-hidden w-11 h-11 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 transition-all duration-500 ease-out group-hover:text-white group-hover:scale-105 group-hover:shadow-lg ${tile}`}>
              <span aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${solid}`} />
              <Icon className="relative w-5 h-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-bold text-[#12305F] text-sm sm:text-[15px] tracking-tight">{title}</div>
              <div className="mt-0.5 text-xs sm:text-[13px] text-slate-500 leading-relaxed">{desc}</div>
            </div>
            <span aria-hidden="true" className={`absolute left-6 right-6 bottom-0 h-[3px] rounded-t-full ${bar}`} />
          </div>
        ))}
      </div>

      {/* "Comment ça marche ?" — cartes à coins nets, libellé de l'étape 4
          et sous-titre alignés sur la maquette adoptée (Phase 17). */}
      <div id="how-it-works-section" className="space-y-6 pt-4">
        {/* === AMÉLIORATION AJOUTÉE (design modernisé) === apparition au
            défilement (navigateurs compatibles, sinon simplement visible). */}
        <div data-reveal className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-[0.16em] text-[#1449B0]">
            {t.process_label}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {t.process_heading}
            </h3>
            <button
              onClick={onGoToFaq}
              className="group flex items-center gap-1.5 px-3.5 py-2 -mx-1 rounded-full text-sm font-semibold text-[#1449B0] hover:bg-[#EAF0FA] transition-colors shrink-0"
            >
              {t.process_view_faq}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">{t.process_subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: PenLine, title: t.process_step1_title, desc: t.process_step1_desc, tone: 'blue' as const,
              category: t.process_step1_category, backTitle: t.process_step1_back_title, backDesc: t.process_step1_back_desc,
            },
            {
              icon: KeyRound, title: t.process_step2_title, desc: t.process_step2_desc, tone: 'amber' as const,
              category: t.process_step2_category, backTitle: t.process_step2_back_title, backDesc: t.process_step2_back_desc,
            },
            {
              icon: MessagesSquare, title: t.process_step3_title, desc: t.process_step3_desc, tone: 'purple' as const,
              category: t.process_step3_category, backTitle: t.process_step3_back_title, backDesc: t.process_step3_back_desc,
            },
            {
              icon: BadgeCheck, title: t.process_step4_title, desc: t.process_step4_desc, tone: 'emerald' as const,
              category: t.process_step4_category, backTitle: t.process_step4_back_title, backDesc: t.process_step4_back_desc,
            },
          ].map((step, idx) => {
            // === AMÉLIORATION AJOUTÉE (éclat + réaction au survol des
            // bulles) === sur demande explicite de l'utilisateur : dégradé +
            // ombre portée colorée (par teinte) au lieu du fond plat
            // d'origine.
            // === AMÉLIORATION AJOUTÉE (réaction de toute la bulle, pas
            // seulement l'icône) === précision explicite de l'utilisateur :
            // `group-hover` (déclenché par le survol de la carte entière
            // ci-dessous), plus `hover:` local — même traitement que les 3
            // bulles Confidentialité/Anonymat/Pas de représailles ci-dessus.
            // === AMÉLIORATION AJOUTÉE (design modernisé) === tuile claire
            // au repos ; la teinte pleine (`toneSolid`) se fond au survol.
            const toneClasses: Record<string, string> = {
              blue: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 ring-1 ring-inset ring-blue-200/70 group-hover:shadow-lg group-hover:shadow-blue-500/30',
              amber: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 ring-1 ring-inset ring-amber-200/70 group-hover:shadow-lg group-hover:shadow-amber-500/30',
              purple: 'bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 ring-1 ring-inset ring-violet-200/70 group-hover:shadow-lg group-hover:shadow-violet-500/30',
              emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 ring-1 ring-inset ring-emerald-200/70 group-hover:shadow-lg group-hover:shadow-emerald-500/30',
            };
            const toneSolid: Record<string, string> = {
              blue: 'bg-gradient-to-br from-blue-500 to-blue-700',
              amber: 'bg-gradient-to-br from-amber-400 to-orange-500',
              purple: 'bg-gradient-to-br from-violet-500 to-purple-700',
              emerald: 'bg-gradient-to-br from-emerald-500 to-teal-600',
            };
            // === AMÉLIORATION AJOUTÉE (cartes colorées — proposition 2) ===
            // === AMÉLIORATION AJOUTÉE (couleurs ACTIVA — variante « tout bleu »
            // retenue) === nuances du bleu du logo ACTIVA (#1449B0), de la plus
            // claire (étape 1) à la plus profonde (étape 4).
            const toneText: Record<string, string> = { blue: 'text-[#1449B0]', amber: 'text-[#1449B0]', purple: 'text-[#1449B0]', emerald: 'text-[#1449B0]' };
            const toneChip: Record<string, string> = { blue: 'bg-[#EAF0FA] text-[#1449B0]', amber: 'bg-[#EAF0FA] text-[#1449B0]', purple: 'bg-[#EAF0FA] text-[#1449B0]', emerald: 'bg-[#EAF0FA] text-[#1449B0]' };
            const activaBand: Record<string, string> = {
              blue: 'bg-gradient-to-br from-[#3A6FC4] to-[#1449B0]',
              amber: 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93]',
              purple: 'bg-gradient-to-br from-[#1449B0] to-[#173B7A]',
              emerald: 'bg-gradient-to-br from-[#0F3C93] to-[#12305F]',
            };
            return (
              <div key={idx} data-reveal className="h-full" style={{ '--rd': `${idx * 120}ms` } as React.CSSProperties}>
              <HowItWorksCard
                idx={idx}
                Icon={step.icon}
                title={step.title}
                desc={step.desc}
                toneClass={toneClasses[step.tone]}
                category={step.category}
                backTitle={step.backTitle}
                backDesc={step.backDesc}
                backButtonLabel={t.process_back_button}
                stepLabel={t.home_step_category.replace('{n}', String(idx + 1)).replace('{category}', step.category)}
                toneSolidClass={activaBand[step.tone]}
                flipHint={t.process_flip_hint}
                toneTextClass={toneText[step.tone]}
                toneChipClass={toneChip[step.tone]}
              />
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
