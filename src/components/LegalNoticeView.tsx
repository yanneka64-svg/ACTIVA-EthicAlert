import React from 'react';
import { Building2, Server, Copyright, Scale, Mail } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) ===
import { BrandPageHero } from './ui/BrandBlue';

interface LegalNoticeViewProps {
  lang: Language;
}

const CONTACT_EMAIL = 'activa.whistleblowing@group-activa.com';

/**
 * === AMÉLIORATION AJOUTÉE (page "Mentions légales" réelle) ===
 *
 * Remplace le bouton décoratif du pied de page (sans destination) par un
 * vrai onglet public (`/legal-notice`, voir routing/routes.ts et App.tsx),
 * sur le même modèle que ContactView.tsx.
 *
 * === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
 * BUG PRÉEXISTANT CORRIGÉ : ce contenu était publié avec des espaces
 * réservés non remplis ([Adresse du siège social], [Numéro RCCM]...),
 * une non-conformité légale visible instantanément. Adresse et entité
 * éditrice désormais réelles et confirmées (i18n/translations.ts,
 * `legal_editor_body`) ; le numéro RCCM, le représentant légal et
 * l'hébergeur restent explicitement marqués « à compléter par le service
 * juridique du Groupe » — jamais inventés — en attendant leur confirmation.
 */
export const LegalNoticeView: React.FC<LegalNoticeViewProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];

  const sections = [
    { icon: Building2, heading: t.legal_editor_heading, body: t.legal_editor_body },
    { icon: Server, heading: t.legal_hosting_heading, body: t.legal_hosting_body },
    { icon: Copyright, heading: t.legal_ip_heading, body: t.legal_ip_body },
    { icon: Scale, heading: t.legal_liability_heading, body: t.legal_liability_body },
  ];

  // === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) === bandeau
  // bleu avec titre blanc ; les cartes (contour neutre) chevauchent le bas du
  // bandeau. L'ancien titre reste dans le code, masqué.
  return (
    <>
    <BrandPageHero Icon={Scale} title={t.legal_title} subtitle={t.legal_subtitle} maxWidth="max-w-4xl" />
    <div className="relative z-10 -mt-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 space-y-5">
      <div className="hidden space-y-1.5">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.legal_title}</h1>
        <p className="text-sm text-slate-600">{t.legal_subtitle}</p>
      </div>

      {sections.map((section, idx) => {
        const Icon = section.icon;
        return (
          <div key={idx} className="flex items-start gap-4 p-6 rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)]">
            <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">{section.heading}</h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{section.body}</p>
            </div>
          </div>
        );
      })}

      <div className="flex items-start gap-4 p-6 rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_48px_-34px_rgb(15_23_42/0.45)]">
        <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-900">{t.legal_contact_heading}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t.legal_contact_body}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-bold text-blue-700 hover:underline break-all">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
    </>
  );
};
