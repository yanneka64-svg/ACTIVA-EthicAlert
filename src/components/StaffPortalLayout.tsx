import React from 'react';
import {
  ShieldAlert,
  BarChart3,
  History,
  ChevronRight,
  LayoutDashboard,
  Landmark,
  // === AMÉLIORATION AJOUTÉE (Phase 9 — restructuration de la navigation façon maquette) ===
  ListFilter,
  UserPlus,
  FolderOpen,
  Search,
  ListTodo,
  Paperclip,
  MessageSquare,
  Wrench,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

/**
 * === AMÉLIORATION AJOUTÉE : mise en page "portail sécurisé" avec navigation latérale ===
 *
 * Wraps the staff-facing views (Investigation Desk, Reports, Audit Trail, Administration)
 * in a persistent left sidebar navigation, closer to the reference enterprise
 * case-management layout (dark navy rail + content canvas) while reusing the
 * existing top Navbar (branding, language, role switcher) unchanged.
 * Purely presentational — no business logic, no behavior change to the wrapped views.
 */

interface StaffPortalLayoutProps {
  lang: Language;
  activeUser: UserProfile;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export const StaffPortalLayout: React.FC<StaffPortalLayoutProps> = ({
  lang,
  activeUser,
  currentTab,
  setCurrentTab,
  children,
}) => {
  const t = TRANSLATIONS[lang];

  const canSeeAudit =
    activeUser.role === 'functional_admin' ||
    activeUser.role === 'system_admin' ||
    activeUser.role === 'auditor';
  const canSeeSettings = activeUser.role === 'system_admin';

  // === AMÉLIORATION AJOUTÉE (Phase 5) === same visibility rule as InvestigationDesk's isGlobalViewer.
  const canSeeControlPanel = canSeeAudit;

  // === AMÉLIORATION AJOUTÉE (Phase 9 — restructuration de la navigation
  // façon maquette) ===
  // La maquette de référence comporte ~15 entrées réparties en 7 groupes
  // (CONTROL PANEL / ALERT MANAGEMENT / INVESTIGATION / REMEDIATION /
  // REPORTING / AUDIT / ADMINISTRATION). Chaque entrée ci-dessous est un
  // écran RÉEL et distinct : soit InvestigationDesk avec un `initialFilter`
  // préréglé (Alertes/Triage/Attribution/Mes Dossiers/Investigations — voir
  // App.tsx `renderStaffContent`), soit un nouveau registre transverse
  // (Tâches/Preuves/Communications/Actions Correctives), soit
  // AdminConfigView avec un `initialTab` différent (Utilisateurs & Rôles /
  // Configuration). AUCUNE entrée, clé, route ou composant existant n'est
  // supprimé : 'portal' et 'settings' conservent exactement leur
  // comportement d'origine (et restent accessibles via la barre Navbar) ;
  // seule cette liste est étendue pour refléter la structure demandée.
  const navItems: Array<{ key: string; label: string; icon: React.ReactNode; visible: boolean; group: string }> = [
    { key: 'control_panel', label: t.nav_control_panel, icon: <LayoutDashboard className="w-4 h-4" />, visible: canSeeControlPanel, group: t.nav_group_control_panel },

    { key: 'portal', label: t.nav_alerts, icon: <ShieldAlert className="w-4 h-4" />, visible: true, group: t.nav_group_alerts },
    { key: 'triage', label: t.nav_triage, icon: <ListFilter className="w-4 h-4" />, visible: true, group: t.nav_group_alerts },
    { key: 'assignment', label: t.nav_assignment, icon: <UserPlus className="w-4 h-4" />, visible: canSeeControlPanel, group: t.nav_group_alerts },

    { key: 'my_cases', label: t.nav_my_cases, icon: <FolderOpen className="w-4 h-4" />, visible: true, group: t.nav_group_investigation },
    { key: 'investigations', label: t.nav_investigations, icon: <Search className="w-4 h-4" />, visible: true, group: t.nav_group_investigation },
    { key: 'tasks', label: t.nav_tasks, icon: <ListTodo className="w-4 h-4" />, visible: true, group: t.nav_group_investigation },
    { key: 'evidence', label: t.nav_evidence, icon: <Paperclip className="w-4 h-4" />, visible: true, group: t.nav_group_investigation },
    { key: 'communications', label: t.nav_communications, icon: <MessageSquare className="w-4 h-4" />, visible: true, group: t.nav_group_investigation },

    { key: 'corrective_actions', label: t.nav_corrective_actions, icon: <Wrench className="w-4 h-4" />, visible: true, group: t.nav_group_remediation },

    { key: 'reports', label: t.nav_reports, icon: <BarChart3 className="w-4 h-4" />, visible: true, group: t.nav_group_reporting },
    // === AMÉLIORATION AJOUTÉE (Phase 7 — Vue Exécutive) ===
    { key: 'executive', label: t.nav_executive, icon: <Landmark className="w-4 h-4" />, visible: canSeeControlPanel, group: t.nav_group_reporting },

    { key: 'audit', label: t.nav_audit, icon: <History className="w-4 h-4" />, visible: canSeeAudit, group: t.nav_group_audit },

    { key: 'admin_users', label: t.nav_admin_users, icon: <Users className="w-4 h-4" />, visible: canSeeSettings, group: t.nav_group_admin },
    { key: 'admin_config', label: t.nav_admin_config, icon: <SlidersHorizontal className="w-4 h-4" />, visible: canSeeSettings, group: t.nav_group_admin },
  ];
  // `settings` (Configuration Système, unfiltered) stays a valid tab id —
  // still reachable from the Navbar's own quick-access button — it is
  // simply no longer listed a second time in this sidebar now that
  // 'admin_users'/'admin_config' cover the same screen with a scoped
  // landing tab; nothing about it was removed, see AdminConfigView.tsx.

  // === AMÉLIORATION AJOUTÉE (Phase 6 — sidebar grouping to match the
  // Control Panel mockup's grouped sidebar) === Purely a rendering
  // grouping over the exact same `navItems` above — no item added, removed,
  // renamed, or re-targeted; a group header renders once before the first
  // visible item that belongs to it.
  const visibleNavItems = navItems.filter((i) => i.visible);
  let lastGroup: string | null = null;

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6 px-0 lg:px-6 xl:px-8">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 lg:sticky lg:top-[6.5rem] lg:self-start bg-[#0B2545] rounded-2xl shadow-sm overflow-hidden mt-6">
        <div className="px-4 py-4 border-b border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Portail Sécurisé DARC
          </span>
          <p className="text-[11px] text-slate-300 mt-1 truncate" title={activeUser.name}>
            {activeUser.name}
          </p>
        </div>

        <nav className="flex-1 py-2">
          {visibleNavItems.map((item) => {
            const active = currentTab === item.key;
            const showGroupHeader = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={item.key}>
                {showGroupHeader && (
                  <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {item.group}
                  </div>
                )}
                <button
                  id={`sidebar-nav-${item.key}`}
                  onClick={() => setCurrentTab(item.key)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {active && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-[10px] text-slate-400">
          {t.group_name}
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-1 -mb-2">
        {navItems.filter((i) => i.visible).map((item) => {
          const active = currentTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setCurrentTab(item.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition ${
                active
                  ? 'bg-[#0B2545] text-white border-[#0B2545]'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content canvas */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};
