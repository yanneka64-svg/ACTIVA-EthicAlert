import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  UserX, 
  FileText, 
  Search, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Scale, 
  HeartHandshake, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_COUNTRIES, ALERT_CATEGORIES } from '../data/activaConfig';

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

  return (
    <div className="space-y-12 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2545] via-[#134074] to-[#0B2545] text-white p-8 sm:p-12 shadow-xl border border-[#134074]">
        {/* Subtle decorative grid/glow */}
        <div className="absolute -right-16 -bottom-16 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-24 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-semibold text-amber-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Direction d’Audit, des Risques et de la Conformité (DARC)</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {t.hero_title}
          </h2>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
            {t.hero_desc}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              id="hero-btn-new-alert"
              onClick={onStartNewAlert}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition transform active:scale-98"
            >
              <FileText className="w-4 h-4 text-slate-950" />
              <span>{t.btn_new_alert}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-btn-track"
              onClick={onGoToTrack}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-sm border border-white/20 transition"
            >
              <Search className="w-4 h-4 text-slate-300" />
              <span>{t.btn_track_existing}</span>
            </button>

            <button
              id="hero-btn-qr"
              onClick={onOpenQrModal}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-amber-300 border border-white/20 transition"
              title="Afficher le QR code pour smartphone"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          {/* Guarantee Badges */}
          <div className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200">Anonymat garanti sans enregistrement d'IP</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-slate-200">Chiffrement de bout en bout</span>
            </div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-slate-200">Protection totale contre les représailles</span>
            </div>
          </div>
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
          {ALERT_CATEGORIES.map((cat, idx) => (
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

      {/* How it works (Process) */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 space-y-8">
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
    </div>
  );
};
