import React from 'react';
import { LayoutDashboard, Search, Settings, ChevronRight, ShieldCheck } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { getRoleBadge } from './Navbar';
import { computeAvailableSpaces, SPACE_DASHBOARD_TAB, SpaceKey } from '../domain/staffSpaces';

interface StaffSpaceHomeProps {
  lang: Language;
  activeUser: UserProfile;
  setCurrentTab: (tab: string) => void;
}

/**
 * === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
 * barre latérale) ===
 *
 * Remplace le petit sélecteur "ESPACES" qui vivait en permanence en haut de
 * la barre latérale (StaffPortalLayout.tsx) par une vraie page d'accueil,
 * affichée une fois après connexion pour tout compte à 2 espaces ou plus
 * (App.tsx, `handleLogin`) — sur demande explicite de l'utilisateur, "un peu
 * comme on fait avec la page d'accueil du suivi des signalements".
 *
 * Réutilise donc délibérément l'habillage déjà établi par cet écran-là
 * (AlertTrackingView.tsx, écran de connexion) plutôt qu'un nouveau style :
 * même carte à 2 colonnes (panneau photo + panneau de contenu), même photo
 * `/brand/activa-hq.jpg`, même dégradé navy (#0B2545), même convention de
 * bouton "chip" bleu (voir `track_switch_to_new_alert` dans
 * AlertTrackingView.tsx) pour chaque choix d'espace. Le texte est
 * spécifique à ce nouvel écran (contexte différent : collaborateur déjà
 * identifié, pas un lanceur d'alerte anonyme) — seul l'habillage visuel est
 * repris à l'identique.
 *
 * Un compte à un seul espace réel ne voit jamais cet écran (App.tsx ne l'y
 * redirige pas) — comportement inchangé par rapport à l'ancien sélecteur,
 * qui ne s'affichait déjà que pour 2 espaces ou plus.
 */
export const StaffSpaceHome: React.FC<StaffSpaceHomeProps> = ({ lang, activeUser, setCurrentTab }) => {
  const t = TRANSLATIONS[lang];
  const badge = getRoleBadge(activeUser.role);
  const spaces = computeAvailableSpaces(activeUser);

  // === AMÉLIORATION AJOUTÉE === compteurs réels, pas fabriqués : mêmes
  // critères que les écrans "Boîte de réception" (Opérateur, vision
  // globale) et "À traiter" (Enquêteur, dossiers assignés) qu'ils
  // représentent — voir App.tsx, branches `op_inbox`/`inv_to_process`.
  const alerts = storage.getAlerts();
  const newAlertsCount = alerts.filter((a) => a.status === 'new').length;
  const myNewCasesCount = alerts.filter((a) => a.status === 'new' && a.assignedInvestigators.includes(activeUser.id)).length;

  const SPACE_CONTENT: Record<SpaceKey, { icon: React.ReactNode; title: string; desc: string; stat?: string } | null> = {
    operator: {
      icon: <LayoutDashboard className="w-5 h-5" />,
      title: t.space_home_operator_title,
      desc: t.space_home_operator_desc,
      stat: newAlertsCount > 0 ? t.space_home_operator_stat.replace('{n}', String(newAlertsCount)) : undefined,
    },
    investigator: {
      icon: <Search className="w-5 h-5" />,
      title: t.space_home_investigator_title,
      desc: t.space_home_investigator_desc,
      stat: myNewCasesCount > 0 ? t.space_home_investigator_stat.replace('{n}', String(myNewCasesCount)) : undefined,
    },
    admin: {
      icon: <Settings className="w-5 h-5" />,
      title: t.space_home_admin_title,
      desc: t.space_home_admin_desc,
    },
    general: null,
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        {/* Photo panel — même photo/dégradé que l'écran de connexion du suivi de signalement (AlertTrackingView.tsx) */}
        <div className="relative hidden lg:flex flex-col justify-end p-8 min-h-[480px] text-white overflow-hidden">
          <img
            src="/brand/activa-hq.jpg"
            alt="Siège du Groupe ACTIVA"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545]/90 via-[#0B2545]/55 to-[#0B2545]/15" />
          <div className="relative z-10 space-y-5">
            <p className="text-2xl font-bold leading-snug max-w-xs">{t.space_home_tagline}</p>
            <div className="w-10 h-px bg-white/40" />
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-white shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold">{t.sidebar_confidentiality_title}</div>
                <div className="text-xs text-white/80">{t.space_home_photo_note}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content panel */}
        <div id="staff-space-home-panel" className="bg-white p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">{t.space_home_hello}</p>
            <h1 className="text-xl font-bold text-slate-900">{activeUser.name}</h1>
            {badge && (
              <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                {badge.label}
              </span>
            )}
            <p className="text-xs text-slate-600 mt-3">{t.space_home_subtitle}</p>
          </div>

          <div className="space-y-2.5">
            {spaces.map((space) => {
              const content = SPACE_CONTENT[space];
              if (!content) return null;
              return (
                <button
                  key={space}
                  id={`space-home-choice-${space}`}
                  onClick={() => setCurrentTab(SPACE_DASHBOARD_TAB[space])}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition text-left"
                >
                  <span className="w-9 h-9 rounded-lg bg-white border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                    {content.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-blue-900">{content.title}</span>
                    <span className="block text-[11px] text-blue-700/80 leading-snug mt-0.5">{content.desc}</span>
                    {content.stat && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10.5px] font-bold">
                        {content.stat}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
