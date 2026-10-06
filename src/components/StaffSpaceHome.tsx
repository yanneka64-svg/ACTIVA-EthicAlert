import React from 'react';
import { Briefcase, Search, Settings, Users, ChevronRight, ShieldOff, X, ArrowRight, Lock, ShieldCheck, Clock3, UserRound } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) ===
import { BrandBlueBackdrop } from './ui/BrandBlue';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { computeAvailableSpaces, computeGeneralDashboardTab, SPACE_DASHBOARD_TAB, SpaceKey } from '../domain/staffSpaces';
// === AMÉLIORATION AJOUTÉE (accueil des espaces — tableau de bord) ===
import { computeVisibleAlerts } from '../hooks/useVisibleAlerts';
import { getRecentCases } from '../services/recentCases';

interface StaffSpaceHomeProps {
  lang: Language;
  activeUser: UserProfile;
  setCurrentTab: (tab: string) => void;
  /** === AMÉLIORATION AJOUTÉE === ouvre la fiche d'un dossier (derniers dossiers consultés). */
  onOpenCase?: (trackingNumber: string) => void;
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
export const StaffSpaceHome: React.FC<StaffSpaceHomeProps> = ({ lang, activeUser, setCurrentTab, onOpenCase }) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (retrait du libellé de fonction dans la
  // salutation) === `UserProfile.name` porte parfois la fonction entre
  // parenthèses (ex. "B. Y. Ekani (Point de Contact)") — utile dans les
  // en-têtes/menus compacts pour identifier le compte, mais redondant ici
  // à côté de "Bienvenue sur EthicsAlert". Ne modifie que l'affichage de
  // cette salutation, jamais `activeUser.name` lui-même (toujours utilisé
  // tel quel ailleurs — Navbar, audit, etc.).
  const greetingName = activeUser.name.replace(/\s*\([^)]*\)\s*$/, '');

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
      icon: <Users className="w-4 h-4" strokeWidth={1.75} />,
      title: t.space_home_operator_title,
      desc: t.space_home_operator_desc,
      stat: newAlertsCount > 0 ? t.space_home_operator_stat.replace('{n}', String(newAlertsCount)) : undefined,
      // === AMÉLIORATION AJOUTÉE (espace du personnel — design modernisé) ===
      // tuiles d'icône en dégradé / teinte douce avec contour fin.
      tone: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30',
    },
    investigator: {
      icon: <Search className="w-4 h-4" strokeWidth={1.75} />,
      title: t.space_home_investigator_title,
      desc: t.space_home_investigator_desc,
      stat: myNewCasesCount > 0 ? t.space_home_investigator_stat.replace('{n}', String(myNewCasesCount)) : undefined,
      tone: 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 ring-1 ring-inset ring-indigo-200/70',
    },
    admin: {
      icon: <Settings className="w-4 h-4" strokeWidth={1.75} />,
      title: t.space_home_admin_title,
      desc: t.space_home_admin_desc,
      tone: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 ring-1 ring-inset ring-emerald-200/70',
    },
    general: {
      icon: <Briefcase className="w-4 h-4" strokeWidth={1.75} />,
      title: t.space_home_general_title,
      desc: t.space_home_general_desc,
      tone: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 ring-1 ring-inset ring-amber-200/70',
    },
  };

  // === AMÉLIORATION AJOUTÉE (accueil des espaces — tableau de bord, proposition A
  // choisie par l'utilisateur) === Couleur d'accent de chaque espace (barre,
  // icône, compteur, lien « Ouvrir »).
  const ACCENT: Record<SpaceKey, { bar: string; tile: string; pill: string; dot: string; link: string }> = {
    operator: { bar: 'bg-blue-600', tile: 'bg-blue-50 text-blue-600', pill: 'bg-blue-50 text-blue-700', dot: 'bg-blue-600', link: 'text-blue-600' },
    investigator: { bar: 'bg-indigo-600', tile: 'bg-indigo-50 text-indigo-600', pill: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-600', link: 'text-indigo-600' },
    admin: { bar: 'bg-emerald-600', tile: 'bg-emerald-50 text-emerald-600', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-600', link: 'text-emerald-600' },
    general: { bar: 'bg-amber-500', tile: 'bg-amber-50 text-amber-600', pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', link: 'text-amber-600' },
  };
  const locale = lang === 'en' ? 'en-GB' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // Derniers dossiers consultés : recoupés avec les dossiers que ce compte a
  // réellement le droit de voir (jamais un dossier devenu inaccessible).
  const visible = computeVisibleAlerts(alerts, activeUser);
  const recent = getRecentCases(activeUser.id)
    .map((e) => ({ entry: e, alert: visible.find((a) => a.trackingNumber === e.trackingNumber) }))
    .filter((r): r is { entry: typeof r.entry; alert: NonNullable<typeof r.alert> } => !!r.alert)
    .slice(0, 4);
  const scope =
    (activeUser.entities?.length ? activeUser.entities : activeUser.countries?.length ? activeUser.countries : null)?.join(', ') ??
    t.space_home_scope_group;
  const STATUS_PILL: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700',
    under_review: 'bg-sky-50 text-sky-700',
    investigation: 'bg-amber-50 text-amber-700',
    corrective_action: 'bg-violet-50 text-violet-700',
    closed: 'bg-emerald-50 text-emerald-700',
    reopened: 'bg-rose-50 text-rose-700',
    archived: 'bg-slate-100 text-slate-600',
  };

  // === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) === bandeau
  // bleu derrière l'en-tête (textes en blanc) ; les cartes des espaces, à
  // contour neutre, le chevauchent.
  return (
    <>
    <div className="relative">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[230px] sm:h-[250px]"><BrandBlueBackdrop /></div>
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* En-tête : date, salutation, rappel de sécurité */}
      <div className="activa-enter mb-7" style={{ '--d': '60ms' } as React.CSSProperties}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{today}</p>
        <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {(t.space_home_greeting || 'Bonjour, M. {name}').replace('{name}', greetingName)}
        </h1>
        <div className="mt-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <p className="text-sm text-white/85">{t.space_home_choose || t.space_home_subtitle_plural}</p>
          {/* === AMÉLIORATION AJOUTÉE (badge de session masqué) === sur demande explicite ; la déconnexion automatique reste active. */}
          <div className="hidden items-center gap-2 self-start lg:self-auto lg:shrink-0 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-inset ring-white/25 text-xs text-white">
            <ShieldCheck className="w-4 h-4 text-[#9BE15D] shrink-0" strokeWidth={1.9} />
            {t.space_home_secure_session}
          </div>
        </div>
      </div>

      {/* Les 4 espaces */}
      <div id="staff-space-home-panel" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {spaces.map((space, i) => {
          const content = SPACE_CONTENT[space];
          const accent = ACCENT[space];
          // Mis en avant seulement si le compte y a réellement accès
          // (`computeAvailableSpaces`) — jamais pour un espace qu'il ne peut pas ouvrir.
          const highlighted = realSpaces.includes(space);
          return (
            <button
              key={space}
              id={`space-home-choice-${space}`}
              onClick={() => (highlighted ? setCurrentTab(targetTabFor(space)) : setDeniedSpace(space))}
              aria-disabled={!highlighted}
              className={`activa-enter group relative overflow-hidden text-left flex flex-col sm:min-h-[232px] p-5 sm:p-6 rounded-[24px] border transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                highlighted
                  ? 'bg-white border-slate-200/90 shadow-[0_24px_48px_-32px_rgb(3_16_48/0.55)] hover:-translate-y-1 hover:shadow-[0_30px_56px_-28px_rgb(3_16_48/0.6)] hover:border-slate-300'
                  : 'bg-slate-50 border-slate-200/90 shadow-[0_24px_48px_-36px_rgb(3_16_48/0.45)] cursor-not-allowed'
              }`}
              style={{ '--d': `${140 + i * 70}ms` } as React.CSSProperties}
            >
              {highlighted && <span aria-hidden="true" className={`hidden absolute inset-x-0 top-0 h-[3px] ${accent.bar}`} />}
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                  highlighted ? accent.tile : 'bg-slate-100 text-slate-400'
                } [&_svg]:w-5 [&_svg]:h-5`}
              >
                {content.icon}
              </span>
              <span className={`mt-4 text-[15px] font-bold ${highlighted ? 'text-[#0B2545]' : 'text-slate-400'}`}>{content.title}</span>
              <span className={`mt-1.5 text-[12.5px] leading-relaxed flex-1 ${highlighted ? 'text-slate-500' : 'text-slate-400'}`}>{content.desc}</span>
              <span className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                {highlighted ? (
                  content.stat ? (
                    <span className={`inline-flex items-center gap-1.5 min-w-0 px-2.5 py-1 rounded-lg text-[11px] leading-tight font-bold ${accent.pill}`}>
                      <span aria-hidden="true" className={`activa-pulse-dot shrink-0 w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                      {content.stat}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-slate-400">{t.space_home_nothing_pending}</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
                    <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                    {t.space_home_no_access}
                  </span>
                )}
                {highlighted && (
                  // Flèche seule (libellé lu par les lecteurs d'écran) : tient
                  // dans les cartes étroites à côté du compteur.
                  <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 transition-all duration-300 group-hover:bg-slate-100 ${accent.link}`}>
                    <span className="sr-only">{t.space_home_open}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.2} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Derniers dossiers consultés + profil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mt-5">
        <section className="activa-enter lg:col-span-2 bg-white border border-slate-200/90 rounded-[24px] shadow-[0_24px_48px_-36px_rgb(3_16_48/0.45)] p-5 sm:p-6" style={{ '--d': '440ms' } as React.CSSProperties}>
          <h2 className="flex items-center gap-2 text-[13px] font-bold text-[#0B2545] mb-2">
            <Clock3 className="w-4 h-4 text-slate-400" strokeWidth={1.9} />
            {t.space_home_recent_title}
          </h2>
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map(({ entry, alert }) => (
                <li key={entry.trackingNumber}>
                  <button
                    type="button"
                    onClick={() => onOpenCase?.(entry.trackingNumber)}
                    disabled={!onOpenCase}
                    className="group w-full flex items-center gap-3 py-2.5 text-left rounded-lg hover:bg-slate-50 -mx-2 px-2 transition-colors"
                  >
                    <span className="font-bold text-[13px] text-[#0B2545] tabular-nums whitespace-nowrap">{entry.trackingNumber}</span>
                    <span className="hidden sm:inline text-slate-300">·</span>
                    <span className="flex-1 min-w-0 truncate text-[13px] text-slate-600 hidden sm:block">{alert.category}</span>
                    <span className="flex-1 sm:hidden" />
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${STATUS_PILL[alert.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t[`case_badge_status_${alert.status}`] ?? t[`status_${alert.status}`] ?? alert.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-slate-400">{t.space_home_recent_empty}</p>
          )}
        </section>
        <section className="activa-enter bg-white border border-slate-200/90 rounded-[24px] shadow-[0_24px_48px_-36px_rgb(3_16_48/0.45)] p-5 sm:p-6" style={{ '--d': '510ms' } as React.CSSProperties}>
          <h2 className="flex items-center gap-2 text-[13px] font-bold text-[#0B2545] mb-2">
            <UserRound className="w-4 h-4 text-slate-400" strokeWidth={1.9} />
            {t.space_home_profile_title}
          </h2>
          <dl className="divide-y divide-slate-100 text-[13px]">
            <div className="flex items-start justify-between gap-3 py-2.5">
              <dt className="text-slate-500">{t.space_home_profile_role}</dt>
              <dd className="font-bold text-[#0B2545] text-right">{activeUser.roleTitle}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 py-2.5">
              <dt className="text-slate-500">{t.space_home_profile_scope}</dt>
              <dd className="font-bold text-[#0B2545] text-right">{scope}</dd>
            </div>
            {activeUser.entity && (
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-slate-500">{t.space_home_profile_entity}</dt>
                <dd className="font-bold text-[#0B2545] text-right">{activeUser.entity}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
    </div>

    {/* === AMÉLIORATION AJOUTÉE (fenêtre d'accès restreint au clic) === */}
    {deniedSpace && (
      <div
        className="activa-fade-in fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setDeniedSpace(null)}
      >
        <div
          className="activa-modal-in relative overflow-hidden w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-slate-900/40 p-6 text-center"
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
          <div className="activa-pop w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/30 flex items-center justify-center mx-auto mb-4 text-white">
            <ShieldOff className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">{t.space_home_denied_title}</h2>
          <p className="text-xs text-slate-600 mt-2">
            {t.space_home_denied_body.replace('{space}', SPACE_CONTENT[deniedSpace].title)}
          </p>
          <button
            type="button"
            onClick={() => setDeniedSpace(null)}
            className="activa-shine mt-5 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0B2545] to-[#134074] text-white text-xs font-bold shadow-lg shadow-[#0B2545]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            {t.space_home_denied_close}
          </button>
        </div>
      </div>
    )}
    </>
  );
};
