import React from 'react';
import {
  ShieldCheck,
  Search,
  QrCode,
  ChevronDown,
  Database,
  Bell,
  Clock3,
  MessageSquare,
  ListTodo,
  RotateCcw,
  Paperclip,
  FileCheck2,
} from 'lucide-react';
import { Language, UserProfile, UserRole, AppNotification } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 4 — notification center) ===
import { generateNotifications } from '../services/statusMapping';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  activeUser: UserProfile;
  setActiveUser: (user: UserProfile) => void;
  onOpenQrModal: () => void;
  pendingAlertsCount: number;
  // === AMÉLIORATION AJOUTÉE (Phase 4) === lets a clicked notification deep
  // link straight into its case, reusing the same trackingNumber filter
  // already wired from the Control Panel (App.tsx's navigateToCases).
  onNavigateToCase: (trackingNumber: string) => void;
  // === AMÉLIORATION AJOUTÉE (Phase 10 — refonte visuelle façon maquette) ===
  // Distinguishes the "staff portal" chrome (white top bar with a search
  // field, notification bell and account menu — the wrapped screen already
  // has its own left sidebar via StaffPortalLayout, see App.tsx) from the
  // "public" chrome (simple text nav for the whistleblower-facing pages).
  // Purely presentational: every tab/handler below is unchanged and still
  // reachable, only the layout of this bar differs.
  isStaffContext: boolean;
}

// A real, computed notification list (see services/statusMapping.ts) never
// carries persistent read/unread state of its own — this component keeps a
// per-session "dismissed" id set, exactly as documented at the source of
// generateNotifications(). It resets on reload, which is an accepted
// trade-off: there is no separate AppNotification collection in storage.ts.
const NOTIFICATION_ICONS: Record<AppNotification['type'], React.ComponentType<{ className?: string }>> = {
  new_message: MessageSquare,
  sla_at_risk: Clock3,
  sla_overdue: Clock3,
  task_overdue: ListTodo,
  case_reopened: RotateCcw,
  evidence_added: Paperclip,
  closure_requested: FileCheck2,
};

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
  activeUser,
  setActiveUser,
  onOpenQrModal,
  pendingAlertsCount,
  onNavigateToCase,
  isStaffContext,
}) => {
  const t = TRANSLATIONS[lang];
  const allUsers = storage.getUsers();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showLangDropdown, setShowLangDropdown] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // === AMÉLIORATION AJOUTÉE (Phase 4 — notification center) ===
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
  const [notifRefresh, setNotifRefresh] = React.useState(0);
  React.useEffect(() => {
    const unsub = storage.subscribe(() => setNotifRefresh((n) => n + 1));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isGlobalViewer =
    activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';
  const isStaffUser = isGlobalViewer || activeUser.role === 'investigator';
  const notifications = React.useMemo(
    () =>
      isStaffUser
        ? generateNotifications(storage.getAlerts(), storage.getAuditLogs(), activeUser.id, isGlobalViewer).filter((n) => !dismissedIds.has(n.id))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStaffUser, isGlobalViewer, activeUser.id, dismissedIds, notifRefresh]
  );

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'functional_admin':
        return { label: 'Admin Fonctionnel / DARC', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'investigator':
        return { label: 'Investigateur DARC', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'system_admin':
        return { label: 'Admin Système', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'auditor':
        return { label: 'Consultation / Audit', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'whistleblower':
        return { label: 'Lanceur d’alerte', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
  };

  const badge = getRoleBadge(activeUser.role);

  // === AMÉLIORATION AJOUTÉE (Phase 11) === two-letter initials ("B. Y.
  // Ekani" → "BY"), matching the avatar shown in the reference mockup.
  const initials = activeUser.name
    .replace(/[.,]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onNavigateToCase(searchValue.trim());
      setSearchValue('');
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-5 py-3">
          {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Logo à deux blocs, comme
              la maquette de référence : le monogramme "activa" (icône +
              wordmark + tagline) suivi du bloc "ACTIVA Hotline" (icône +
              titre + sous-titre). */}
          <div
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block leading-none">
                <span className="text-base font-black text-[#0B2545] tracking-tight lowercase">activa</span>
                <p className="text-[8px] italic text-rose-600 -mt-0.5">{t.brand_tagline}</p>
              </div>
            </div>
            <div className="hidden md:block w-px h-8 bg-slate-200" />
            <div className="hidden md:block leading-tight">
              <h1 className="text-[15px] font-extrabold tracking-tight text-[#0B2545] group-hover:text-blue-700 transition">
                {t.app_title}
              </h1>
              <p className="text-[11px] text-slate-500 max-w-[260px] truncate">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {isStaffContext ? (
            <>
              {/* Search bar (staff portal) */}
              <form onSubmit={handleSearchSubmit} className="flex-1 hidden md:block max-w-xl">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="navbar-search"
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={t.navbar_search_placeholder}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 border border-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                  />
                </div>
              </form>
              <div className="flex-1 md:hidden" />
            </>
          ) : (
            /* === AMÉLIORATION AJOUTÉE (Phase 11) === Nav publique exacte de
                la maquette : Accueil / Comment ça marche / FAQ. Les deux
                derniers font défiler la page d'accueil jusqu'à la section
                correspondante (id posé dans WhistleblowerHome.tsx) plutôt que
                de changer d'écran — "Suivre un signalement" reste accessible
                via les gros boutons de la page d'accueil elle-même. */
            <nav className="hidden md:flex items-center gap-1 flex-1">
              <button
                id="nav-btn-home"
                onClick={() => setCurrentTab('home')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'home' || currentTab === 'new_alert' || currentTab === 'track'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.nav_public_home}
              </button>

              <button
                id="nav-btn-how-it-works"
                onClick={() => {
                  setCurrentTab('home');
                  setTimeout(() => document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {t.nav_public_how}
              </button>

              <button
                id="nav-btn-faq"
                onClick={() => {
                  setCurrentTab('home');
                  setTimeout(() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {t.nav_public_faq}
              </button>

              {/* Kept as a discreet entry point into the staff portal (role-switch
                  demo requirement, CDC 3.2.3) — not shown in the reference mockup,
                  which assumes an already-authenticated staff session. */}
              <button
                id="nav-btn-portal"
                onClick={() => setCurrentTab('portal')}
                className="relative ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-blue-700 hover:bg-slate-50 transition"
              >
                <span>{t.nav_portal}</span>
                {pendingAlertsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    {pendingAlertsCount}
                  </span>
                )}
              </button>
            </nav>
          )}

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isStaffContext && (
              <>
                {/* Notification bell */}
                <div className="relative">
                  <button
                    id="btn-notification-bell"
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-600"
                    title={t.notif_title}
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {notifications.length > 9 ? '9+' : notifications.length}
                      </span>
                    )}
                  </button>

                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-1 w-80 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 z-50 text-xs max-h-96 flex flex-col">
                      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                        <p className="font-bold text-slate-700">{t.notif_title}</p>
                        {notifications.length > 0 && (
                          <button
                            onClick={() => setDismissedIds(new Set([...dismissedIds, ...notifications.map((n) => n.id)]))}
                            className="text-[10px] font-semibold text-blue-700 hover:underline"
                          >
                            {t.notif_mark_all_read}
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-[11px]">{t.notif_empty}</div>
                        ) : (
                          notifications.map((n) => {
                            const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
                            return (
                              <button
                                key={n.id}
                                onClick={() => {
                                  setDismissedIds(new Set([...dismissedIds, n.id]));
                                  setShowNotifDropdown(false);
                                  onNavigateToCase(n.trackingNumber);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition border-b border-slate-100 last:border-b-0 flex items-start gap-2.5"
                              >
                                <span
                                  className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                    n.type === 'sla_overdue' ? 'bg-rose-50 text-rose-600' : n.type === 'sla_at_risk' || n.type === 'task_overdue' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-slate-700 leading-snug">{n.message}</span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    {new Date(n.createdAt).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Compact links to screens not covered by the sidebar (Reports/Audit/Settings/Executive/
                    Control Panel already live in StaffPortalLayout's sidebar — see App.tsx) */}
                <button
                  id="nav-btn-firebase-lookup"
                  onClick={() => setCurrentTab('firebase_lookup')}
                  className={`hidden lg:flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition ${
                    currentTab === 'firebase_lookup' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title={t.nav_firebase_lookup}
                >
                  <Database className="w-4 h-4" />
                </button>
              </>
            )}

            {!isStaffContext && (
              <button
                id="nav-btn-qr"
                onClick={onOpenQrModal}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700 transition"
                title="Générer / Afficher le QR Code de signalement"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}

            {/* Language Selector */}
            <div className="relative">
              <button
                id="btn-language-selector"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-600 text-xs"
                title="Changer de langue"
              >
                <span className="font-bold uppercase">{lang}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {showLangDropdown && (
                <div
                  className="absolute right-0 mt-1 w-32 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs"
                  onClick={() => setShowLangDropdown(false)}
                >
                  <button
                    onClick={() => setLang('fr')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'fr' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇫🇷 Français</span>
                    {lang === 'fr' && <span>✓</span>}
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'en' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇬🇧 English</span>
                    {lang === 'en' && <span>✓</span>}
                  </button>
                  <button
                    onClick={() => setLang('pt')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'pt' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇵🇹 Português</span>
                    {lang === 'pt' && <span>✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Account / role-switcher menu (role-switching stays crucial for demo & CDC 3.2.3 access testing) */}
            <div className="relative">
              <button
                id="btn-role-switcher"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition"
              >
                <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                  {initials}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-xs font-bold text-slate-800 max-w-[140px] truncate">{activeUser.name}</span>
                  <span className="block text-[10px] text-slate-500 max-w-[140px] truncate">{badge?.label}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showUserDropdown && (
                <div
                  className="absolute right-0 mt-1 w-72 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 py-1.5 z-50 text-xs"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                    <p className="font-semibold text-slate-600">{t.switch_role}</p>
                    <p className="text-[11px] text-slate-500">Testez les accès selon le profil (CDC 3.2.3)</p>
                  </div>

                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setActiveUser(u);
                        storage.setActiveUser(u);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition border-b border-slate-100 last:border-b-0 ${
                        activeUser.id === u.id ? 'bg-blue-50/80 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{u.name}</span>
                        <span className="text-[10px] text-slate-500">{u.country}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{u.roleTitle}</div>
                    </button>
                  ))}

                  {/* Option to simulate pure anonymous whistleblower */}
                  <button
                    onClick={() => {
                      const wbUser: UserProfile = {
                        id: 'usr-whistleblower',
                        name: 'Lanceur d’alerte (Visiteur)',
                        email: 'anonyme@declare.activa',
                        role: 'whistleblower',
                        roleTitle: 'Déclarant externe ou employé',
                        entity: 'Toutes entités',
                        country: 'Groupe ACTIVA',
                      };
                      setActiveUser(wbUser);
                      storage.setActiveUser(wbUser);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-800 font-medium"
                  >
                    👤 Mode Lanceur d’alerte (Public)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t border-slate-100 text-[11px] font-medium">
          <button
            onClick={() => setCurrentTab('home')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap ${currentTab === 'home' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            {t.nav_home}
          </button>
          <button
            onClick={() => setCurrentTab('track')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap ${currentTab === 'track' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            {t.nav_track}
          </button>
          <button
            onClick={() => setCurrentTab('portal')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${currentTab === 'portal' || isStaffContext ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            <span>{t.nav_portal}</span>
            {pendingAlertsCount > 0 && <span className="bg-amber-400 text-slate-950 px-1 rounded-full text-[9px]">{pendingAlertsCount}</span>}
          </button>
          <button
            onClick={() => setCurrentTab('firebase_lookup')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${currentTab === 'firebase_lookup' ? 'bg-purple-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            <Database className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenQrModal}
            className="px-2.5 py-1 rounded-full whitespace-nowrap bg-slate-100 text-blue-700 flex items-center gap-1"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR</span>
          </button>
        </div>
      </div>
    </header>
  );
};
