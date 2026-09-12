import React, { useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Building2, 
  Users, 
  Layers, 
  Clock, 
  Globe, 
  Plus, 
  Trash2, 
  RotateCcw,
  CheckCircle2,
  Database,
  Cloud,
  Server
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_COUNTRIES, ACTIVA_ENTITIES, ALERT_CATEGORIES } from '../data/activaConfig';
import { storage } from '../services/storage';
import { 
  isFirebaseConfigured, 
  getActiveFirebaseConfig, 
  setCustomFirebaseConfig, 
  clearCustomFirebaseConfig,
  fetchAlertsFromCloud
} from '../services/firebase';

interface AdminConfigViewProps {
  lang: Language;
  activeUser: UserProfile;
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  lang,
  activeUser,
}) => {
  const t = TRANSLATIONS[lang];

  const [configTab, setConfigTab] = useState<'matrix' | 'entities' | 'categories' | 'users' | 'database'>('matrix');
  const [saveBanner, setSaveBanner] = useState('');

  // Firebase connection state
  const currentFbConfig = getActiveFirebaseConfig();
  const [fbProjectId, setFbProjectId] = useState(currentFbConfig.projectId || 'activa-ethicalert');
  const [fbApiKey, setFbApiKey] = useState(currentFbConfig.apiKey || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(currentFbConfig.authDomain || '');
  const [fbStorageBucket, setFbStorageBucket] = useState(currentFbConfig.storageBucket || '');
  const [fbAppId, setFbAppId] = useState(currentFbConfig.appId || '');
  const [fbSnippet, setFbSnippet] = useState('');
  const [fbSyncStatus, setFbSyncStatus] = useState<string>('');
  const [rulesCopied, setRulesCopied] = useState(false);

  const users = storage.getUsers();

  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbApiKey.trim() || !fbProjectId.trim()) {
      alert("Veuillez renseigner au minimum la clé d'API (apiKey) et l'ID de projet (projectId).");
      return;
    }

    setCustomFirebaseConfig({
      apiKey: fbApiKey.trim(),
      projectId: fbProjectId.trim(),
      authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`,
      storageBucket: fbStorageBucket.trim() || `${fbProjectId.trim()}.appspot.com`,
      messagingSenderId: '',
      appId: fbAppId.trim() || '',
    });

    setSaveBanner(`Projet Firebase [${fbProjectId.trim()}] rattaché avec succès !`);
    setTimeout(() => setSaveBanner(''), 4000);
  };

  const handleParseSnippet = () => {
    if (!fbSnippet.trim()) return;
    try {
      const apiKeyMatch = fbSnippet.match(/apiKey:\s*["']([^"']+)["']/);
      const projMatch = fbSnippet.match(/projectId:\s*["']([^"']+)["']/);
      const authMatch = fbSnippet.match(/authDomain:\s*["']([^"']+)["']/);
      const bucketMatch = fbSnippet.match(/storageBucket:\s*["']([^"']+)["']/);
      const appIdMatch = fbSnippet.match(/appId:\s*["']([^"']+)["']/);

      if (apiKeyMatch) setFbApiKey(apiKeyMatch[1]);
      if (projMatch) setFbProjectId(projMatch[1]);
      if (authMatch) setFbAuthDomain(authMatch[1]);
      if (bucketMatch) setFbStorageBucket(bucketMatch[1]);
      if (appIdMatch) setFbAppId(appIdMatch[1]);

      setSaveBanner("Configuration extraite du code copié. Cliquez sur 'Enregistrer et Rattacher'.");
      setTimeout(() => setSaveBanner(''), 3000);
    } catch {
      alert("Impossible d'extraire la configuration. Veuillez remplir les champs manuellement.");
    }
  };

  const handleManualCloudSync = async () => {
    setFbSyncStatus('Synchronisation en cours avec Firestore...');
    try {
      const alerts = storage.getAlerts();
      const auditLogs = storage.getAuditLogs();
      const { saveAlertToCloud, saveAuditLogToCloud } = await import('../services/firebase');
      
      for (const a of alerts) {
        await saveAlertToCloud(a);
      }
      for (const log of auditLogs.slice(0, 20)) {
        await saveAuditLogToCloud(log);
      }

      setFbSyncStatus(`Succès : ${alerts.length} dossiers d'alerte et journaux d'audit synchronisés dans Firestore !`);
      setTimeout(() => setFbSyncStatus(''), 5000);
    } catch (err: any) {
      setFbSyncStatus(`Erreur lors de la synchronisation : ${err.message || err}`);
    }
  };

  const handleCopyRules = () => {
    const rulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /alerts/{alertId} {
      allow create: if request.resource.data.trackingNumber != null;
      allow read, update: if true;
      allow delete: if request.auth != null && request.auth.token.role == 'system_admin';
    }
    match /audit_logs/{logId} {
      allow create, read: if true;
      allow update, delete: if false;
    }
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'system_admin';
    }
  }
}`;
    navigator.clipboard.writeText(rulesText);
    setRulesCopied(true);
    setTimeout(() => setRulesCopied(false), 2500);
  };

  const handleResetDemoData = () => {
    if (confirm("Réinitialiser l'application avec le jeu d'essai standard conforme au Cahier des Charges ?")) {
      storage.resetToFactory();
      setSaveBanner("Données réinitialisées avec succès.");
      setTimeout(() => setSaveBanner(''), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 text-blue-700" />
              <h2 className="text-xl font-bold text-slate-900">
                {t.nav_settings} (CDC 3.2.4)
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Paramétrage global de la plateforme réservé à l'Administrateur Système ATS & DARC.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemoData}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Réinitialiser jeu de démonstration</span>
            </button>
          </div>
        </div>

        {saveBanner && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveBanner}</span>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-2 mt-4 pt-1">
          <button
            onClick={() => setConfigTab('matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              configTab === 'matrix' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Matrice des risques & Délais SLA
          </button>
          <button
            onClick={() => setConfigTab('entities')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              configTab === 'entities' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Entités du Groupe (16 filiales / 10 pays)
          </button>
          <button
            onClick={() => setConfigTab('categories')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              configTab === 'categories' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Catégories d'alerte (CDC 2.0)
          </button>
          <button
            onClick={() => setConfigTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              configTab === 'users' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Comptes & Habilitations (CDC 3.2.3)
          </button>
          <button
            onClick={() => setConfigTab('database')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              configTab === 'database' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Base de données & Firebase</span>
          </button>
        </div>
      </div>

      {/* 1. MATRIX & SLA TAB */}
      {configTab === 'matrix' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Barème officiel de la Matrice des Risques (Annexe 9)
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Évaluation pondérée sur 4 axes conduisant aux seuils NOCA 1, NOCA 2, NOCA 3 et NOCA 4.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                  <th className="p-3">Critère d'évaluation</th>
                  <th className="p-3 text-emerald-800">Faible (01)</th>
                  <th className="p-3 text-amber-800">Élevé (02)</th>
                  <th className="p-3 text-orange-800">Très élevé (03)</th>
                  <th className="p-3 text-rose-800">Critique (04)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Impact financier</td>
                  <td className="p-3">&lt; 5 000 Euro</td>
                  <td className="p-3">5 000 - 10 000 Euro</td>
                  <td className="p-3">10 000 - 20 000 Euro</td>
                  <td className="p-3">&gt; 20 000 Euro</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Niveau hiérarchique</td>
                  <td className="p-3">Employé</td>
                  <td className="p-3">Cadre</td>
                  <td className="p-3">Sous Directeur</td>
                  <td className="p-3">Directeur</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Récidive</td>
                  <td className="p-3">Aucune</td>
                  <td className="p-3">Possible</td>
                  <td className="p-3">Confirmée</td>
                  <td className="p-3">Confirmée (Majeure)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Risque réputationnel</td>
                  <td className="p-3">Négligeable</td>
                  <td className="p-3">Modéré</td>
                  <td className="p-3">Élevé</td>
                  <td className="p-3">Élevé / Médiatique</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Thresholds Table */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
              Seuils de priorité et délais cibles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <div className="font-bold text-emerald-900">NOCA 1 - Faible</div>
                <div className="text-[11px] text-emerald-800">Score 4 à 6</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Traitement standard</div>
                <div className="text-[11px] text-slate-500">Délai : 30 jours max</div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
                <div className="font-bold text-amber-900">NOCA 2 - Élevée</div>
                <div className="text-[11px] text-amber-800">Score 7 à 10</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Suivi renforcé</div>
                <div className="text-[11px] text-slate-500">Délai : 15 jours max</div>
              </div>

              <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/60">
                <div className="font-bold text-orange-900">NOCA 3 - Très élevé</div>
                <div className="text-[11px] text-orange-800">Score 11 à 13</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Enquête urgente</div>
                <div className="text-[11px] text-slate-500">Délai : 7 jours max</div>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                <div className="font-bold text-rose-900">NOCA 4 - Critique</div>
                <div className="text-[11px] text-rose-800">Score 14 à 16</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Action immédiate</div>
                <div className="text-[11px] text-slate-500">Délai : 48 heures max</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENTITIES TAB */}
      {configTab === 'entities' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Entités et filiales du Groupe ACTIVA (16 entités dans 10 pays)
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Conforme au périmètre institutionnel établi dans le Cahier des Charges.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIVA_ENTITIES.map((ent) => (
              <div key={ent.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{ent.flag}</span>
                    <span>{ent.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{ent.country}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                  Actif
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CATEGORIES TAB */}
      {configTab === 'categories' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Nomenclature des catégories et sous-catégories de manquements (CDC 2.0)
            </h3>
          </div>

          <div className="space-y-4">
            {ALERT_CATEGORIES.map((cat) => (
              <div key={cat.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-[#0B2545] text-sm">
                  {cat.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.subCategories.map((sub, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. USERS & ROLES TAB */}
      {configTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Profils et Habilitations (CDC 3.2.3)
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Gestionnaires, Administrateurs fonctionnels, Administrateurs système, Consultation et Lanceurs d'alerte.
            </p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-[11px] text-slate-500">{u.email} • {u.entity} ({u.country})</div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">
                    {u.role.toUpperCase()}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">{u.roleTitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. DATABASE & FIREBASE PERSISTENCE TAB */}
      {configTab === 'database' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                Rattachement au Projet Firebase "ACTIVA EthicAlert"
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Connectez directement votre projet Cloud Firestore pour la centralisation des alertes et de la piste d'audit.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 ${
                isFirebaseConfigured()
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                <Cloud className="w-3.5 h-3.5" />
                {isFirebaseConfigured() 
                  ? `Connecté : ${fbProjectId}` 
                  : 'En attente des identifiants projet'}
              </span>

              {isFirebaseConfigured() && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Déconnecter la configuration personnalisée Firebase ?")) {
                      clearCustomFirebaseConfig();
                      setFbApiKey('');
                      setSaveBanner("Configuration réinitialisée.");
                      setTimeout(() => setSaveBanner(''), 3000);
                    }
                  }}
                  className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium text-[11px]"
                >
                  Déconnecter
                </button>
              )}
            </div>
          </div>

          {fbSyncStatus && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-semibold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>{fbSyncStatus}</span>
            </div>
          )}

          {/* Form to connect Firebase Project */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Identifiants de l'application Web Firebase
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Disponibles sur <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">console.firebase.google.com</a> &gt; Projet <strong>ACTIVA EthicAlert</strong> &gt; Paramètres du projet &gt; Vos applications (Web).
                </p>
              </div>

              {/* Quick action: Manual Cloud Sync */}
              {isFirebaseConfigured() && (
                <button
                  type="button"
                  onClick={handleManualCloudSync}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Synchroniser alertes vers Cloud</span>
                </button>
              )}
            </div>

            {/* Quick snippet paste */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <label className="block font-semibold text-slate-700 text-[11px]">
                Option rapide : Collez ici l'objet <code className="text-blue-700 font-mono">firebaseConfig</code> de la console Firebase
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fbSnippet}
                  onChange={(e) => setFbSnippet(e.target.value)}
                  placeholder="Ex: const firebaseConfig = { apiKey: 'AIza...', projectId: 'activa-ethicalert', ... };"
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleParseSnippet}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs whitespace-nowrap"
                >
                  Extraire
                </button>
              </div>
            </div>

            {/* Manual fields */}
            <form onSubmit={handleSaveFirebaseConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID de Projet Firebase (projectId) *
                </label>
                <input
                  type="text"
                  value={fbProjectId}
                  onChange={(e) => setFbProjectId(e.target.value)}
                  placeholder="activa-ethicalert"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Clé d'API Web (apiKey) *
                </label>
                <input
                  type="text"
                  value={fbApiKey}
                  onChange={(e) => setFbApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Domaine d'authentification (authDomain)
                </label>
                <input
                  type="text"
                  value={fbAuthDomain}
                  onChange={(e) => setFbAuthDomain(e.target.value)}
                  placeholder="activa-ethicalert.firebaseapp.com"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Identifiant de l'application (appId)
                </label>
                <input
                  type="text"
                  value={fbAppId}
                  onChange={(e) => setFbAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold text-xs shadow-md transition"
                >
                  Rattacher et Activer la Synchronisation Cloud
                </button>
              </div>
            </form>
          </div>

          {/* Security Rules & Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Règles de sécurité Firestore (Annexe CDC)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRules}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] transition"
                >
                  {rulesCopied ? 'Copié !' : 'Copier les règles'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-amber-300 font-mono text-[10px] rounded-lg overflow-x-auto max-h-44">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /alerts/{alertId} {
      allow create: if request.resource.data.trackingNumber != null;
      allow read, update: if true;
      allow delete: if request.auth != null && request.auth.token.role == 'system_admin';
    }
    match /audit_logs/{logId} {
      allow create, read: if true;
      allow update, delete: if false; // Immuable
    }
  }
}`}
              </pre>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Garantie de Disponibilité & Traçabilité</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Architecture bi-couche résiliente</strong> : les signalements sont sécurisés immédiatement même en cas de coupure de connexion réseau.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Piste d'audit inviolable (CDC 3.1.5)</strong> : chaque accès ou modification génère une écriture scellée et conservée 10 ans.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Anonymat garanti</strong> : aucune donnée personnelle d'IP ou de géolocalisation n'est stockée dans Firestore lors d'un dépôt anonyme.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
