import React from 'react';
import { Briefcase, Search, Settings, BarChart3, ChevronRight, ShieldCheck, History, Info, User } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { getRoleBadge } from './Navbar';
import { computeAvailableSpaces, computeGeneralDashboardTab, SPACE_DASHBOARD_TAB, SpaceKey } from '../domain/staffSpaces';

interface StaffSpaceHomeProps {
  lang: Language;
  activeUser: UserProfile;
  setCurrentTab: (tab: string) => void;
}

/**
 * === AMÉLIORATION AJOUTÉE (Accueil des espaces — étendu à tous les
 * profils) ===
 *
 * Remplace le petit sélecteur "ESPACES" qui vivait en permanence en haut de
 * la barre latérale (StaffPortalLayout.tsx) par une vraie page d'accueil,
 * affichée pour TOUTE connexion (App.tsx, `handleLogin`) — y compris un
 * compte à un seul espace réel, ou à aucun des 3 (repli "vision globale") —
 * pas seulement les comptes à 2 espaces ou plus comme lors d'une première
 * itération. Habillage aligné sur la référence fournie par l'utilisateur :
 * badge "Dispositif d'Alerte Éthique & Déontologie", panneau photo avec
 * indicateurs Confidentialité/Traçabilité, avatar générique, titre
 * singulier/pluriel selon le nombre d'espaces, bloc "Session active" en bas
 * du panneau de choix.
 *
 * L'identifiant/mot de passe (StaffLoginView.tsx, `/login`) reste
 * strictement inchangé et reste le seul point de connexion — cet écran
 * n'est jamais atteignable sans être déjà authentifié (App.tsx,
 * AuthenticatedRoute).
 */
export const StaffSpaceHome: React.FC<StaffSpaceHomeProps> = ({ lang, activeUser, setCurrentTab }) => {
  const t = TRANSLATIONS[lang];
  const badge = getRoleBadge(activeUser.role);

  // === AMÉLIORATION AJOUTÉE === un compte sans aucun des 3 espaces réels
  // (consultation/executive/audit_committee/security_admin) reçoit
  // désormais, lui aussi, une carte — l'unique espace "general" de repli,
  // au lieu d'être envoyé directement sans jamais voir cet accueil.
  const realSpaces = computeAvailableSpaces(activeUser);
  const spaces: SpaceKey[] = realSpaces.length > 0 ? realSpaces : ['general'];
  const isSingle = spaces.length === 1;

  const targetTabFor = (space: SpaceKey): string =>
    space === 'general' ? computeGeneralDashboardTab(activeUser) : SPACE_DASHBOARD_TAB[space];

  // === AMÉLIORATION AJOUTÉE === compteurs réels, pas fabriqués : mêmes
  // critères que les écrans "Boîte de réception" (Opérateur, vision
  // globale) et "À traiter" (Enquêteur, dossiers assignés) qu'ils
  // représentent — voir App.tsx, branches `op_inbox`/`inv_to_process`.
  const alerts = storage.getAlerts();
  const newAlertsCount = alerts.filter((a) => a.status === 'new').length;
  const myNewCasesCount = alerts.filter((a) => a.status === 'new' && a.assignedInvestigators.includes(activeUser.id)).length;

  const SPACE_CONTENT: Record<SpaceKey, { icon: React.ReactNode; title: string; desc: string; stat?: string }> = {
    operator: {
      icon: <Briefcase className="w-5 h-5" />,
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
    general: {
      icon: <BarChart3 className="w-5 h-5" />,
      title: t.space_home_general_title,
      desc: t.space_home_general_desc,
    },
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        {/* Photo panel — nouvelle photo moderne du siège ACTIVA avec message d'accueil enrichi et suppression des anciens textes */}
        <div className="relative hidden lg:flex flex-col justify-end p-8 sm:p-10 min-h-[560px] text-white overflow-hidden">
          <img
            src="/brand/activa-headquarters-modern.jpg"
            alt="Siège moderne du Groupe ACTIVA"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545]/95 via-[#0B2545]/70 to-[#0B2545]/35" />
          <div className="relative z-10 space-y-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 border border-white/30 backdrop-blur-sm text-blue-100">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" /> Dispositif d’Alerte Éthique & Déontologie
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight pt-2">
                {activeUser.id === 'usr-functional-admin' || activeUser.name.includes('Ekani')
                  ? 'Bonjour M. B. Y. Ekani (Point de Contact)'
                  : `Bonjour ${activeUser.name}`}
              </h2>
              <p className="text-lg font-semibold text-blue-200">
                Bienvenue à votre espace
              </p>
            </div>

            <div className="w-14 h-0.5 bg-blue-400/70" />

            <div className="text-xs sm:text-sm text-slate-100/90 leading-relaxed space-y-2.5">
              <p>
                Votre mission au cœur du dispositif d’alerte éthique garantit l’intégrité, la conformité et la confiance au sein de l’ensemble des entités du Groupe ACTIVA.
              </p>
              <p>
                Cet environnement confidentiel et sécurisé vous confère les outils nécessaires pour veiller au traitement impartial, rigoureux et diligent des signalements, dans le respect absolu de la protection des personnes et de la traçabilité des procédures.
              </p>
            </div>

            <div className="pt-2 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="text-[11px] font-semibold text-white/90">Confidentialité garantie</span>
              </div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="text-[11px] font-semibold text-white/90">Traçabilité probante</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content panel */}
        <div id="staff-space-home-panel" className="bg-white p-6 sm:p-10 flex flex-col justify-center">
          <div className="text-center mb-6">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white mx-auto mb-3 shadow-sm">
              <User className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              {isSingle
                ? (spaces[0] === 'investigator' ? 'Espace Enquêteur' : t.space_home_title_single)
                : t.space_home_title_plural}
            </h1>
            <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
              {isSingle
                ? (spaces[0] === 'investigator'
                    ? 'Accédez directement à vos dossiers d’enquête assignés et à vos outils d’instruction.'
                    : t.space_home_subtitle_single)
                : t.space_home_subtitle_plural}
            </p>
          </div>

          <div className="space-y-2.5">
            {spaces.map((space) => {
              const content = SPACE_CONTENT[space];
              return (
                <button
                  key={space}
                  id={`space-home-choice-${space}`}
                  onClick={() => setCurrentTab(targetTabFor(space))}
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

          {/* === AMÉLIORATION AJOUTÉE === bloc "Session active", données déjà
              réelles du compte (roleTitle/country existent sur UserProfile
              depuis l'origine) — jamais un résumé fabriqué. */}
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-snug">
              <p className="font-bold text-slate-700">{t.space_home_session_active}</p>
              <p className="text-slate-500 mt-0.5">
                {activeUser.name} • {badge?.label ?? activeUser.roleTitle} • {activeUser.country}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
