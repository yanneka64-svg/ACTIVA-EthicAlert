/**
 * ACTIVA EthicAlert - Plateforme Sécurisée de Gestion des Alertes Éthiques
 * Groupe ACTIVA (DARC - Direction d'Audit, des Risques et de la Conformité)
 * @license Apache-2.0
 */

// === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
// `lazy` n'est plus utilisé ici : les déclarations `React.lazy` vivent
// désormais dans ./app/lazyScreens.ts.
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Language, UserProfile } from './types';
import { storage } from './services/storage';
import { TRANSLATIONS } from './i18n/translations';
// === AMÉLIORATION AJOUTÉE : langue courante partagée avec les petits composants ===
import { setCurrentLang } from './i18n/currentLang';
import { Navbar } from './components/Navbar';
import { WhistleblowerHome } from './components/WhistleblowerHome';
// === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
import { FaqView } from './components/FaqView';
// === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
import { ContactView } from './components/ContactView';
// === AMÉLIORATION AJOUTÉE (liens réels du pied de page) ===
import { LegalNoticeView } from './components/LegalNoticeView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { AlertSubmissionFlow } from './components/AlertSubmissionFlow';
import { AlertTrackingView } from './components/AlertTrackingView';
import { QrCodeModal } from './components/QrCodeModal';
import { StaffPortalLayout } from './components/StaffPortalLayout';
// === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
// Déclarations `React.lazy` des écrans staff (avec leur commentaire
// d'origine), indicateur de chargement, aiguillage des écrans staff et pied
// de page déplacés dans ./app/ — voir l'en-tête de chaque fichier.
import { StaffSpaceHome, CaseLookup, StaffLoginView } from './app/lazyScreens';
import { StaffLoadingFallback } from './app/StaffLoadingFallback';
import { renderStaffScreen } from './app/renderStaffScreen';
import { AppFooter } from './app/AppFooter';
// === AMÉLIORATION AJOUTÉE : correction post-fusion ===
// Ces imports (routage par URL, garde-fous, pont RBAC, écran de connexion
// interne — Phase 12.2/12.3/12.4) avaient disparu lors de la fusion avec la
// refonte visuelle (Phase 13/16), alors que le code plus bas continuait de
// les utiliser (`navigate`, `pathForTab`, `PermissionGuard`,
// `AuthenticatedRoute`, `canSeeAuditTrail`, `canManageConfiguration`,
// `isGlobalCaseViewer`, `StaffLoginView`) — d'où l'échec de compilation.
// Restaurés ici, sans rien changer au reste de la restructuration visuelle.
import { resolveRoute, pathForTab } from './routing/routes';
// === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
// `PermissionGuard`, `canSeeAuditTrail`, `canManageConfiguration` et `userCan`
// ne servent plus qu'à l'aiguillage des écrans staff, déplacé dans
// ./app/renderStaffScreen.tsx (qui les importe lui-même).
import { AuthenticatedRoute } from './routing/guards';
import { isGlobalCaseViewer } from './services/authz';

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
  // === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
  // barre latérale) ===
  'space_home',
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
  // === AMÉLIORATION AJOUTÉE (Revue navigation — nettoyage des doublons morts) ===
  // `op_search`/`op_reports`/`op_communications`/`inv_tasks`/`inv_evidence`/
  // `inv_communications`/`inv_reports`/`inv_search` retirés de cette liste :
  // ils rendaient le même écran que `advanced_search`/`reports`/
  // `communications`/`tasks`/`evidence` sans aucune différence fonctionnelle,
  // et n'étaient plus atteignables par aucun bouton de menu depuis la
  // Proposition B (voir StaffPortalLayout.tsx). Leurs anciennes URLs restent
  // fonctionnelles via un alias dans routing/routes.ts.
  'op_dashboard', 'op_inbox', 'op_pending_info', 'op_assign', 'op_processed', 'op_review', 'op_closed',
  'inv_dashboard', 'inv_my_cases', 'inv_to_process', 'inv_in_progress', 'inv_pending',
  'admin_audit', 'admin_reports', 'admin_organization',
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  'admin_governance',
  // === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
  'advanced_search',
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée) ===
  // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
  // données" retiré) === 'admin_database' retiré de cette liste, sur
  // demande explicite de l'utilisateur (voir aussi routing/routes.ts et
  // StaffPortalLayout.tsx).
  'admin_entities', 'admin_categories',
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
  setCurrentLang(lang);
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
  // réel.
  // === AMÉLIORATION AJOUTÉE (BUG PRÉEXISTANT CORRIGÉ — accès direct à
  // l'espace de travail sans connexion) === Signalé par l'utilisateur :
  // partager le lien de l'app donnait à quiconque l'ouvre sur un appareil
  // différent un accès DIRECT à l'espace collaborateur, sans jamais passer
  // par l'écran de connexion. Cause : ce useState valait `true` par défaut
  // au tout premier lancement (aucune clé en storage), pour "ne rien
  // changer au confort existant" — mais un appareil qui n'a jamais visité
  // l'app n'a justement AUCUNE clé en storage, donc était traité comme déjà
  // connecté. Vaut désormais `false` par défaut (connexion requise) tant
  // qu'aucune session n'a été explicitement établie sur cet appareil ; un
  // appareil déjà connecté (clé déjà à 'true' en storage) n'est pas
  // affecté. Même correctif pour le cas `localStorage` indisponible : repli
  // fermé (connexion requise) plutôt qu'ouvert.
  const STAFF_SESSION_KEY = 'activa_staff_session_active';
  const [isStaffSessionActive, setIsStaffSessionActiveState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STAFF_SESSION_KEY) === 'true';
    } catch {
      return false;
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

  // === AMÉLIORATION AJOUTÉE (connexion — retour systématique à l'accueil
  // des espaces) === Sur demande explicite de l'utilisateur, TOUT compte
  // qui se connecte est désormais ramené sur l'accueil des espaces
  // (StaffSpaceHome.tsx), quel que soit le nombre d'espaces réellement
  // accessibles — c'est là que son nom est affiché et que le choix
  // d'espace se fait, plutôt que d'y accéder directement pour les comptes
  // à un seul espace comme auparavant.
  const handleLogin = (user: UserProfile) => {
    handleUserChange(user);
    setIsStaffSessionActive(true);
    navigate(pathForTab('space_home'));
  };

  const handleLogout = () => {
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 6) === best-
    // effort, jamais attendu : évite qu'une session Firebase Auth réelle
    // établie par syncStaffAuthSession (staffAuthSync.ts) pour ce compte
    // reste ouverte et fuite vers le prochain compte connecté localement
    // dans ce même navigateur. Import dynamique : `staffAuthSync.ts` importe
    // `firebase/auth` (via staffAuth.ts) — App.tsx est le point d'entrée
    // principal, chargé par CHAQUE visiteur y compris le formulaire public
    // anonyme, donc jamais d'import statique de ce module ici (même
    // discipline que services/firebaseClient.ts/getPhase4Functions).
    import('./services/staffAuthSync').then(({ clearStaffAuthSession }) => clearStaffAuthSession()).catch(() => {});
    setIsStaffSessionActive(false);
    navigate(pathForTab('login'));
  };

  // === AMÉLIORATION AJOUTÉE (déconnexion automatique après inactivité) ===
  // Les espaces de travail internes se déconnectent automatiquement après
  // 5 minutes sans interaction (souris, clavier, défilement, tactile) —
  // aucune minuterie tant qu'aucune session interne n'est active (l'accueil
  // public n'est jamais concerné).
  const IDLE_LOGOUT_MS = 5 * 60 * 1000;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!isStaffSessionActive) return;
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        handleLogout();
      }, IDLE_LOGOUT_MS);
    };
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer));
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaffSessionActive]);

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
  // devient `<PermissionGuard lang={lang} allowed label>` (routing/guards.tsx) — même
  // garde de défense en profondeur qu'avant (la Navbar/barre latérale
  // masquent déjà ces entrées, mais l'écran actif est revalidé ici aussi),
  // simplement extraite en composant nommé et réutilisable.
  const renderStaffContent = () => {
    // === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
    // Corps déplacé tel quel dans ./app/renderStaffScreen.tsx (fonction
    // ordinaire, pas un composant : arbre React strictement identique).
    return renderStaffScreen({ currentTab, lang, t, activeUser, isGlobalViewer, effectiveCaseFilter, navigateToCases, goToTab });
  };

  const isStaffTab = STAFF_TAB_KEYS.includes(currentTab);
  // === AMÉLIORATION AJOUTÉE (page de connexion plein cadre, sur maquette
  // fournie) === La nouvelle page de connexion (photo du siège + sélecteur
  // de profil à gauche, formulaire à droite) reste dans le cadre standard
  // de l'app : la Navbar (topbar) et le pied de page ne disparaissent
  // jamais, quel que soit l'écran — consigne explicite de l'utilisateur.
  // (Une précédente version masquait la Navbar sur cet écran ; revenue en
  // arrière sur demande.)

  return (
    // === AMÉLIORATION AJOUTÉE (Ascenseur sous l'en-tête) === `min-h-screen`
    // + page (html/body) scrollable → `h-screen overflow-hidden` + seule la
    // zone sous l'en-tête (nouveau conteneur ci-dessous) scrolle. Sur
    // demande explicite : la barre de défilement verticale ne doit plus
    // s'étendre sur toute la hauteur (à côté de l'en-tête aussi), mais
    // débuter juste en dessous. L'en-tête (Navbar) reste hors de cette zone
    // scrollable, donc toujours visible, sans avoir besoin d'être `sticky`
    // (son parent ne défile plus).
    <div className="h-screen overflow-hidden bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
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
        // === AMÉLIORATION AJOUTÉE (en-tête cohérent sur l'écran "Connexion
        // requise") === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur
        // (capture d'écran) : un visiteur non connecté qui ouvrait un lien
        // direct vers un écran interne voyait quand même l'en-tête "espace
        // collaborateur" (avatar, barre de bulles "Espace Gestion DARC")
        // au-dessus du mur "Connexion requise" — `isStaffContext` ne
        // dépendait que de l'onglet visé, jamais de l'état réel de
        // connexion. Exige désormais aussi `isStaffSessionActive` : tant
        // que la connexion n'est pas faite, l'en-tête public normal
        // s'affiche (logo, Signaler/Suivre, Connexion), cohérent avec le
        // mur affiché juste en dessous.
        isStaffContext={(isStaffTab || currentTab === 'firebase_lookup') && isStaffSessionActive}
        isStaffSessionActive={isStaffSessionActive}
        onLogout={handleLogout}
      />

      {/* === AMÉLIORATION AJOUTÉE (Ascenseur sous l'en-tête) === Seule zone
          scrollable de la page : uniquement `<main>` — l'en-tête ET le pied
          de page vivent désormais tous deux hors du défilement (voir
          plus bas, BUG PRÉEXISTANT CORRIGÉ : la barre de défilement
          couvrait visuellement le pied de page, signalé par l'utilisateur).
          `min-h-0` est nécessaire : sans lui, un enfant flex refuse par
          défaut de rétrécir sous la taille de son contenu, empêchant
          `overflow-y-auto` de jouer son rôle ici. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
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

        {/* === AMÉLIORATION AJOUTÉE (liens réels du pied de page) === */}
        {currentTab === 'legal_notice' && <LegalNoticeView lang={lang} />}
        {currentTab === 'privacy_policy' && <PrivacyPolicyView lang={lang} />}

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
        {currentTab === 'login' && (
          <Suspense fallback={<StaffLoadingFallback />}>
            <StaffLoginView lang={lang} onLogin={handleLogin} onGoToContact={() => goToTab('contact')} />
          </Suspense>
        )}

        {/* === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le
            sélecteur en barre latérale) === Rendue à part, HORS de
            StaffPortalLayout (donc sans sidebar) — même traitement que
            /login ou /track juste au-dessus : un vrai plein-écran d'accueil,
            pas un écran de plus dans le menu latéral. Toujours protégée par
            AuthenticatedRoute comme le reste de l'espace staff. */}
        {currentTab === 'space_home' && (
          <AuthenticatedRoute lang={lang} isAuthenticated={isStaffSessionActive} onGoToLogin={() => goToTab('login')}>
            <Suspense fallback={<StaffLoadingFallback />}>
              <StaffSpaceHome lang={lang} activeUser={activeUser} setCurrentTab={goToTab} />
            </Suspense>
          </AuthenticatedRoute>
        )}

        {isStaffTab && currentTab !== 'space_home' && (
          // === AMÉLIORATION AJOUTÉE (Phase 12.2/12.4) === tout l'espace
          // staff passe désormais par AuthenticatedRoute — une session non
          // connectée (après déconnexion) est renvoyée vers /login au lieu
          // d'afficher le contenu, plutôt que de compter uniquement sur le
          // fait que le menu soit masqué.
          <AuthenticatedRoute lang={lang} isAuthenticated={isStaffSessionActive} onGoToLogin={() => goToTab('login')}>
            <StaffPortalLayout
              lang={lang}
              activeUser={activeUser}
              currentTab={currentTab}
              setCurrentTab={goToTab}
            >
              <Suspense fallback={<StaffLoadingFallback />}>{renderStaffContent()}</Suspense>
            </StaffPortalLayout>
          </AuthenticatedRoute>
        )}

        {/* === AMÉLIORATION AJOUTÉE (Phase 4) ===
            Independent of the local demo model above: real Firebase Auth +
            Firestore against the actual project (activa-ethicalert-47246).
            See src/components/CaseLookup.tsx and docs/FIREBASE-SETUP.md. */}
        {currentTab === 'firebase_lookup' && (
          <Suspense fallback={<StaffLoadingFallback />}>
            <CaseLookup lang={lang} />
          </Suspense>
        )}
      </main>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Pied de page réduit à
          l'exact contenu de la maquette de référence : un simple lien de
          liens à gauche, la garantie "Plateforme sécurisée" à droite — plus
          de bloc de branding épais. */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 13) === Pied de page bleu marine,
          conforme à la nouvelle maquette d'accueil (au lieu du pied clair
          précédent). */}
      {/* === AMÉLIORATION AJOUTÉE (pied de page fixe en bas de l'écran) ===
          BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : la barre de
          défilement (propre à la zone scrollable ci-dessus) continuait de
          s'afficher par-dessus le pied de page tant qu'il faisait partie de
          cette même zone scrollable — comportement standard de tout
          navigateur, mais visuellement gênant. Sorti de la zone scrollable
          et placé ici, en frère direct (racine `flex flex-col`, `shrink-0`
          implicite car sans `flex-1`) : il reste désormais TOUJOURS visible,
          épinglé en bas de l'écran, et la barre de défilement ne couvre
          plus que la zone entre l'en-tête et lui. */}
      <AppFooter t={t} goToTab={goToTab} />

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        lang={lang}
      />
    </div>
  );
}
