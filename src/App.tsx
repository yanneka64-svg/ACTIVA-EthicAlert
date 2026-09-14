/**
 * ACTIVA EthicAlert - Plateforme Sécurisée de Gestion des Alertes Éthiques
 * Groupe ACTIVA (DARC - Direction d'Audit, des Risques et de la Conformité)
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Language, UserProfile } from './types';
import { storage } from './services/storage';
import { TRANSLATIONS } from './i18n/translations';
import { Navbar } from './components/Navbar';
import { WhistleblowerHome } from './components/WhistleblowerHome';
// === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
import { FaqView } from './components/FaqView';
// === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
import { ContactView } from './components/ContactView';
import { AlertSubmissionFlow } from './components/AlertSubmissionFlow';
import { AlertTrackingView } from './components/AlertTrackingView';
import { InvestigationDesk } from './components/InvestigationDesk';
import { ControlPanel } from './components/ControlPanel';
import { ReportingDashboard } from './components/ReportingDashboard';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { AuditTrailView } from './components/AuditTrailView';
import { AdminConfigView } from './components/AdminConfigView';
import { QrCodeModal } from './components/QrCodeModal';
import { StaffPortalLayout } from './components/StaffPortalLayout';
import { CaseLookup } from './components/CaseLookup';
// === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
// 4 écrans transverses réels (Tâches / Preuves / Communications / Actions
// correctives), agrégeant des données déjà existantes sur `AlertRecord` —
// voir chaque fichier pour le détail.
import { TasksRegistry } from './components/TasksRegistry';
import { EvidenceRegistry } from './components/EvidenceRegistry';
import { CommunicationsRegistry } from './components/CommunicationsRegistry';
import { CorrectiveActionsRegistry } from './components/CorrectiveActionsRegistry';
import { ShieldOff } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE : correction post-fusion ===
// Ces imports (routage par URL, garde-fous, pont RBAC, écran de connexion
// interne — Phase 12.2/12.3/12.4) avaient disparu lors de la fusion avec la
// refonte visuelle (Phase 13/16), alors que le code plus bas continuait de
// les utiliser (`navigate`, `pathForTab`, `PermissionGuard`,
// `AuthenticatedRoute`, `canSeeAuditTrail`, `canManageConfiguration`,
// `isGlobalCaseViewer`, `StaffLoginView`) — d'où l'échec de compilation.
// Restaurés ici, sans rien changer au reste de la restructuration visuelle.
import { resolveRoute, pathForTab } from './routing/routes';
import { AuthenticatedRoute, PermissionGuard } from './routing/guards';
import { isGlobalCaseViewer, canSeeAuditTrail, canManageConfiguration } from './services/authz';
import { StaffLoginView } from './components/StaffLoginView';

// Tabs handled by the top Navbar: 'home' | 'new_alert' | 'track' | 'portal' | 'reports' | 'audit' | 'settings' | 'firebase_lookup'
// === AMÉLIORATION AJOUTÉE (Phase 9) === plus, via la nouvelle barre latérale
// restructurée (StaffPortalLayout) : 'triage' | 'assignment' | 'my_cases' |
// 'investigations' | 'tasks' | 'evidence' | 'communications' |
// 'corrective_actions' | 'admin_users' | 'admin_config' — chacun un écran
// réel et distinct, voir renderStaffContent() ci-dessous.

// === AMÉLIORATION AJOUTÉE (Phase 9 — restructuration de la navigation
// façon maquette) ===
// Liste unique, partagée entre le garde de bascule de profil
// (`handleUserChange`) et `isStaffTab` ci-dessous, pour que les deux listes
// ne puissent jamais diverger désormais que la barre latérale compte ~15
// entrées au lieu de 6.
const STAFF_TAB_KEYS = [
  'control_panel',
  'portal',
  'triage',
  'assignment',
  'my_cases',
  'investigations',
  'tasks',
  'evidence',
  'communications',
  'corrective_actions',
  'reports',
  'executive',
  'audit',
  'settings',
  'admin_users',
  'admin_config',
  // === AMÉLIORATION AJOUTÉE (Phase 11) ===
  'admin_roles',
  // === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
  'op_dashboard', 'op_inbox', 'op_pending_info', 'op_assign', 'op_processed', 'op_search', 'op_reports', 'op_communications',
  'inv_dashboard', 'inv_my_cases', 'inv_to_process', 'inv_in_progress', 'inv_pending', 'inv_tasks', 'inv_evidence', 'inv_communications', 'inv_reports', 'inv_search',
  'admin_audit', 'admin_reports',
];

// === AMÉLIORATION AJOUTÉE : correction post-fusion (Phase 12.2) ===
// `App()` redevient un mince point d'entrée qui monte le routeur ; toute la
// logique vit dans `AppShell`, qui lit l'URL réelle via `useLocation` /
// `useNavigate` — c'était déjà la structure voulue par le routage par URL,
// perdue lors de la fusion avec la refonte visuelle (voir le commentaire
// d'import ci-dessus).
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: currentTab, trackingNumber: routeTrackingNumber } = resolveRoute(location.pathname);
  const setCurrentTab = (tab: string) => navigate(pathForTab(tab));

  const [lang, setLang] = useState<Language>('fr');
  const t = TRANSLATIONS[lang];
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [prefilledTrackingNumber, setPrefilledTrackingNumber] = useState<string>('');
  // === AMÉLIORATION AJOUTÉE (Phase 5) === filter the Control Panel's KPI
  // cards/quick actions hand off to InvestigationDesk when navigating there.
  const [pendingCaseFilter, setPendingCaseFilter] = useState<
    { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean; trackingNumber?: string; myCasesOnly?: boolean } | undefined
  >(undefined);

  // Active user profile (role-switcher for demo/testing across CDC profiles; defaults to the
  // functional admin / point de contact so the staff portal is visible on first load).
  const [activeUser, setActiveUser] = useState<UserProfile>(storage.getActiveUser());

  // === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
  // Session "collaborateur connecté", au sens démo du terme (voir
  // StaffLoginView / routing/guards.tsx — pas de backend d'authentification
  // réel ici). Persistée dans localStorage (comme `activeUser` l'est déjà
  // via storage.ts) : sans ça, taper une URL dans la barre d'adresse — le
  // scénario même que le brief section 32 veut voir bloqué — déclenche un
  // rechargement complet de la page, qui aurait sinon remis ce simple
  // useState à sa valeur par défaut et vidé la déconnexion de tout effet
  // réel. Vaut `true` par défaut au tout premier lancement (aucune clé en
  // storage) pour ne rien changer au confort existant, documenté depuis les
  // premières phases de ce projet : l'app s'ouvrait déjà directement sur le
  // profil `functional_admin`.
  const STAFF_SESSION_KEY = 'activa_staff_session_active';
  const [isStaffSessionActive, setIsStaffSessionActiveState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STAFF_SESSION_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true; // localStorage unavailable (private browsing, etc.) — fail open to the pre-existing default.
    }
  });
  const setIsStaffSessionActive = (active: boolean) => {
    setIsStaffSessionActiveState(active);
    try {
      localStorage.setItem(STAFF_SESSION_KEY, String(active));
    } catch {
      // Best-effort only — the in-memory state above still works for this tab session.
    }
  };

  // Live alert count for the Navbar badge & role-based access guards below.
  const [alertCount, setAlertCount] = useState(() => storage.getAlerts().length);
  useEffect(() => {
    const unsub = storage.subscribe(() => setAlertCount(storage.getAlerts().length));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === remplace l'ancienne
  // comparaison à 3 rôles codée en dur. Diffère volontairement de l'ancien
  // comportement pour `system_admin`, qui n'a plus accès aux dossiers
  // (brief section 30, « System Administrator ≠ Case Access » — voir
  // src/services/authz.ts).
  const isGlobalViewer = isGlobalCaseViewer(activeUser);

  // Count of "new" alerts visible to the active user (mirrors the visibility rule enforced in
  // InvestigationDesk: a non-admin only sees cases explicitly assigned to them).
  const pendingAlertsCount = React.useMemo(() => {
    const alerts = storage.getAlerts();
    return alerts.filter((a) => {
      if (a.status !== 'new') return false;
      if (isGlobalViewer) return true;
      return a.assignedInvestigators.includes(activeUser.id);
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser.id, isGlobalViewer, alertCount]);

  const handleUserChange = (user: UserProfile) => {
    setActiveUser(user);
    storage.setActiveUser(user);
    // Leaving admin/investigator-only screens when switching to the public whistleblower profile.
    if (user.role === 'reporter' && STAFF_TAB_KEYS.includes(currentTab)) {
      navigate('/');
    }
    // === AMÉLIORATION AJOUTÉE (Phase 11) === Symmetric case: the public top
    // nav no longer carries a visible "Espace Gestion DARC" button (removed
    // to match the reference mockup's public header exactly — Accueil /
    // Comment ça marche / FAQ only), so picking a staff profile from a
    // public page needs to land somewhere real; the staff portal's own
    // sidebar (StaffPortalLayout) then covers every other screen.
    else if (user.role !== 'reporter' && !STAFF_TAB_KEYS.includes(currentTab)) {
      setCurrentTab('portal');
    }
  };

  // === AMÉLIORATION AJOUTÉE (Phase 12.4) === le sélecteur de profil de la
  // Navbar (pratique de démonstration/QA existante, inchangée) marque aussi
  // la session comme "connectée" — cohérent avec le nouvel écran /login qui
  // fait la même chose explicitement.
  const handleUserChangeAndAuthenticate = (user: UserProfile) => {
    handleUserChange(user);
    setIsStaffSessionActive(true);
  };

  const handleLogin = (user: UserProfile) => {
    handleUserChange(user);
    setIsStaffSessionActive(true);
    navigate(pathForTab('control_panel'));
  };

  const handleLogout = () => {
    setIsStaffSessionActive(false);
    navigate(pathForTab('login'));
  };

  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  // A plain tab switch (Navbar / sidebar) clears any Control-Panel-driven
  // filter so it never leaks into a later, unrelated visit to "portal" —
  // only navigateToCases() below sets a filter, deliberately.
  const goToTab = (tab: string) => {
    setPendingCaseFilter(undefined);
    navigate(pathForTab(tab));
  };

  const navigateToCases = (filter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean; trackingNumber?: string; myCasesOnly?: boolean }) => {
    // === AMÉLIORATION AJOUTÉE (Phase 12.2) === un lien vers un dossier
    // précis devient une vraie URL partageable (/cases/:trackingNumber) —
    // tout autre filtre (statut, non-attribué, mes dossiers…) continue de
    // transiter par l'état React existant, exactement comme avant.
    if (filter?.trackingNumber) {
      setPendingCaseFilter(undefined);
      navigate(`/cases/${encodeURIComponent(filter.trackingNumber)}`);
      return;
    }
    setPendingCaseFilter(filter);
    navigate(pathForTab('portal'));
  };

  const handleAlertSubmitted = (trackingNumber: string) => {
    setPrefilledTrackingNumber(trackingNumber);
    navigate(pathForTab('track'));
  };

  // === AMÉLIORATION AJOUTÉE (Phase 12.2) === le lien profond vers un
  // dossier précis vient maintenant de l'URL elle-même (voir routing/routes.ts)
  // quand elle est présente, sinon du filtre React existant (Centre de
  // Pilotage, cloche de notifications…) — les deux mécanismes cohabitent
  // sans qu'InvestigationDesk n'ait besoin de changer.
  const effectiveCaseFilter = routeTrackingNumber ? { trackingNumber: routeTrackingNumber } : pendingCaseFilter;

  // === AMÉLIORATION AJOUTÉE (Phase 12.2) === /how-it-works réutilise la
  // page d'accueil existante (même contenu, jamais dupliqué) et se contente
  // de faire défiler jusqu'à la section correspondante — voir l'ancre
  // #how-it-works-section dans WhistleblowerHome.tsx.
  // === AMÉLIORATION AJOUTÉE (Phase 18) === /faq n'est plus concerné : la
  // FAQ a désormais son propre onglet réel (voir routing/routes.ts et
  // FaqView.tsx) plutôt qu'une ancre sur la page d'accueil.
  useEffect(() => {
    if (location.pathname === '/how-it-works') {
      const el = document.getElementById('how-it-works-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // === AMÉLIORATION AJOUTÉE (Phase 12.2) === `renderAccessDenied(label)`
  // devient `<PermissionGuard allowed label>` (routing/guards.tsx) — même
  // garde de défense en profondeur qu'avant (la Navbar/barre latérale
  // masquent déjà ces entrées, mais l'écran actif est revalidé ici aussi),
  // simplement extraite en composant nommé et réutilisable.
  const renderStaffContent = () => {
    if (currentTab === 'control_panel') {
      return (
        <PermissionGuard allowed={isGlobalViewer} label="Centre de Pilotage">
          <ControlPanel
            lang={lang}
            activeUser={activeUser}
            onNavigateToCases={navigateToCases}
            onNavigateToReports={() => goToTab('reports')}
            onNavigateToNewCase={() => goToTab('new_alert')}
          />
        </PermissionGuard>
      );
    }
    if (currentTab === 'portal') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={effectiveCaseFilter} />;
    // === AMÉLIORATION AJOUTÉE (Phase 9 — écrans dédiés façon maquette) ===
    // Chacune de ces entrées réutilise InvestigationDesk (même liste, même
    // écran de détail, mêmes actions) avec un `initialFilter` préréglé
    // différent — pas une copie, un préréglage — exactement comme le
    // Centre de Pilotage le fait déjà pour ses propres cartes KPI.
    if (currentTab === 'triage') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'new' }} />;
    if (currentTab === 'assignment') {
      return (
        <PermissionGuard allowed={isGlobalViewer} label="Attribution">
          <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ unassignedOnly: true }} />
        </PermissionGuard>
      );
    }
    if (currentTab === 'my_cases') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true }} />;
    if (currentTab === 'investigations') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'investigation' }} />;
    if (currentTab === 'tasks') return <TasksRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'evidence') return <EvidenceRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'communications') return <CommunicationsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'corrective_actions') return <CorrectiveActionsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'reports') return <ReportingDashboard lang={lang} activeUser={activeUser} />;
    if (currentTab === 'executive') {
      return (
        <PermissionGuard allowed={isGlobalViewer} label="Vue Exécutive">
          <ExecutiveDashboard lang={lang} activeUser={activeUser} />
        </PermissionGuard>
      );
    }
    if (currentTab === 'audit') {
      // === AMÉLIORATION AJOUTÉE (Phase 12.3) === garde désormais sur la
      // vraie permission `audit.read`, pas `isGlobalViewer` — `system_admin`
      // n'a plus accès aux dossiers mais garde bien accès à la piste
      // d'audit (il a `audit.read`), exactement comme dans l'ancien modèle.
      return (
        <PermissionGuard allowed={canSeeAuditTrail(activeUser)} label="Piste d’Audit">
          <AuditTrailView lang={lang} activeUser={activeUser} />
        </PermissionGuard>
      );
    }
    if (currentTab === 'settings') {
      return (
        <PermissionGuard allowed={canManageConfiguration(activeUser)} label="Administration">
          <AdminConfigView lang={lang} activeUser={activeUser} />
        </PermissionGuard>
      );
    }
    // === AMÉLIORATION AJOUTÉE (Phase 9 — Administration scindée en 2 écrans
    // dédiés façon maquette) === Même composant, même CRUD, même garde de
    // rôle que 'settings' ci-dessus — seul l'onglet de départ diffère, et le
    // sélecteur d'onglets complet reste visible pour ne rien masquer.
    if (currentTab === 'admin_users') {
      return (
        <PermissionGuard allowed={canManageConfiguration(activeUser)} label="Utilisateurs & Rôles">
          <AdminConfigView lang={lang} activeUser={activeUser} initialTab="users" />
        </PermissionGuard>
      );
    }
    if (currentTab === 'admin_config') {
      return (
        <PermissionGuard allowed={canManageConfiguration(activeUser)} label="Configuration">
          <AdminConfigView lang={lang} activeUser={activeUser} initialTab="matrix" />
        </PermissionGuard>
      );
    }
    // === AMÉLIORATION AJOUTÉE (Phase 11 — "Rôles & Permissions" de la
    // maquette) === même composant/CRUD/garde que 'admin_users', onglet de
    // départ différent.
    if (currentTab === 'admin_roles') {
      return (
        <PermissionGuard allowed={canManageConfiguration(activeUser)} label="Rôles & Permissions">
          <AdminConfigView lang={lang} activeUser={activeUser} initialTab="roles" />
        </PermissionGuard>
      );
    }

    // === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
    // Chaque nouvelle URL réutilise un écran déjà réel avec un
    // `initialFilter` préréglé différent — même technique que triage/
    // assignment/my_cases (Phase 9) ci-dessus, jamais un écran fabriqué ou
    // un placeholder. Voir routing/routes.ts pour la table complète des
    // nouveaux chemins.
    if (currentTab === 'op_dashboard') {
      return (
        <PermissionGuard allowed={isGlobalViewer} label="Tableau de bord Opérateur">
          <ControlPanel
            lang={lang}
            activeUser={activeUser}
            onNavigateToCases={navigateToCases}
            onNavigateToReports={() => goToTab('op_reports')}
            onNavigateToNewCase={() => goToTab('new_alert')}
          />
        </PermissionGuard>
      );
    }
    if (currentTab === 'op_inbox') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'new' }} />;
    if (currentTab === 'op_pending_info') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'under_review' }} />;
    if (currentTab === 'op_assign') {
      return (
        <PermissionGuard allowed={isGlobalViewer} label="Attribution">
          <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ unassignedOnly: true }} />
        </PermissionGuard>
      );
    }
    if (currentTab === 'op_processed') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'closed' }} />;
    if (currentTab === 'op_search') return <InvestigationDesk lang={lang} activeUser={activeUser} />;
    if (currentTab === 'op_reports') return <ReportingDashboard lang={lang} activeUser={activeUser} />;
    if (currentTab === 'op_communications') return <CommunicationsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;

    if (currentTab === 'inv_dashboard') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true }} />;
    if (currentTab === 'inv_my_cases') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true }} />;
    if (currentTab === 'inv_to_process') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true, status: 'new' }} />;
    if (currentTab === 'inv_in_progress') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true, status: 'investigation' }} />;
    if (currentTab === 'inv_pending') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true, status: 'under_review' }} />;
    if (currentTab === 'inv_tasks') return <TasksRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'inv_evidence') return <EvidenceRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'inv_communications') return <CommunicationsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />;
    if (currentTab === 'inv_reports') return <ReportingDashboard lang={lang} activeUser={activeUser} />;
    if (currentTab === 'inv_search') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ myCasesOnly: true }} />;

    if (currentTab === 'admin_audit') {
      return (
        <PermissionGuard allowed={canSeeAuditTrail(activeUser)} label="Piste d’Audit">
          <AuditTrailView lang={lang} activeUser={activeUser} />
        </PermissionGuard>
      );
    }
    if (currentTab === 'admin_reports') {
      return (
        <PermissionGuard allowed={canManageConfiguration(activeUser)} label="Rapports système">
          <ReportingDashboard lang={lang} activeUser={activeUser} />
        </PermissionGuard>
      );
    }

    return null;
  };

  const isStaffTab = STAFF_TAB_KEYS.includes(currentTab);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Main Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={goToTab}
        lang={lang}
        setLang={setLang}
        activeUser={activeUser}
        setActiveUser={handleUserChangeAndAuthenticate}
        onOpenQrModal={() => setShowQrModal(true)}
        pendingAlertsCount={pendingAlertsCount}
        onNavigateToCase={(trackingNumber) => navigateToCases({ trackingNumber })}
        isStaffContext={isStaffTab || currentTab === 'firebase_lookup'}
        isStaffSessionActive={isStaffSessionActive}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'home' && (
          <WhistleblowerHome
            lang={lang}
            onStartNewAlert={() => goToTab('new_alert')}
            onGoToTrack={() => goToTab('track')}
            onOpenDesk={() => goToTab('portal')}
            onGoToFaq={() => goToTab('faq')}
          />
        )}

        {/* === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) === */}
        {currentTab === 'faq' && (
          <FaqView lang={lang} onStartNewAlert={() => goToTab('new_alert')} />
        )}

        {/* === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) === */}
        {currentTab === 'contact' && <ContactView lang={lang} />}

        {currentTab === 'new_alert' && (
          <AlertSubmissionFlow
            lang={lang}
            onSuccessNavigateToTrack={handleAlertSubmitted}
            onCancel={() => goToTab('home')}
          />
        )}

        {currentTab === 'track' && (
          <AlertTrackingView
            lang={lang}
            initialTrackingNumber={prefilledTrackingNumber}
            onGoToNewAlert={() => goToTab('new_alert')}
            onGoToContact={() => goToTab('contact')}
          />
        )}

        {/* === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) === */}
        {currentTab === 'login' && <StaffLoginView onLogin={handleLogin} />}

        {isStaffTab && (
          // === AMÉLIORATION AJOUTÉE (Phase 12.2/12.4) === tout l'espace
          // staff passe désormais par AuthenticatedRoute — une session non
          // connectée (après déconnexion) est renvoyée vers /login au lieu
          // d'afficher le contenu, plutôt que de compter uniquement sur le
          // fait que le menu soit masqué.
          <AuthenticatedRoute isAuthenticated={isStaffSessionActive} onGoToLogin={() => goToTab('login')}>
            <StaffPortalLayout
              lang={lang}
              activeUser={activeUser}
              currentTab={currentTab}
              setCurrentTab={goToTab}
            >
              {renderStaffContent()}
            </StaffPortalLayout>
          </AuthenticatedRoute>
        )}

        {/* === AMÉLIORATION AJOUTÉE (Phase 4) ===
            Independent of the local demo model above: real Firebase Auth +
            Firestore against the actual project (activa-ethicalert-47246).
            See src/components/CaseLookup.tsx and docs/FIREBASE-SETUP.md. */}
        {currentTab === 'firebase_lookup' && <CaseLookup lang={lang} />}
      </main>

      {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Pied de page réduit à
          l'exact contenu de la maquette de référence : un simple lien de
          liens à gauche, la garantie "Plateforme sécurisée" à droite — plus
          de bloc de branding épais. */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 13) === Pied de page bleu marine,
          conforme à la nouvelle maquette d'accueil (au lieu du pied clair
          précédent). */}
      <footer className="bg-[#0B2545] text-slate-300 text-[11px] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* === AMÉLIORATION AJOUTÉE (Phase 20) === logo retiré du pied de page sur demande explicite (ajouté Phase 17). */}
          <span>© {new Date().getFullYear()} Groupe ACTIVA. Tous droits réservés.</span>
          <div className="flex items-center gap-4">
            <button className="hover:text-white hover:underline">{t.footer_legal_notice}</button>
            <button className="hover:text-white hover:underline">{t.footer_privacy_policy}</button>
            <button className="hover:text-white hover:underline">{t.footer_contact}</button>
          </div>
        </div>
      </footer>

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        lang={lang}
      />
    </div>
  );
}
