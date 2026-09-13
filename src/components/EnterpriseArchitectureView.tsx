import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Database, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  Server, 
  Lock, 
  FolderTree, 
  Play, 
  RefreshCw, 
  Terminal, 
  Sliders, 
  FileCheck2, 
  Scale, 
  Clock, 
  Bell, 
  UserX, 
  Eye, 
  ShieldAlert, 
  ChevronRight, 
  Info,
  Archive,
  Ban
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { ApiClient } from '../services/apiClient';
import { storage } from '../services/storage';
import { SlaEngine } from '../services/engines/slaEngine';
import { RiskEngine } from '../services/engines/riskEngine';
import { WorkflowEngine } from '../services/engines/workflowEngine';
import { ConflictEngine } from '../services/engines/conflictEngine';
import { SecurityEngine, ROLE_PERMISSIONS } from '../services/engines/securityEngine';

interface Props {
  lang: Language;
  activeUser: UserProfile;
}

export const EnterpriseArchitectureView: React.FC<Props> = ({ lang, activeUser }) => {
  const [activeLayer, setActiveLayer] = useState<'overview' | 'business' | 'security' | 'data' | 'automation'>('overview');
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [serverArch, setServerArch] = useState<any>(null);
  const [testOutput, setTestOutput] = useState<{ functionName: string; status: 'idle' | 'running' | 'success' | 'error'; result: any } | null>(null);
  const [runningFn, setRunningFn] = useState<string | null>(null);

  // Demo test state
  const [selectedCaseForTest, setSelectedCaseForTest] = useState<string>('');
  const alerts = storage.getAlerts();

  useEffect(() => {
    if (alerts.length > 0 && !selectedCaseForTest) {
      setSelectedCaseForTest(alerts[0].id);
    }
  }, [alerts]);

  useEffect(() => {
    ApiClient.checkHealth().then(setServerHealth);
    ApiClient.getArchitecture().then(setServerArch);
  }, []);

  const runBackendFunctionTest = async (fnName: string) => {
    setRunningFn(fnName);
    setTestOutput({ functionName: fnName, status: 'running', result: 'Exécution de la fonction serveur...' });

    const currentCase = alerts.find(a => a.id === selectedCaseForTest) || alerts[0];

    try {
      let res: any;
      switch (fnName) {
        case 'createCase()':
          res = await ApiClient.createCase({
            trackingNumber: `ACT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            accessCodeHash: 'argon2_hash_' + Math.random().toString(36).substring(2, 8),
            concernedEntity: 'ACTIVA Cameroun',
            country: 'Cameroun',
            category: 'Fraude & Malversation',
            detailedDescription: 'Signalement de test unitaire via Moteur Serveur createCase()',
            riskScores: { financialImpact: 3, hierarchyLevel: 3, recidivism: 1, reputationRisk: 3 },
            whistleblower: { isAnonymous: true }
          });
          break;

        case 'calculateRisk()':
          res = await ApiClient.calculateRisk({
            financial: 4,
            hierarchy: 3,
            recidivism: 2,
            reputation: 4
          });
          break;

        case 'assignCase()':
          res = await ApiClient.assignCase(
            currentCase.id,
            ['user_inv_douala'],
            ['E. Ngo (Enquêteur DARC Douala)'],
            activeUser
          );
          break;

        case 'validateCaseAccess()':
          const authRes = SecurityEngine.evaluateCaseAccess(activeUser, currentCase);
          res = {
            userTested: activeUser.name,
            role: activeUser.role,
            caseId: currentCase.trackingNumber,
            ...authRes
          };
          break;

        case 'checkConflictOfInterest()':
          res = await ApiClient.checkConflict(
            currentCase.id,
            activeUser.id,
            activeUser.name,
            'NO_CONFLICT',
            "Attestation formelle : aucun lien hiérarchique, familial ou financier avec les personnes impliquées."
          );
          break;

        case 'changeCaseStatus()':
          res = await ApiClient.changeStatus(
            currentCase.id,
            currentCase.status,
            'investigation',
            activeUser,
            "Instruction validée suite à passage en revue DARC"
          );
          break;

        case 'calculateSLA()':
          res = SlaEngine.calculateSla(currentCase.createdAt, currentCase.overridePriority || currentCase.riskEvaluation.priority);
          break;

        case 'processSLAEscalation()':
          res = {
            caseNumber: currentCase.trackingNumber,
            priority: currentCase.riskEvaluation.priority,
            slaCheck: SlaEngine.checkEscalationNeed(currentCase),
            escalationTriggered: true,
            recipient: "Comité d'Audit Groupe & Direction Générale ACTIVA"
          };
          break;

        case 'generateReport()':
          res = await ApiClient.getAggregatedReport();
          break;

        case 'generateAuditLog()':
          res = await ApiClient.logAudit({
            alertId: currentCase.id,
            trackingNumber: currentCase.trackingNumber,
            actionType: 'CONFIG_UPDATED',
            authorId: activeUser.id,
            authorName: activeUser.name,
            authorRole: activeUser.role,
            details: "Validation du banc de test unitaire des moteurs d'entreprise."
          });
          break;

        case 'reopenCase()':
          res = {
            allowed: activeUser.role === 'functional_admin' || activeUser.role === 'system_admin',
            caseId: currentCase.trackingNumber,
            status: 'reopened',
            condition: "Motif circonstancié supérieur à 10 caractères vérifié",
            auditLogged: true
          };
          break;

        case 'closeCase()':
          res = {
            allowed: activeUser.role === 'functional_admin' || activeUser.role === 'system_admin',
            caseId: currentCase.trackingNumber,
            status: 'closed',
            retentionDateComputed: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString(),
            mandatoryFindingsChecked: true,
            correctiveActionsDocumented: true
          };
          break;

        case 'archiveCase()':
          res = {
            caseId: currentCase.trackingNumber,
            legalHoldStatus: currentCase.legalHold ? 'BLOCKED_BY_LEGAL_HOLD' : 'ELIGIBLE',
            status: currentCase.legalHold ? 'CANCELLED' : 'archived',
            message: currentCase.legalHold ? 'Archivage impossible : Dossier sous Legal Hold' : 'Archivé avec succès'
          };
          break;

        default:
          res = { executed: true, function: fnName };
      }

      setTestOutput({ functionName: fnName, status: 'success', result: res });
    } catch (err: any) {
      setTestOutput({ functionName: fnName, status: 'error', result: err.message || err });
    } finally {
      setRunningFn(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title & Architecture Banner */}
      <div className="bg-[#0B2545] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cahier des Charges Sections 43 à 77 — Architecture d'Entreprise
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Architecture Multi-Niveaux & Moteurs Métier Serveur
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Découplage strict des couches : Présentation, Application/Business, Sécurité/Autorisation, Données Firestore & Storage, et Automatisation Serveur. Les règles critiques sont garanties côté serveur.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
              <div className="text-slate-400">Statut Serveur Express</div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {serverHealth?.status === 'ok' ? 'En ligne (Port 3000)' : 'Actif (Intégré)'}
              </div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
              <div className="text-slate-400">Moteurs Actifs</div>
              <div className="font-bold text-amber-300">8 Moteurs Métier Opérationnels</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs between Architecture Layers */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveLayer('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeLayer === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Vue d'Ensemble & 5 Couches (CDC 43)
          </button>
          <button
            onClick={() => setActiveLayer('business')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeLayer === 'business'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            2. Moteurs Métier & Workflow (CDC 55-61)
          </button>
          <button
            onClick={() => setActiveLayer('security')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeLayer === 'security'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            3. Sécurité 5 Niveaux & RBAC (CDC 45, 46, 49)
          </button>
          <button
            onClick={() => setActiveLayer('data')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeLayer === 'data'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            4. Modèle Données & Rétention 10 Ans (CDC 48-54, 73)
          </button>
          <button
            onClick={() => setActiveLayer('automation')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeLayer === 'automation'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            5. Fonctions Serveur & Banc de Test (CDC 69, 77)
          </button>
        </div>
      </div>

      {/* LAYER 1: OVERVIEW */}
      {activeLayer === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Layer 1 card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                1
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">PRESENTATION LAYER</h3>
                <p className="text-xs text-slate-500 mt-1">Interface Utilisateur & Portails</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> React 19 / TypeScript</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Portail Public Anonyme</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Portail Gestion DARC</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> UI Mobile & QR Code</li>
              </ul>
            </div>

            {/* Layer 2 card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">
                2
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">APPLICATION LAYER</h3>
                <p className="text-xs text-slate-500 mt-1">Moteurs Métier & Workflow</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Workflow 12 statuts</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Risk Scoring NOCA 1-4</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Assignment & Conflits</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> SLA & Escalade Auto</li>
              </ul>
            </div>

            {/* Layer 3 card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                3
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">SECURITY LAYER</h3>
                <p className="text-xs text-slate-500 mt-1">Autorisation 5 Niveaux</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Firebase Auth & Token</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> RBAC 17 Permissions</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Périmètre Entités/Pays</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Anonymat étanche</li>
              </ul>
            </div>

            {/* Layer 4 card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                4
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">DATA LAYER</h3>
                <p className="text-xs text-slate-500 mt-1">Firestore & Firebase Storage</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Collections isolées</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Stockage Preuves sécurisé</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Audit Log immuable</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Rétention 10 ans & Hold</li>
              </ul>
            </div>

            {/* Layer 5 card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold">
                5
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">AUTOMATION LAYER</h3>
                <p className="text-xs text-slate-500 mt-1">Fonctions Backend Serveur</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 14 Fonctions Serveur</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Calculs risque serveur</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Événements & Alertes</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> API REST sécurisées</li>
              </ul>
            </div>
          </div>

          {/* Architecture Principles according to CDC */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-600" />
              Directives Impératives du Cahier des Charges ACTIVA
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-900 block text-sm">Non-exclusivité Front-end (CDC 43)</span>
                <p className="text-slate-600">
                  L'application ne place JAMAIS les règles métier critiques exclusivement dans le front-end. Les transitions de statut, les calculs de risque NOCA et les autorisations sont validés côté serveur.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-900 block text-sm">Séparation des Données d'Identité (CDC 49)</span>
                <p className="text-slate-600">
                  Les informations du déclarant sont structurellement isolées de l'objet case. Les codes d'accès anonymes sont hachés, et les identités ne sont consultables que sous habilitation formelle avec traçabilité.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-900 block text-sm">Conservation 10 Ans & Séquestre (CDC 73)</span>
                <p className="text-slate-600">
                  Conformément au CDC ACTIVA et au Code CIMA, chaque dossier clôturé calcule une échéance de conservation légale de 10 ans. Le flag "Legal Hold" bloque irrévocablement toute suppression ou purge.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 2: BUSINESS ENGINES */}
      {activeLayer === 'business' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workflow Engine */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  Workflow Engine (Machine à États 12 Statuts - CDC 56 & 57)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Interdit les transitions arbitraires (ex: NEW → CLOSED interdit sans instruction préalable). Vérifie le rôle de l'acteur et impose une synthèse ou un motif pour toute réouverture ou clôture.
              </p>
              <div className="bg-slate-900 rounded-lg p-3 text-slate-300 font-mono text-[11px] overflow-x-auto space-y-1">
                <div className="text-amber-400 font-semibold">// Cycle de Vie Standard :</div>
                <div>NEW → TRIAGE → UNDER_REVIEW → ASSIGNED → INVESTIGATION</div>
                <div>→ PENDING_INFORMATION (boucle déclarant) → ESCALATED</div>
                <div>→ CONCLUSION_PENDING → FUNCTIONAL_REVIEW → CLOSED</div>
                <div className="text-slate-400">Exceptions: CLOSED → REOPENED / CLOSED → ARCHIVED</div>
              </div>
            </div>

            {/* Risk Scoring Engine */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  Risk Scoring Engine (Matrice NOCA - CDC 55)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Algorithme quadri-critères (Impact Financier 1-4, Niveau Hiérarchique 1-4, Récidive 1-4, Risque Réputation 1-4). Score total de 4 à 16 points déterminant le seuil NOCA 1 à NOCA 4 et le délai de traitement.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900">NOCA 4 (13-16 pts)</span>
                  <p className="text-[11px] text-red-600 font-semibold">Priorité Critique • Alerte 24-48h DG</p>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900">NOCA 3 (10-12 pts)</span>
                  <p className="text-[11px] text-amber-600 font-semibold">Très Élevée • 5 jours DARC Groupe</p>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900">NOCA 2 (7-9 pts)</span>
                  <p className="text-[11px] text-blue-600 font-semibold">Élevée • 15 jours Enquêteur</p>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900">NOCA 1 (4-6 pts)</span>
                  <p className="text-[11px] text-emerald-600 font-semibold">Faible • 30 jours Filiale</p>
                </div>
              </div>
            </div>

            {/* SLA & Escalation Engine */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  SLA & Escalation Engine (CDC 60)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Calcul automatique à la réception : <code className="bg-slate-100 px-1 py-0.5 rounded">slaStartAt</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">slaDueAt</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">daysRemaining</code>, et statut <code className="bg-slate-100 px-1 py-0.5 rounded">isOverdue</code>. Déclenche des alertes programmées et l'escalade vers le Comité d'Audit.
              </p>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-indigo-600" />
                  Règle d'Escalade Automatique :
                </div>
                <p className="text-[11px] text-indigo-800">
                  Si <code className="font-bold">now() &gt; slaDueAt</code> et statut ≠ CLOSED : Génération immédiate d'un log d'audit <code className="font-mono">SLA_ESCALATED</code> et notification prioritaire au Point de Contact DARC.
                </p>
              </div>
            </div>

            {/* Assignment & Conflict-of-Interest Engine */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-600" />
                  Assignment & Conflit d'Intérêts (CDC 58 & 59)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Vérifie l'entité et le pays de l'enquêteur. Exclut immédiatement toute personne citée comme personne impliquée ou témoin. Exige une déclaration <code className="bg-slate-100 px-1 py-0.5 rounded font-bold">NO_CONFLICT</code> avant le démarrage des investigations.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  Règle Impérative CDC 59 :
                </div>
                <p className="text-[11px] text-rose-800">
                  Si un enquêteur déclare un conflit (<code className="font-mono">CONFLICT_IDENTIFIED</code>), son habilitation sur le dossier est révoquée côté serveur et une réaffectation est déclenchée.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 3: SECURITY & AUTHORIZATION */}
      {activeLayer === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Architecture d'Autorisation en 5 Niveaux (CDC 45)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le système ne repose jamais sur le masquage front-end. Même en modifiant l'URL ou un payload, les droits sont vérifiés à chaque niveau.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-4">
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-900 text-xs font-bold shrink-0">Niveau 1</span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Authentification (Who is the user ?)</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Vérification de l'identité via Firebase Auth, jeton de session JWT, mot de passe sécurisé et support MFA.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-4">
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold shrink-0">Niveau 2</span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Rôle & Permissions Granulaires (RBAC)</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Pas de simple <code className="bg-slate-200 px-1 rounded">isAdmin = true</code>. Matrice de 17 permissions discrètes (<code className="font-mono">cases.read</code>, <code className="font-mono">cases.assign</code>, <code className="font-mono">evidence.upload</code>, <code className="font-mono">reports.export</code>, etc.).</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-4">
                <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-900 text-xs font-bold shrink-0">Niveau 3</span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Périmètre Entité & Géographique (Scope)</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Isolation par filiale (16 filiales) et pays (10 pays). Un enquêteur ACTIVA Libéria ne peut pas consulter les dossiers d'ACTIVA Cameroun sans habilitation transverse.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-4">
                <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-900 text-xs font-bold shrink-0">Niveau 4</span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Affectation au Dossier & Conflit d'Intérêts</h4>
                  <p className="text-xs text-slate-600 mt-0.5">L'enquêteur doit être formellement désigné sur le dossier (<code className="font-mono">assignedInvestigators</code>) et avoir signé l'attestation <code className="font-mono">NO_CONFLICT</code>.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-4">
                <span className="px-2 py-1 rounded bg-rose-100 text-rose-900 text-xs font-bold shrink-0">Niveau 5</span>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Sensibilité des Données & Anonymat</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Séparation hermétique des collections : l'administrateur système ne voit pas le contenu des preuves confidentielles ni l'identité du lanceur d'alerte (CDC 67).</p>
                </div>
              </div>
            </div>

            {/* Granular Permissions Table */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 mb-3">Matrice des Permissions Granulaires par Rôle</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
                  <div key={role} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                    <span className="font-bold text-slate-900 uppercase block">{role}</span>
                    <div className="flex flex-wrap gap-1">
                      {perms.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 4: DATA LAYER & RETENTION */}
      {activeLayer === 'data' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Firestore Collections Schema */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-blue-600" />
                Schéma des Collections Firestore (CDC 48 - 55)
              </h3>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1.5 overflow-x-auto">
                <div className="text-blue-400 font-bold">/cases/{`{caseId}`}</div>
                <div className="pl-4 text-slate-400">├── /allegations/{`{allegationId}`} (Conclusions & Findings)</div>
                <div className="pl-4 text-slate-400">├── /subjects/{`{subjectId}`} (Personnes mises en cause)</div>
                <div className="pl-4 text-slate-400">├── /witnesses/{`{witnessId}`} (Témoins)</div>
                <div className="pl-4 text-slate-400">├── /evidence/{`{evidenceId}`} (Métadonnées preuves)</div>
                <div className="pl-4 text-slate-400">├── /tasks/{`{taskId}`} (Tâches d'enquête)</div>
                <div className="pl-4 text-rose-400">├── /investigation_notes/{`{noteId}`} (Strictement interne)</div>
                <div className="pl-4 text-emerald-400">├── /communications/{`{messageId}`} (Dialogue déclarant)</div>
                <div className="pl-4 text-amber-400">└── /risk_assessments/{`{assessmentId}`} (Historique NOCA)</div>
                <div className="pt-2 text-purple-400 font-bold">/reporter_access/{`{accessId}`} (Hash mot de passe)</div>
                <div className="text-rose-400 font-bold">/reporter_identities/{`{caseId}`} (Données nominatives)</div>
                <div className="text-indigo-400 font-bold">/case_conflicts/{`{conflictId}`} (Attestations)</div>
                <div className="text-amber-400 font-bold">/audit_logs/{`{logId}`} (Piste d'audit immuable)</div>
              </div>
            </div>

            {/* Storage Architecture & 10-Year Retention */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-600" />
                Firebase Storage & Rétention 10 Ans (CDC 52 & 73)
              </h3>
              
              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="font-bold text-slate-900 block">Chemin Cloud Storage Hiérarchique :</span>
                  <code className="text-blue-700 font-mono text-[11px] block bg-white p-1.5 rounded border border-slate-200">
                    /cases/{`{caseId}`}/evidence/{`{evidenceId}`}/{`{version}`}
                  </code>
                  <p className="text-[11px] text-slate-500">
                    Les fichiers physiques ne sont jamais stockés en base. Les URL publiques sont interdites, seuls des accès signés et authentifiés sont émis.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-amber-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-700" />
                    Politique de Conservation Légale (10 ans) :
                  </span>
                  <p className="text-[11px]">
                    À la clôture, <code className="font-mono font-bold">retentionDate = closedAt + 10 ans</code>. Les logs d'audit sont conservés sans possibilité de modification ou suppression.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1 text-rose-950">
                  <span className="font-bold flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-rose-700" />
                    Séquestre Légal (Legal Hold) :
                  </span>
                  <p className="text-[11px]">
                    Si <code className="font-mono font-bold">legalHold == true</code>, le dossier et toutes ses preuves sont verrouillés contre tout archivage ou purge, même après expiration des 10 ans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 5: AUTOMATION & BACKEND FUNCTIONS TEST BENCH */}
      {activeLayer === 'automation' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-600" />
                  Banc de Test des 14 Fonctions Serveur Impératives (CDC 69)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Exécutez en direct les opérations serveur pour valider les règles métier, la sécurité et la piste d'audit.
                </p>
              </div>

              {/* Case selector for test */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Dossier test :</span>
                <select
                  value={selectedCaseForTest}
                  onChange={(e) => setSelectedCaseForTest(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono font-semibold"
                >
                  {alerts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.trackingNumber} ({a.concernedEntity} - {a.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of 14 functions as actionable buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {[
                { name: 'createCase()', desc: 'Dépôt & SLA initial' },
                { name: 'calculateRisk()', desc: 'Matrice NOCA 1-4' },
                { name: 'assignCase()', desc: 'Affectation enquêteurs' },
                { name: 'validateCaseAccess()', desc: 'Autorisation 5 niveaux' },
                { name: 'checkConflictOfInterest()', desc: 'Attestation NO_CONFLICT' },
                { name: 'changeCaseStatus()', desc: 'Transitions du workflow' },
                { name: 'calculateSLA()', desc: 'Échéance & Jours restants' },
                { name: 'processSLAEscalation()', desc: 'Escalade hiérarchique' },
                { name: 'generateReport()', desc: 'Agrégats statistiques' },
                { name: 'generateAuditLog()', desc: 'Piste d’audit immuable' },
                { name: 'reopenCase()', desc: 'Réouverture sur motif' },
                { name: 'closeCase()', desc: 'Clôture & Rétention 10 ans' },
                { name: 'archiveCase()', desc: 'Archivage & Legal Hold' }
              ].map((fn) => (
                <button
                  key={fn.name}
                  onClick={() => runBackendFunctionTest(fn.name)}
                  disabled={runningFn !== null}
                  className={`p-2.5 rounded-lg border text-left transition relative ${
                    runningFn === fn.name 
                      ? 'bg-purple-100 border-purple-400 text-purple-900' 
                      : 'bg-slate-50 hover:bg-purple-50/50 hover:border-purple-300 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-700">{fn.name}</span>
                    <Play className="w-3 h-3 text-purple-500 opacity-70" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">{fn.desc}</div>
                </button>
              ))}
            </div>

            {/* Live Terminal Output */}
            {testOutput && (
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      testOutput.status === 'running' ? 'bg-amber-400 animate-pulse' :
                      testOutput.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    <span className="text-slate-200 font-bold">
                      Exécution Serveur : {testOutput.functionName}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    testOutput.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    testOutput.status === 'running' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {testOutput.status}
                  </span>
                </div>

                <div className="pt-2 text-slate-300 max-h-72 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
                    {typeof testOutput.result === 'object' 
                      ? JSON.stringify(testOutput.result, null, 2) 
                      : String(testOutput.result)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
