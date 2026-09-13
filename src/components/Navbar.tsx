import React from 'react';
import { 
  ShieldAlert, 
  Globe, 
  FileText, 
  Search, 
  BarChart3, 
  History, 
  Settings, 
  QrCode,
  UserCheck,
  Lock,
  ChevronDown,
  Database,
  LayoutDashboard
} from 'lucide-react';
import { Language, UserProfile, UserRole } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  activeUser: UserProfile;
  setActiveUser: (user: UserProfile) => void;
  onOpenQrModal: () => void;
  pendingAlertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
  activeUser,
  setActiveUser,
  onOpenQrModal,
  pendingAlertsCount,
}) => {
  const t = TRANSLATIONS[lang];
  const allUsers = storage.getUsers();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showLangDropdown, setShowLangDropdown] = React.useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'functional_admin':
        return { label: 'Admin Fonctionnel / DARC', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'investigator':
        return { label: 'Investigateur DARC', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'system_admin':
        return { label: 'Admin Système', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'auditor':
        return { label: 'Consultation / Audit', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'whistleblower':
        return { label: 'Lanceur d’alerte', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
  };

  const badge = getRoleBadge(activeUser.role);

  return (
    <header className="bg-[#0B2545] text-white border-b border-[#134074] shadow-md sticky top-0 z-40">
      {/* Top utility bar: Group info & Role switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 text-xs border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wider text-amber-400 uppercase">
              {t.group_name}
            </span>
            <span className="hidden sm:inline-block text-slate-300">|</span>
            <span className="hidden sm:inline-block text-slate-300">
              {t.darc_label}
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-400 font-medium">
              <Lock className="w-3.5 h-3.5" />
              {t.confidentiality_guarantee}
            </span>
          </div>

          {/* Role & Lang switcher */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                id="btn-language-selector"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition text-slate-200"
                title="Changer de langue"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase">{lang}</span>
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

            {/* Simulated Profile / Role Switcher (Crucial for test & review) */}
            <div className="relative">
              <button
                id="btn-role-switcher"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="max-w-[140px] truncate font-medium">{activeUser.name}</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-amber-400/30 text-[10px] uppercase font-bold text-amber-300">
                  {activeUser.role}
                </span>
                <ChevronDown className="w-3 h-3 text-amber-400" />
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

        {/* Main Nav header */}
        <div className="flex items-center justify-between py-3">
          {/* Logo & title */}
          <div 
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-white/20">
              <ShieldAlert className="w-6 h-6 text-[#0B2545]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white group-hover:text-amber-300 transition">
                  {t.app_title}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  v2.0 DARC
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {/* Nav buttons */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              id="nav-btn-home"
              onClick={() => setCurrentTab('home')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentTab === 'home' || currentTab === 'new_alert'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.nav_home}
            </button>

            <button
              id="nav-btn-track"
              onClick={() => setCurrentTab('track')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentTab === 'track'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
              {t.nav_track}
            </button>

            {/* === AMÉLIORATION AJOUTÉE (Phase 5) === Control Panel, same visibility as Audit Trail */}
            {(activeUser.role === 'functional_admin' ||
              activeUser.role === 'system_admin' ||
              activeUser.role === 'auditor') && (
              <button
                id="nav-btn-control-panel"
                onClick={() => setCurrentTab('control_panel')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'control_panel'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                {t.nav_control_panel}
              </button>
            )}

            {/* Portal for investigators and admins */}
            <button
              id="nav-btn-portal"
              onClick={() => setCurrentTab('portal')}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentTab === 'portal'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{t.nav_portal}</span>
              {pendingAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  {pendingAlertsCount}
                </span>
              )}
            </button>

            <button
              id="nav-btn-reports"
              onClick={() => setCurrentTab('reports')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentTab === 'reports'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {t.nav_reports}
            </button>

            {/* Audit Trail (Accessible to Admins and Auditors) */}
            {(activeUser.role === 'functional_admin' || 
              activeUser.role === 'system_admin' || 
              activeUser.role === 'auditor') && (
              <button
                id="nav-btn-audit"
                onClick={() => setCurrentTab('audit')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'audit'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <History className="w-4 h-4" />
                {t.nav_audit}
              </button>
            )}

            {/* Settings (Admin system) */}
            {activeUser.role === 'system_admin' && (
              <button
                id="nav-btn-settings"
                onClick={() => setCurrentTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'settings'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Settings className="w-4 h-4" />
                {t.nav_settings}
              </button>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 4) : outil de recherche connecté au vrai projet Firebase */}
            <button
              id="nav-btn-firebase-lookup"
              onClick={() => setCurrentTab('firebase_lookup')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentTab === 'firebase_lookup'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
              title={t.nav_firebase_lookup}
            >
              <Database className="w-4 h-4" />
              <span className="hidden xl:inline">{t.nav_firebase_lookup}</span>
            </button>

            {/* QR Code trigger */}
            <button
              id="nav-btn-qr"
              onClick={onOpenQrModal}
              className="p-2 rounded-lg text-slate-200 hover:bg-white/10 hover:text-amber-300 transition"
              title="Générer / Afficher le QR Code de signalement"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </nav>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-white/10 overflow-x-auto text-[11px] font-medium">
          <button
            onClick={() => setCurrentTab('home')}
            className={`px-2 py-1 rounded ${currentTab === 'home' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-200'}`}
          >
            {t.nav_home}
          </button>
          <button
            onClick={() => setCurrentTab('track')}
            className={`px-2 py-1 rounded ${currentTab === 'track' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-200'}`}
          >
            {t.nav_track}
          </button>
          <button
            onClick={() => setCurrentTab('portal')}
            className={`px-2 py-1 rounded flex items-center gap-1 ${currentTab === 'portal' ? 'bg-blue-600 text-white font-bold' : 'text-slate-200'}`}
          >
            <span>{t.nav_portal}</span>
            {pendingAlertsCount > 0 && <span className="bg-amber-400 text-slate-950 px-1 rounded-full text-[9px]">{pendingAlertsCount}</span>}
          </button>
          <button
            onClick={() => setCurrentTab('reports')}
            className={`px-2 py-1 rounded ${currentTab === 'reports' ? 'bg-blue-600 text-white font-bold' : 'text-slate-200'}`}
          >
            {t.nav_reports}
          </button>
          <button
            onClick={() => setCurrentTab('firebase_lookup')}
            className={`px-2 py-1 rounded flex items-center gap-1 ${currentTab === 'firebase_lookup' ? 'bg-purple-600 text-white font-bold' : 'text-slate-200'}`}
          >
            <Database className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenQrModal}
            className="px-2 py-1 rounded text-amber-300 flex items-center gap-0.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR</span>
          </button>
        </div>
      </div>
    </header>
  );
};
