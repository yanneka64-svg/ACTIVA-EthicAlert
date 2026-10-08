/**
 * === AMÉLIORATION AJOUTÉE (carrousel des canaux — propositions v3) ===
 *
 * Trois présentations des canaux de signalement (en ligne, WhatsApp, e-mail)
 * pour le haut de la page d'accueil, proposées au choix. Retenue et affichée :
 * `HeroChannelCoverflow` (proposition A) ; les deux autres restent disponibles :
 * - `HeroChannelCoverflow` : cartes en 3D, la carte active de face, les deux
 *   autres pivotées de part et d'autre ;
 * - `HeroChannelFan` : cartes colorées disposées en éventail, la carte active
 *   se redresse au premier plan ;
 * - `HeroChannelPhone` : un téléphone montre chaque canal « en action »
 *   (formulaire, conversation WhatsApp, e-mail), avec les canaux à côté.
 *
 * Communs aux trois : défilement automatique, pause au survol, au focus
 * clavier et au toucher, balayage gauche/droite sur téléphone, et aucun
 * défilement automatique si l'utilisateur limite les animations.
 */
import React from 'react';
import { ArrowRight, ArrowUpRight, Lock, CheckCheck, Paperclip, Send, ShieldCheck } from 'lucide-react';

export interface ChannelShowcaseItem {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  short?: string;
  cta?: string;
  href?: string;
  onClick?: () => void;
}

export interface ChannelShowcaseProps {
  items: ChannelShowcaseItem[];
  label: string;
  heading: string;
  availability: string;
}

/** Dégradés par canal : bleu ACTIVA (en ligne), vert WhatsApp, indigo (e-mail). */
const ACCENTS = [
  { grad: 'from-[#3B74E6] via-[#1F55C4] to-[#0F3C93]', solid: '#1449B0', soft: 'bg-[#EEF3FC]', text: 'text-[#1449B0]' },
  { grad: 'from-[#2FD27A] via-[#1BAA6A] to-[#0E7A57]', solid: '#128C5E', soft: 'bg-[#E8F8EF]', text: 'text-[#0E7A57]' },
  { grad: 'from-[#7A8CFF] via-[#5267F0] to-[#3341C4]', solid: '#3F51D6', soft: 'bg-[#EEF0FF]', text: 'text-[#3341C4]' },
];
const accentOf = (i: number) => ACCENTS[i % ACCENTS.length];

const CONTACT_RE = /(\+\d[\d ]{6,}\d|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
/** Numéros et adresses e-mail jamais coupés en fin de ligne. */
function contactText(text: string): React.ReactNode {
  return text.split(CONTACT_RE).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [ok, setOk] = React.useState(get);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setOk(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return ok;
}

/** Rotation automatique + gestes (survol, focus, toucher, balayage). */
function useRotation(n: number, stepMs: number) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const touchX = React.useRef<number | null>(null);
  const reduced = React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  React.useEffect(() => {
    if (reduced || paused || n < 2) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % n), stepMs);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, n, stepMs]);
  const go = React.useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);
  const bind = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocusCapture: () => setPaused(true),
    onBlurCapture: () => setPaused(false),
    onTouchStart: (e: React.TouchEvent) => {
      touchX.current = e.touches[0]?.clientX ?? null;
      setPaused(true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touchX.current;
      const end = e.changedTouches[0]?.clientX;
      touchX.current = null;
      if (start != null && end != null && Math.abs(end - start) > 40) setIndex((i) => (((i + (end < start ? 1 : -1)) % n) + n) % n);
    },
  };
  return { index, go, paused, reduced, bind };
}

/** Position relative d'une carte par rapport à la carte active : 0, 1 (suivante), -1 (précédente)… */
function relPos(i: number, index: number, n: number): number {
  const d = (i - index + n) % n;
  return d > n / 2 ? d - n : d;
}

/** Lien ou bouton d'action du canal (formulaire, WhatsApp, e-mail). */
function ChannelAction({ item, className, children, tabIndex, style }: { item: ChannelShowcaseItem; className: string; children: React.ReactNode; tabIndex?: number; style?: React.CSSProperties }) {
  if (item.href) {
    const external = item.href.startsWith('http');
    return (
      <a href={item.href} target={external ? '_blank' : undefined} rel="noopener noreferrer" className={className} tabIndex={tabIndex} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={item.onClick} className={className} tabIndex={tabIndex} style={style}>
      {children}
    </button>
  );
}

const ActionArrow = ({ item, className }: { item: ChannelShowcaseItem; className?: string }) =>
  item.href?.startsWith('http') ? <ArrowUpRight className={className} strokeWidth={2.2} /> : <ArrowRight className={className} strokeWidth={2.2} />;

/** Pastilles de navigation communes (libellé + barre de progression). */
function ChannelPills({ items, index, go, paused, reduced, stepMs, label }: { items: ChannelShowcaseItem[]; index: number; go: (i: number) => void; paused: boolean; reduced: boolean; stepMs: number; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex items-center justify-center gap-1.5 sm:gap-2">
      {items.map((it, i) => {
        const TabIcon = it.Icon;
        const active = i === index;
        return (
          <button
            key={it.title}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => go(i)}
            className={`relative overflow-hidden inline-flex items-center gap-1.5 rounded-full px-3 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
              active ? 'bg-white text-[#0F3C93] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.7)]' : 'bg-white/10 text-white/85 ring-1 ring-inset ring-white/20 hover:bg-white/20'
            }`}
          >
            <TabIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" strokeWidth={2} />
            <span className="whitespace-nowrap">{it.short ?? it.title}</span>
            {active && !reduced && (
              <span aria-hidden="true" className="absolute left-3 right-3 bottom-[3px] h-[2px] rounded-full bg-[#1449B0]/10 overflow-hidden">
                <span key={index} className="activa-trust-progress block h-full rounded-full bg-[#1449B0]" style={{ animationDuration: `${stepMs}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ShowcaseHeader({ label, heading, center }: { label: string; heading: string; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C9DAF8]">{label}</p>
      <p className="mt-1.5 text-[20px] sm:text-[22px] font-extrabold tracking-tight leading-tight text-white">{heading}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition A — cartes en 3D (coverflow)                            */
/* ------------------------------------------------------------------ */

export function HeroChannelCoverflow({ items, label, heading, availability }: ChannelShowcaseProps) {
  const n = items.length;
  const STEP = 4800;
  const { index, go, paused, reduced, bind } = useRotation(n, STEP);
  const wide = useMinWidth(640);
  const W = wide ? 286 : 274;
  const X = wide ? 168 : 132;
  if (n === 0) return null;
  return (
    <div {...bind} className="relative w-full select-none">
      <ShowcaseHeader label={label} heading={heading} center />
      <div className="relative mt-6 h-[350px] sm:h-[356px] [perspective:1300px]">
        <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 bottom-1 w-[62%] h-10 rounded-full bg-[#020B26]/45 blur-2xl" />
        {items.map((it, i) => {
          const rel = relPos(i, index, n);
          const active = rel === 0;
          const a = accentOf(i);
          const ItemIcon = it.Icon;
          return (
            <div
              key={it.title}
              aria-hidden={!active}
              onClick={active ? undefined : () => go(i)}
              className={`absolute top-0 left-1/2 ${active ? '' : 'cursor-pointer'}`}
              style={{
                width: W,
                marginLeft: -W / 2,
                transform: `translateX(${rel * X}px) translateZ(${active ? 0 : -190}px) rotateY(${-rel * 42}deg)`,
                opacity: Math.abs(rel) > 1 ? 0 : active ? 1 : 0.62,
                zIndex: 30 - Math.abs(rel) * 10,
                transition: 'transform 900ms cubic-bezier(0.22, 0.8, 0.2, 1), opacity 900ms ease',
              }}
            >
              <div className="rounded-[28px] overflow-hidden bg-white shadow-[0_50px_90px_-40px_rgb(2_12_40/0.95)] ring-1 ring-white/50">
                <div className={`relative h-[148px] bg-gradient-to-br ${a.grad} overflow-hidden`}>
                  {[0, 1, 2].map((k) => (
                    <span key={k} aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" style={{ width: 120 + k * 80, height: 120 + k * 80 }} />
                  ))}
                  <span aria-hidden="true" className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-inset ring-white/30">
                    <span className="activa-live-dot w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    24/7
                  </span>
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[76px] h-[76px] rounded-[24px] bg-white/20 backdrop-blur-md ring-1 ring-inset ring-white/50 shadow-[0_18px_36px_-14px_rgb(0_0_0/0.55)] flex items-center justify-center">
                    <ItemIcon className="w-9 h-9 text-white" strokeWidth={1.7} />
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-[20px] font-extrabold tracking-tight text-[#0B2545]">{it.title}</p>
                  <p className={`mt-1.5 min-h-[44px] leading-snug text-slate-600 ${it.desc.includes('@') ? 'text-[12.5px] tracking-[-0.01em]' : 'text-[14px]'}`}>{contactText(it.desc)}</p>
                  <ChannelAction
                    item={it}
                    tabIndex={active ? 0 : -1}
                    style={{ background: `linear-gradient(135deg, ${a.solid}, ${a.solid}dd)` }}
                    className="group/cta mt-4 w-full flex items-center justify-between gap-2 rounded-2xl px-3.5 sm:px-4 py-3 text-[13px] sm:text-[14px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1449B0]/30"
                  >
                    <span className="min-w-0 truncate">{it.cta ?? it.title}</span>
                    <ActionArrow item={it} className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
                  </ChannelAction>
                </div>
              </div>
              <span className="sr-only">{availability}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2">
        <ChannelPills items={items} index={index} go={go} paused={paused} reduced={reduced} stepMs={STEP} label={label} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition B — cartes colorées en éventail                         */
/* ------------------------------------------------------------------ */

export function HeroChannelFan({ items, label, heading, availability }: ChannelShowcaseProps) {
  const n = items.length;
  const STEP = 4800;
  const { index, go, paused, reduced, bind } = useRotation(n, STEP);
  const wide = useMinWidth(640);
  const W = wide ? 300 : 284;
  if (n === 0) return null;
  return (
    <div {...bind} className="relative w-full select-none">
      <ShowcaseHeader label={label} heading={heading} center />
      <div className="relative mt-7 h-[388px] sm:h-[400px]">
        {items.map((it, i) => {
          const rel = relPos(i, index, n);
          const active = rel === 0;
          const a = accentOf(i);
          const ItemIcon = it.Icon;
          const t = active
            ? 'translateX(0) translateY(0) rotate(0deg) scale(1)'
            : `translateX(${rel * (wide ? 54 : 34)}px) translateY(14px) rotate(${rel * 9}deg) scale(0.93)`;
          return (
            <div
              key={it.title}
              aria-hidden={!active}
              onClick={active ? undefined : () => go(i)}
              className={`absolute top-0 left-1/2 ${active ? '' : 'cursor-pointer'}`}
              style={{
                width: W,
                marginLeft: -W / 2,
                transformOrigin: '50% 115%',
                transform: t,
                zIndex: active ? 30 : 20 - (rel > 0 ? 0 : 5),
                transition: 'transform 850ms cubic-bezier(0.3, 1.25, 0.4, 1), filter 600ms ease',
                filter: active ? 'none' : 'brightness(0.86) saturate(0.9)',
              }}
            >
              <div className={`relative h-[350px] sm:h-[362px] rounded-[30px] overflow-hidden bg-gradient-to-br ${a.grad} p-6 flex flex-col text-white shadow-[0_40px_80px_-34px_rgb(2_12_40/0.95)] ring-1 ring-inset ring-white/25`}>
                <ItemIcon className="pointer-events-none absolute -right-10 -bottom-10 w-56 h-56 text-white/[0.09] rotate-[-12deg]" strokeWidth={1.2} />
                <span aria-hidden="true" className="absolute -left-16 -top-20 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(120deg,rgb(255_255_255/0.18),transparent_38%)]" />
                <div className="relative flex items-center justify-between">
                  <span className="w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-md ring-1 ring-inset ring-white/45 flex items-center justify-center shadow-[0_14px_30px_-14px_rgb(0_0_0/0.6)]">
                    <ItemIcon className="w-7 h-7" strokeWidth={1.8} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ring-white/25">
                    <span className="activa-live-dot w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    24/7
                  </span>
                </div>
                <p className="relative mt-auto text-[28px] sm:text-[30px] leading-[1.05] font-extrabold tracking-tight">{it.title}</p>
                <p className={`relative mt-2 leading-snug text-white/85 ${it.desc.includes('@') ? 'text-[12.5px] tracking-[-0.01em]' : 'text-[14.5px]'}`}>{contactText(it.desc)}</p>
                <ChannelAction
                  item={it}
                  tabIndex={active ? 0 : -1}
                  className={`group/cta relative mt-5 w-full flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-[13.5px] sm:text-[14px] font-bold ${a.text} shadow-[0_16px_30px_-16px_rgb(0_0_0/0.6)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60`}
                >
                  <span className="min-w-0 truncate">{it.cta ?? it.title}</span>
                  <span className={`w-8 h-8 shrink-0 rounded-xl ${a.soft} flex items-center justify-center`}>
                    <ActionArrow item={it} className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
                  </span>
                </ChannelAction>
                <span className="sr-only">{availability}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1">
        <ChannelPills items={items} index={index} go={go} paused={paused} reduced={reduced} stepMs={STEP} label={label} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition C — téléphone qui montre chaque canal en action         */
/* ------------------------------------------------------------------ */

function PhoneScreenOnline() {
  return (
    <div className="h-full flex flex-col bg-[#F4F7FC]">
      <div className="px-3 pt-9 pb-2 bg-white">
        <div className="mx-auto w-fit flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
          <Lock className="w-2.5 h-2.5 text-emerald-600" strokeWidth={2.5} />
          activa-alertes.com
        </div>
      </div>
      <div className="m-3 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] p-3.5 text-white activa-chat-in">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">Étape 2 sur 4</p>
        <p className="mt-1 text-[14px] font-extrabold leading-tight">Décrivez la situation</p>
        <div className="mt-2.5 grid grid-cols-4 gap-1">
          {[1, 1, 0, 0].map((on, k) => (
            <span key={k} className={`h-1 rounded-full ${on ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>
      <div className="px-3 space-y-2.5">
        <div className="activa-chat-in" style={{ animationDelay: '250ms' }}>
          <p className="text-[9.5px] font-bold text-slate-500">Catégorie</p>
          <div className="mt-1 rounded-xl bg-white ring-1 ring-[#1449B0]/40 px-2.5 py-2 text-[11px] font-semibold text-[#0B2545]">Fraude présumée</div>
        </div>
        <div className="activa-chat-in" style={{ animationDelay: '500ms' }}>
          <p className="text-[9.5px] font-bold text-slate-500">Description</p>
          <div className="mt-1 rounded-xl bg-white ring-1 ring-slate-200 px-2.5 py-2 space-y-1.5">
            <span className="block h-1.5 w-[92%] rounded bg-slate-200" />
            <span className="block h-1.5 w-[80%] rounded bg-slate-200" />
            <span className="block h-1.5 w-[55%] rounded bg-slate-200" />
          </div>
        </div>
        <div className="activa-chat-in flex items-center gap-2 rounded-xl bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-800" style={{ animationDelay: '750ms' }}>
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          Signalement anonyme possible
        </div>
      </div>
      <div className="mt-auto p-3">
        <div className="activa-chat-in rounded-xl bg-[#1449B0] py-2.5 text-center text-[11.5px] font-bold text-white shadow-[0_10px_20px_-10px_rgb(20_73_176/0.9)]" style={{ animationDelay: '1000ms' }}>
          Envoyer en toute sécurité
        </div>
      </div>
    </div>
  );
}

function PhoneScreenWhatsApp() {
  const Bubble = ({ out, children, delay }: { out?: boolean; children: React.ReactNode; delay: number }) => (
    <div className={`activa-chat-in flex ${out ? 'justify-end' : 'justify-start'}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`max-w-[82%] rounded-2xl px-2.5 py-1.5 text-[10.5px] leading-snug text-[#111B21] shadow-sm ${out ? 'bg-[#D9FDD3] rounded-tr-md' : 'bg-white rounded-tl-md'}`}>
        {children}
        <span className="ml-1.5 inline-flex items-center gap-0.5 align-bottom text-[8px] text-slate-400">
          09:4{Math.round(delay / 600)}
          {out && <CheckCheck className="w-3 h-3 text-[#53BDEB]" strokeWidth={2.2} />}
        </span>
      </div>
    </div>
  );
  return (
    <div className="h-full flex flex-col bg-[#EFE7DD] [background-image:radial-gradient(rgb(0_0_0/0.045)_1px,transparent_1.2px)] [background-size:14px_14px]">
      <div className="flex items-center gap-2 bg-[#0B6E5F] px-3 pt-9 pb-2.5 text-white">
        <span className="w-7 h-7 rounded-full bg-white text-[#0B6E5F] flex items-center justify-center text-[11px] font-black">A</span>
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold leading-tight truncate">ACTIVA Whistleblowing</p>
          <p className="text-[9px] text-white/75">en ligne</p>
        </div>
      </div>
      <div className="flex-1 px-2.5 py-3 space-y-2">
        <div className="activa-chat-in mx-auto w-fit rounded-lg bg-[#FFF3C4] px-2 py-1 text-[8.5px] text-[#54656F] text-center flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" strokeWidth={2.4} />
          Échange confidentiel
        </div>
        <Bubble delay={300}>Bonjour, vous pouvez nous écrire en toute confidentialité.</Bubble>
        <Bubble out delay={1100}>Bonjour, je souhaite signaler une situation.</Bubble>
        <Bubble delay={2000}>Merci. Décrivez-nous les faits, nous vous répondons rapidement.</Bubble>
        <div className="activa-chat-in flex" style={{ animationDelay: '2800ms' }}>
          <div className="rounded-2xl rounded-tl-md bg-white px-3 py-2 flex gap-1 shadow-sm">
            {[0, 1, 2].map((k) => (
              <span key={k} className="activa-typing w-1.5 h-1.5 rounded-full bg-slate-400" style={{ animationDelay: `${k * 160}ms` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 p-2">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-slate-400">Message</div>
        <span className="w-7 h-7 rounded-full bg-[#00A884] flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-white" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

function PhoneScreenEmail() {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between px-3.5 pt-9 pb-2.5 border-b border-slate-100">
        <p className="text-[13px] font-extrabold text-[#0B2545]">Nouveau message</p>
        <span className="w-7 h-7 rounded-full bg-[#3F51D6] flex items-center justify-center shadow-[0_8px_16px_-8px_rgb(63_81_214/0.9)]">
          <Send className="w-3.5 h-3.5 text-white" strokeWidth={2} />
        </span>
      </div>
      <div className="px-3.5 divide-y divide-slate-100 text-[10px]">
        <div className="activa-chat-in py-2 flex items-center gap-1.5" style={{ animationDelay: '200ms' }}>
          <span className="text-slate-400">À</span>
          <span className="truncate rounded-full bg-[#EEF0FF] px-2 py-0.5 font-semibold text-[#3341C4]">activa.whistleblowing@group-activa.com</span>
        </div>
        <div className="activa-chat-in py-2 flex items-center gap-1.5" style={{ animationDelay: '500ms' }}>
          <span className="text-slate-400">Objet</span>
          <span className="font-semibold text-[#0B2545]">Signalement confidentiel</span>
        </div>
      </div>
      <div className="activa-chat-in px-3.5 py-3 space-y-1.5" style={{ animationDelay: '800ms' }}>
        <p className="text-[10.5px] text-[#0B2545]">Bonjour,</p>
        <span className="block h-1.5 w-[94%] rounded bg-slate-200" />
        <span className="block h-1.5 w-[88%] rounded bg-slate-200" />
        <span className="block h-1.5 w-[72%] rounded bg-slate-200" />
        <span className="block h-1.5 w-[40%] rounded bg-slate-200" />
      </div>
      <div className="activa-chat-in mx-3.5 mt-1 flex items-center gap-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-2.5 py-2" style={{ animationDelay: '1100ms' }}>
        <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
          <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[10px] font-bold text-[#0B2545]">piece-justificative.pdf</p>
          <p className="text-[8.5px] text-slate-400">240 Ko</p>
        </div>
      </div>
      <div className="mt-auto p-3">
        <div className="activa-chat-in rounded-xl bg-[#3F51D6] py-2.5 text-center text-[11.5px] font-bold text-white" style={{ animationDelay: '1400ms' }}>
          Envoyer
        </div>
      </div>
    </div>
  );
}

const PHONE_SCREENS = [PhoneScreenOnline, PhoneScreenWhatsApp, PhoneScreenEmail];

export function HeroChannelPhone({ items, label, heading, availability }: ChannelShowcaseProps) {
  const n = items.length;
  const STEP = 5600;
  const { index, go, paused, reduced, bind } = useRotation(n, STEP);
  if (n === 0) return null;
  const current = items[index];
  const Screen = PHONE_SCREENS[index % PHONE_SCREENS.length];
  const a = accentOf(index);
  return (
    <div {...bind} className="relative w-full select-none">
      <div className="flex flex-col-reverse sm:flex-row items-center sm:items-center justify-center gap-6 sm:gap-7">
        {/* Canaux */}
        <div className="w-full sm:w-[210px] shrink-0">
          <div className="hidden sm:block mb-4">
            <ShowcaseHeader label={label} heading={heading} />
          </div>
          <div role="tablist" aria-label={label} className="grid grid-cols-3 sm:grid-cols-1 gap-2">
            {items.map((it, i) => {
              const TabIcon = it.Icon;
              const active = i === index;
              const ac = accentOf(i);
              return (
                <button
                  key={it.title}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => go(i)}
                  className={`relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 rounded-2xl p-2.5 sm:p-3 text-center sm:text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                    active ? 'bg-white shadow-[0_18px_36px_-18px_rgb(0_0_0/0.7)] sm:translate-x-1' : 'bg-white/10 ring-1 ring-inset ring-white/20 hover:bg-white/15'
                  }`}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${active ? `bg-gradient-to-br ${ac.grad} text-white` : 'bg-white/15 text-white'}`}>
                    <TabIcon className="w-[18px] h-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className={`text-[12px] sm:text-[14px] font-bold leading-tight ${active ? 'text-[#0B2545]' : 'text-white'}`}>{it.short ?? it.title}</span>
                  {active && !reduced && (
                    <span aria-hidden="true" className="absolute left-3 right-3 bottom-1.5 h-[2px] rounded-full bg-slate-100 overflow-hidden">
                      <span key={index} className="activa-trust-progress block h-full rounded-full" style={{ background: ac.solid, animationDuration: `${STEP}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Téléphone */}
        <div className="relative shrink-0">
          <div className="sm:hidden mb-5">
            <ShowcaseHeader label={label} heading={heading} center />
          </div>
          <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-3xl opacity-60 transition-colors duration-700" style={{ background: `radial-gradient(closest-side, ${a.solid}, transparent)` }} />
          <div className="relative w-[236px] h-[470px] sm:w-[248px] sm:h-[500px] rounded-[44px] bg-gradient-to-b from-[#1B2B52] to-[#0A1530] p-[9px] shadow-[0_50px_90px_-40px_rgb(1_8_28/0.95),inset_0_0_0_1.5px_rgb(255_255_255/0.14)] rotate-[2deg]">
            <span aria-hidden="true" className="absolute -left-[3px] top-24 w-[3px] h-10 rounded-l bg-[#24365F]" />
            <span aria-hidden="true" className="absolute -right-[3px] top-32 w-[3px] h-16 rounded-r bg-[#24365F]" />
            <div className="relative h-full rounded-[36px] overflow-hidden bg-white">
              <span aria-hidden="true" className="absolute z-20 left-1/2 -translate-x-1/2 top-2 w-[78px] h-[22px] rounded-full bg-[#0A1530]" />
              <div key={index} className="activa-screen-in absolute inset-0">
                <Screen />
              </div>
              <ChannelAction item={current} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#1449B0]/40">
                <span className="sr-only">{current.cta ?? current.title}</span>
              </ChannelAction>
            </div>
          </div>
          {/* Bouton d'action flottant */}
          <ChannelAction
            item={current}
            className="group/cta absolute z-20 left-1/2 -translate-x-1/2 -bottom-5 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white pl-4 pr-1.5 py-1.5 text-[13.5px] font-bold text-[#0B2545] shadow-[0_20px_40px_-16px_rgb(0_0_0/0.75)] ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          >
            <span>{current.cta ?? current.title}</span>
            <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.grad} text-white flex items-center justify-center`}>
              <ActionArrow item={current} className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
            </span>
          </ChannelAction>
          <span className="sr-only">{availability}</span>
        </div>
      </div>
    </div>
  );
}
