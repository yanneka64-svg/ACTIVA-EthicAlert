import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Building2,
  Users,
  Clock,
  Globe,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Database,
  Cloud,
  Server,
  Pencil,
  X
} from 'lucide-react';
import { Language, UserProfile, UserRole } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_COUNTRIES, EntityDef, CategoryDef } from '../data/activaConfig';
import { storage } from '../services/storage';
import {
  isFirebaseConfigured,
  getActiveFirebaseConfig,
  setCustomFirebaseConfig,
  clearCustomFirebaseConfig,
  fetchAlertsFromCloud
} from '../services/firebase';
// === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
// Read-only: this screen only imports and displays this real, already-
// existing data — src/domain/permissions.ts itself is never modified.
import { ROLE_PERMISSIONS, Permission } from '../domain/permissions';
import { RoleId } from '../domain/caseTypes';

interface AdminConfigViewProps {
  lang: Language;
  activeUser: UserProfile;
  // === AMÉLIORATION AJOUTÉE (Phase 9 — écrans "Utilisateurs & Rôles" /
  // "Configuration" dédiés dans le menu, façon maquette) ===
  // Optionnel, avec le même défaut ('matrix') qu'avant cette phase : ne
  // change rien pour l'entrée existante `settings`. Les deux nouvelles
  // entrées de menu ('admin_users' / 'admin_config') pointent vers ce même
  // composant, seulement avec un onglet de départ différent — aucun onglet
  // n'est retiré, le sélecteur d'onglets complet reste toujours visible et
  // navigable, exactement comme avant.
  initialTab?: 'matrix' | 'entities' | 'categories' | 'users' | 'roles' | 'database';
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  lang,
  activeUser,
  initialTab,
}) => {
  const t = TRANSLATIONS[lang];

  const [configTab, setConfigTab] = useState<'matrix' | 'entities' | 'categories' | 'users' | 'roles' | 'database'>(initialTab ?? 'matrix');
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
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === real,
  // persisted, editable config — no longer the static activaConfig
  // imports. Re-fetched fresh on every render (this component already
  // re-renders after every CRUD action via its own local state, e.g. the
  // save banner or closing a modal — the same lightweight pattern the rest
  // of this file already uses, no dedicated storage.subscribe needed).
  const entities = storage.getEntities();
  const categoriesConfig = storage.getCategories();

  // --- SLA config state (Phase 7 — configuration SLA éditable) ---
  // Seeded once from storage on first mount, like the Firebase config
  // fields just below already do — edited locally, then saved explicitly.
  const initialSlaConfig = storage.getSlaConfig();
  const [slaNoca1, setSlaNoca1] = useState(initialSlaConfig.noca1Days);
  const [slaNoca2, setSlaNoca2] = useState(initialSlaConfig.noca2Days);
  const [slaNoca3, setSlaNoca3] = useState(initialSlaConfig.noca3Days);
  const [slaNoca4, setSlaNoca4] = useState(initialSlaConfig.noca4Days);
  const handleSaveSlaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateSlaConfig({ noca1Days: slaNoca1, noca2Days: slaNoca2, noca3Days: slaNoca3, noca4Days: slaNoca4 }, activeUser);
    flashBanner('Délais SLA mis à jour.');
  };

  // --- Entities CRUD state ---
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityCountry, setEntityCountry] = useState('');
  const [entityFlag, setEntityFlag] = useState('');
  const [deleteEntityConfirmId, setDeleteEntityConfirmId] = useState<string | null>(null);

  // --- Categories CRUD state ---
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);
  const [newSubCategoryInputs, setNewSubCategoryInputs] = useState<Record<string, string>>({});

  // --- Users CRUD state ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('investigator');
  const [userRoleTitle, setUserRoleTitle] = useState('');
  const [userEntity, setUserEntity] = useState('');
  const [userCountry, setUserCountry] = useState('');
  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null);

  const slugify = (name: string) =>
    name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

  const flashBanner = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(''), 3000);
  };

  // --- Entities handlers ---
  const resetEntityForm = () => {
    setEditingEntityId(null);
    setEntityName('');
    setEntityCountry('');
    setEntityFlag('');
  };
  const openAddEntity = () => { resetEntityForm(); setShowEntityModal(true); };
  const openEditEntity = (ent: EntityDef) => {
    setEditingEntityId(ent.id);
    setEntityName(ent.name);
    setEntityCountry(ent.country);
    setEntityFlag(ent.flag);
    setShowEntityModal(true);
  };
  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim() || !entityCountry.trim()) return;
    if (editingEntityId) {
      storage.updateEntity(editingEntityId, { name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️' }, activeUser);
      flashBanner(`Entité "${entityName.trim()}" mise à jour.`);
    } else {
      const id = `ent-${slugify(entityName)}-${Date.now().toString(36)}`;
      storage.addEntity({ id, name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️' }, activeUser);
      flashBanner(`Entité "${entityName.trim()}" ajoutée.`);
    }
    setShowEntityModal(false);
  };
  const handleDeleteEntity = (ent: EntityDef) => {
    storage.deleteEntity(ent.id, activeUser);
    setDeleteEntityConfirmId(null);
    flashBanner(`Entité "${ent.name}" supprimée.`);
  };

  // --- Categories handlers ---
  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
  };
  const openAddCategory = () => { resetCategoryForm(); setShowCategoryModal(true); };
  const openEditCategory = (cat: CategoryDef) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    if (editingCategoryId) {
      storage.updateCategory(editingCategoryId, { name: categoryName.trim() }, activeUser);
      flashBanner(`Catégorie "${categoryName.trim()}" mise à jour.`);
    } else {
      const id = `cat-${slugify(categoryName)}-${Date.now().toString(36)}`;
      storage.addCategory({ id, name: categoryName.trim(), subCategories: [] }, activeUser);
      flashBanner(`Catégorie "${categoryName.trim()}" ajoutée.`);
    }
    setShowCategoryModal(false);
  };
  const handleDeleteCategory = (cat: CategoryDef) => {
    storage.deleteCategory(cat.id, activeUser);
    setDeleteCategoryConfirmId(null);
    flashBanner(`Catégorie "${cat.name}" supprimée.`);
  };
  const handleAddSubCategory = (categoryId: string) => {
    const val = (newSubCategoryInputs[categoryId] || '').trim();
    if (!val) return;
    storage.addSubCategory(categoryId, val, activeUser);
    setNewSubCategoryInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };
  const handleRemoveSubCategory = (categoryId: string, sub: string) => {
    storage.removeSubCategory(categoryId, sub, activeUser);
  };

  // --- Users handlers ---
  const resetUserForm = () => {
    setEditingUserId(null);
    setUserName('');
    setUserEmail('');
    setUserRole('investigator');
    setUserRoleTitle('');
    setUserEntity('');
    setUserCountry('');
  };
  const openAddUser = () => { resetUserForm(); setShowUserModal(true); };
  const openEditUser = (u: UserProfile) => {
    setEditingUserId(u.id);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRole(u.role);
    setUserRoleTitle(u.roleTitle);
    setUserEntity(u.entity);
    setUserCountry(u.country);
    setShowUserModal(true);
  };
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;
    if (editingUserId) {
      storage.updateUser(
        editingUserId,
        { name: userName.trim(), email: userEmail.trim(), role: userRole, roleTitle: userRoleTitle.trim(), entity: userEntity.trim(), country: userCountry.trim() },
        activeUser
      );
      flashBanner(`Compte "${userName.trim()}" mis à jour.`);
    } else {
      const id = 'usr-' + Date.now().toString(36);
      storage.addUser(
        {
          id,
          name: userName.trim(),
          email: userEmail.trim(),
          role: userRole,
          roleTitle: userRoleTitle.trim() || userRole,
          entity: userEntity.trim() || 'Toutes entités',
          country: userCountry.trim() || 'Groupe ACTIVA',
        },
        activeUser
      );
      flashBanner(`Compte "${userName.trim()}" créé.`);
    }
    setShowUserModal(false);
  };
  const handleDeleteUser = (u: UserProfile) => {
    if (u.id === activeUser.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte actif.');
      setDeleteUserConfirmId(null);
      return;
    }
    storage.deleteUser(u.id, activeUser);
    setDeleteUserConfirmId(null);
    flashBanner(`Compte "${u.name}" supprimé.`);
  };

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

  // === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
  // Pure display data over the real ROLE_PERMISSIONS table — "no new logic
  // needed, just a UI" per the plan.
  // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu à 10 rôles) === les 2
  // nouveaux rôles (security_admin, audit_committee) suivent exactement le
  // même principe d'affichage pur que les 8 précédents — voir
  // src/domain/permissions.ts pour leur table de permissions réelle.
  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === `RoleId` n'est plus un
  // vocabulaire séparé "cible" pour un futur système Cloud Functions —
  // c'est désormais exactement le même type que `UserRole` (src/types.ts),
  // réellement appliqué par cette application (voir
  // src/services/authz.ts). Ce tableau reste néanmoins la bonne source
  // d'affichage : il énumère TOUTES les valeurs possibles, y compris
  // celles qu'aucun compte de démonstration n'utilise encore.
  const ALL_ROLE_IDS: RoleId[] = ['reporter', 'investigator', 'senior_investigator', 'functional_admin', 'darc_compliance', 'consultation', 'system_admin', 'security_admin', 'audit_committee', 'executive'];
  const ROLE_ID_LABELS: Record<RoleId, string> = {
    reporter: 'Lanceur d’alerte',
    investigator: 'Investigateur',
    senior_investigator: 'Investigateur senior',
    functional_admin: 'Administrateur fonctionnel',
    darc_compliance: 'Conformité DARC',
    consultation: 'Consultation',
    system_admin: 'Administrateur système',
    security_admin: 'Administrateur sécurité',
    audit_committee: 'Comité d’audit',
    executive: 'Direction / Exécutif',
  };
  const PERMISSION_GROUPS: { group: string; permissions: { key: Permission; label: string }[] }[] = [
    {
      group: 'Dossiers',
      permissions: [
        { key: 'cases.read', label: 'Consulter les dossiers' },
        { key: 'cases.create', label: 'Créer un dossier' },
        { key: 'cases.assign', label: 'Attribuer un dossier' },
        { key: 'cases.reassign', label: 'Réattribuer un dossier' },
        { key: 'cases.edit', label: 'Modifier un dossier' },
        { key: 'cases.close', label: 'Clôturer un dossier' },
        { key: 'cases.reopen', label: 'Rouvrir un dossier' },
        { key: 'cases.export', label: 'Exporter les dossiers' },
      ],
    },
    {
      group: 'Preuves',
      permissions: [
        { key: 'evidence.read', label: 'Consulter les preuves' },
        { key: 'evidence.upload', label: 'Téléverser des preuves' },
        { key: 'evidence.delete', label: 'Supprimer des preuves' },
      ],
    },
    {
      group: 'Communications',
      permissions: [
        { key: 'communications.read', label: 'Consulter les messages' },
        { key: 'communications.send', label: 'Envoyer des messages' },
      ],
    },
    {
      group: 'Rapports',
      permissions: [
        { key: 'reports.read', label: 'Consulter les rapports' },
        { key: 'reports.export', label: 'Exporter les rapports' },
      ],
    },
    {
      group: 'Administration',
      permissions: [
        { key: 'configuration.manage', label: 'Gérer la configuration' },
        { key: 'users.manage', label: 'Gérer les comptes utilisateurs' },
        { key: 'audit.read', label: 'Consulter la piste d’audit' },
        // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu) ===
        { key: 'security.manage', label: 'Gérer la sécurité (authentification, MFA, sessions)' },
      ],
    },
  ];

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
            onClick={() => setConfigTab('roles')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              configTab === 'roles' ? 'bg-[#0B2545] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Rôles & Permissions
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

          {/* === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
              Thresholds Table — now a real editable form against
              storage.getSlaConfig()/updateSlaConfig(), not a static display.
              Saving here changes the actual delay AlertSubmissionFlow sets
              on every new case's targetCompletionDate, and the
              expectedTreatment text computeRiskEvaluation derives — not
              just this screen's own display. */}
          <form onSubmit={handleSaveSlaConfig} className="pt-4 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
              Seuils de priorité et délais cibles (modifiable)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <div className="font-bold text-emerald-900">NOCA 1 - Faible</div>
                <div className="text-[11px] text-emerald-800">Score 4 à 6</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Traitement standard</div>
                <label className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="number"
                    min={1}
                    value={slaNoca1}
                    onChange={(e) => setSlaNoca1(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
                  />
                  <span className="text-[11px] text-slate-500">jours max</span>
                </label>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
                <div className="font-bold text-amber-900">NOCA 2 - Élevée</div>
                <div className="text-[11px] text-amber-800">Score 7 à 10</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Suivi renforcé</div>
                <label className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="number"
                    min={1}
                    value={slaNoca2}
                    onChange={(e) => setSlaNoca2(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 border border-amber-300 rounded-lg bg-white font-bold text-amber-900"
                  />
                  <span className="text-[11px] text-slate-500">jours max</span>
                </label>
              </div>

              <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/60">
                <div className="font-bold text-orange-900">NOCA 3 - Très élevé</div>
                <div className="text-[11px] text-orange-800">Score 11 à 13</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Enquête urgente</div>
                <label className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="number"
                    min={1}
                    value={slaNoca3}
                    onChange={(e) => setSlaNoca3(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 border border-orange-300 rounded-lg bg-white font-bold text-orange-900"
                  />
                  <span className="text-[11px] text-slate-500">jours max</span>
                </label>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                <div className="font-bold text-rose-900">NOCA 4 - Critique</div>
                <div className="text-[11px] text-rose-800">Score 14 à 16</div>
                <div className="text-xs font-semibold mt-2 text-slate-800">Action immédiate</div>
                <label className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="number"
                    min={1}
                    value={slaNoca4}
                    onChange={(e) => setSlaNoca4(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-2 py-1 border border-rose-300 rounded-lg bg-white font-bold text-rose-900"
                  />
                  <span className="text-[11px] text-slate-500">jours max</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold text-xs shadow-xs transition"
              >
                Enregistrer les délais SLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          2. ENTITIES TAB — now a real add/edit/delete CRUD screen against
          storage.getEntities()/addEntity/updateEntity/deleteEntity, not a
          read-only display of the static activaConfig list. */}
      {configTab === 'entities' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Entités et filiales du Groupe ACTIVA ({entities.length} entités)
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Conforme au périmètre institutionnel établi dans le Cahier des Charges.
              </p>
            </div>
            <button
              onClick={openAddEntity}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une entité
            </button>
          </div>

          {entities.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune entité configurée.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entities.map((ent) => (
                <div key={ent.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <span>{ent.flag}</span>
                      <span className="truncate">{ent.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{ent.country}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditEntity(ent)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Modifier">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deleteEntityConfirmId === ent.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteEntity(ent)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                        <button onClick={() => setDeleteEntityConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteEntityConfirmId(ent.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          3. CATEGORIES TAB — real CRUD (categories + their subcategories)
          against storage.ts, replacing the static ALERT_CATEGORIES display. */}
      {configTab === 'categories' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">
              Nomenclature des catégories et sous-catégories de manquements (CDC 2.0)
            </h3>
            <button
              onClick={openAddCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une catégorie
            </button>
          </div>

          {categoriesConfig.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune catégorie configurée.</p>
          ) : (
            <div className="space-y-4">
              {categoriesConfig.map((cat) => (
                <div key={cat.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#0B2545] text-sm">{cat.name}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditCategory(cat)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Renommer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deleteCategoryConfirmId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteCategory(cat)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                          <button onClick={() => setDeleteCategoryConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteCategoryConfirmId(cat.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subCategories.map((sub, i) => (
                      <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                        {sub}
                        <button onClick={() => handleRemoveSubCategory(cat.id, sub)} className="text-slate-400 hover:text-rose-600" title="Retirer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newSubCategoryInputs[cat.id] || ''}
                      onChange={(e) => setNewSubCategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCategory(cat.id); } }}
                      placeholder="Nouvelle sous-catégorie..."
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      onClick={() => handleAddSubCategory(cat.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold whitespace-nowrap"
                    >
                      + Ajouter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          4. USERS & ROLES TAB — real CRUD against storage.ts (addUser
          already existed; updateUser/deleteUser are new). */}
      {configTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Profils et Habilitations (CDC 3.2.3)
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Gestionnaires, Administrateurs fonctionnels, Administrateurs système, Consultation et Lanceurs d'alerte.
              </p>
            </div>
            <button
              onClick={openAddUser}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un compte
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{u.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{u.email} • {u.entity} ({u.country})</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">
                      {u.role.toUpperCase()}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{u.roleTitle}</div>
                  </div>
                  <button onClick={() => openEditUser(u)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Modifier">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {deleteUserConfirmId === u.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteUser(u)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                      <button onClick={() => setDeleteUserConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteUserConfirmId(u.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
          6. ROLES & PERMISSIONS TAB — read-only visualization of the real
          ROLE_PERMISSIONS table (src/domain/permissions.ts). No new
          permission logic here, purely a UI over existing data.
          === AMÉLIORATION AJOUTÉE (Phase 12.3) === this table is no longer
          a separate/future model — it is the exact set of permissions this
          application actually enforces (see src/services/authz.ts). */}
      {configTab === 'roles' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Matrice des rôles & permissions
            </h3>
            <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
              Modèle RBAC granulaire (19 permissions atomiques, <code className="font-mono text-slate-600">src/domain/permissions.ts</code>) —
              la même table sera réutilisée côté serveur (future architecture Cloud Functions / Firestore)
              afin que client et serveur ne divergent jamais sur ce qu'un rôle peut faire.
              {/* === AMÉLIORATION AJOUTÉE (Phase 12.3) === ce n'est plus un
                  modèle "cible" séparé : ce sont exactement les 10 rôles et
                  permissions réellement appliqués par cette application
                  (onglet « Comptes & Habilitations » ci-dessus utilise ces
                  mêmes valeurs). */}
              {' '}Ce sont exactement les rôles et permissions réellement appliqués par cette
              application — l'onglet « Comptes & Habilitations » ci-dessus utilise ces mêmes valeurs.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-white z-10"></th>
                  {ALL_ROLE_IDS.map((r) => (
                    <th key={r} className="p-2 text-center font-bold text-slate-700 whitespace-nowrap">
                      {ROLE_ID_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((g) => (
                  <React.Fragment key={g.group}>
                    <tr className="bg-slate-50">
                      <td colSpan={ALL_ROLE_IDS.length + 1} className="p-2 font-bold text-slate-500 uppercase tracking-wide text-[10px] sticky left-0">
                        {g.group}
                      </td>
                    </tr>
                    {g.permissions.map((p) => (
                      <tr key={p.key} className="border-b border-slate-100">
                        <td className="p-2 text-slate-700 font-medium whitespace-nowrap sticky left-0 bg-white">{p.label}</td>
                        {ALL_ROLE_IDS.map((r) => (
                          <td key={r} className="p-2 text-center">
                            {ROLE_PERMISSIONS[r].includes(p.key) ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === Modals */}

      {/* MODAL: ADD/EDIT ENTITY */}
      {showEntityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingEntityId ? 'Modifier l’entité' : 'Ajouter une entité'}
              </h3>
            </div>
            <form onSubmit={handleSaveEntity} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de l'entité *</label>
                <input type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Ex : ACTIVA Assurances Bénin" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pays *</label>
                <select value={entityCountry} onChange={(e) => setEntityCountry(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white" required>
                  <option value="">Sélectionner un pays</option>
                  {ACTIVA_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emoji drapeau (optionnel)</label>
                <input type="text" value={entityFlag} onChange={(e) => setEntityFlag(e.target.value)} placeholder="🇧🇯" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" maxLength={8} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEntityModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingEntityId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCategoryId ? 'Renommer la catégorie' : 'Ajouter une catégorie'}
              </h3>
              {!editingCategoryId && (
                <p className="text-slate-500 text-[11px] mt-0.5">Les sous-catégories s'ajoutent ensuite depuis la liste.</p>
              )}
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de la catégorie *</label>
                <input type="text" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ex : Protection des données personnelles" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingCategoryId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUserId ? 'Modifier le compte' : 'Ajouter un compte'}
              </h3>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nom complet *</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rôle *</label>
                  {/* === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du
                      modèle de rôles) === les 10 rôles réels de l'application
                      (auparavant 4 options ne couvrant que l'ancien modèle à
                      5 valeurs — "Lanceur d'alerte" n'y figurait jamais non
                      plus, un compte créé ici étant toujours un compte
                      collaborateur). */}
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value as UserRole)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="investigator">Investigateur</option>
                    <option value="senior_investigator">Investigateur senior</option>
                    <option value="functional_admin">Administrateur fonctionnel</option>
                    <option value="darc_compliance">Conformité DARC</option>
                    <option value="consultation">Consultation / Audit</option>
                    <option value="executive">Direction / Exécutif</option>
                    <option value="system_admin">Administrateur système</option>
                    <option value="security_admin">Administrateur sécurité</option>
                    <option value="audit_committee">Comité d’Audit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Intitulé de poste</label>
                  <input type="text" value={userRoleTitle} onChange={(e) => setUserRoleTitle(e.target.value)} placeholder="Ex : Investigatrice DARC" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entité</label>
                  <select value={userEntity} onChange={(e) => setUserEntity(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">Toutes entités</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pays</label>
                  <select value={userCountry} onChange={(e) => setUserCountry(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">Groupe ACTIVA</option>
                    {ACTIVA_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowUserModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingUserId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
