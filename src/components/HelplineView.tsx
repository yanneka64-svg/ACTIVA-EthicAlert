/**
 * === AMÉLIORATION AJOUTÉE (ligne d'assistance téléphonique) ===
 *
 * Sur demande explicite (« un peu comme NAVEX ») : page publique
 * « Ligne d'assistance » (`/helpline`).
 * - Numéro réel, le même pour tous les pays : +237 687 45 45 45 (appel ou
 *   WhatsApp Business), plus l'adresse e-mail dédiée.
 * - Le numéro « défile » à l'affichage ; boutons Appeler (`tel:`),
 *   WhatsApp et Copier ; horaires et langues ; e-mail avec Écrire et Copier.
 * - Déroulé « Un signalement en 4 étapes » ; autres canaux (en ligne,
 *   WhatsApp, suivi).
 * - Déroulé de l'appel en 4 étapes qui s'allument l'une après l'autre.
 * - Autres canaux : en ligne, e-mail, suivi d'un dossier.
 */
import React from 'react';
import { Phone, Copy, Check, Send, MessageCircle, MessageSquareText, Search, Mail, ArrowRight, Globe2, PenLine, KeyRound, Clock3, FileDown, Languages, ChevronRight, Lock } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { BrandBlueBackdrop } from './ui/BrandBlue';

// Coordonnées réelles du canal (mêmes valeurs que ContactView.tsx).
export const HELPLINE_NUMBER = '+237 687 45 45 45';
export const HELPLINE_TEL = 'tel:+237687454545';
export const HELPLINE_WHATSAPP_LINK = 'https://wa.me/237687454545';
export const HELPLINE_EMAIL = 'activa.whistleblowing@group-activa.com';

// === AMÉLIORATION AJOUTÉE (étapes WhatsApp / e-mail revues) ===
// « www.activa-alertes.com » cité dans un texte devient un lien cliquable.
const SITE_LABEL = 'www.activa-alertes.com';
const SITE_URL = 'https://www.activa-alertes.com';
function linkifySite(text: string): React.ReactNode {
  const i = text.indexOf(SITE_LABEL);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <a href={SITE_URL} className="font-semibold text-[#1449B0] underline underline-offset-2 decoration-[#1449B0]/40 hover:decoration-[#1449B0] whitespace-nowrap">
        {SITE_LABEL}
      </a>
      {text.slice(i + SITE_LABEL.length)}
    </>
  );
}

function usePrefersReducedMotion(): boolean {
  return React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
}

/** Numéro dont chaque chiffre « roule » depuis 0 jusqu'à sa valeur. */
const RollingNumber: React.FC<{ value: string }> = ({ value }) => {
  const [shown, setShown] = React.useState(value.replace(/\d/g, '0'));
  React.useEffect(() => {
    const id = window.setTimeout(() => setShown(value), 500);
    return () => window.clearTimeout(id);
  }, [value]);
  return (
    <span className="inline-flex items-baseline tabular-nums" aria-label={value}>
      {shown.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
            <span
              className="flex flex-col transition-transform duration-[2400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(ch) * 10}%)`, transitionDelay: `${i * 110}ms` }}
            >
              {'0123456789'.split('').map((d) => (
                <span key={d} className="h-[1.15em] leading-[1.15em]">{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">{ch === ' ' ? ' ' : ch}</span>
        )
      )}
    </span>
  );
};

/**
 * === AMÉLIORATION AJOUTÉE (canaux séparés qui défilent) ===
 * Carrousel horizontal, de la droite vers la gauche, en boucle : la carte
 * suivante arrive par la droite. Ralenti (une carte toutes les 7 s,
 * glissement de 1,4 s), pause au survol ou quand un bouton a le focus.
 * Les cartes non visibles sont inertes (ni clic ni tabulation).
 */
const ChannelCarousel: React.FC<{ slides: React.ReactNode[]; labels: string[] }> = ({ slides, labels }) => {
  const n = slides.length;
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [pos, setPos] = React.useState(0);
  const [animate, setAnimate] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const reduced = usePrefersReducedMotion();
  const GAP = 20;
  const STEP_MS = 7000;
  const SLIDE_MS = 1400;

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
    }, SLIDE_MS + 60);
    return () => window.clearTimeout(id);
  }, [pos, n]);
  React.useEffect(() => {
    if (animate) return;
    const id = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(id);
  }, [animate]);

  // Carte : 88 % de la largeur visible, la suivante dépasse à droite.
  const card = Math.max(260, Math.round(width * 0.88));
  const index = pos % n;
  const track = [...slides, ...slides];
  return (
    <div
      className="activa-modal-in min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div ref={viewportRef} className="relative overflow-hidden -my-8 py-8 [mask-image:linear-gradient(90deg,#000_0%,#000_88%,transparent)]">
        <div
          className="flex items-stretch"
          style={{
            gap: `${GAP}px`,
            transform: `translateX(-${pos * (card + GAP)}px)`,
            transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none',
          }}
        >
          {track.map((slide, i) => {
            const active = i === pos;
            return (
              <div
                key={i}
                className={`shrink-0 transition-[opacity,transform] duration-[1400ms] ${active ? 'opacity-100 scale-100' : 'opacity-60 scale-[0.96] pointer-events-none'}`}
                style={{ width: `${card}px` }}
                aria-hidden={!active}
                inert={!active}
              >
                {slide}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setAnimate(true);
              setPos(i);
            }}
            aria-current={i === index}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all duration-700 ${
              i === index ? 'bg-white text-[#1449B0] shadow-[0_8px_18px_-10px_rgb(0_0_0/0.5)]' : 'bg-white/10 text-white/80 ring-1 ring-inset ring-white/25 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface HelplineViewProps {
  lang: Language;
  onStartNewAlert: () => void;
  onGoToTrack: () => void;
}

export const HelplineView: React.FC<HelplineViewProps> = ({ lang, onStartNewAlert, onGoToTrack }) => {
  const t = TRANSLATIONS[lang];
  const reduced = usePrefersReducedMotion();
  const [copied, setCopied] = React.useState<'phone' | 'email' | null>(null);
  const [step, setStep] = React.useState(0);

  // Ouverture en haut de page (la zone de défilement est conservée d'un
  // onglet à l'autre : on arrivait sinon au milieu de la page).
  React.useEffect(() => {
    document.querySelector('.activa-vt-main')?.scrollTo({ top: 0 });
  }, []);

  React.useEffect(() => {
    if (reduced) return;
    // === AMÉLIORATION AJOUTÉE (ralenti) === sur demande : tout en « slow motion ».
    const id = window.setInterval(() => setStep((s) => (s + 1) % 4), 4500);
    return () => window.clearInterval(id);
  }, [reduced]);

  // === AMÉLIORATION AJOUTÉE (titre animé) === déclenché à l'arrivée à l'écran.
  const stepsHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const [headingSeen, setHeadingSeen] = React.useState(false);
  React.useEffect(() => {
    const el = stepsHeadingRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setHeadingSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHeadingSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const copy = (text: string, field: 'phone' | 'email') => {
    void navigator.clipboard?.writeText(text);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const STEPS = [
    { Icon: MessageCircle, title: t.helpline_step1_title, desc: t.helpline_step1_desc },
    { Icon: MessageSquareText, title: t.helpline_step2_title, desc: t.helpline_step2_desc },
    { Icon: PenLine, title: t.helpline_step3_title, desc: t.helpline_step3_desc },
    { Icon: KeyRound, title: t.helpline_step4_title, desc: t.helpline_step4_desc },
  ];
  // === AMÉLIORATION AJOUTÉE (étapes WhatsApp / e-mail revues) === l'étape 4
  // invite à télécharger l'accusé de réception : icône « téléchargement »
  // (l'icône clé reste dans STEPS ci-dessus, remplacée à l'affichage).
  STEPS[3] = { ...STEPS[3], Icon: FileDown };

  const ghostBtn =
    'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300';

  return (
    <div className="activa-helpline">
      {/* Bandeau bleu : titre + carte d'appel */}
      <div className="relative overflow-hidden">
        <BrandBlueBackdrop />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* === AMÉLIORATION AJOUTÉE (message propre à la ligne d'assistance) ===
              sur demande explicite : message dédié, sans les boutons
              « Signaler » et « Suivre ». Les versions précédentes restent
              ci-dessous, masquées. */}
          <div>
            <p className="activa-enter text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] leading-relaxed text-[#C9DAF8]" style={{ '--d': '100ms' } as React.CSSProperties}>
              <span aria-hidden="true" className="activa-pulse-dot inline-block align-middle w-2 h-2 rounded-full bg-white mr-2.5 -mt-0.5" />
              {t.helpline_eyebrow}
            </p>
            <h1 className="activa-enter mt-5 text-[38px] sm:text-5xl lg:text-[52px] font-extrabold tracking-[-0.035em] leading-[1.06] text-white [text-wrap:balance]" style={{ '--d': '200ms' } as React.CSSProperties}>
              {t.helpline_title_v2}
            </h1>
            <p className="activa-enter mt-5 text-lg sm:text-xl text-[#DCE7FA] leading-relaxed max-w-xl" style={{ '--d': '420ms' } as React.CSSProperties}>
              {t.helpline_subtitle_v2}
            </p>
            <p className="activa-enter mt-6 text-sm sm:text-base font-medium text-white" style={{ '--d': '600ms' } as React.CSSProperties}>
              <Lock className="inline-block align-[-3px] w-4 h-4 mr-2 text-white" strokeWidth={2} />
              {t.hero_anonymous_note}
            </p>
          </div>
          <div hidden>
            <p className="activa-enter text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] leading-relaxed text-[#C9DAF8]" style={{ '--d': '100ms' } as React.CSSProperties}>
              <span aria-hidden="true" className="activa-pulse-dot inline-block align-middle w-2 h-2 rounded-full bg-white mr-2.5 -mt-0.5" />
              {t.hero_eyebrow}
            </p>
            <h1 className="mt-5 text-[40px] sm:text-6xl lg:text-[54px] font-extrabold tracking-[-0.035em] leading-[1.04] text-white">
              <span className="activa-enter block" style={{ '--d': '200ms' } as React.CSSProperties}>{t.hero_headline_line1}</span>
              <span className="activa-enter block pb-1" style={{ '--d': '300ms' } as React.CSSProperties}>{t.hero_headline_line2}</span>
            </h1>
            <p className="activa-enter mt-5 text-lg sm:text-xl text-[#DCE7FA] leading-relaxed max-w-xl" style={{ '--d': '520ms' } as React.CSSProperties}>
              {t.hero_desc_line1}{' '}{t.hero_desc_line2}{' '}
              <span className="font-bold text-white">{t.hero_desc_cta}</span>
            </p>
            <div className="activa-enter mt-8 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3" style={{ '--d': '620ms' } as React.CSSProperties}>
              <button
                type="button"
                onClick={onStartNewAlert}
                className="activa-shine group flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-[#0F3C93] hover:bg-[#0C3176] ring-1 ring-inset ring-white/15 text-white font-bold text-[14.5px] shadow-[0_14px_28px_-14px_rgb(0_0_0/0.7)] hover:-translate-y-0.5 transition-all duration-700 ease-out whitespace-nowrap"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                <span>{t.btn_new_alert}</span>
                <ChevronRight className="w-4 h-4 transition-transform duration-700 group-hover:translate-x-1" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onGoToTrack}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-white hover:bg-[#F1F5FD] text-[#1449B0] font-bold text-[14.5px] shadow-[0_14px_28px_-16px_rgb(0_0_0/0.55)] hover:-translate-y-0.5 transition-all duration-700 ease-out whitespace-nowrap"
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
          <div hidden>
            <p className="activa-enter text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/80" style={{ '--d': '60ms' } as React.CSSProperties}>
              {t.helpline_eyebrow}
            </p>
            <h1 className="activa-enter mt-3 text-3xl sm:text-4xl lg:text-[46px] font-extrabold tracking-[-0.03em] leading-[1.08] text-white [text-wrap:balance]" style={{ '--d': '120ms' } as React.CSSProperties}>
              {t.helpline_title}
            </h1>
            <p className="activa-enter mt-4 max-w-xl text-sm sm:text-base text-white/85 leading-relaxed" style={{ '--d': '200ms' } as React.CSSProperties}>
              {t.helpline_subtitle}
            </p>
            {/* Combiné qui sonne, entouré d'ondes */}
            <div className="activa-enter hidden lg:flex mt-10 items-center gap-5" style={{ '--d': '280ms' } as React.CSSProperties} aria-hidden="true">
              <span className="relative w-20 h-20 flex items-center justify-center">
                <span className="activa-ripple absolute inset-0 rounded-full border-2 border-white/40" />
                <span className="activa-ripple absolute inset-0 rounded-full border-2 border-white/40" style={{ animationDelay: '1.2s' }} />
                <span className="relative w-16 h-16 rounded-full bg-white text-[#1449B0] flex items-center justify-center shadow-[0_18px_40px_-12px_rgb(0_0_0/0.5)]">
                  <Phone className="activa-ring w-7 h-7" strokeWidth={1.9} />
                </span>
              </span>
              <span className="text-sm text-white/85 leading-snug max-w-[16rem]">{t.helpline_reassurance}</span>
            </div>
          </div>

          {/* === AMÉLIORATION AJOUTÉE (canaux séparés qui défilent) === sur
              demande explicite : WhatsApp Business et e-mail sont deux cartes
              distinctes qui défilent de la droite vers la gauche (ralenti,
              pause au survol). */}
          <ChannelCarousel
            labels={[t.contact_whatsapp_title, t.contact_email_title]}
            slides={[
              <div key="wa" className="h-full bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-7 sm:p-9 flex flex-col">
                {/* === AMÉLIORATION AJOUTÉE (cartes allégées) === sur demande
                    explicite (« trop touffu ») : une seule ligne d'information
                    par canal, plus d'espace ; les listes détaillées restent dans
                    le code, masquées. */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]">
                      <MessageCircle className="w-5 h-5" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-extrabold text-[#0B2545]">{t.contact_whatsapp_title}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <span className="activa-live-dot w-2 h-2 rounded-full bg-emerald-500" />
                    {t.helpline_open}
                  </span>
                </div>
                <div id="helpline-number" className="mt-8 text-[30px] sm:text-[40px] font-extrabold tracking-tight text-[#0B2545] leading-none">
                  <RollingNumber value={HELPLINE_NUMBER} />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-slate-500">
                  <Globe2 className="w-4 h-4 text-slate-400" strokeWidth={1.9} />
                  {t.helpline_wa_meta}
                </p>
                {/* === AMÉLIORATION AJOUTÉE (bouton Appeler retiré) === sur demande
                    explicite : numéro WhatsApp Business uniquement ; le bouton
                    Appeler reste dans le code, masqué. */}
                <div className="mt-auto pt-8 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
                  <a
                    id="helpline-call"
                    href={HELPLINE_TEL}
                    className="hidden activa-shine group items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] hover:from-[#1449B0] hover:to-[#0F3C93] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30 hover:-translate-y-0.5 transition-all duration-500"
                  >
                    <Phone className="activa-ring-hover w-4 h-4" strokeWidth={2} />
                    {t.helpline_call}
                  </a>
                  <a id="helpline-whatsapp" href={HELPLINE_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="activa-shine group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] hover:from-[#1449B0] hover:to-[#0F3C93] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30 hover:-translate-y-0.5 transition-all duration-500">
                    <MessageCircle className="activa-ring-hover w-4 h-4" strokeWidth={2} />
                    {t.helpline_whatsapp_btn}
                  </a>
                  <button type="button" onClick={() => copy(HELPLINE_NUMBER.replace(/\s/g, ''), 'phone')} className={ghostBtn} aria-label={t.helpline_copy}>
                    {copied === 'phone' ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} /> : <Copy className="w-4 h-4" strokeWidth={1.9} />}
                    <span>{copied === 'phone' ? t.helpline_copied : t.helpline_copy}</span>
                  </button>
                </div>
                <ul className="hidden mt-5 space-y-2 text-[13.5px] text-slate-600">
                  {[t.contact_whatsapp_tip1, t.contact_whatsapp_tip2, t.contact_whatsapp_tip3].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" strokeWidth={2.2} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <dl className="hidden mt-5 grid-cols-2 gap-3 text-[13px]">
                  <div className="flex items-start gap-2.5">
                    <Clock3 className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" strokeWidth={1.9} />
                    <div>
                      <dt className="text-slate-500">{t.helpline_hours_label}</dt>
                      <dd className="font-semibold text-slate-800">{t.helpline_hours_value}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Languages className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" strokeWidth={1.9} />
                    <div>
                      <dt className="text-slate-500">{t.helpline_languages_label}</dt>
                      <dd className="font-semibold text-slate-800">Français · English · Português</dd>
                    </div>
                  </div>
                </dl>
              </div>,
              <div key="mail" className="h-full bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-7 sm:p-9 flex flex-col">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]">
                      <Mail className="w-5 h-5" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-extrabold text-[#0B2545]">{t.contact_email_title}</span>
                  </span>
                  <span className="hidden rounded-full bg-[#EEF3FC] px-2.5 py-1 text-[11px] font-bold text-[#1449B0]">{t.contact_email_recommended}</span>
                </div>
                <p id="helpline-email" className="mt-8 text-[16px] sm:text-[17px] font-extrabold tracking-[-0.01em] text-[#0B2545] [overflow-wrap:anywhere]">{HELPLINE_EMAIL}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-slate-500">
                  <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                  {t.helpline_email_meta}
                </p>
                <ul className="hidden mt-4 space-y-2 text-[13.5px] text-slate-600">
                  {[t.contact_email_info1, t.contact_email_info2, t.contact_email_info3].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" strokeWidth={2.2} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8 flex flex-wrap gap-2.5">
                  <a href={`mailto:${HELPLINE_EMAIL}`} className="activa-shine group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] hover:from-[#1449B0] hover:to-[#0F3C93] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30 hover:-translate-y-0.5 transition-all duration-500">
                    <Mail className="w-4 h-4" strokeWidth={2} />
                    {t.helpline_email_btn}
                  </a>
                  <button type="button" onClick={() => copy(HELPLINE_EMAIL, 'email')} className={ghostBtn}>
                    {copied === 'email' ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} /> : <Copy className="w-4 h-4" strokeWidth={1.9} />}
                    {copied === 'email' ? t.helpline_copied : t.helpline_copy}
                  </button>
                </div>
              </div>,
            ]}
          />
        </div>
      </div>

      {/* Déroulé de l'appel : les étapes s'allument l'une après l'autre */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 space-y-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-[0.16em] text-[#1449B0]">{t.helpline_steps_label}</span>
          {/* === AMÉLIORATION AJOUTÉE (titre animé) === sur demande explicite :
              les mots apparaissent l'un après l'autre (ralenti) quand la
              section arrive à l'écran, puis un trait sous le titre avance au
              rythme des étapes. */}
          <h2 ref={stepsHeadingRef} aria-label={t.helpline_steps_heading} className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B2545]">
            {t.helpline_steps_heading.split(' ').map((word, i) => (
              <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-bottom pb-1 mr-[0.28em]">
                <span
                  className="inline-block transition-[transform,opacity] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    transform: headingSeen || reduced ? 'translateY(0)' : 'translateY(110%)',
                    opacity: headingSeen || reduced ? 1 : 0,
                    transitionDelay: `${i * 160}ms`,
                  }}
                >
                  {/\d/.test(word) ? <span className="text-[#1449B0]">{word}</span> : word}
                </span>
              </span>
            ))}
          </h2>
          <div aria-hidden="true" className="mt-3 h-[3px] w-40 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1449B0] to-[#7FBC0A] transition-[width] duration-[1600ms] ease-in-out"
              style={{ width: headingSeen || reduced ? `${((reduced ? 3 : step) + 1) * 25}%` : '0%' }}
            />
          </div>
        </div>
        <div className="relative">
          {/* fil qui se remplit d'une étape à l'autre */}
          <div aria-hidden="true" className="hidden lg:block absolute left-[12.5%] right-[12.5%] top-[34px] h-[3px] rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1449B0] to-[#5A86DD] transition-[width] duration-[1600ms] ease-in-out"
              style={{ width: `${reduced ? 100 : (step / 3) * 100}%` }}
            />
          </div>
          <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map(({ Icon, title, desc }, i) => {
              const lit = reduced || i <= step;
              const current = !reduced && i === step;
              return (
                <li key={title} className="flex flex-col items-start lg:items-center lg:text-center">
                  <span
                    className={`relative w-[70px] h-[70px] rounded-[22px] flex items-center justify-center transition-all duration-[1200ms] ease-in-out ${
                      lit
                        ? 'bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white shadow-[0_16px_30px_-14px_rgb(20_73_176/0.95)]'
                        : 'bg-white text-slate-400 border border-slate-200'
                    } ${current ? 'scale-110' : 'scale-100'}`}
                  >
                    {current && <span aria-hidden="true" className="activa-ripple absolute inset-0 rounded-[22px] border-2 border-[#1449B0]/40" />}
                    <Icon className="w-7 h-7" strokeWidth={1.8} />
                    <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ring-2 ring-white ${lit ? 'bg-[#7FBC0A] text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {i + 1}
                    </span>
                  </span>
                  <span className={`mt-4 text-[16px] font-extrabold tracking-tight transition-colors duration-[1200ms] ${lit ? 'text-[#0B2545]' : 'text-slate-400'}`}>{title}</span>
                  <span className={`mt-1 text-[13.5px] leading-relaxed max-w-[17rem] transition-colors duration-[1200ms] ${lit ? 'text-slate-600' : 'text-slate-400'}`}>{linkifySite(desc)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Autres canaux */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 space-y-5">
        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0B2545]">{t.helpline_other_label}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { Icon: Send, title: t.helpline_other_online_title, desc: t.helpline_other_online_desc, onClick: onStartNewAlert },
            { Icon: MessageCircle, title: t.helpline_other_whatsapp_title, desc: `${t.helpline_other_whatsapp_desc} ${HELPLINE_NUMBER}`, href: HELPLINE_WHATSAPP_LINK },
            { Icon: Search, title: t.helpline_other_track_title, desc: t.helpline_other_track_desc, onClick: onGoToTrack },
          ].map(({ Icon, title, desc, onClick, href }) => {
            const body = (
              <>
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shrink-0 shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)] transition-transform duration-300 group-hover:scale-105">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[#0B2545] text-[15px]">{title}</span>
                  <span className="block mt-0.5 text-[13px] text-slate-500 leading-relaxed break-words">{desc}</span>
                </span>
                <ArrowRight className="w-4 h-4 mt-1 shrink-0 text-[#1449B0] transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </>
            );
            const cls =
              'group text-left flex items-start gap-4 p-5 sm:p-6 rounded-[24px] bg-white border border-slate-200/90 shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)] hover:-translate-y-1 hover:shadow-[0_30px_56px_-30px_rgb(15_23_42/0.5)] transition-all duration-700 ease-out';
            return href ? (
              <a key={title} href={href} className={cls}>{body}</a>
            ) : (
              <button key={title} type="button" onClick={onClick} className={cls}>{body}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
