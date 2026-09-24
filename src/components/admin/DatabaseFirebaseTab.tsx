/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Septième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx —
 * voir les PR précédentes (#90-#95) pour le contexte général et les étapes
 * déjà faites. Extraction de l'onglet "Base de données" (rattachement au
 * projet Firebase, synchronisation cloud manuelle, règles de sécurité)
 * hors du composant monolithique AdminConfigView.tsx, sans aucun
 * changement de comportement.
 *
 * Code strictement déplacé, pas réécrit — y compris le `window.confirm()`
 * natif du bouton "Déconnecter" (pas converti en `ConfirmDialog`, ce qui
 * serait un changement d'UX visible, hors périmètre d'un pur déplacement
 * de code). `setSaveBanner` (pas `flashBanner`) est passé en prop et
 * utilisé tel quel : ces handlers ont toujours géré leurs propres délais
 * d'affichage (3000/4000 ms selon le message), différents du délai fixe de
 * `flashBanner` — les reproduire à l'identique évite de changer la durée
 * d'affichage de ces bandeaux précis.
 */
import React, { useState } from 'react';
import { Database, Cloud, Server, ShieldCheck, RotateCcw, CheckCircle2 } from 'lucide-react';
import { storage } from '../../services/storage';
import {
  isFirebaseConfigured,
  getActiveFirebaseConfig,
  setCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  fetchAlertsFromCloud
} from '../../services/firebase';

interface DatabaseFirebaseTabProps {
  setSaveBanner: (msg: string) => void;
}

export const DatabaseFirebaseTab: React.FC<DatabaseFirebaseTabProps> = ({ setSaveBanner }) => {
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
      const { saveAlertToCloud, saveAuditLogToCloud } = await import('../../services/firebase');

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" />
            Rattachement au Projet Firebase "activa-whistleblowing"
          </h3>
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
              Disponibles sur <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">console.firebase.google.com</a> &gt; Projet <strong>activa-whistleblowing</strong> &gt; Paramètres du projet &gt; Vos applications (Web).
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
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré */
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
              <span>Règles de sécurité Firestore</span>
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
              <span><strong>Piste d'audit inviolable</strong> : chaque accès ou modification génère une écriture scellée et conservée 10 ans.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">•</span>
              <span><strong>Anonymat garanti</strong> : aucune donnée personnelle d'IP ou de géolocalisation n'est stockée dans Firestore lors d'un dépôt anonyme.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
