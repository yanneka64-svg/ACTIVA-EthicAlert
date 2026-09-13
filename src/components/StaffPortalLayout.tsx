import React from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  ListTodo,
  Paperclip,
  MessageSquare,
  Wrench,
  LayoutGrid,
  Package,
  Users,
  ShieldCheck,
  Settings,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, canSeeAuditTrail, canManageConfiguration } from '../services/authz';

/**
 * === AMÉLIORATION AJOUTÉE (Phase 11 — reproduction fidèle de la maquette) ===
 *
 * Barre latérale entièrement reconstruite pour correspondre exactement à la
 * maquette de référence (image 1) : 1 item autonome ("Tableau de bord"),
 * puis 4 groupes ("GESTION DES DOSSIERS" / "CONFORMITÉ" / "RAPPORTS" /
 * "ADMINISTRATION") avec exactement les items qui y figurent, plus le
 * bloc d'aide "Besoin d'aide ?" en bas. Chaque item pointe vers un écran
 * réel déjà existant (voir App.tsx `renderStaffContent`) — rien n'est
 * supprimé côté code, seule la liste de raccourcis affichée ici est
 * désormais celle de la maquette (les anciens raccourcis Triage/
 * Attribution/Mes Dossiers/Vue Exécutive/Piste d'Audit restent de vrais
 * écrans fonctionnels, simplement non listés ici car absents de la
 * maquette de référence).
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

  const canSeeControlPanel =
    activeUser.role === 'functional_admin' ||
    activeUser.role === 'system_admin' ||
    activeUser.role === 'auditor';
  const canSeeAdmin = activeUser.role === 'system_admin';

  const navItems: Array<{ key: string; label: string; icon: React.ReactNode; visible: boolean; group: string }> = [
    { key: 'control_panel', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, visible: canSeeControlPanel, group: '' },

    { key: 'portal', label: t.sidebar_dossiers, icon: <FolderOpen className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'investigations', label: t.nav_investigations, icon: <Search className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'tasks', label: t.nav_tasks, icon: <ListTodo className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'evidence', label: t.sidebar_evidence, icon: <Paperclip className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'communications', label: t.nav_communications, icon: <MessageSquare className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },

    { key: 'corrective_actions', label: t.sidebar_corrective_measures, icon: <Wrench className="w-4 h-4" />, visible: true, group: t.sidebar_group_compliance },

    { key: 'reports', label: t.sidebar_reports_dashboards, icon: <LayoutGrid className="w-4 h-4" />, visible: true, group: t.sidebar_group_reports },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <Package className="w-4 h-4" />, visible: true, group: t.sidebar_group_reports },

    { key: 'admin_users', label: t.sidebar_admin_users, icon: <Users className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    { key: 'admin_roles', label: t.sidebar_admin_roles, icon: <ShieldCheck className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    { key: 'settings', label: t.sidebar_admin_settings, icon: <Settings className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
  ];
  // Écrans existants non repris dans cette liste (car absents de la
  // maquette de référence) mais toujours fonctionnels dans le code :
  // 'triage' / 'assignment' / 'my_cases' (des préréglages de filtre sur ce
  // même écran "Dossiers", déjà accessibles via sa barre de filtres),
  // 'executive' (Vue Exécutive) et 'audit' (Piste d'Audit).

  const visibleNavItems = navItems.filter((i) => i.visible);
  let lastGroup: string | null = null;

  const renderNavButton = (item: (typeof navItems)[number], mobile = false) => {
    const active = currentTab === item.key;
    if (mobile) {
      return (
        <button
          key={`${item.key}-${item.label}`}
          onClick={() => setCurrentTab(item.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition ${
            active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      );
    }
    return (
      <button
        id={`sidebar-nav-${item.key}-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
        key={`${item.key}-${item.label}`}
        onClick={() => setCurrentTab(item.key)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
          active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className={active ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {active && <ChevronRight className="w-3.5 h-3.5 text-blue-500" />}
      </button>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6 px-0 lg:px-6 xl:px-8">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-[5.5rem] lg:self-start bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
        <nav className="flex-1 py-3 px-2.5">
          {visibleNavItems.map((item) => {
            const showGroupHeader = !!item.group && item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.key}-${item.label}`}>
                {showGroupHeader && (
                  <div className="px-3 pt-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {item.group}
                  </div>
                )}
                {renderNavButton(item)}
              </React.Fragment>
            );
          })}
        </nav>

        {/* "Besoin d'aide ?" — exact match with the reference mockup's sidebar footer */}
        <div className="m-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div className="text-[11px] leading-snug">
            <p className="font-bold text-slate-700">{t.sidebar_help_title}</p>
            <p className="text-slate-500 mt-0.5">{t.sidebar_help_body}</p>
          </div>
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-1 -mb-2">
        {visibleNavItems.map((item) => renderNavButton(item, true))}
      </div>

      {/* Content canvas — sa propre largeur maximale centrée */}
      <div className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto lg:px-6 xl:px-8 lg:py-6">{children}</div>
    </div>
  );
};
