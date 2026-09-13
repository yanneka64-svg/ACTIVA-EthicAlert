import React, { useState } from 'react';
import {
  ShieldCheck,
  UserX,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Scale,
  HeartHandshake,
  ExternalLink,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_COUNTRIES } from '../data/activaConfig';
import { storage } from '../services/storage';

interface WhistleblowerHomeProps {
  lang: Language;
  onStartNewAlert: () => void;
  onGoToTrack: () => void;
  onOpenQrModal: () => void;
  onOpenDesk: () => void;
}

export const WhistleblowerHome: React.FC<WhistleblowerHomeProps> = ({
  lang,
  onStartNewAlert,
  onGoToTrack,
  onOpenQrModal,
  onOpenDesk,
}) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === reads the
  // real, editable category list (storage.ts) instead of the static
  // ALERT_CATEGORIES import, so a category an admin adds/renames/removes
  // is reflected here too, not just in the admin screen.
  const alertCategories = storage.getCategories();

  // === AMÉLIORATION AJOUTÉE (Phase 2 — FAQ section, absente jusqu'ici) ===
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const faqItems: { q: string; a: string }[] = [
    { q: t.faq_q1, a: t.faq_a1 },
    { q: t.faq_q2, a: t.faq_a2 },
    { q: t.faq_q3, a: t.faq_a3 },
    { q: t.faq_q4, a: t.faq_a4 },
    { q: t.faq_q5, a: t.faq_a5 },
    { q: t.faq_q6, a: t.faq_a6 },
  ];

  return (
    <div className="space-y-12 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* === AMÉLIORATION AJOUTÉE (Phase 11 — reproduction fidèle de la
          maquette) === Hero reconstruit : bloc de texte à gauche (titre
          court + sous-titre + 2 boutons + 3 badges Confidentialité/
          Anonymat/Pas de représailles), visuel dégradé à droite en
          remplacement de la photographie de la maquette (aucun asset photo
          réel n'étant disponible pour ce projet). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
        <div className="bg-white p-8 sm:p-12 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0B2545] leading-tight">
            {t.hero_title}
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md">
            {t.hero_desc}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="hero-btn-new-alert"
              onClick={onStartNewAlert}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition"
            >
              <span>{t.btn_new_alert}</span>
            </button>

            <button
              id="hero-btn-track"
              onClick={onGoToTrack}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 transition"
            >
              <span>{t.btn_track_existing}</span>
            </button>

            <button
              id="hero-btn-qr"
              onClick={onOpenQrModal}
              className="p-3 rounded-xl bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 transition"
              title="Afficher le QR code pour smartphone"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          {/* Guarantee Badges — exact match with the reference mockup's 3 feature icons */}
          <div className="pt-6 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
            <div className="flex flex-col items-start gap-1.5">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800">{t.hero_feature_confidentiality_title}</span>
              <span className="text-slate-500 text-[11px] leading-snug">{t.hero_feature_confidentiality_desc}</span>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <UserX className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800">{t.hero_feature_anonymity_title}</span>
              <span className="text-slate-500 text-[11px] leading-snug">{t.hero_feature_anonymity_desc}</span>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <HeartHandshake className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800">{t.hero_feature_no_retaliation_title}</span>
              <span className="text-slate-500 text-[11px] leading-snug">{t.hero_feature_no_retaliation_desc}</span>
            </div>
          </div>
        </div>

        {/* Decorative visual (stand-in for the mockup's photograph) */}
        <div className="relative hidden lg:block bg-gradient-to-br from-blue-700 via-teal-600 to-emerald-500 min-h-[380px] overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute left-10 top-16 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>

      {/* Scope / Covered Categories (CDC 2.0) */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
            Périmètre d'application & Comportements signalables
          </h3>
          <p className="text-xs text-slate-600">
            Conformément au Code éthique et à la Politique de lutte contre la fraude du Groupe ACTIVA (CDC 2.0).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {alertCategories.map((cat, idx) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-blue-400 transition space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                0{idx + 1}
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {cat.name}
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {cat.subCategories.map((sub, sidx) => (
                  <li key={sidx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{sub}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVA Group Footprint (10 Countries, 16 Subsidiaries - CDC 1.0) */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Présence Panafricaine & Internationale
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              16 entités réparties dans 10 pays
            </h3>
          </div>
          <p className="text-xs text-slate-500 max-w-sm">
            Une plateforme unifiée et centralisée pour harmoniser les pratiques de signalement dans toutes les filiales.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {ACTIVA_COUNTRIES.map((c) => (
            <div
              key={c.code}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-2.5"
            >
              <span className="text-xl">{c.flag}</span>
              <div>
                <span className="font-bold text-slate-900 block">{c.name}</span>
                <span className="text-[10px] text-slate-500">Filiales ACTIVA</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works (Process) — id targeted by the Navbar's "Comment ça marche" link */}
      <div id="how-it-works-section" className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 space-y-8">
        <div className="max-w-xl">
          <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
            Processus de traitement sécurisé
          </span>
          <h3 className="text-2xl font-bold mt-1">
            Comment votre alerte est-elle gérée par la DARC ?
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-xs">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              1
            </div>
            <div className="font-bold text-white text-sm">Dépôt sécurisé</div>
            <p className="text-slate-300 leading-relaxed">
              Formulaire anonyme ou identifié, génération d'un numéro unique et mot de passe de suivi.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
              2
            </div>
            <div className="font-bold text-white text-sm">Évaluation NOCA</div>
            <p className="text-slate-300 leading-relaxed">
              Classification selon la matrice de risques officielle (impact, hiérarchie, récidive, réputation).
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
              3
            </div>
            <div className="font-bold text-white text-sm">Investigation & Échanges</div>
            <p className="text-slate-300 leading-relaxed">
              Attribution aux auditeurs assermentés, dialogue chiffré sans lever votre anonymat.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
              4
            </div>
            <div className="font-bold text-white text-sm">Mesures & Clôture</div>
            <p className="text-slate-300 leading-relaxed">
              Documentation obligatoire des plans d'action correctifs et information du déclarant.
            </p>
          </div>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 2 — section FAQ) === id targeted by the Navbar's "FAQ" link */}
      <div id="faq-section" className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{t.faq_title}</h3>
          <p className="text-xs text-slate-600">{t.faq_subtitle}</p>
        </div>

        <div className="max-w-3xl mx-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {faqItems.map((item, idx) => {
            const open = openFaqIndex === idx;
            return (
              <div key={idx} className="bg-white">
                <button
                  onClick={() => setOpenFaqIndex(open ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
                >
                  <span className="text-sm font-semibold text-slate-800">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
