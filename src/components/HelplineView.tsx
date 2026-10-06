/**
 * === AMÉLIORATION AJOUTÉE (ligne d'assistance téléphonique — aperçu) ===
 *
 * Sur demande explicite (« un peu comme NAVEX ») : page publique
 * « Ligne d'assistance » (`/helpline`).
 * - Choix du pays (drapeaux) → le numéro à composer s'affiche avec un
 *   défilement des chiffres ; bouton Appeler (lien `tel:`) et Copier.
 * - Indicateur « Ligne ouverte » (point qui pulse) selon les horaires.
 * - Déroulé de l'appel en 4 étapes qui s'allument l'une après l'autre.
 * - Autres canaux : en ligne, WhatsApp (réel), suivi d'un dossier.
 *
 * APERÇU : les numéros ci-dessous sont des EXEMPLES, non attribués. Tant que
 * `HELPLINE_IS_EXAMPLE` vaut `true`, un bandeau l'indique et le bouton
 * Appeler ne compose rien. Pour la mise en service : remplacer les numéros
 * de `HELPLINE_NUMBERS` par les vrais et passer `HELPLINE_IS_EXAMPLE` à
 * `false`.
 */
import React from 'react';
import { Phone, Copy, Check, Send, MessageCircle, Search, Clock3, Languages, ArrowRight, Info, Headphones, PenLine, KeyRound } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_COUNTRIES } from '../data/activaConfig';
import { BrandBlueBackdrop } from './ui/BrandBlue';

export const HELPLINE_IS_EXAMPLE = true;

/** Numéros d'EXEMPLE (indicatif réel du pays + 800 000 0NN fictif). */
export const HELPLINE_NUMBERS: Record<string, { number: string; languages: string[] }> = {
  CM: { number: '+237 800 000 001', languages: ['Français', 'English'] },
  CD: { number: '+243 800 000 002', languages: ['Français'] },
  GN: { number: '+224 800 000 003', languages: ['Français'] },
  CI: { number: '+225 800 000 004', languages: ['Français'] },
  GH: { number: '+233 800 000 005', languages: ['English'] },
  LR: { number: '+231 800 000 006', languages: ['English'] },
  SL: { number: '+232 800 000 007', languages: ['English'] },
  MU: { number: '+230 800 000 008', languages: ['Français', 'English'] },
  FR: { number: '+33 800 000 009', languages: ['Français'] },
  AO: { number: '+244 800 000 010', languages: ['Português'] },
};

const WHATSAPP_LINK = 'https://wa.me/237687454545';
const WHATSAPP_DISPLAY = '00237 687 45 45 45';

/** Exemple d'horaires : lundi–vendredi, 8 h – 18 h (heure de l'appareil). */
function isLineOpen(now: Date): boolean {
  const d = now.getDay();
  const h = now.getHours();
  return d >= 1 && d <= 5 && h >= 8 && h < 18;
}

function usePrefersReducedMotion(): boolean {
  return React.useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
}

/** Numéro dont chaque chiffre « roule » jusqu'à sa nouvelle valeur. */
const RollingNumber: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex items-baseline tabular-nums" aria-label={value}>
    {value.split('').map((ch, i) =>
      /\d/.test(ch) ? (
        <span key={i} aria-hidden="true" className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
          <span
            className="flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
            style={{ transform: `translateY(-${Number(ch) * 10}%)`, transitionDelay: `${i * 35}ms` }}
          >
            {'0123456789'.split('').map((d) => (
              <span key={d} className="h-[1.15em] leading-[1.15em]">{d}</span>
            ))}
          </span>
        </span>
      ) : (
        <span key={i} aria-hidden="true" className={ch === ' ' ? 'w-[0.3em]' : ''}>{ch === ' ' ? ' ' : ch}</span>
      )
    )}
  </span>
);

interface HelplineViewProps {
  lang: Language;
  onStartNewAlert: () => void;
  onGoToTrack: () => void;
}

export const HelplineView: React.FC<HelplineViewProps> = ({ lang, onStartNewAlert, onGoToTrack }) => {
  const t = TRANSLATIONS[lang];
  const reduced = usePrefersReducedMotion();
  const countries = ACTIVA_COUNTRIES.filter((c) => HELPLINE_NUMBERS[c.code]);
  const [code, setCode] = React.useState<string>('CM');
  const [copied, setCopied] = React.useState(false);
  const [notice, setNotice] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const open = isLineOpen(new Date());
  const entry = HELPLINE_NUMBERS[code];
  const country = countries.find((c) => c.code === code);

  React.useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % 4), 2600);
    return () => window.clearInterval(id);
  }, [reduced]);

  const copy = () => {
    void navigator.clipboard?.writeText(entry.number.replace(/\s/g, ''));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const call = (e: React.MouseEvent) => {
    if (HELPLINE_IS_EXAMPLE) {
      e.preventDefault();
      setNotice(true);
      window.setTimeout(() => setNotice(false), 3200);
    }
  };

  const STEPS = [
    { Icon: Phone, title: t.helpline_step1_title, desc: t.helpline_step1_desc },
    { Icon: Headphones, title: t.helpline_step2_title, desc: t.helpline_step2_desc },
    { Icon: PenLine, title: t.helpline_step3_title, desc: t.helpline_step3_desc },
    { Icon: KeyRound, title: t.helpline_step4_title, desc: t.helpline_step4_desc },
  ];

  return (
    <div>
      {/* Bandeau bleu : titre + carte d'appel */}
      <div className="relative overflow-hidden">
        <BrandBlueBackdrop />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-10 items-center">
          <div>
            {HELPLINE_IS_EXAMPLE && (
              <p className="activa-enter inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-amber-300 text-[#3B2A00] text-[11px] font-bold">
                <Info className="w-3.5 h-3.5" strokeWidth={2.2} />
                {t.helpline_preview_banner}
              </p>
            )}
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

          {/* Carte d'appel */}
          <div className="activa-modal-in relative bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t.helpline_choose_country}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t.helpline_choose_country}>
              {countries.map((c) => {
                const active = c.code === code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    id={`helpline-country-${c.code}`}
                    onClick={() => setCode(c.code)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1449B0]/20 ${
                      active
                        ? 'bg-[#1449B0] border-[#1449B0] text-white shadow-[0_8px_18px_-8px_rgb(20_73_176/0.8)]'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:-translate-y-0.5'
                    }`}
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[22px] bg-[#F3F6FC] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">
                  {t.helpline_your_number} · <span aria-hidden="true">{country?.flag}</span> {country?.name}
                </span>
                {HELPLINE_IS_EXAMPLE && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold uppercase tracking-wide">
                    {t.helpline_example_badge}
                  </span>
                )}
              </div>
              <div id="helpline-number" className="mt-2 text-[30px] sm:text-[38px] font-extrabold tracking-tight text-[#0B2545] leading-none">
                <RollingNumber value={entry.number} />
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
                <a
                  id="helpline-call"
                  href={`tel:${entry.number.replace(/\s/g, '')}`}
                  onClick={call}
                  className="activa-shine group inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] hover:from-[#1449B0] hover:to-[#0F3C93] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Phone className="activa-ring-hover w-4 h-4" strokeWidth={2} />
                  {t.helpline_call}
                </a>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 transition-all duration-300"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} /> : <Copy className="w-4 h-4" strokeWidth={1.9} />}
                  {copied ? t.helpline_copied : t.helpline_copy}
                </button>
              </div>
              {notice && (
                <p role="status" className="activa-enter mt-3 text-[12px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {t.helpline_example_toast}
                </p>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div className="sm:col-span-2 flex items-start gap-2.5">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${open ? 'activa-live-dot bg-emerald-500' : 'bg-slate-300'}`} />
                <div>
                  <dt className="sr-only">Statut</dt>
                  <dd className={`font-bold ${open ? 'text-emerald-700' : 'text-slate-600'}`}>{open ? t.helpline_open : t.helpline_closed}</dd>
                </div>
              </div>
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
                  <dd className="font-semibold text-slate-800">{entry.languages.join(' · ')}</dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Déroulé de l'appel : les étapes s'allument l'une après l'autre */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 space-y-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-[0.16em] text-[#1449B0]">{t.helpline_steps_label}</span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B2545]">{t.helpline_steps_heading}</h2>
        </div>
        <div className="relative">
          {/* fil qui se remplit d'une étape à l'autre */}
          <div aria-hidden="true" className="hidden lg:block absolute left-[12.5%] right-[12.5%] top-[34px] h-[3px] rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1449B0] to-[#5A86DD] transition-[width] duration-700 ease-out"
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
                    className={`relative w-[70px] h-[70px] rounded-[22px] flex items-center justify-center transition-all duration-500 ${
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
                  <span className={`mt-4 text-[16px] font-extrabold tracking-tight transition-colors duration-500 ${lit ? 'text-[#0B2545]' : 'text-slate-400'}`}>{title}</span>
                  <span className={`mt-1 text-[13.5px] leading-relaxed max-w-[17rem] transition-colors duration-500 ${lit ? 'text-slate-600' : 'text-slate-400'}`}>{desc}</span>
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
            { Icon: MessageCircle, title: t.helpline_other_whatsapp_title, desc: `${t.helpline_other_whatsapp_desc} ${WHATSAPP_DISPLAY}`, href: WHATSAPP_LINK },
            { Icon: Search, title: t.helpline_other_track_title, desc: t.helpline_other_track_desc, onClick: onGoToTrack },
          ].map(({ Icon, title, desc, onClick, href }) => {
            const body = (
              <>
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shrink-0 shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)] transition-transform duration-300 group-hover:scale-105">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-[#0B2545] text-[15px]">{title}</span>
                  <span className="block mt-0.5 text-[13px] text-slate-500 leading-relaxed">{desc}</span>
                </span>
                <ArrowRight className="w-4 h-4 mt-1 text-[#1449B0] transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </>
            );
            const cls =
              'group text-left flex items-start gap-4 p-5 sm:p-6 rounded-[24px] bg-white border border-slate-200/90 shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)] hover:-translate-y-1 hover:shadow-[0_30px_56px_-30px_rgb(15_23_42/0.5)] transition-all duration-300';
            return href ? (
              <a key={title} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
            ) : (
              <button key={title} type="button" onClick={onClick} className={cls}>{body}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
