import React from 'react';
import {
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
  Lock,
  Send,
  User,
} from 'lucide-react';
import { Language, UserProfile, UserRole, AppNotification } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 4 — notification center) ===
import { generateNotifications } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) ===
import { ActivaLogo } from './ui';
// === AMÉLIORATION AJOUTÉE : correction post-fusion === cet import avait
// été perdu lors de la fusion avec la refonte visuelle (Phase 13), alors
// que le code plus bas l'utilise déjà — voir isGlobalViewer ci-dessous.
import { isGlobalCaseViewer } from '../services/authz';

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
  // === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
  // Perdus lors de la fusion avec la refonte visuelle (Phase 13) alors que
  // le bouton "Se déconnecter" plus bas s'appuie dessus — restaurés ici.
  isStaffSessionActive: boolean;
  onLogout: () => void;
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
  isStaffSessionActive,
  onLogout,
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
  // === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
  // Remplace l'ancienne comparaison à 3 rôles codée en dur par la vraie
  // permission `cases.read` + visibilité globale (src/services/authz.ts).
  // `isStaffUser` (tout profil hors lanceur d'alerte) n'a plus besoin de
  // dépendre d'`isGlobalViewer` : le nouveau modèle compte désormais 8
  // rôles "collaborateur" distincts (contre 3 avant), donc `role !== 'reporter'`
  // exprime directement l'intention.
  const isGlobalViewer = isGlobalCaseViewer(activeUser);
  const isStaffUser = activeUser.role !== 'reporter';
  const notifications = React.useMemo(
    () =>
      isStaffUser
        ? generateNotifications(storage.getAlerts(), storage.getAuditLogs(), activeUser.id, isGlobalViewer).filter((n) => !dismissedIds.has(n.id))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStaffUser, isGlobalViewer, activeUser.id, dismissedIds, notifRefresh]
  );

  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === étendu de 5 à 10 rôles ; les
  // 5 libellés/couleurs déjà en production restent strictement identiques
  // (`functional_admin`/`investigator`/`system_admin`/`reporter` gardent
  // leur rendu exact — `reporter` est le nouveau nom de l'ancien
  // `whistleblower`, `consultation` celui de l'ancien `auditor`), les 5
  // nouveaux suivent la même convention visuelle.
  // === AMÉLIORATION AJOUTÉE : correction post-fusion === ce switch avait
  // été réécrit sur les 5 anciens rôles (`auditor`/`whistleblower`) lors de
  // la fusion avec la refonte visuelle (Phase 13), ce qui ne compile plus
  // contre le modèle RBAC à 10 rôles — restauré ici avec les couleurs déjà
  // choisies pour ce nouveau style d'en-tête (fonds `-50`/`-800`).
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'functional_admin':
        return { label: 'Admin Fonctionnel / DARC', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'investigator':
        return { label: 'Investigateur DARC', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'senior_investigator':
        return { label: 'Investigateur Senior DARC', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'darc_compliance':
        return { label: 'Conformité DARC', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'system_admin':
        return { label: 'Admin Système', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'security_admin':
        return { label: 'Admin Sécurité', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'consultation':
        return { label: 'Consultation / Audit', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'audit_committee':
        return { label: 'Comité d’Audit', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
      case 'executive':
        return { label: 'Direction / Exécutif', color: 'bg-slate-800 text-white border-slate-700' };
      case 'reporter':
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
      {/* === AMÉLIORATION AJOUTÉE (Phase 24) === bande utilitaire (Phase 23)
          retirée sur demande explicite. */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-5 py-3">
          {/* === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) === Le
              logo réel remplace le monogramme provisoire. Sur les pages
              publiques (accueil...), seul le logo est affiché, comme dans
              la maquette d'accueil ; le bloc "EthicsAlert.Com" + sous-titre
              n'apparaît qu'en contexte portail (déjà le cas avant, la
              maquette détaillée de la fiche dossier montrant ce bloc). */}
          <div
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
          >
            <ActivaLogo className="h-10 shrink-0" />
            {isStaffContext && (
              <>
                <div className="hidden md:block w-px h-8 bg-slate-200" />
                <div className="hidden md:block leading-tight">
                  <h1 className="text-[15px] font-extrabold tracking-tight text-[#0B2545] group-hover:text-blue-700 transition">
                    {t.app_title}
                  </h1>
                  <p className="text-[11px] text-slate-500 max-w-[260px] truncate">
                    {t.app_subtitle}
                  </p>
                </div>
              </>
            )}
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
            /* === AMÉLIORATION AJOUTÉE (Phase 13) === Nav publique exacte de
                la nouvelle maquette d'accueil : Accueil / Comment ça marche ? /
                FAQ / Nous contacter. Les trois derniers font défiler la page
                d'accueil jusqu'à la section correspondante (id posé dans
                WhistleblowerHome.tsx) plutôt que de changer d'écran. */
            <nav className="hidden md:flex items-center gap-1 flex-1">
              <button
                id="nav-btn-home"
                onClick={() => setCurrentTab('home')}
                className={`px-3 py-2 text-xs font-semibold transition border-b-2 ${
                  currentTab === 'home' || currentTab === 'new_alert' || currentTab === 'track'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-blue-700'
                }`}
              >
                {t.nav_public_home}
              </button>

              {/* === AMÉLIORATION AJOUTÉE (Phase 20) === lien "Comment ça
                  marche ?" retiré de l'en-tête sur demande explicite ; la
                  section elle-même reste sur la page d'accueil, simplement
                  plus reliée par un raccourci direct. */}

              {/* === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de
                  l'accueil) === Vraie navigation vers l'onglet `/faq`
                  (FaqView.tsx) au lieu d'un défilement vers une ancre
                  aujourd'hui retirée de la page d'accueil. */}
              <button
                id="nav-btn-faq"
                onClick={() => setCurrentTab('faq')}
                className={`px-3 py-2 text-xs font-semibold transition border-b-2 ${
                  currentTab === 'faq'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-blue-700'
                }`}
              >
                {t.nav_public_faq}
              </button>

              <button
                id="nav-btn-contact"
                onClick={() => document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 transition"
              >
                {t.nav_public_contact}
              </button>
            </nav>
          )}

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isStaffContext && (
              /* === AMÉLIORATION AJOUTÉE (Phase 17 — réorganisation de
                  l'accueil) === La maquette adoptée ne montre plus ce bouton
                  du tout dans l'en-tête public (place laissée aux deux
                  actions "Suivre"/"Signaler" ci-dessous) — mais c'est
                  l'unique point d'entrée public vers l'espace collaborateur
                  (régression déjà corrigée une fois, Phase 10 : sans lui, un
                  profil staff arrivant sur une page publique n'a plus aucun
                  moyen d'y accéder, la barre latérale ne s'affichant qu'une
                  fois DANS l'espace staff). Conservé, réduit à une icône
                  discrète plutôt que supprimé. */
              <button
                id="nav-btn-portal"
                onClick={() => setCurrentTab('portal')}
                className="relative p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0B2545] transition"
                title={t.nav_secure_space}
              >
                <Lock className="w-4 h-4" />
                {pendingAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-amber-400 text-slate-950 text-[9px] font-bold flex items-center justify-center">
                    {pendingAlertsCount}
                  </span>
                )}
              </button>
            )}
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
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700 transition"
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
                className={`flex items-center gap-1 rounded-lg transition text-xs ${
                  isStaffContext
                    ? 'px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'px-2 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
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

            {!isStaffContext && (
              /* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle
                  fourni) === "Suivre mon signalement" reprend le style
                  large façon barre de recherche de la maquette (icône +
                  texte dans un encadré large, coins arrondis) plutôt qu'un
                  simple bouton contour ; "Signaler une préoccupation" passe
                  en coins arrondis, comme le reste du modèle. */
              <>
                <button
                  id="nav-btn-track"
                  onClick={() => setCurrentTab('track')}
                  className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition whitespace-nowrap"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{t.btn_track_existing}</span>
                </button>
                <button
                  id="nav-btn-new-alert"
                  onClick={() => setCurrentTab('new_alert')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.btn_new_alert}</span>
                </button>
                <div className="hidden sm:block w-px h-6 bg-slate-200" />
              </>
            )}

            {/* Account / role-switcher menu (role-switching stays crucial for demo & CDC 3.2.3 access testing) */}
            <div className="relative">
              {/* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle
                  fourni) === Sur les pages publiques, le déclencheur reprend
                  l'apparence "Connexion" (icône + libellé) de la maquette au
                  lieu de l'avatar/nom — mais ouvre exactement le même menu
                  de changement de profil en dessous : rien n'est perdu, la
                  fonction de test des rôles (CDC 3.2.3) reste entière. Dans
                  l'espace collaborateur, l'avatar + nom + rôle reste affiché
                  (contexte où savoir "qui est connecté" a du sens). */}
              <button
                id="btn-role-switcher"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={
                  isStaffContext
                    ? 'flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition'
                    : 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition'
                }
              >
                {isStaffContext ? (
                  <>
                    <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                      {initials}
                    </span>
                    <span className="hidden sm:block text-left leading-tight">
                      <span className="block text-xs font-bold text-slate-800 max-w-[140px] truncate">{activeUser.name}</span>
                      <span className="block text-[10px] text-slate-500 max-w-[140px] truncate">{badge?.label}</span>
                    </span>
                  </>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                )}
                {!isStaffContext && <span className="hidden sm:block text-xs font-bold">{t.nav_connexion}</span>}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {showUserDropdown && (
                <div
                  className="absolute right-0 mt-1 w-72 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs"
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
                        role: 'reporter',
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

                  {/* === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne
                      dédiée) === Déconnexion réelle de la session
                      "collaborateur" démo : referme l'accès aux écrans
                      internes (AuthenticatedRoute, App.tsx) jusqu'à une
                      nouvelle connexion via /login. */}
                  {isStaffUser && isStaffSessionActive && (
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 font-medium border-t border-slate-100"
                    >
                      Se déconnecter
                    </button>
                  )}
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
