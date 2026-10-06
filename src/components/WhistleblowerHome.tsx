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
// === AMÉLIORATION AJOUTÉE (ligne d'assistance — trois canaux) ===
import { Phone as PhoneIcon, Mail as MailIcon, Send as SendIcon, MessageCircle as WhatsAppIcon } from 'lucide-react';

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
  // === AMÉLIORATION AJOUTÉE (canaux dans le carrousel) === bulle cliquable.
  href?: string;
  onClick?: () => void;
}

function HeroTrustShowcase({ items, liveLabel }: { items: TrustItem[]; liveLabel: string; trustItemsKept?: TrustItem[] }) {
  // === AMÉLIORATION AJOUTÉE (carrousel horizontal, droite → gauche) === sur
  // demande explicite : les garanties défilent latéralement. La carte active
  // est au centre, la suivante arrive par la droite, la précédente sort par
  // la gauche. Boucle infinie : la liste est rendue deux fois et l'on revient
  // sans transition à la première après la dernière.
  const n = items.length;
  const [pos, setPos] = React.useState(0);
  const [animate, setAnimate] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const reduced = React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const STEP_MS = 3800;
  const CARD = 280;
  const GAP = 16;
  React.useEffect(() => {
    if (reduced || paused) return;
    const id = window.setTimeout(() => {
      setAnimate(true);
      setPos((p) => p + 1);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [pos, paused, reduced]);
  // Retour invisible au début une fois la copie de la première carte atteinte.
  React.useEffect(() => {
    if (pos < n) return;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setPos(0);
    }, 820);
    return () => window.clearTimeout(id);
  }, [pos, n]);
  React.useEffect(() => {
    if (!animate) {
      const id = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [animate]);

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

  const index = pos % n;
  const CurrentIcon = items[index].Icon;
  const track = [...items, ...items];
  return (
    <div
      className="relative w-full min-w-0 flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      {/* Emblème : ondes lumineuses + orbite + icône de la garantie en cours */}
      <div className="relative w-36 h-36 flex items-center justify-center" aria-hidden="true">
        <span className="activa-ripple absolute inset-5 rounded-full border-2 border-white/40" />
        <span className="activa-ripple absolute inset-5 rounded-full border-2 border-white/40" style={{ animationDelay: '1.2s' }} />
        <span className="activa-ripple absolute inset-5 rounded-full border-2 border-white/40" style={{ animationDelay: '2.4s' }} />
        <span className="activa-orbit absolute inset-0 rounded-full border border-white/15">
          <span className="absolute -top-1.5 left-1/2 -ml-1.5 w-3 h-3 rounded-full bg-[#7FBC0A] shadow-[0_0_14px_4px_rgb(127_188_10/0.6)]" />
          <span className="absolute top-1/2 -right-1 -mt-1 w-2 h-2 rounded-full bg-white/80" />
        </span>
        <span className="relative w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-md ring-1 ring-inset ring-white/40 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] flex items-center justify-center">
          <span key={index} className="activa-trust-pop w-14 h-14 rounded-2xl bg-white text-[#1449B0] flex items-center justify-center shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)]">
            <CurrentIcon className="w-8 h-8" strokeWidth={1.8} />
          </span>
        </span>
      </div>

      {/* Carrousel : bulles qui glissent de droite à gauche */}
      <div className="relative mt-2 w-full overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
        <div
          className="flex"
          style={{
            gap: `${GAP}px`,
            paddingLeft: `calc(50% - ${CARD / 2}px)`,
            transform: `translateX(-${pos * (CARD + GAP)}px)`,
            transition: animate ? 'transform 800ms cubic-bezier(0.65, 0, 0.35, 1)' : 'none',
          }}
        >
          {track.map((it, i) => {
            const active = i === pos;
            const ItemIcon = it.Icon;
            return (
              <div
                key={`${it.title}-${i}`}
                className="relative shrink-0"
                style={{ width: `${CARD}px` }}
                aria-hidden={!active}
              >
                {/* === AMÉLIORATION AJOUTÉE (bulles v3 — taille, forme, contours) ===
                    sur demande explicite : bulles plus hautes et plus arrondies
                    (forme « tuile »), contour neutre, sans trame de points ni
                    queue. La bulle active est blanche ; les voisines sont en
                    verre dépoli, texte blanc. */}
                <div
                  className={`activa-bubble relative overflow-hidden rounded-[30px] p-6 min-h-[236px] flex flex-col backdrop-blur-xl transition-all duration-700 ${
                    active
                      ? 'bg-white ring-1 ring-slate-200/90 opacity-100 scale-100 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)]'
                      : 'bg-white/10 ring-1 ring-white/25 opacity-70 scale-[0.88] shadow-none'
                  }`}
                >
                  {/* === AMÉLIORATION AJOUTÉE (canaux cliquables) === la bulle
                      active ouvre le canal (formulaire, WhatsApp, e-mail). */}
                  {active && it.href && (
                    <a href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" aria-label={it.title} className="absolute inset-0 z-10 rounded-[30px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60" />
                  )}
                  {active && !it.href && it.onClick && (
                    <button type="button" onClick={it.onClick} aria-label={it.title} className="absolute inset-0 z-10 rounded-[30px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60" />
                  )}
                  {/* reflet doux en haut de la bulle */}
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${active ? 'from-[#EEF3FC]' : 'from-white/10'} to-transparent`} />
                  <span
                    className={`relative w-14 h-14 rounded-[18px] flex items-center justify-center transition-colors duration-700 ${
                      active
                        ? 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white shadow-[0_14px_28px_-12px_rgb(20_73_176/0.95)]'
                        : 'bg-white/15 text-white'
                    }`}
                  >
                    <ItemIcon className="w-7 h-7" strokeWidth={1.7} />
                  </span>
                  <div className="relative mt-5 flex items-center gap-2 flex-wrap">
                    <span className={`text-[19px] leading-tight font-extrabold tracking-tight ${active ? 'text-[#0B2545]' : 'text-white'}`}>{it.title}</span>
                    {it.live && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        <span className="activa-live-dot w-2 h-2 rounded-full bg-emerald-500" />
                        {liveLabel}
                      </span>
                    )}
                  </div>
                  <p className={`relative mt-2 text-[14px] leading-relaxed break-words ${active ? 'text-slate-600' : 'text-white/80'}`}>{it.desc}</p>
                  <div className="relative mt-auto pt-5 flex items-center gap-3">
                    <span className={`text-[12px] font-bold tabular-nums ${active ? 'text-[#1449B0]' : 'text-white/70'}`}>
                      {String((i % n) + 1).padStart(2, '0')}
                      <span className={active ? 'text-slate-400' : 'text-white/50'}> / {String(n).padStart(2, '0')}</span>
                    </span>
                    <div className={`flex-1 h-[3px] rounded-full overflow-hidden ${active ? 'bg-slate-100' : 'bg-white/15'}`}>
                      {active && (
                        <span
                          className="activa-trust-progress block h-full rounded-full bg-gradient-to-r from-[#1449B0] to-[#5A86DD]"
                          style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {/* Version précédente des bulles, conservée et masquée. */}
                <div
                  hidden
                  className={`activa-bubble relative overflow-hidden rounded-[22px] bg-white p-5 transition-all duration-700 ${
                    active ? 'opacity-100 scale-100 shadow-[0_30px_60px_-28px_rgb(0_0_0/0.65)]' : 'opacity-55 scale-[0.9] shadow-none'
                  }`}
                >
                  <span aria-hidden="true" className="absolute -right-4 -top-4 w-28 h-28 opacity-60 [background-image:radial-gradient(rgb(20_73_176/0.18)_1.2px,transparent_1.3px)] [background-size:10px_10px] [mask-image:radial-gradient(circle_at_top_right,#000,transparent_70%)]" />
                  <div className="relative flex items-center justify-between">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center">
                      <ItemIcon className="w-6 h-6" strokeWidth={1.8} />
                    </span>
                  </div>
                  <p className="relative mt-1 text-[13.5px] leading-relaxed text-slate-600">{it.desc}</p>
                </div>
                {/* queue de bulle (prise de parole) — masquée */}
                <span
                  aria-hidden="true"
                  className={`hidden absolute left-9 -bottom-2 w-5 h-5 rotate-45 rounded-[4px] bg-white transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Points de navigation */}
      <div className="mt-3 flex items-center gap-2">
        {items.map((it, i) => (
          <button
            key={it.title}
            type="button"
            onClick={() => {
              setAnimate(true);
              setPos(i);
            }}
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
  // === AMÉLIORATION AJOUTÉE (ligne d'assistance téléphonique) ===
  onGoToHelpline?: () => void;
}

export const WhistleblowerHome: React.FC<WhistleblowerHomeProps> = ({
  lang,
  onStartNewAlert,
  onGoToTrack,
  onOpenDesk,
  onGoToFaq,
  onGoToHelpline,
}) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE (trois canaux qui défilent dans le haut de page) ===
  const channelItems: TrustItem[] = [
    { Icon: SendIcon, title: t.helpline_other_online_title, desc: t.helpline_other_online_desc, onClick: onStartNewAlert },
    { Icon: WhatsAppIcon, title: t.hero_channel_whatsapp_title, desc: t.hero_channel_whatsapp_desc, href: 'https://wa.me/237687454545' },
    { Icon: MailIcon, title: t.helpline_home_email_title, desc: 'activa.whistleblowing@group-activa.com', href: 'mailto:activa.whistleblowing@group-activa.com' },
  ];
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
        {/* === AMÉLIORATION AJOUTÉE (« Résonance abritée ») === ondes issues de la
            planche docs/design/resonance-abritee : elles partent de l'emblème
            de la vitrine (tremblantes puis apaisées) et respirent lentement.
            Remplacent les grands cercles décoratifs (conservés ci-dessous,
            masqués). */}
        {/* === AMÉLIORATION AJOUTÉE (motifs revus) === sur demande explicite :
            trame de points fine qui s'éclaire côté droit, deux halos de lumière
            qui dérivent lentement (bleu clair et vert ACTIVA) et une grande
            courbe fine. Les ondes « Résonance abritée » restent ci-dessous,
            masquées. */}
        <div aria-hidden="true" className="hidden pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.22)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(100deg,transparent_25%,rgb(0_0_0/0.5)_55%,#000_85%)]" />
        <div aria-hidden="true" className="activa-aurora pointer-events-none absolute -right-40 -top-40 w-[720px] h-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(90_134_221/0.55),transparent)] blur-2xl" />
        <div aria-hidden="true" className="activa-aurora-2 pointer-events-none absolute right-[18%] bottom-[-220px] w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(127_188_10/0.16),transparent)] blur-2xl" />
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 640">
          <path d="M -40 560 C 380 470, 760 640, 1480 300" fill="none" stroke="rgb(255 255 255 / 0.10)" strokeWidth="1.5" />
          <path d="M -40 600 C 420 520, 820 680, 1480 360" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
        </svg>
        <div
          aria-hidden="true"
          className="hidden activa-ondes pointer-events-none absolute inset-0 bg-no-repeat bg-cover opacity-[0.22] lg:opacity-50 [mask-image:linear-gradient(90deg,transparent_0%,rgb(0_0_0/0.25)_35%,#000_60%)]"
          style={{ backgroundImage: "url('/brand/resonance-ondes.webp')", backgroundPosition: '66% 34%' }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden">
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

          <div className="activa-enter min-w-0" style={{ '--d': '500ms' } as React.CSSProperties}>
            <HeroTrustShowcase
              liveLabel={t.hero_trust_live}
              // === AMÉLIORATION AJOUTÉE (trois canaux qui défilent) === sur demande
              // explicite : les bulles présentent les trois canaux (en ligne,
              // WhatsApp Business, e-mail) ; les 5 garanties restent ci-dessous,
              // non affichées (`items` remplacé par `channelItems`).
              items={channelItems}
              trustItemsKept={[
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
        className="activa-enter relative z-20 -mt-[4.5rem] grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{ '--d': '820ms' } as React.CSSProperties}
      >
        {[
          { Icon: ShieldCheck, title: t.hero_feature_confidentiality_title, desc: t.hero_feature_confidentiality_desc, tile: 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white ring-white/20 shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
          { Icon: EyeOff, title: t.hero_feature_anonymity_title, desc: t.hero_feature_anonymity_desc, tile: 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white ring-white/20 shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
          { Icon: HeartHandshake, title: t.hero_feature_no_retaliation_title, desc: t.hero_feature_no_retaliation_desc, tile: 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white ring-white/20 shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]', solid: 'from-[#2B5FC8] to-[#0F3C93]', bar: 'bg-[#1449B0]' },
        ].map(({ Icon, title, desc, tile, solid, bar }, i) => (
          <div
            key={title}
            data-reveal
            style={{ '--rd': `${i * 110}ms` } as React.CSSProperties}
            className="group relative overflow-hidden p-5 sm:p-6 flex items-start gap-4 rounded-[28px] bg-white ring-1 ring-slate-200/90 shadow-[0_24px_50px_-28px_rgb(15_23_42/0.5)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-26px_rgb(20_73_176/0.45)]"
          >
            {/* === AMÉLIORATION AJOUTÉE (bulles revues) === bulles séparées,
                trame de points dans l'angle, filet dégradé en tête. */}
            <span aria-hidden="true" className="hidden absolute -right-4 -top-4 w-28 h-28 opacity-70 [background-image:radial-gradient(rgb(20_73_176/0.16)_1.2px,transparent_1.3px)] [background-size:10px_10px] [mask-image:radial-gradient(circle_at_top_right,#000,transparent_70%)]" />
            <span aria-hidden="true" className="hidden absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-[#1449B0] to-[#5A86DD]" />
            <span className={`relative overflow-hidden w-11 h-11 rounded-xl ring-1 ring-inset flex items-center justify-center shrink-0 transition-all duration-500 ease-out group-hover:text-white group-hover:scale-105 group-hover:shadow-lg ${tile}`}>
              <span aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${solid}`} />
              <Icon className="relative w-5 h-5" strokeWidth={1.75} />
            </span>
            <div className="relative">
              <div className="font-bold text-[#12305F] text-sm sm:text-[15px] tracking-tight">{title}</div>
              <div className="mt-0.5 text-xs sm:text-[13px] text-slate-500 leading-relaxed">{desc}</div>
            </div>
            <span aria-hidden="true" className={`hidden absolute left-6 right-6 bottom-0 h-[3px] rounded-t-full ${bar}`} />
          </div>
        ))}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (ligne d'assistance — trois canaux) ===
          sur le modèle NAVEX : en ligne, par téléphone, par WhatsApp. Au
          survol, la bulle se soulève et l'icône s'anime. */}
      <div id="home-channels" className="hidden space-y-5 pt-4">
        <div data-reveal className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-[0.16em] text-[#1449B0]">{t.helpline_home_label}</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{t.helpline_home_heading}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'online', Icon: SendIcon, title: t.helpline_other_online_title, desc: t.helpline_other_online_desc, onClick: onStartNewAlert, anim: 'group-hover:-translate-y-0.5 group-hover:translate-x-0.5' },
            { id: 'phone', Icon: PhoneIcon, title: t.helpline_home_phone_title, desc: t.helpline_home_phone_desc, onClick: onGoToHelpline, anim: 'activa-ring-hover', isNew: true },
            { id: 'email', Icon: MailIcon, title: t.helpline_home_email_title, desc: 'activa.whistleblowing@group-activa.com', href: 'mailto:activa.whistleblowing@group-activa.com', anim: 'group-hover:-rotate-6 group-hover:scale-110' },
          ].map(({ id, Icon, title, desc, onClick, href, anim, isNew }, i) => {
            const body = (
              <>
                <span className="relative w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shrink-0 shadow-[0_12px_26px_-12px_rgb(20_73_176/0.95)]">
                  {id === 'phone' && <span aria-hidden="true" className="activa-ripple absolute inset-0 rounded-[18px] border-2 border-[#1449B0]/35" />}
                  <Icon className={`relative w-6 h-6 transition-transform duration-300 ${anim}`} strokeWidth={1.8} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[#0B2545] text-[16px] tracking-tight">{title}</span>
                    {isNew && <span className="px-2 py-0.5 rounded-full bg-[#EEF7E0] text-[#4E7A00] text-[10.5px] font-bold uppercase tracking-wide">{t.helpline_home_new}</span>}
                  </span>
                  <span className="block mt-1 text-[13px] text-slate-500 leading-relaxed break-words">{desc}</span>
                </span>
                <ArrowRight className="w-4 h-4 mt-1 shrink-0 text-[#1449B0] transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </>
            );
            const cls = 'group text-left w-full flex items-start gap-4 p-5 sm:p-6 rounded-[28px] bg-white ring-1 ring-slate-200/90 shadow-[0_24px_50px_-30px_rgb(15_23_42/0.5)] hover:-translate-y-1 hover:shadow-[0_30px_60px_-28px_rgb(15_23_42/0.55)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1449B0]/25';
            return href ? (
              <a key={id} id={`home-channel-${id}`} data-reveal style={{ '--rd': `${i * 110}ms` } as React.CSSProperties} href={href} className={cls}>{body}</a>
            ) : (
              <button key={id} id={`home-channel-${id}`} data-reveal style={{ '--rd': `${i * 110}ms` } as React.CSSProperties} type="button" onClick={onClick} className={cls}>{body}</button>
            );
          })}
        </div>
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
