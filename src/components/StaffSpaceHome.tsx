import React from 'react';
import { Briefcase, Search, Settings, Users, ChevronRight, ShieldCheck, Info } from 'lucide-react';
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

  const targetTabFor = (space: SpaceKey): string =>
    space === 'general' ? computeGeneralDashboardTab(activeUser) : SPACE_DASHBOARD_TAB[space];

  // === AMÉLIORATION AJOUTÉE === compteurs réels, pas fabriqués : mêmes
  // critères que les écrans "Boîte de réception" (Opérateur, vision
  // globale) et "À traiter" (Enquêteur, dossiers assignés) qu'ils
  // représentent — voir App.tsx, branches `op_inbox`/`inv_to_process`.
  const alerts = storage.getAlerts();
  const newAlertsCount = alerts.filter((a) => a.status === 'new').length;
  const myNewCasesCount = alerts.filter((a) => a.status === 'new' && a.assignedInvestigators.includes(activeUser.id)).length;

  // === AMÉLIORATION AJOUTÉE (habillage aligné sur la maquette "Espaces de
  // travail") === Une icône et une couleur distinctes par espace (au lieu
  // d'un unique bleu uniforme) — Opérateur/Enquêteur/Administrateur/
  // Consultant, cohérent avec le sélecteur de profil de l'écran de
  // connexion (StaffLoginView.tsx).
  const SPACE_CONTENT: Record<SpaceKey, { icon: React.ReactNode; title: string; desc: string; stat?: string; tone: string }> = {
    operator: {
      icon: <Users className="w-5 h-5" />,
      title: t.space_home_operator_title,
      desc: t.space_home_operator_desc,
      stat: newAlertsCount > 0 ? t.space_home_operator_stat.replace('{n}', String(newAlertsCount)) : undefined,
      tone: 'bg-blue-600 text-white',
    },
    investigator: {
      icon: <Search className="w-5 h-5" />,
      title: t.space_home_investigator_title,
      desc: t.space_home_investigator_desc,
      stat: myNewCasesCount > 0 ? t.space_home_investigator_stat.replace('{n}', String(myNewCasesCount)) : undefined,
      tone: 'bg-indigo-100 text-indigo-600',
    },
    admin: {
      icon: <Settings className="w-5 h-5" />,
      title: t.space_home_admin_title,
      desc: t.space_home_admin_desc,
      tone: 'bg-emerald-100 text-emerald-600',
    },
    general: {
      icon: <Briefcase className="w-5 h-5" />,
      title: t.space_home_general_title,
      desc: t.space_home_general_desc,
      tone: 'bg-amber-100 text-amber-600',
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
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" /> EthicsAlert · Signalement • Enquêtes • Éthique
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight pt-2">
                Bonjour M. {activeUser.name}
              </h2>
              <p className="text-lg font-semibold text-blue-200">
                Bienvenue sur EthicsAlert
              </p>
            </div>

            <div className="w-14 h-0.5 bg-blue-400/70" />

            <div className="text-xs sm:text-sm text-slate-100/90 leading-relaxed space-y-2.5">
              <p>
                Un espace sécurisé pour gérer les alertes, les enquêtes et promouvoir une culture d’éthique.
              </p>
            </div>

            <p className="pt-2 text-xs sm:text-sm font-semibold text-blue-200">
              Ensemble pour une organisation plus responsable.
            </p>
          </div>
        </div>

        {/* Content panel */}
        <div id="staff-space-home-panel" className="bg-white p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2545]">{t.space_home_title_plural}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-sm">{t.space_home_subtitle_plural}</p>
          </div>

          <div className="space-y-2.5">
            {spaces.map((space, idx) => {
              const content = SPACE_CONTENT[space];
              // === AMÉLIORATION AJOUTÉE === le premier espace de la liste
              // (l'ordre vient de `computeAvailableSpaces`, inchangé) reste
              // mis en avant visuellement, conforme à la maquette.
              const highlighted = idx === 0;
              return (
                <button
                  key={space}
                  id={`space-home-choice-${space}`}
                  onClick={() => setCurrentTab(targetTabFor(space))}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition text-left ${
                    highlighted
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${content.tone}`}>
                    {content.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-[#0B2545]">{content.title}</span>
                    <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{content.desc}</span>
                    {content.stat && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10.5px] font-bold">
                        {content.stat}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
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
