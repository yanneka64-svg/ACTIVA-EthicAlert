import React, { useState } from 'react';
import { MessageCircle, Mail, CheckCircle2, Copy, ExternalLink, Info, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="max-w-2xl space-y-1.5">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.contact_title}</h1>
        <p className="text-sm text-slate-600">{t.contact_subtitle}</p>
      </div>

      {/* WhatsApp Business */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 p-6 sm:p-8 rounded-2xl border border-emerald-200 bg-emerald-50/40">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-7 h-7" />
            </span>
            <div>
              <div className="font-bold text-slate-900">{t.contact_whatsapp_title}</div>
              <div className="text-xs font-semibold text-emerald-700">{t.contact_whatsapp_available}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{WHATSAPP_DISPLAY}</span>
            <button
              type="button"
              id="btn-copy-whatsapp"
              onClick={() => copy(WHATSAPP_DISPLAY.replace(/\s+/g, ''), 'phone')}
              className="p-1.5 rounded-lg hover:bg-white/70 text-slate-500"
              title={t.btn_copy}
            >
              <Copy className="w-4 h-4" />
            </button>
            {copiedField === 'phone' && <span className="text-[11px] text-emerald-700 font-semibold">{t.btn_copy} ✓</span>}
          </div>

          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-open-whatsapp"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t.contact_whatsapp_btn}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        <div className="hidden sm:block w-px bg-emerald-200" />

        <ul className="space-y-2.5 self-center">
          {whatsappTips.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dedicated email */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 p-6 sm:p-8 rounded-2xl border border-blue-200 bg-blue-50/40">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Mail className="w-7 h-7" />
            </span>
            <div>
              <div className="font-bold text-slate-900">{t.contact_email_title}</div>
              <div className="text-xs font-semibold text-blue-700">{t.contact_email_recommended}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-lg sm:text-xl font-bold text-blue-700 hover:underline break-all">
              {CONTACT_EMAIL}
            </a>
            <button
              type="button"
              id="btn-copy-email"
              onClick={() => copy(CONTACT_EMAIL, 'email')}
              className="p-1.5 rounded-lg hover:bg-white/70 text-slate-500"
              title={t.btn_copy}
            >
              <Copy className="w-4 h-4" />
            </button>
            {copiedField === 'email' && <span className="text-[11px] text-blue-700 font-semibold">{t.btn_copy} ✓</span>}
          </div>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            id="btn-send-email"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-sm shadow-sm transition"
          >
            <Mail className="w-4 h-4" />
            <span>{t.contact_email_btn}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        <div className="hidden sm:block w-px bg-blue-200" />

        <div className="flex items-start gap-2.5 self-center text-sm text-slate-700">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-2.5">
            <p>{t.contact_email_info1}</p>
            <p>{t.contact_email_info2}</p>
            <p>{t.contact_email_info3}</p>
          </div>
        </div>
      </div>

      {/* Confidentiality note — même motif que le formulaire de signalement */}
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white">
        <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div>
          <div className="font-bold text-sm text-blue-900">{t.sidebar_confidentiality_title}</div>
          <p className="text-xs text-slate-600">{t.contact_confidentiality_desc}</p>
        </div>
      </div>
    </div>
  );
};
