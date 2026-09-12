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
import { ReportingDashboard } from './components/ReportingDashboard';
import { AuditTrailView } from './components/AuditTrailView';
import { AdminConfigView } from './components/AdminConfigView';
import { EnterpriseArchitectureView } from './components/EnterpriseArchitectureView';
import { QrCodeModal } from './components/QrCodeModal';
import { ShieldCheck, Lock, Globe, Building2, ExternalLink } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const [activeTab, setActiveTab] = useState<string>('whistleblower_home');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [prefilledTrackingNumber, setPrefilledTrackingNumber] = useState<string>('');

  // Current logged in / active profile (defaults to functional_admin for easy testing and governance)
  const users = storage.getUsers();
  const [activeUser, setActiveUser] = useState<UserProfile>(
    users.find(u => u.role === 'functional_admin') || users[0]
  );

  // When switching to whistleblower view, set a public view or adjust
  const handleRoleChange = (newUserId: string) => {
    const found = users.find(u => u.id === newUserId);
    if (found) {
      setActiveUser(found);
      // If switching to whistleblower, navigate to home if in admin views
      if (found.role === 'whistleblower' && (activeTab === 'investigation_desk' || activeTab === 'reporting' || activeTab === 'audit' || activeTab === 'admin_config')) {
        setActiveTab('whistleblower_home');
      }
    }
  };

  const handleSubmittedAlert = (trackingNumber: string) => {
    setPrefilledTrackingNumber(trackingNumber);
    setActiveTab('whistleblower_track');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Main Navigation */}
      <Navbar
        lang={lang}
        onLanguageChange={setLang}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeUser={activeUser}
        onUserChange={handleRoleChange}
        onOpenQrModal={() => setShowQrModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'whistleblower_home' && (
          <WhistleblowerHome
            lang={lang}
            onStartNewAlert={() => setActiveTab('whistleblower_submit')}
            onGoToTrack={() => setActiveTab('whistleblower_track')}
            onOpenQrModal={() => setShowQrModal(true)}
            onOpenDesk={() => setActiveTab('investigation_desk')}
          />
        )}

        {activeTab === 'whistleblower_submit' && (
          <AlertSubmissionFlow
            lang={lang}
            onComplete={handleSubmittedAlert}
            onCancel={() => setActiveTab('whistleblower_home')}
          />
        )}

        {activeTab === 'whistleblower_track' && (
          <AlertTrackingView
            lang={lang}
            initialTrackingNumber={prefilledTrackingNumber}
            onBackToHome={() => setActiveTab('whistleblower_home')}
          />
        )}

        {activeTab === 'investigation_desk' && (
          <InvestigationDesk
            lang={lang}
            activeUser={activeUser}
          />
        )}

        {activeTab === 'reporting' && (
          <ReportingDashboard
            lang={lang}
            activeUser={activeUser}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView
            lang={lang}
            activeUser={activeUser}
          />
        )}

        {activeTab === 'admin_config' && (
          <AdminConfigView
            lang={lang}
            activeUser={activeUser}
          />
        )}

        {activeTab === 'architecture' && (
          <EnterpriseArchitectureView
            lang={lang}
            activeUser={activeUser}
          />
        )}
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
