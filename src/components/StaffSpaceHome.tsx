import React from 'react';
import { Briefcase, Search, Settings, Users, ChevronRight, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
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
 * itération. Habillage aligné sur la référence fournie par l'utilisateur.
 * Le bloc "Session active" qui vivait en bas du panneau de choix a été
 * retiré sur demande explicite.
 *
 * L'identifiant/mot de passe (StaffLoginView.tsx, `/login`) reste
 * strictement inchangé et reste le seul point de connexion — cet écran
 * n'est jamais atteignable sans être déjà authentifié (App.tsx,
 * AuthenticatedRoute).
 */
export const StaffSpaceHome: React.FC<StaffSpaceHomeProps> = ({ lang, activeUser, setCurrentTab }) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (fenêtre d'accès restreint au clic) === Sur
  // demande explicite : cliquer sur un espace non permis n'emmène plus vers
  // l'écran "Accès restreint" (PermissionGuard, routing/guards.tsx) — qui
  // reste la protection réelle si l'écran est atteint autrement (lien
  // profond, retour navigateur...) — mais affiche une fenêtre de message
  // directement ici, sans quitter l'accueil des espaces. Jamais un accès
  // fictif : le clic ne navigue simplement pas.
  const [deniedSpace, setDeniedSpace] = React.useState<SpaceKey | null>(null);

  // === AMÉLIORATION AJOUTÉE (conforme à la maquette "Espaces de travail")
  // === Les 4 espaces canoniques sont désormais TOUJOURS affichés, quel que
  // soit le compte connecté — plus seulement ceux réellement permis. Un
  // espace auquel le compte n'a pas droit reste cliquable mais renvoie
  // honnêtement vers l'écran "Accès restreint" existant (PermissionGuard,
  // App.tsx) au lieu d'être masqué : jamais un accès fictif, juste une
  // liste complète et cohérente d'un profil à l'autre. `realSpaces` sert
  // uniquement à distinguer visuellement les espaces réellement accessibles
  // (mis en avant) des autres.
  const realSpaces = computeAvailableSpaces(activeUser);
  const spaces: SpaceKey[] = ['operator', 'investigator', 'admin', 'general'];

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
    <>
    {/* === AMÉLIORATION AJOUTÉE (élargissement de la fenêtre) === max-w-3xl →
        max-w-5xl, sur demande explicite de l'utilisateur (trop d'espace vide
        de part et d'autre sur grand écran). */}
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        {/* === AMÉLIORATION AJOUTÉE (nouvelle photo de fond, fournie par
            l'utilisateur) === Remplace la photo du siège par une photo de
            bureau avec vue sur skyline (heure dorée), servie depuis
            public/brand/space-home-bg.jpg. */}
        <div className="relative hidden lg:flex flex-col justify-end p-8 sm:p-10 min-h-[460px] text-white overflow-hidden">
          <img
            src="/brand/space-home-bg.jpg"
            alt="Espace de travail avec vue sur la ville"
            className="absolute inset-0 w-full h-full object-cover object-left"
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
            {spaces.map((space) => {
              const content = SPACE_CONTENT[space];
              // Mis en avant visuellement seulement si le compte y a
              // réellement accès (`computeAvailableSpaces`) — jamais pour
              // un espace qu'il ne peut pas ouvrir.
              const highlighted = realSpaces.includes(space);
              return (
                <button
                  key={space}
                  id={`space-home-choice-${space}`}
                  onClick={() => (highlighted ? setCurrentTab(targetTabFor(space)) : setDeniedSpace(space))}
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
        </div>
      </div>
    </div>

    {/* === AMÉLIORATION AJOUTÉE (fenêtre d'accès restreint au clic) === */}
    {deniedSpace && (
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setDeniedSpace(null)}
      >
        <div
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setDeniedSpace(null)}
            aria-label={t.space_home_denied_close}
            className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <ShieldOff className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">{t.space_home_denied_title}</h2>
          <p className="text-xs text-slate-600 mt-2">
            {t.space_home_denied_body.replace('{space}', SPACE_CONTENT[deniedSpace].title)}
          </p>
          <button
            type="button"
            onClick={() => setDeniedSpace(null)}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-[#0B2545] text-white text-xs font-bold hover:bg-[#0B2545]/90 transition"
          >
            {t.space_home_denied_close}
          </button>
        </div>
      </div>
    )}
    </>
  );
};
