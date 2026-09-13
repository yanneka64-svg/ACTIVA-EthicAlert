import React from 'react';
import {
  ShieldAlert,
  FileText,
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
// === AMÉLIORATION AJOUTÉE (Phase 10 — en-tête sur une seule ligne, façon
// maquette) === partagée avec App.tsx pour ne jamais diverger sur ce qui
// compte comme un onglet "staff" (couvert par la barre latérale).
import { STAFF_TAB_KEYS } from '../constants/staffTabs';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
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
  // === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
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
  isStaffSessionActive,
  onLogout,
}) => {
  const t = TRANSLATIONS[lang];
  const allUsers = storage.getUsers();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showLangDropdown, setShowLangDropdown] = React.useState(false);

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
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'functional_admin':
        return { label: 'Admin Fonctionnel / DARC', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'investigator':
        return { label: 'Investigateur DARC', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'senior_investigator':
        return { label: 'Investigateur Senior DARC', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
      case 'darc_compliance':
        return { label: 'Conformité DARC', color: 'bg-teal-100 text-teal-900 border-teal-300' };
      case 'system_admin':
        return { label: 'Admin Système', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'security_admin':
        return { label: 'Admin Sécurité', color: 'bg-rose-100 text-rose-900 border-rose-300' };
      case 'consultation':
        return { label: 'Consultation / Audit', color: 'bg-slate-100 text-slate-800 border-slate-300' };
      case 'audit_committee':
        return { label: 'Comité d’Audit', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
      case 'executive':
        return { label: 'Direction / Exécutif', color: 'bg-slate-800 text-white border-slate-700' };
      case 'reporter':
        return { label: 'Lanceur d’alerte', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
  };

  const badge = getRoleBadge(activeUser.role);

  // === AMÉLIORATION AJOUTÉE (Phase 10 — en-tête sur une seule ligne, façon
  // maquette) ===
  // La maquette de référence n'a qu'UNE seule ligne d'en-tête compacte : le
  // reste de la navigation (Alertes, Triage, Rapports, Administration…) vit
  // exclusivement dans la barre latérale (StaffPortalLayout), désormais
  // capable de couvrir tous les onglets "staff". L'ancienne barre horizontale
  // dupliquait donc entièrement la barre latérale — supprimée ici, mais rien
  // n'est perdu : chaque onglet qu'elle ouvrait reste accessible depuis la
  // barre latérale (ou, pour Accueil/Suivre mon alerte, depuis les boutons
  // publics conservés ci-dessous, visibles uniquement hors de l'espace
  // staff — exactement comme la page d'accueil de la maquette, qui ne montre
  // pas ces liens dans son en-tête non plus).
  const isStaffTab = STAFF_TAB_KEYS.includes(currentTab);

  return (
    <header className="bg-[#0B2545] text-white border-b border-[#134074] shadow-md sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-2.5">
          {/* === AMÉLIORATION AJOUTÉE (Phase 11 — alignement de marque
              « ACTIVA Hotline » sur la maquette) === Nom de produit +
              slogan sur une ligne compacte, comme la maquette ; le badge de
              version ("v2.0 DARC") — un simple ornement, absent de la
              maquette — est retiré ici pour ne pas alourdir l'en-tête. */}
          <div
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none group min-w-0"
          >
            <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow ring-1 ring-white/20">
              <ShieldAlert className="w-5 h-5 text-[#0B2545]" />
            </div>
            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Sur mobile, le nom
                reste visible (brief §4 : "conserver le logo ; conserver
                Hotline") ; seul le slogan secondaire est masqué pour
                laisser la place aux icônes de droite. */}
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold tracking-tight text-white group-hover:text-amber-300 transition truncate">
                {t.app_title}
              </h1>
              <p className="hidden sm:block text-[10.5px] text-slate-400 truncate max-w-[280px]">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {/* Liens publics — uniquement hors de l'espace staff (dans
              l'espace staff, la barre latérale couvre toute la navigation) */}
          {!isStaffTab && (
            <nav className="hidden md:flex items-center gap-1">
              <button
                id="nav-btn-home"
                onClick={() => setCurrentTab('home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'home' || currentTab === 'new_alert'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {t.nav_home}
              </button>
              <button
                id="nav-btn-track"
                onClick={() => setCurrentTab('track')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'track'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                {t.nav_track}
              </button>

              {/* === AMÉLIORATION AJOUTÉE (Phase 10) ===
                  Point d'entrée indispensable vers l'espace staff : depuis
                  que la grande barre horizontale a été retirée (remplacée
                  par la barre latérale), un profil staff arrivant sur une
                  page publique n'avait plus aucun moyen d'y accéder — la
                  barre latérale elle-même ne s'affiche qu'une fois DANS
                  l'espace staff. Ce lien compact comble ce vide, exactement
                  comme le lien "Employee/Staff Login" d'un site vitrine
                  d'entreprise. */}
              {isStaffUser && (
                <button
                  id="nav-btn-portal"
                  onClick={() => setCurrentTab('portal')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t.nav_portal}
                </button>
              )}
            </nav>
          )}

          {/* Cluster de droite : notifications, langue, accès annexes, profil */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* === AMÉLIORATION AJOUTÉE (Phase 4 — notification center) === */}
            {isStaffUser && (
              <div className="relative">
                <button
                  id="btn-notification-bell"
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-slate-200"
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
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 10) === Sélecteur de langue
                compact (FR / EN / PT en ligne), remplace l'ancien menu
                déroulant — même fonction (setLang), rendu plus proche de la
                maquette. */}
            <div className="hidden sm:flex items-center rounded-lg bg-white/10 overflow-hidden text-[11px] font-bold">
              {(['fr', 'en', 'pt'] as Language[]).map((l) => (
                <button
                  key={l}
                  id={l === 'fr' ? 'btn-language-selector' : undefined}
                  onClick={() => setLang(l)}
                  className={`px-2 py-1.5 uppercase transition ${
                    lang === l ? 'bg-white text-[#0B2545]' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Accès annexes, conservés mais discrets (recherche Firebase, QR) */}
            <button
              id="nav-btn-firebase-lookup"
              onClick={() => setCurrentTab('firebase_lookup')}
              className={`hidden lg:flex p-1.5 rounded-lg transition ${
                currentTab === 'firebase_lookup' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}
              title={t.nav_firebase_lookup}
            >
              <Database className="w-4 h-4" />
            </button>
            <button
              id="nav-btn-qr"
              onClick={onOpenQrModal}
              className="hidden sm:flex p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-amber-300 transition"
              title="Générer / Afficher le QR Code de signalement"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Profil actif / sélecteur de rôle (démo) */}
            <div className="relative">
              <button
                id="btn-role-switcher"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-white/10 transition"
              >
                <span className="w-7 h-7 rounded-full bg-blue-500/30 border border-blue-300/40 flex items-center justify-center text-[11px] font-bold text-blue-100 shrink-0">
                  {activeUser.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="hidden md:block text-left leading-tight">
                  <span className="block max-w-[140px] truncate font-semibold text-[12px] text-white">{activeUser.name}</span>
                  <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{badge?.label}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
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

        {/* Mobile: liens publics uniquement hors de l'espace staff — dans
            l'espace staff, StaffPortalLayout affiche déjà sa propre barre
            horizontale mobile couvrant tous les onglets. */}
        {!isStaffTab && (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-white/10 text-[11px] font-medium">
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
            {/* === AMÉLIORATION AJOUTÉE (Phase 10) === même point d'entrée
                staff que sur desktop, voir le commentaire équivalent ci-dessus. */}
            {isStaffUser && (
              <button
                onClick={() => setCurrentTab('portal')}
                className="px-2 py-1 rounded text-slate-200"
              >
                {t.nav_portal}
              </button>
            )}
            <button
              onClick={onOpenQrModal}
              className="px-2 py-1 rounded text-amber-300 flex items-center gap-0.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
