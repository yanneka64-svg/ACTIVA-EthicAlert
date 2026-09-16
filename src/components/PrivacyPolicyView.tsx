import React from 'react';
import { UserCog, Database, Target, Clock, Users, ShieldCheck, Lock, Mail } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface PrivacyPolicyViewProps {
  lang: Language;
}

const CONTACT_EMAIL = 'activa.whistleblowing@group-activa.com';

/**
 * === AMÉLIORATION AJOUTÉE (page "Politique de confidentialité" réelle) ===
 *
 * Remplace le bouton décoratif du pied de page (sans destination) par un
 * vrai onglet public (`/privacy-policy`, voir routing/routes.ts et
 * App.tsx), sur le même modèle que ContactView.tsx / LegalNoticeView.tsx.
 * Contenu-type de départ, à faire relire/adapter par le Groupe ACTIVA
 * (durées de conservation exactes, etc.).
 */
export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];

  const sections = [
    { icon: UserCog, heading: t.privacy_controller_heading, body: t.privacy_controller_body },
    { icon: Database, heading: t.privacy_data_heading, body: t.privacy_data_body },
    { icon: Target, heading: t.privacy_purpose_heading, body: t.privacy_purpose_body },
    { icon: Clock, heading: t.privacy_retention_heading, body: t.privacy_retention_body },
    { icon: Users, heading: t.privacy_recipients_heading, body: t.privacy_recipients_body },
    { icon: Lock, heading: t.privacy_security_heading, body: t.privacy_security_body },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.privacy_title}</h1>
        <p className="text-sm text-slate-600">{t.privacy_subtitle}</p>
      </div>

      {sections.map((section, idx) => {
        const Icon = section.icon;
        return (
          <div key={idx} className="flex items-start gap-4 p-6 rounded-2xl border border-slate-200 bg-white">
            <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">{section.heading}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{section.body}</p>
            </div>
          </div>
        );
      })}

      <div className="flex items-start gap-4 p-6 rounded-2xl border border-blue-200 bg-blue-50/40">
        <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-900">{t.privacy_rights_heading}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t.privacy_rights_body}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline break-all">
            <Mail className="w-4 h-4 shrink-0" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
};
