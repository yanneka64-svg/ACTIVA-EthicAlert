/**
 * === AMÉLIORATION AJOUTÉE (ligne d'assistance téléphonique) ===
 *
 * Sur demande explicite (« un peu comme NAVEX ») : page publique
 * « Ligne d'assistance » (`/helpline`).
 * - Numéro WhatsApp Business réel, le même pour tous les pays :
 *   +237 687 45 45 45, plus l'adresse e-mail dédiée. Avec le formulaire en
 *   ligne, cela fait trois canaux. Pas de bouton d'appel téléphonique
 *   classique : ce numéro est un compte WhatsApp Business.
 * - Le numéro « défile » à l'affichage ; boutons Ouvrir WhatsApp et
 *   Copier ; e-mail avec Écrire et Copier.
 * - Déroulé de l'appel en 4 étapes qui s'allument l'une après l'autre.
 * - Autres canaux : en ligne, e-mail, suivi d'un dossier.
 */
import React from 'react';
import { Copy, Check, Send, MessageCircle, Search, Mail, ArrowRight, Globe2, Bot, Lock, Paperclip } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { BrandBlueBackdrop } from './ui/BrandBlue';

// Coordonnées réelles du canal (mêmes valeurs que ContactView.tsx).
export const HELPLINE_NUMBER = '+237 687 45 45 45';
export const HELPLINE_WHATSAPP_LINK = 'https://wa.me/237687454545';
export const HELPLINE_EMAIL = 'activa.whistleblowing@group-activa.com';

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
    const id = window.setTimeout(() => setShown(value), 250);
    return () => window.clearTimeout(id);
  }, [value]);
  return (
    <span className="inline-flex items-baseline tabular-nums" aria-label={value}>
      {shown.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
            <span
              className="flex flex-col transition-transform duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(ch) * 10}%)`, transitionDelay: `${i * 45}ms` }}
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
    const id = window.setInterval(() => setStep((s) => (s + 1) % 4), 2600);
    return () => window.clearInterval(id);
  }, [reduced]);

  const copy = (text: string, field: 'phone' | 'email') => {
    void navigator.clipboard?.writeText(text);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const STEPS = [
    { Icon: MessageCircle, title: t.helpline_step1_title, desc: t.helpline_step1_desc },
    { Icon: Bot, title: t.helpline_step2_title, desc: t.helpline_step2_desc },
    { Icon: Lock, title: t.helpline_step3_title, desc: t.helpline_step3_desc },
    { Icon: Paperclip, title: t.helpline_step4_title, desc: t.helpline_step4_desc },
  ];

  const ghostBtn =
    'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300';

  return (
    <div>
      {/* Bandeau bleu : titre + carte d'appel */}
      <div className="relative overflow-hidden">
        <BrandBlueBackdrop />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-10 items-center">
          <div>
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
                  <MessageCircle className="activa-ring w-7 h-7" strokeWidth={1.9} />
                </span>
              </span>
              <span className="text-sm text-white/85 leading-snug max-w-[16rem]">{t.helpline_reassurance}</span>
            </div>
          </div>

          {/* Carte : téléphone / WhatsApp puis e-mail */}
          <div className="activa-modal-in relative bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t.helpline_your_number}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <span className="activa-live-dot w-2 h-2 rounded-full bg-emerald-500" />
                {t.helpline_available}
              </span>
            </div>
            <div id="helpline-number" className="mt-3 text-[32px] sm:text-[42px] font-extrabold tracking-tight text-[#0B2545] leading-none">
              <RollingNumber value={HELPLINE_NUMBER} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
              <Globe2 className="w-4 h-4 text-slate-400" strokeWidth={1.9} />
              {t.helpline_from_anywhere}
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
              <a
                id="helpline-whatsapp"
                href={HELPLINE_WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="activa-shine group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] hover:from-[#1449B0] hover:to-[#0F3C93] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30 hover:-translate-y-0.5 transition-all duration-300"
              >
                <MessageCircle className="activa-ring-hover w-4 h-4" strokeWidth={2} />
                {t.helpline_whatsapp_btn}
              </a>
              <button type="button" onClick={() => copy(HELPLINE_NUMBER.replace(/\s/g, ''), 'phone')} className={ghostBtn} aria-label={t.helpline_copy}>
                {copied === 'phone' ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} /> : <Copy className="w-4 h-4" strokeWidth={1.9} />}
                <span>{copied === 'phone' ? t.helpline_copied : t.helpline_copy}</span>
              </button>
            </div>

            <div className="mt-6 rounded-[22px] bg-[#F3F6FC] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t.helpline_email_label}</p>
              <p id="helpline-email" className="mt-2 text-[15px] sm:text-[17px] font-bold text-[#0B2545] break-all">{HELPLINE_EMAIL}</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <a href={`mailto:${HELPLINE_EMAIL}`} className={`group ${ghostBtn} py-2.5`}>
                  <Mail className="w-4 h-4 text-[#1449B0]" strokeWidth={1.9} />
                  {t.helpline_email_btn}
                </a>
                <button type="button" onClick={() => copy(HELPLINE_EMAIL, 'email')} className={`${ghostBtn} py-2.5`}>
                  {copied === 'email' ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.2} /> : <Copy className="w-4 h-4" strokeWidth={1.9} />}
                  {copied === 'email' ? t.helpline_copied : t.helpline_copy}
                </button>
              </div>
            </div>
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
            { Icon: Mail, title: t.helpline_home_email_title, desc: HELPLINE_EMAIL, href: `mailto:${HELPLINE_EMAIL}` },
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
              'group text-left flex items-start gap-4 p-5 sm:p-6 rounded-[24px] bg-white border border-slate-200/90 shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)] hover:-translate-y-1 hover:shadow-[0_30px_56px_-30px_rgb(15_23_42/0.5)] transition-all duration-300';
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
