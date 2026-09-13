import React from 'react';
import { ShieldAlert, BarChart3, History, Settings, ChevronRight } from 'lucide-react';
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

  const navItems: Array<{ key: string; label: string; icon: React.ReactNode; visible: boolean }> = [
    { key: 'portal', label: t.nav_portal, icon: <ShieldAlert className="w-4 h-4" />, visible: true },
    { key: 'reports', label: t.nav_reports, icon: <BarChart3 className="w-4 h-4" />, visible: true },
    { key: 'audit', label: t.nav_audit, icon: <History className="w-4 h-4" />, visible: canSeeAudit },
    { key: 'settings', label: t.nav_settings, icon: <Settings className="w-4 h-4" />, visible: canSeeSettings },
  ];

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
          {navItems.filter((i) => i.visible).map((item) => {
            const active = currentTab === item.key;
            return (
              <button
                key={item.key}
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
