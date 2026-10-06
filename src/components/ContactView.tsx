import React, { useState } from 'react';
import { MessageCircle, Mail, CheckCircle2, Copy, ExternalLink, Info, ShieldCheck, Check } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) ===
import { BrandPageHero } from './ui/BrandBlue';

interface ContactViewProps {
  lang: Language;
}

// === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
// Coordonnées réelles du Groupe ACTIVA pour ce canal — à mettre à jour
// depuis un seul endroit si le numéro/l'adresse change un jour.
const WHATSAPP_DISPLAY = '00237 687 45 45 45';
const WHATSAPP_LINK = 'https://wa.me/237687454545';
const CONTACT_EMAIL = 'activa.whistleblowing@group-activa.com';

/**
 * === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel, maquette de
 * référence) ===
 *
 * Remplace l'ancien lien "Contact" qui se contentait de faire défiler
 * jusqu'au pied de page : devient un vrai onglet public (`/contact`, voir
 * routing/routes.ts et App.tsx) présentant les deux canaux réels du Groupe
 * (WhatsApp Business, e-mail dédié), fidèle à la capture fournie.
 */
export const ContactView: React.FC<ContactViewProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | null>(null);

  const copy = (text: string, field: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const whatsappTips = [
    t.contact_whatsapp_tip1,
    t.contact_whatsapp_tip2,
    t.contact_whatsapp_tip3,
    t.contact_whatsapp_tip4,
  ];

  // === AMÉLIORATION AJOUTÉE (Contact — design modernisé) ===
  // En-tête animé, cartes de canal blanches à halo coloré qui apparaissent en
  // cascade et se soulèvent au survol, tuiles d'icône en dégradé, point
  // « disponible » pulsé pour WhatsApp, bouton de copie dont l'icône devient
  // une coche animée, boutons avec flèche/lien qui avance, conseils en
  // cascade, encart confidentialité en dégradé. Mêmes canaux, mêmes liens,
  // même comportement de copie. Animations coupées si l'utilisateur limite
  // les animations (index.css).
  const cardBase =
    'activa-enter relative overflow-hidden grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 p-6 sm:p-8 rounded-[24px] border bg-white transition-all duration-300 hover:-translate-y-0.5';
  const copyBtn =
    'w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-inset transition-all duration-300';

  // === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) === bandeau
  // bleu avec titre blanc ; cartes à contour neutre qui chevauchent le bas du
  // bandeau. L'ancien en-tête reste dans le code, masqué.
  return (
    <>
    <BrandPageHero Icon={MessageCircle} title={t.contact_title} subtitle={t.contact_subtitle} />
    <div className="relative z-10 -mt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 space-y-5">
      <div className="hidden max-w-2xl space-y-3">
        <h1 className="activa-enter text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ '--d': '0ms' } as React.CSSProperties}>{t.contact_title}</h1>
        <div className="activa-draw-x w-12 h-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-400" style={{ '--d': '150ms' } as React.CSSProperties} />
        <p className="activa-enter text-sm text-slate-600" style={{ '--d': '120ms' } as React.CSSProperties}>{t.contact_subtitle}</p>
      </div>

      {/* WhatsApp Business */}
      <div
        className={`${cardBase} border-slate-200/90 shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)] hover:shadow-[0_30px_60px_-32px_rgb(15_23_42/0.5)]`}
        style={{ '--d': '200ms' } as React.CSSProperties}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 w-72 h-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3.5">
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/30">
              <MessageCircle className="w-7 h-7" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-base font-bold text-slate-900 tracking-tight">{t.contact_whatsapp_title}</div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <span aria-hidden="true" className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                {t.contact_whatsapp_available}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{WHATSAPP_DISPLAY}</span>
            <button
              type="button"
              id="btn-copy-whatsapp"
              onClick={() => copy(WHATSAPP_DISPLAY.replace(/\s+/g, ''), 'phone')}
              className={`${copyBtn} ${copiedField === 'phone' ? 'bg-emerald-500 text-white ring-emerald-500' : 'bg-white text-slate-500 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-300'}`}
              title={t.btn_copy}
            >
              {copiedField === 'phone' ? <Check key="ok" className="activa-pop w-4 h-4" strokeWidth={3} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
            </button>
            {copiedField === 'phone' && <span className="activa-fade-in text-xs text-emerald-700 font-semibold">{t.btn_copy} ✓</span>}
          </div>

          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-open-whatsapp"
            className="activa-shine group inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/35 hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
            <span>{t.contact_whatsapp_btn}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
          </a>
        </div>

        <div className="hidden sm:block w-px bg-gradient-to-b from-transparent via-emerald-200 to-transparent" />

        <ul className="relative space-y-3 self-center">
          {whatsappTips.map((tip, idx) => (
            <li
              key={idx}
              className="activa-enter flex items-start gap-3 text-sm text-slate-700"
              style={{ '--d': `${350 + idx * 80}ms` } as React.CSSProperties}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dedicated email */}
      <div
        className={`${cardBase} border-slate-200/90 shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)] hover:shadow-[0_30px_60px_-32px_rgb(15_23_42/0.5)]`}
        style={{ '--d': '320ms' } as React.CSSProperties}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 w-72 h-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3.5">
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
              <Mail className="w-7 h-7" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-base font-bold text-slate-900 tracking-tight">{t.contact_email_title}</div>
              <div className="inline-flex items-center gap-1.5 mt-0.5 px-2 py-0.5 rounded-full bg-blue-50 ring-1 ring-inset ring-blue-200 text-xs font-semibold text-blue-700">
                {t.contact_email_recommended}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Retour à la ligne autorisé juste après « @ » (au lieu de couper
                n'importe où, ex. « .c / om » sur mobile). */}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-base sm:text-xl font-bold text-blue-700 hover:text-blue-800 underline-offset-4 hover:underline break-words">
              {CONTACT_EMAIL.split('@')[0]}@<wbr />{CONTACT_EMAIL.split('@')[1]}
            </a>
            <button
              type="button"
              id="btn-copy-email"
              onClick={() => copy(CONTACT_EMAIL, 'email')}
              className={`${copyBtn} ${copiedField === 'email' ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-500 ring-slate-200 hover:text-blue-700 hover:ring-blue-300'}`}
              title={t.btn_copy}
            >
              {copiedField === 'email' ? <Check key="ok" className="activa-pop w-4 h-4" strokeWidth={3} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
            </button>
            {copiedField === 'email' && <span className="activa-fade-in text-xs text-blue-700 font-semibold">{t.btn_copy} ✓</span>}
          </div>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            id="btn-send-email"
            className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-blue-50 border border-blue-300 hover:border-blue-400 text-blue-700 font-bold text-sm shadow-sm hover:shadow-md hover:shadow-blue-600/10 hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            <Mail className="w-4 h-4" strokeWidth={1.75} />
            <span>{t.contact_email_btn}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
          </a>
        </div>

        <div className="hidden sm:block w-px bg-gradient-to-b from-transparent via-blue-200 to-transparent" />

        <div className="relative flex items-start gap-3 self-center text-sm text-slate-700">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <div className="space-y-2.5">
            <p>{t.contact_email_info1}</p>
            <p>{t.contact_email_info2}</p>
            <p>{t.contact_email_info3}</p>
          </div>
        </div>
      </div>

      {/* Confidentiality note — même motif que le formulaire de signalement */}
      <div
        className="activa-enter flex items-center gap-4 p-5 rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)]"
        style={{ '--d': '440ms' } as React.CSSProperties}
      >
        <span className="w-11 h-11 rounded-xl bg-white text-blue-700 ring-1 ring-inset ring-blue-200/70 shadow-sm flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
        </span>
        <div>
          <div className="font-bold text-base text-blue-900 tracking-tight">{t.sidebar_confidentiality_title}</div>
          <p className="text-sm text-slate-600">{t.contact_confidentiality_desc}</p>
        </div>
      </div>
    </div>
    </>
  );
};
