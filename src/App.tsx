/**
 * ACTIVA EthicAlert - Plateforme Sécurisée de Gestion des Alertes Éthiques
 * Groupe ACTIVA (DARC - Direction d'Audit, des Risques et de la Conformité)
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language, UserProfile } from './types';
import { storage } from './services/storage';
import { TRANSLATIONS } from './i18n/translations';
import { Navbar } from './components/Navbar';
import { WhistleblowerHome } from './components/WhistleblowerHome';
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
import { ShieldCheck, ShieldOff } from 'lucide-react';

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
];

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const t = TRANSLATIONS[lang];
  const [currentTab, setCurrentTab] = useState<string>('home');
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

  // Live alert count for the Navbar badge & role-based access guards below.
  const [alertCount, setAlertCount] = useState(() => storage.getAlerts().length);
  useEffect(() => {
    const unsub = storage.subscribe(() => setAlertCount(storage.getAlerts().length));
    return unsub;
  }, []);

  const isGlobalViewer =
    activeUser.role === 'functional_admin' ||
    activeUser.role === 'system_admin' ||
    activeUser.role === 'auditor';

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
    if (user.role === 'whistleblower' && STAFF_TAB_KEYS.includes(currentTab)) {
      setCurrentTab('home');
    }
    // === AMÉLIORATION AJOUTÉE (Phase 11) === Symmetric case: the public top
    // nav no longer carries a visible "Espace Gestion DARC" button (removed
    // to match the reference mockup's public header exactly — Accueil /
    // Comment ça marche / FAQ only), so picking a staff profile from a
    // public page needs to land somewhere real; the staff portal's own
    // sidebar (StaffPortalLayout) then covers every other screen.
    else if (user.role !== 'whistleblower' && !STAFF_TAB_KEYS.includes(currentTab)) {
      setCurrentTab('portal');
    }
  };

  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  // A plain tab switch (Navbar / sidebar) clears any Control-Panel-driven
  // filter so it never leaks into a later, unrelated visit to "portal" —
  // only navigateToCases() below sets a filter, deliberately.
  const goToTab = (tab: string) => {
    setPendingCaseFilter(undefined);
    setCurrentTab(tab);
  };

  const navigateToCases = (filter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean; trackingNumber?: string; myCasesOnly?: boolean }) => {
    setPendingCaseFilter(filter);
    setCurrentTab('portal');
  };

  const handleAlertSubmitted = (trackingNumber: string) => {
    setPrefilledTrackingNumber(trackingNumber);
    setCurrentTab('track');
  };

  // Access-denied guard for role-restricted staff screens (defense in depth: the Navbar and
  // sidebar already hide these entries, but the active view is re-validated here too since
  // authorization must never rely on UI visibility alone).
  const renderAccessDenied = (label: string) => (
    <div className="max-w-xl mx-auto py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
        <ShieldOff className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Accès restreint</h2>
      <p className="text-xs text-slate-600 mt-2">
        Votre profil ({activeUser.roleTitle}) ne dispose pas des habilitations nécessaires pour
        consulter « {label} ». Cette restriction est appliquée conformément au principe du
        moindre privilège (CDC 3.2.3).
      </p>
    </div>
  );

  const renderStaffContent = () => {
    if (currentTab === 'control_panel') {
      return isGlobalViewer ? (
        <ControlPanel
          lang={lang}
          activeUser={activeUser}
          onNavigateToCases={navigateToCases}
          onNavigateToReports={() => goToTab('reports')}
          onNavigateToNewCase={() => goToTab('new_alert')}
        />
      ) : (
        renderAccessDenied('Centre de Pilotage')
      );
    }
    if (currentTab === 'portal') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={pendingCaseFilter} />;
    // === AMÉLIORATION AJOUTÉE (Phase 9 — écrans dédiés façon maquette) ===
    // Chacune de ces entrées réutilise InvestigationDesk (même liste, même
    // écran de détail, mêmes actions) avec un `initialFilter` préréglé
    // différent — pas une copie, un préréglage — exactement comme le
    // Centre de Pilotage le fait déjà pour ses propres cartes KPI.
    if (currentTab === 'triage') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ status: 'new' }} />;
    if (currentTab === 'assignment') {
      return isGlobalViewer ? (
        <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={{ unassignedOnly: true }} />
      ) : (
        renderAccessDenied('Attribution')
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
      return isGlobalViewer ? (
        <ExecutiveDashboard lang={lang} activeUser={activeUser} />
      ) : (
        renderAccessDenied('Vue Exécutive')
      );
    }
    if (currentTab === 'audit') {
      return isGlobalViewer ? (
        <AuditTrailView lang={lang} activeUser={activeUser} />
      ) : (
        renderAccessDenied('Piste d’Audit')
      );
    }
    if (currentTab === 'settings') {
      return activeUser.role === 'system_admin' ? (
        <AdminConfigView lang={lang} activeUser={activeUser} />
      ) : (
        renderAccessDenied('Administration')
      );
    }
    // === AMÉLIORATION AJOUTÉE (Phase 9 — Administration scindée en 2 écrans
    // dédiés façon maquette) === Même composant, même CRUD, même garde de
    // rôle que 'settings' ci-dessus — seul l'onglet de départ diffère, et le
    // sélecteur d'onglets complet reste visible pour ne rien masquer.
    if (currentTab === 'admin_users') {
      return activeUser.role === 'system_admin' ? (
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="users" />
      ) : (
        renderAccessDenied('Utilisateurs & Rôles')
      );
    }
    if (currentTab === 'admin_config') {
      return activeUser.role === 'system_admin' ? (
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="matrix" />
      ) : (
        renderAccessDenied('Configuration')
      );
    }
    // === AMÉLIORATION AJOUTÉE (Phase 11 — "Rôles & Permissions" de la
    // maquette) === même composant/CRUD/garde que 'admin_users', onglet de
    // départ différent.
    if (currentTab === 'admin_roles') {
      return activeUser.role === 'system_admin' ? (
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="roles" />
      ) : (
        renderAccessDenied('Rôles & Permissions')
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
        setActiveUser={handleUserChange}
        onOpenQrModal={() => setShowQrModal(true)}
        pendingAlertsCount={pendingAlertsCount}
        onNavigateToCase={(trackingNumber) => navigateToCases({ trackingNumber })}
        isStaffContext={isStaffTab || currentTab === 'firebase_lookup'}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'home' && (
          <WhistleblowerHome
            lang={lang}
            onStartNewAlert={() => setCurrentTab('new_alert')}
            onGoToTrack={() => setCurrentTab('track')}
            onOpenQrModal={() => setShowQrModal(true)}
            onOpenDesk={() => goToTab('portal')}
          />
        )}

        {currentTab === 'new_alert' && (
          <AlertSubmissionFlow
            lang={lang}
            onSuccessNavigateToTrack={handleAlertSubmitted}
            onCancel={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'track' && (
          <AlertTrackingView
            lang={lang}
            initialTrackingNumber={prefilledTrackingNumber}
            onGoToNewAlert={() => setCurrentTab('new_alert')}
          />
        )}

        {isStaffTab && (
          <StaffPortalLayout
            lang={lang}
            activeUser={activeUser}
            currentTab={currentTab}
            setCurrentTab={goToTab}
          >
            {renderStaffContent()}
          </StaffPortalLayout>
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
      <footer className="bg-white border-t border-slate-200 text-[11px] text-slate-500 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} Groupe ACTIVA.</span>
            <button className="hover:text-blue-700 hover:underline">{t.footer_confidentiality}</button>
            <button className="hover:text-blue-700 hover:underline">{t.footer_legal}</button>
            <button className="hover:text-blue-700 hover:underline">{t.footer_contact}</button>
          </div>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium text-slate-600">{t.footer_secure}</span>
            <span className="text-slate-300">|</span>
            <span>{t.footer_secure_sub}</span>
          </span>
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
