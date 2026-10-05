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
}

function HowItWorksCard({ idx, Icon, title, desc, toneClass, category, backTitle, backDesc, backButtonLabel, stepLabel = `Étape ${idx + 1} · ${category}`, toneSolidClass = 'bg-gradient-to-br from-blue-500 to-blue-700', flipHint }: HowItWorksCardProps) {
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
            === AMÉLIORATION AJOUTÉE (design modernisé) === coins arrondis,
            ombre douce en deux couches, tuile d'icône « squircle » dont la
            teinte pleine se fond au survol, icône au trait fin (1,75),
            numéro d'étape discret et mention « En savoir plus » (la carte
            se retourne au clic). Comportement inchangé. */}
        <div className="[grid-area:1/1] h-full [backface-visibility:hidden] bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_10px_28px_-14px_rgb(15_23_42/0.14)] flex flex-col gap-3 transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_2px_4px_rgb(15_23_42/0.04),0_26px_50px_-18px_rgb(37_99_235/0.32)]">
          <div className="flex items-start justify-between">
            <span className={`relative overflow-hidden w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ease-out group-hover:-rotate-3 group-hover:scale-105 group-hover:text-white ${toneClass}`}>
              <span aria-hidden="true" className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${toneSolidClass}`} />
              <Icon className="relative w-[22px] h-[22px]" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-slate-300 transition-colors duration-300 group-hover:text-slate-400">
              {String(idx + 1).padStart(2, '0')}
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-[15px] tracking-tight pt-1">{title}</h4>
          <p className="text-xs text-slate-600 leading-relaxed flex-1">{desc}</p>
          {flipHint && (
            <span className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-400 transition-colors duration-300 group-hover:text-blue-600">
              <RotateCw className="w-3.5 h-3.5 transition-transform duration-700 ease-out group-hover:rotate-180" strokeWidth={2} />
              {flipHint}
            </span>
          )}
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
      <div className="relative overflow-hidden min-h-[440px] sm:min-h-[520px] flex items-center bg-slate-100">
        {/* === AMÉLIORATION AJOUTÉE (parallaxe) === la photo glisse plus lentement que la page. */}
        <div className="activa-parallax-img absolute inset-0">
        <img
          src="/brand/activa-hq-hero.jpg"
          alt={t.home_hero_img_alt}
          fetchPriority="high"
          decoding="async"
          className="activa-kenburns absolute inset-0 w-full h-full object-cover object-right sm:object-[75%_45%]"
        />
        </div>
        {/* Voile doux blanc pour garantir la parfaite lisibilité des textes tout en respectant les teintes de la photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/35 to-transparent pointer-events-none" />

        {/* === AMÉLIORATION AJOUTÉE (voile sombre côté droit, bandeau de
            valeurs) === Sur demande explicite : le bandeau de valeurs flotte
            directement sur la photo (sans fond propre — essai avec carte à
            fond flouté explicitement écarté), donc ce voile porte seul sa
            lisibilité. N'affecte pas le voile blanc du texte principal à
            gauche. Masqué sous `lg`, comme le panneau lui-même. */}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/55 via-slate-900/10 to-transparent pointer-events-none hidden lg:block" />

        {/* === AMÉLIORATION AJOUTÉE (bandeau de valeurs flottant, côté droit
            du hero) === Sur demande explicite : texte fin (`font-light`, pas
            gras) posé directement sur la photo, sans fond ni carte.
            === AMÉLIORATION AJOUTÉE (effet flottant au survol) === Sur
            demande explicite : chaque ligne de valeur flotte
            individuellement au survol (léger soulèvement + ombre portée),
            pas le bandeau entier — la transformation est posée directement
            sur chaque `<li>`, donc seule la ligne survolée bouge (pas de
            fond ajouté, juste une transition douce). */}
        <div className="hidden lg:flex flex-col gap-3 absolute right-10 xl:right-20 top-1/2 -translate-y-1/2 z-10 text-white max-w-[220px]">
          <ul className="space-y-2.5">
            {[t.hero_value_1, t.hero_value_2, t.hero_value_3, t.hero_value_4, t.hero_value_5].map((value, i) => (
              // === AMÉLIORATION AJOUTÉE (design modernisé) === entrée
              // décalée sur le <li>, effet flottant au survol conservé sur
              // le texte (une animation terminée bloquerait sinon le survol).
              <li key={value} className="activa-enter-x" style={{ '--d': `${450 + i * 90}ms` } as React.CSSProperties}>
                <span className="inline-block text-xs xl:text-sm font-light tracking-[0.2em] uppercase leading-snug transition-transform duration-300 ease-out hover:-translate-y-1 hover:drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)]">
                  {value}
                </span>
              </li>
            ))}
          </ul>
          <div className="activa-draw-x w-10 h-0.5 rounded-full bg-blue-400" style={{ '--d': '950ms' } as React.CSSProperties} />
          <p className="activa-enter-x text-xs font-light text-white/90 leading-snug" style={{ '--d': '1000ms' } as React.CSSProperties}>{t.hero_values_caption}</p>
        </div>

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
        <div className="relative z-10 px-8 pt-10 pb-24 sm:px-12 sm:pt-12 sm:pb-28 lg:pl-[calc((100vw-80rem)/2+2rem)]">
          <div className="activa-parallax-text max-w-xl space-y-5">
            {/* === AMÉLIORATION AJOUTÉE (ligne unique nom de produit + accroche) ===
                Sur demande explicite, alignée sur la capture de référence
                fournie : "activa-whistleblowing" + "Canal éthique du Groupe
                ACTIVA" (mêmes textes, `hero_title`/`hero_eyebrow`) tiennent
                sur une seule ligne, séparés par un point médian, dans leur
                casse naturelle (un essai en minuscules a été tenté puis
                abandonné au profit de cette capture de référence). Espace
                resserré avant le titre via `-mt-1` sur le titre ci-dessous. */}
            {/* === AMÉLIORATION AJOUTÉE (palette premium finale, sans halo)
                === Sur demande explicite, palette : #082B52/Bold (nom de
                marque), `blue-800` #1e40af/Medium (point médian),
                `blue-900` #1e3a8a/Regular (accroche). Le halo blanc
                (`text-shadow`) ajouté à une itération précédente pour
                renforcer la lisibilité est entièrement retiré (nom de
                marque compris) : il donnait une impression de "reflet"/
                police changée signalée par l'utilisateur, plutôt que de
                l'améliorer — la lisibilité repose désormais uniquement sur
                des teintes suffisamment foncées. Identique sur mobile et
                web (même composant, pas de variante distincte). */}
            <p className="activa-enter text-base" style={{ '--d': '100ms' } as React.CSSProperties}>
              {/* === AMÉLIORATION AJOUTÉE (design modernisé) === point
                  pulsé : canal actif et sécurisé. */}
              <span aria-hidden="true" className="activa-pulse-dot inline-block align-middle w-2 h-2 rounded-full bg-blue-600 mr-2.5 -mt-0.5" />
              <span className="font-bold text-[#082B52]">{t.hero_title}</span>
              <span className="font-medium text-blue-800">{' '}·{' '}</span>
              <span className="font-normal text-blue-900">{t.hero_eyebrow}</span>
            </p>

            {/* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle fourni) ===
                Titre en deux lignes bicolores, comme sur la maquette de
                référence, à la place du nom de produit utilisé jusqu'ici. */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.02em] leading-[1.05] -mt-1">
              <span className="activa-enter block text-[#0B2545]" style={{ '--d': '200ms' } as React.CSSProperties}>{t.hero_headline_line1}</span>
              <span className="activa-enter block bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 bg-clip-text text-transparent pb-1" style={{ '--d': '300ms' } as React.CSSProperties}>{t.hero_headline_line2}</span>
            </h1>

            {/* === AMÉLIORATION AJOUTÉE (barre d'accent sous le titre) ===
                Sur demande explicite, capture de référence à respecter. */}
            <div className="activa-draw-x w-12 h-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-400 -mt-2" style={{ '--d': '480ms' } as React.CSSProperties} />

            {/* === AMÉLIORATION AJOUTÉE (garder "Parlez-en. Nous vous
                écoutons." sur une seule ligne) === Sur demande explicite :
                `whitespace-nowrap` sur l'appel à l'action final seul (la
                question s'enroule normalement au-dessus) — un simple espace
                insécable aurait laissé le navigateur couper au trait
                d'union existant de "Parlez-en".
                === AMÉLIORATION AJOUTÉE (retour à la ligne forcé avant "à
                l'éthique") === Sur demande explicite : `<br />` entre les 2
                lignes de la question, pour que "à l'éthique ou à la
                réglementation ?" retombe toujours sur sa propre ligne. */}
            <p className="activa-enter text-base sm:text-lg font-semibold text-slate-800 leading-snug max-w-md" style={{ '--d': '520ms' } as React.CSSProperties}>
              {t.hero_desc_line1}
              <br />
              {t.hero_desc_line2}{' '}
              <span className="whitespace-nowrap">{t.hero_desc_cta}</span>
            </p>

            {/* === AMÉLIORATION AJOUTÉE (réaction plus marquée des boutons du
                hero) === sur demande explicite de l'utilisateur : le simple
                changement de couleur au survol passait inaperçu — ajout
                d'un léger soulèvement (`hover:-translate-y-0.5`) et d'une
                ombre plus prononcée, même logique que les bandes
                Confidentialité/Anonymat/Pas de représailles ci-dessous. */}
            {/* === AMÉLIORATION AJOUTÉE (design modernisé) === bouton
                principal en dégradé avec reflet au survol et flèche qui
                avance ; bouton secondaire en verre dépoli. */}
            <div className="activa-enter flex flex-col sm:flex-row sm:items-center gap-3 pt-2" style={{ '--d': '620ms' } as React.CSSProperties}>
              <button
                id="hero-btn-new-alert"
                onClick={onStartNewAlert}
                className="activa-shine group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-0.5 transition-all duration-300 ease-out whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                <span>{t.btn_new_alert}</span>
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </button>

              <button
                id="hero-btn-track"
                onClick={onGoToTrack}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/80 hover:bg-white backdrop-blur-md text-slate-800 font-semibold text-xs sm:text-sm border border-white/70 ring-1 ring-slate-900/10 hover:ring-slate-900/20 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ease-out whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                <Search className="w-4 h-4" strokeWidth={1.75} />
                <span>{t.btn_track_existing}</span>
              </button>
            </div>

            {/* === AMÉLIORATION AJOUTÉE (lisibilité de la mention anonymat) ===
                Petit texte gris posé directement sur la photo du hero :
                contraste insuffisant. Sans pastille (demande utilisateur),
                option « 2 » retenue : bleu marine ACTIVA (#0B2545), très
                gras, un peu plus grand, sans halo. */}
            <p className="activa-enter flex items-center gap-2 pt-1 text-xs sm:text-sm font-extrabold text-[#0B2545]" style={{ '--d': '720ms' } as React.CSSProperties}>
              <Lock className="w-4 h-4 text-blue-700 shrink-0 drop-shadow-[0_0_3px_#fff]" strokeWidth={2} />
              {t.hero_anonymous_note}
            </p>
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
      <div
        className="activa-enter relative z-20 -mt-[5.5rem] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 rounded-2xl bg-white/85 backdrop-blur-xl ring-1 ring-slate-900/5 border border-white/70 shadow-[0_24px_60px_-24px_rgb(15_23_42/0.35)]"
        style={{ '--d': '820ms' } as React.CSSProperties}
      >
        {[
          { Icon: ShieldCheck, title: t.hero_feature_confidentiality_title, desc: t.hero_feature_confidentiality_desc },
          { Icon: EyeOff, title: t.hero_feature_anonymity_title, desc: t.hero_feature_anonymity_desc },
          { Icon: HeartHandshake, title: t.hero_feature_no_retaliation_title, desc: t.hero_feature_no_retaliation_desc },
        ].map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            data-reveal
            style={{ '--rd': `${i * 110}ms` } as React.CSSProperties}
            className="group relative z-0 hover:z-10 p-5 sm:p-6 flex items-center gap-4 rounded-2xl transition-all duration-300 ease-out hover:bg-white hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/5"
          >
            <span className="relative overflow-hidden w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200/70 flex items-center justify-center shrink-0 transition-all duration-500 ease-out group-hover:text-white group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-blue-600/30">
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <Icon className="relative w-5 h-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-bold text-slate-900 text-sm tracking-tight">{title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* "Comment ça marche ?" — cartes à coins nets, libellé de l'étape 4
          et sous-titre alignés sur la maquette adoptée (Phase 17). */}
      <div id="how-it-works-section" className="space-y-6 pt-4">
        {/* === AMÉLIORATION AJOUTÉE (design modernisé) === apparition au
            défilement (navigateurs compatibles, sinon simplement visible). */}
        <div data-reveal className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-[0.16em] text-blue-600">
            {t.process_label}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {t.process_heading}
            </h3>
            <button
              onClick={onGoToFaq}
              className="group flex items-center gap-1.5 px-3.5 py-2 -mx-1 rounded-full text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors shrink-0"
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
                toneSolidClass={toneSolid[step.tone]}
                flipHint={t.process_flip_hint}
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
