/**
 * ACTIVA EthicAlert - Plateforme Sécurisée de Gestion des Alertes Éthiques
 * Groupe ACTIVA (DARC - Direction d'Audit, des Risques et de la Conformité)
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language, UserProfile } from './types';
import { storage } from './services/storage';
import { Navbar } from './components/Navbar';
import { WhistleblowerHome } from './components/WhistleblowerHome';
import { AlertSubmissionFlow } from './components/AlertSubmissionFlow';
import { AlertTrackingView } from './components/AlertTrackingView';
import { InvestigationDesk } from './components/InvestigationDesk';
import { ControlPanel } from './components/ControlPanel';
import { ReportingDashboard } from './components/ReportingDashboard';
import { AuditTrailView } from './components/AuditTrailView';
import { AdminConfigView } from './components/AdminConfigView';
import { QrCodeModal } from './components/QrCodeModal';
import { StaffPortalLayout } from './components/StaffPortalLayout';
import { CaseLookup } from './components/CaseLookup';
import { ShieldCheck, Lock, Building2, ShieldOff } from 'lucide-react';

// Tabs handled by the top Navbar: 'home' | 'new_alert' | 'track' | 'portal' | 'reports' | 'audit' | 'settings' | 'firebase_lookup'

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [prefilledTrackingNumber, setPrefilledTrackingNumber] = useState<string>('');
  // === AMÉLIORATION AJOUTÉE (Phase 5) === filter the Control Panel's KPI
  // cards/quick actions hand off to InvestigationDesk when navigating there.
  const [pendingCaseFilter, setPendingCaseFilter] = useState<
    { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean } | undefined
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
    if (
      user.role === 'whistleblower' &&
      ['control_panel', 'portal', 'reports', 'audit', 'settings'].includes(currentTab)
    ) {
      setCurrentTab('home');
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

  const navigateToCases = (filter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean }) => {
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
        />
      ) : (
        renderAccessDenied('Centre de Pilotage')
      );
    }
    if (currentTab === 'portal') return <InvestigationDesk lang={lang} activeUser={activeUser} initialFilter={pendingCaseFilter} />;
    if (currentTab === 'reports') return <ReportingDashboard lang={lang} activeUser={activeUser} />;
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
    return null;
  };

  const isStaffTab = ['control_panel', 'portal', 'reports', 'audit', 'settings'].includes(currentTab);

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

      {/* Corporate Ethical Governance Footer */}
      <footer className="bg-[#0B2545] text-slate-300 border-t border-slate-800 text-xs py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-extrabold text-[#0B2545] text-sm">
                A
              </div>
              <div>
                <span className="font-extrabold text-white text-sm tracking-wide">
                  ACTIVA EthicAlert
                </span>
                <span className="text-[11px] text-amber-300 block">
                  Direction d'Audit, des Risques et de la Conformité (DARC)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Conforme CDC Groupe ACTIVA
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                Chiffrement TLS & Intégrité Piste d'Audit
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-300" />
                16 filiales • 10 pays africains
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>
              © {new Date().getFullYear()} Groupe ACTIVA. Tous droits réservés. Plateforme de signalement éthique professionnelle.
            </p>
            <p className="text-center sm:text-right">
              Garantie stricte de non-représailles et de confidentialité des données à caractère personnel (RGPD & législations CIMA).
            </p>
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
