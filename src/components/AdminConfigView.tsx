import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Clock,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  Pencil,
  X,
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  Network,
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  GitBranch,
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  Search,
  Folder,
} from 'lucide-react';
import { Language, UserProfile, UserRole } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { EntityDef, CategoryDef, CountryDef, HierarchyLevels } from '../data/activaConfig';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
// Read-only: this screen only imports and displays this real, already-
// existing data — src/domain/permissions.ts itself is never modified.
import { Permission } from '../domain/permissions';
import { RoleId, CaseStatus } from '../domain/caseTypes';
// === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
import { getRoutingMatrixView } from '../domain/independentRouting';
// === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
import { CASE_STATUS_LABELS } from '../domain/workflow';

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
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) === 'governance'
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) === 'workflow'
  // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
  // données" retiré) === 'database' retiré de cette union, sur demande
  // explicite de l'utilisateur.
  initialTab?: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'governance' | 'workflow';
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  lang,
  activeUser,
  initialTab,
}) => {
  const t = TRANSLATIONS[lang];

  const [configTab, setConfigTab] = useState<'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'governance' | 'workflow'>(initialTab ?? 'matrix');
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — bug corrigé) ===
  // BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : "aucune des
  // fenêtres de cette page ne s'affiche lorsque je clique dessus excepté la
  // première". Cause réelle : App.tsx rend ce composant depuis 9 branches
  // différentes (admin_organization/admin_entities/.../settings), toutes au
  // même emplacement de l'arbre React et sans `key` — React réutilise donc
  // la MÊME instance d'`AdminConfigView` d'un clic de barre latérale à
  // l'autre au lieu de la remonter. `useState(initialTab ?? 'matrix')`
  // n'initialise `configTab` qu'au tout premier montage : un changement de
  // la prop `initialTab` ensuite (clic sur une autre entrée) était donc
  // silencieusement ignoré, et l'écran restait bloqué sur le premier onglet
  // jamais monté. Cet effet resynchronise `configTab` à chaque changement
  // réel de `initialTab`, sans toucher au comportement de navigation
  // interne par onglet (l'utilisateur reste libre de changer `configTab`
  // sans que cet effet ne le réinitialise, car `initialTab` ne change pas
  // tant que la barre latérale n'est pas recliquée).
  useEffect(() => {
    setConfigTab(initialTab ?? 'matrix');
  }, [initialTab]);
  const [saveBanner, setSaveBanner] = useState('');

  const users = storage.getUsers();
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === real,
  // persisted, editable config — no longer the static activaConfig
  // imports. Re-fetched fresh on every render (this component already
  // re-renders after every CRUD action via its own local state, e.g. the
  // save banner or closing a modal — the same lightweight pattern the rest
  // of this file already uses, no dedicated storage.subscribe needed).
  const entities = storage.getEntities();
  const categoriesConfig = storage.getCategories();
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  // Comptage réel des dossiers par catégorie (colonne "Dossiers associés")
  // — jamais un chiffre inventé, même motif de lecture directe que
  // `categoriesConfig` ci-dessus.
  const allAlertsForCategoryCounts = storage.getAlerts();
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // Remplace l'import statique ACTIVA_COUNTRIES (utilisé ci-dessous dans
  // les listes déroulantes pays des formulaires Entité/Compte) par la
  // copie réelle, persistée, éditable — même motif que entities/
  // categoriesConfig ci-dessus. Un pays ajouté depuis le nouvel onglet
  // "Pays" apparaît donc immédiatement dans ces listes.
  const countries = storage.getCountries();

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

  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  // --- Hierarchy levels state (routage indépendant) --- même motif
  // seed-then-edit-then-save que la configuration SLA ci-dessus : une
  // copie locale éditée puis sauvegardée explicitement, jamais écrite
  // directement dans storage.ts à chaque frappe.
  const [hierarchyLevelsDraft, setHierarchyLevelsDraft] = useState<HierarchyLevels>(storage.getHierarchyLevels());
  const handleSaveHierarchyLevels = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateHierarchyLevels(hierarchyLevelsDraft, activeUser);
    flashBanner('Niveaux hiérarchiques de routage indépendant mis à jour.');
  };

  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  // --- Role permissions state --- même motif seed-then-edit-then-save que
  // la configuration SLA/gouvernance ci-dessus. `rolePermissionsDraft` est
  // une copie locale éditée par cases à cocher ; seul un clic sur
  // "Enregistrer" persiste réellement (storage.updateRolePermissions),
  // et uniquement pour les rôles dont la liste a changé — pour ne pas
  // journaliser 10 entrées d'audit identiques à chaque sauvegarde.
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState<Record<RoleId, Permission[]>>(storage.getRolePermissions());
  // Empêche de se retirer soi-même (ou tout système_admin) l'accès à cet
  // écran — même principe de garde anti-auto-verrouillage déjà appliqué à
  // la suppression de son propre compte (handleDeleteUser ci-dessous) :
  // sans configuration.manage, PERSONNE ne peut plus revenir ici pour la
  // réactiver, puisque cet onglet lui-même est gardé par
  // canManageConfiguration.
  const isProtectedPermissionCell = (role: RoleId, permission: Permission) =>
    role === 'system_admin' && permission === 'configuration.manage';
  const toggleRolePermissionDraft = (role: RoleId, permission: Permission) => {
    if (isProtectedPermissionCell(role, permission)) return;
    setRolePermissionsDraft((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      return { ...prev, [role]: next };
    });
  };
  const handleSaveRolePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = storage.getRolePermissions();
    let changedCount = 0;
    for (const role of ALL_ROLE_IDS) {
      const before = [...(saved[role] ?? [])].sort();
      const after = [...(rolePermissionsDraft[role] ?? [])].sort();
      const unchanged = before.length === after.length && before.every((p, i) => p === after[i]);
      if (!unchanged) {
        storage.updateRolePermissions(role, rolePermissionsDraft[role], activeUser);
        changedCount += 1;
      }
    }
    flashBanner(changedCount > 0 ? `Permissions mises à jour pour ${changedCount} rôle(s).` : 'Aucune modification à enregistrer.');
  };

  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  // --- Workflow transitions state --- même motif seed-then-edit-then-save
  // que rolePermissionsDraft ci-dessus : une copie locale éditée par cases
  // à cocher (colonnes = statuts CIBLES accessibles depuis la ligne =
  // statut SOURCE), sauvegardée uniquement pour les statuts dont la liste
  // a changé.
  const [workflowTransitionsDraft, setWorkflowTransitionsDraft] = useState<Record<CaseStatus, CaseStatus[]>>(storage.getWorkflowTransitions());
  const toggleWorkflowTransitionDraft = (status: CaseStatus, target: CaseStatus) => {
    if (status === target) return; // une transition vers soi-même n'a jamais de sens (isStructurallyValidTransition la refuse de toute façon)
    setWorkflowTransitionsDraft((prev) => {
      const current = prev[status] ?? [];
      const next = current.includes(target) ? current.filter((s) => s !== target) : [...current, target];
      return { ...prev, [status]: next };
    });
  };
  const handleSaveWorkflowTransitions = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = storage.getWorkflowTransitions();
    let changedCount = 0;
    for (const status of ALL_CASE_STATUSES) {
      const before = [...(saved[status] ?? [])].sort();
      const after = [...(workflowTransitionsDraft[status] ?? [])].sort();
      const unchanged = before.length === after.length && before.every((s, i) => s === after[i]);
      if (!unchanged) {
        storage.updateWorkflowTransitions(status, workflowTransitionsDraft[status], activeUser);
        changedCount += 1;
      }
    }
    flashBanner(changedCount > 0 ? `Transitions mises à jour pour ${changedCount} statut(s).` : 'Aucune modification à enregistrer.');
  };

  // --- Entities CRUD state ---
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityCountry, setEntityCountry] = useState('');
  const [entityFlag, setEntityFlag] = useState('');
  const [deleteEntityConfirmId, setDeleteEntityConfirmId] = useState<string | null>(null);

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // --- Countries CRUD state --- même motif que les Entités ci-dessus.
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [editingCountryCode, setEditingCountryCode] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [countryFlag, setCountryFlag] = useState('');
  const [deleteCountryConfirmCode, setDeleteCountryConfirmCode] = useState<string | null>(null);
  const [deleteCountryError, setDeleteCountryError] = useState<string>('');

  // --- Categories CRUD state ---
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);
  const [newSubCategoryInputs, setNewSubCategoryInputs] = useState<Record<string, string>>({});
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  const [categorySearch, setCategorySearch] = useState('');

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

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // --- Countries handlers ---
  const resetCountryForm = () => {
    setEditingCountryCode(null);
    setCountryCode('');
    setCountryName('');
    setCountryFlag('');
  };
  const openAddCountry = () => { resetCountryForm(); setShowCountryModal(true); };
  const openEditCountry = (c: CountryDef) => {
    setEditingCountryCode(c.code);
    setCountryCode(c.code);
    setCountryName(c.name);
    setCountryFlag(c.flag);
    setShowCountryModal(true);
  };
  const handleSaveCountry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryName.trim() || !countryCode.trim()) return;
    if (editingCountryCode) {
      storage.updateCountry(editingCountryCode, { name: countryName.trim(), flag: countryFlag.trim() || '🏳️' }, activeUser);
      flashBanner(`Pays "${countryName.trim()}" mis à jour.`);
    } else {
      const code = countryCode.trim().toUpperCase().slice(0, 4);
      if (countries.some((c) => c.code === code)) {
        alert(`Le code pays "${code}" est déjà utilisé.`);
        return;
      }
      storage.addCountry({ code, name: countryName.trim(), flag: countryFlag.trim() || '🏳️' }, activeUser);
      flashBanner(`Pays "${countryName.trim()}" ajouté.`);
    }
    setShowCountryModal(false);
  };
  const handleDeleteCountry = (c: CountryDef) => {
    const result = storage.deleteCountry(c.code, activeUser);
    setDeleteCountryConfirmCode(null);
    if (result.allowed) {
      setDeleteCountryError('');
      flashBanner(`Pays "${c.name}" supprimé.`);
    } else {
      setDeleteCountryError(result.reason ?? 'Suppression refusée.');
    }
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
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  const handleToggleCategoryActive = (cat: CategoryDef) => {
    storage.toggleCategoryActive(cat.id, activeUser);
    flashBanner(`Catégorie "${cat.name}" ${(cat.active ?? true) ? 'désactivée' : 'réactivée'}.`);
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

  // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
  // données" et bouton "Réinitialiser jeu de démonstration" retirés) ===
  // `handleSaveFirebaseConfig`/`handleParseSnippet`/`handleManualCloudSync`/
  // `handleCopyRules` (onglet "Base de données") et `handleResetDemoData`
  // (bouton "Réinitialiser jeu de démonstration") retirés d'ici, sur
  // demande explicite de l'utilisateur — plus aucun appelant ne les
  // référence (vérifié). `storage.resetToFactory()` (services/storage.ts)
  // et le service Firebase (services/firebase.ts) restent inchangés :
  // seul ce point d'entrée dans l'écran Administration disparaît.

  // === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
  // Structure d'affichage (groupes/libellés) au-dessus de la table réelle.
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === n'est plus
  // un affichage pur : la case cochée/décochée vient désormais de
  // `rolePermissionsDraft` (storage.getRolePermissions()), pas de la
  // constante ROLE_PERMISSIONS statique importée ci-dessus.
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
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  // Les 14 valeurs de CaseStatus (domain/caseTypes.ts), dans l'ordre du
  // pipeline décrit par CASE_STATUS_LABELS/domain/workflow.ts (NEW → ... →
  // ARCHIVED, puis les 2 statuts annexes DUPLICATE/OUT_OF_SCOPE).
  const ALL_CASE_STATUSES: CaseStatus[] = [
    'new', 'triage', 'under_review', 'assigned', 'investigation', 'pending_information',
    'escalated', 'conclusion_pending', 'functional_review', 'closed', 'reopened', 'archived',
    'duplicate', 'out_of_scope',
  ];
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
    // === AMÉLIORATION AJOUTÉE (Correction demandée — alignement avec la
    // barre latérale) === BUG PRÉEXISTANT CORRIGÉ, signalé par
    // l'utilisateur : `py-8` (haut ET bas) s'ajoutait au `lg:py-6` déjà
    // posé par la colonne de contenu (StaffPortalLayout.tsx, `{children}`)
    // — exactement le même espacement que `mt-6` sur la barre latérale
    // elle-même. Ce cumul décalait les cartes de formulaire ~32px plus bas
    // que le haut de la barre latérale. `pt-0` aligne désormais les deux
    // sur le même espacement fourni par la colonne.
    // === AMÉLIORATION AJOUTÉE (Correction demandée — taille de la barre
    // latérale conservée) === BUG PRÉEXISTANT CORRIGÉ (introduit par la
    // correction d'alignement ci-dessus), signalé par l'utilisateur :
    // passer `py-8` (64px de padding total) à `pt-0 pb-8` (32px) réduisait
    // la hauteur totale de cette colonne de contenu de 32px — et donc,
    // via `lg:self-stretch` (StaffPortalLayout.tsx, réservé à l'espace
    // Admin), rétrécissait d'autant la barre latérale, qui s'étire
    // toujours à la hauteur de la plus grande des deux colonnes. `pb-16`
    // (64px, remplace `pb-8`) restitue exactement le même total de
    // padding (64px) qu'avec `py-8` à l'origine — même hauteur de colonne,
    // donc même taille de barre latérale qu'avant la correction
    // d'alignement — tout en gardant `pt-0` (le haut des cartes reste
    // aligné avec le haut de la barre latérale).
    <div className="max-w-7xl mx-auto pt-0 pb-16 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* === AMÉLIORATION AJOUTÉE (Correction demandée — bandeau
          "Configuration Système" retiré) === Le bandeau générique (icône +
          titre "Configuration Système" + sous-titre + repère de section en
          majuscules dupliqué) disparaît, sur demande explicite de
          l'utilisateur : chaque onglet affiche déjà son propre titre dans
          son propre contenu ci-dessous (ex. "ORGANISATION (PAYS)",
          "CATÉGORIES D'ALERTE", "GOUVERNANCE (ROUTAGE INDÉPENDANT)"...),
          rendant ce bandeau générique purement redondant depuis la Phase
          "Navigation Admin unifiée" (qui avait déjà retiré la rangée de 9
          onglets qu'il remplaçait). Le bouton "Réinitialiser jeu de
          démonstration" qui vivait ici est lui aussi retiré (demande
          explicite séparée). Le bandeau de confirmation `saveBanner` reste
          entièrement fonctionnel (toujours déclenché par les autres
          onglets — SLA, rôles, workflows...), simplement sans le titre
          générique ni le bouton qui l'entouraient. */}
      {saveBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* 1. MATRIX & SLA TAB */}
      {configTab === 'matrix' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Barème officiel de la Matrice des Risques
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
          ORGANIZATION TAB (pays) — même motif CRUD que l'onglet Entités
          ci-dessus, un niveau au-dessus dans la hiérarchie ACTIVA GROUP →
          Pays → Entité → Utilisateurs (brief §2). Un pays supprimé alors
          qu'une entité y est encore rattachée est refusé — voir
          storage.deleteCountry(). Validation frontend uniquement (comme
          partout ailleurs dans cet écran) : signalé, pas contourné. */}
      {configTab === 'organization' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pays du Groupe ACTIVA ({countries.length} pays)
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Niveau organisationnel structurant : chaque entité (onglet précédent) est rattachée à l'un de ces pays.
              </p>
            </div>
            <button
              onClick={openAddCountry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un pays
            </button>
          </div>

          {deleteCountryError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start gap-2">
              <span>{deleteCountryError}</span>
              <button onClick={() => setDeleteCountryError('')} className="ml-auto text-rose-500 hover:text-rose-700 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {countries.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucun pays configuré.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {countries.map((c) => {
                const entityCount = entities.filter((e) => e.country === c.name).length;
                return (
                  <div key={c.code} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                        <span>{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{c.code} · {entityCount} entité(s)</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditCountry(c)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deleteCountryConfirmCode === c.code ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteCountry(c)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                          <button onClick={() => setDeleteCountryConfirmCode(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteCountryConfirmCode(c.code)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          3. CATEGORIES TAB — real CRUD (categories + their subcategories)
          against storage.ts, replacing the static ALERT_CATEGORIES display. */}
      {/* === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table
          Catégories) === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur
          (capture de référence) : remplace la liste de cartes par un
          tableau (#, Nom, Code, Description, Statut, Dossiers associés,
          Date de création, Actions) — mêmes handlers CRUD qu'avant
          (openAddCategory/openEditCategory/handleDeleteCategory), aucun
          retiré. La gestion des sous-catégories (ajout/retrait), qui
          n'apparaît pas dans la capture de référence, reste accessible
          intégralement sur une seconde ligne sous chaque catégorie —
          aucune fonctionnalité existante supprimée. */}
      {configTab === 'categories' && (() => {
        const filteredCategories = categoriesConfig.filter((cat) => {
          const q = categorySearch.trim().toLowerCase();
          if (!q) return true;
          return (
            cat.name.toLowerCase().includes(q) ||
            (cat.code ?? '').toLowerCase().includes(q) ||
            cat.subCategories.some((s) => s.toLowerCase().includes(q))
          );
        });
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Folder className="w-4 h-4 text-blue-700" />
                Catégories ({categoriesConfig.length})
              </h3>
              <button
                onClick={openAddCategory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter une catégorie
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Rechercher une catégorie par nom, code ou sous-catégorie..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white"
              />
            </div>

            {filteredCategories.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                {categoriesConfig.length === 0 ? 'Aucune catégorie configurée.' : 'Aucune catégorie ne correspond à la recherche.'}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-bold">#</th>
                      <th className="py-2 pr-3 font-bold">Nom de la catégorie</th>
                      <th className="py-2 pr-3 font-bold">Code</th>
                      <th className="py-2 pr-3 font-bold">Description</th>
                      <th className="py-2 pr-3 font-bold">Statut</th>
                      <th className="py-2 pr-3 font-bold">Dossiers associés</th>
                      <th className="py-2 pr-3 font-bold">Date de création</th>
                      <th className="py-2 pl-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((cat, i) => {
                      const isActive = cat.active ?? true;
                      const caseCount = allAlertsForCategoryCounts.filter((a) => a.category === cat.name).length;
                      return (
                        <React.Fragment key={cat.id}>
                          <tr className="border-b border-slate-100 align-top">
                            <td className="py-3 pr-3 text-slate-400 font-semibold">{i + 1}</td>
                            <td className="py-3 pr-3 font-bold text-[#0B2545]">{cat.name}</td>
                            <td className="py-3 pr-3 font-mono text-slate-500">{cat.code ?? '—'}</td>
                            <td className="py-3 pr-3 text-slate-600 max-w-xs">
                              <span className="line-clamp-2">{cat.subCategories.length > 0 ? cat.subCategories.join(', ') : '—'}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <button
                                onClick={() => handleToggleCategoryActive(cat)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10.5px] transition ${
                                  isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                }`}
                                title={isActive ? 'Cliquer pour désactiver' : 'Cliquer pour réactiver'}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {isActive ? 'Actif' : 'Inactif'}
                              </button>
                            </td>
                            <td className="py-3 pr-3 text-slate-700 font-semibold">{caseCount}</td>
                            <td className="py-3 pr-3 text-slate-500">
                              {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('fr-FR') : '—'}
                            </td>
                            <td className="py-3 pl-3">
                              <div className="flex items-center justify-end gap-1">
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
                            </td>
                          </tr>
                          {/* Sous-catégories — hors de la capture de référence, gardée
                              intégralement (ajout/retrait), rattachée visuellement à
                              la ligne au-dessus plutôt que retirée. */}
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <td></td>
                            <td colSpan={7} className="py-2.5 pr-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {cat.subCategories.map((sub, si) => (
                                  <span key={si} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                                    {sub}
                                    <button onClick={() => handleRemoveSubCategory(cat.id, sub)} className="text-slate-400 hover:text-rose-600" title="Retirer">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                                <div className="flex gap-1.5 min-w-[220px] flex-1">
                                  <input
                                    type="text"
                                    value={newSubCategoryInputs[cat.id] || ''}
                                    onChange={(e) => setNewSubCategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCategory(cat.id); } }}
                                    placeholder="Nouvelle sous-catégorie..."
                                    className="flex-1 px-2.5 py-1 border border-slate-300 rounded-lg bg-white"
                                  />
                                  <button
                                    onClick={() => handleAddSubCategory(cat.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold whitespace-nowrap"
                                  >
                                    + Ajouter
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-slate-400 mt-3">
                  Affichage de {filteredCategories.length} sur {categoriesConfig.length} catégorie{categoriesConfig.length > 1 ? 's' : ''}.
                </p>
              </div>
            )}
          </div>
        );
      })()}

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
          6. ROLES & PERMISSIONS TAB.
          === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === n'est
          plus un affichage en lecture seule : chaque case est une vraie
          case à cocher, sauvegardée via storage.updateRolePermissions()
          (voir domain/permissionOverrides.ts pour la mécanique complète —
          domain/permissions.ts, la table PAR DÉFAUT, reste inchangée).
          === AMÉLIORATION AJOUTÉE (Phase 12.3) === this table is no longer
          a separate/future model — it is the exact set of permissions this
          application actually enforces (see src/services/authz.ts). */}
      {configTab === 'roles' && (
        <form onSubmit={handleSaveRolePermissions} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                Matrice des rôles & permissions
              </h3>
              <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                Modèle RBAC granulaire (19 permissions atomiques, <code className="font-mono text-slate-600">src/domain/permissions.ts</code>) —
                la même table sera réutilisée côté serveur (future architecture Cloud Functions / Firestore)
                afin que client et serveur ne divergent jamais sur ce qu'un rôle peut faire.
                {/* === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
                    Cette matrice est désormais RÉELLEMENT éditable — cocher/
                    décocher une case change immédiatement ce que ce rôle
                    peut faire dans toute l'application (authz.userCan),
                    dès l'enregistrement. Réservé à system_admin, comme les
                    autres tables de configuration. */}
                {' '}Cochez ou décochez une permission puis "Enregistrer" — le changement s'applique
                immédiatement à toute l'application. La case grisée (Administrateur système ×
                Gérer la configuration) est protégée : la retirer priverait tout le monde de l'accès
                à cet écran.
              </p>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              Enregistrer les permissions
            </button>
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
                        {ALL_ROLE_IDS.map((r) => {
                          const protectedCell = isProtectedPermissionCell(r, p.key);
                          const checked = (rolePermissionsDraft[r] ?? []).includes(p.key);
                          return (
                            <td key={r} className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={protectedCell}
                                onChange={() => toggleRolePermissionDraft(r, p.key)}
                                title={protectedCell ? 'Protégé : nécessaire pour conserver l\'accès à cet écran' : undefined}
                                className={`accent-blue-600 w-3.5 h-3.5 ${protectedCell ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
          GOUVERNANCE TAB — hiérarchie PAR RÔLE (jamais codée en dur, brief
          §47-68) utilisée par domain/independentRouting.ts pour trouver une
          autorité indépendante de niveau strictement supérieur, + vue
          dérivée en LECTURE SEULE (getRoutingMatrixView) : jamais une
          seconde table à maintenir à la main, qui pourrait diverger de la
          table de niveaux éditée ci-dessous. */}
      {configTab === 'governance' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3">
            {/* === AMÉLIORATION AJOUTÉE (Correction demandée — texte retiré) ===
                Le paragraphe explicatif sous ce titre a été retiré, sur
                demande explicite de l'utilisateur. Le titre et le tableau
                (édition des niveaux + vue dérivée) ci-dessous restent
                inchangés. */}
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-blue-700" />
              Routage indépendant — Niveaux hiérarchiques
            </h3>
          </div>

          <form onSubmit={handleSaveHierarchyLevels} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_ROLE_IDS.map((r) => (
                <label key={r} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-700">{ROLE_ID_LABELS[r]}</span>
                  <input
                    type="number"
                    min={1}
                    value={hierarchyLevelsDraft[r]}
                    onChange={(e) =>
                      setHierarchyLevelsDraft((prev) => ({ ...prev, [r]: Number(e.target.value) || 0 }))
                    }
                    className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-mono"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition"
              >
                Enregistrer les niveaux
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 mb-2">
              Vue dérivée — autorité de repli par rôle (lecture seule)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getRoutingMatrixView(hierarchyLevelsDraft).map((row) => (
                <div key={row.role} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-slate-700 font-medium">{ROLE_ID_LABELS[row.role]} (niveau {row.level})</span>
                  <span className="text-slate-500 text-right">
                    {row.nextLevelRoles.length > 0
                      ? row.nextLevelRoles.map((r) => ROLE_ID_LABELS[r]).join(', ')
                      : 'Aucune — intervention manuelle'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
          WORKFLOW TAB — matrice d'adjacence des 14 statuts CaseStatus
          (domain/caseTypes.ts), jusqu'ici codée en dur dans
          domain/workflow.ts (ALLOWED_TRANSITIONS) sans aucun écran pour
          l'éditer. Même mécanique que la matrice Rôles & Permissions
          ci-dessus : cases à cocher réelles, sauvegarde uniquement des
          lignes modifiées, effet immédiat sur checkTransition() via
          domain/workflow.ts (setWorkflowTransitions). */}
      {configTab === 'workflow' && (
        <form onSubmit={handleSaveWorkflowTransitions} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-blue-700" />
                Workflows & Statuts — Transitions autorisées
              </h3>
              <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                Chaque ligne est un statut de DÉPART, chaque colonne cochée un statut D'ARRIVÉE autorisé depuis cette
                ligne. Cochez ou décochez une case puis "Enregistrer" — le changement s'applique immédiatement à
                toute l'application (storage.transitionStatus / escalateAlert). Cette table ne gouverne que la
                structure du parcours : les conditions métier de clôture (allégations documentées, mesures
                correctives soldées, visa de revue fonctionnelle) restent toujours appliquées par ailleurs et ne
                peuvent pas être contournées d'ici.
              </p>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              Enregistrer les transitions
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-white z-10">Depuis \ Vers</th>
                  {ALL_CASE_STATUSES.map((s) => (
                    <th key={s} className="p-2 text-center font-bold text-slate-700 whitespace-nowrap">
                      {CASE_STATUS_LABELS[s].fr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_CASE_STATUSES.map((source) => (
                  <tr key={source} className="border-b border-slate-100">
                    <td className="p-2 text-slate-700 font-medium whitespace-nowrap sticky left-0 bg-white">
                      {CASE_STATUS_LABELS[source].fr}
                    </td>
                    {ALL_CASE_STATUSES.map((target) => {
                      const isSelf = source === target;
                      const checked = !isSelf && (workflowTransitionsDraft[source] ?? []).includes(target);
                      return (
                        <td key={target} className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSelf}
                            onChange={() => toggleWorkflowTransitionDraft(source, target)}
                            title={isSelf ? 'Un statut ne transite jamais vers lui-même' : undefined}
                            className={`accent-blue-600 w-3.5 h-3.5 ${isSelf ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
          données" retiré) === L'onglet "Base de données" (rattachement
          Firebase, règles de sécurité Firestore, synchronisation manuelle)
          disparaît d'ici, sur demande explicite de l'utilisateur. Le
          service Firebase lui-même (src/services/firebase.ts, utilisé par
          storage.ts pour la synchronisation Cloud en arrière-plan à chaque
          sauvegarde) reste entièrement inchangé — seul cet écran
          d'administration pour le configurer manuellement disparaît. */}

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
                  {countries.map((c) => (
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
          MODAL: ADD/EDIT COUNTRY */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCountryCode ? 'Modifier le pays' : 'Ajouter un pays'}
              </h3>
            </div>
            <form onSubmit={handleSaveCountry} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code pays (ISO, 2-4 lettres) *</label>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="Ex : SN"
                  maxLength={4}
                  disabled={!!editingCountryCode}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                {editingCountryCode && (
                  <p className="text-[10px] text-slate-400 mt-1">Le code n'est pas modifiable après création (utilisé comme identifiant stable).</p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom du pays *</label>
                <input type="text" value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="Ex : Sénégal" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emoji drapeau (optionnel)</label>
                <input type="text" value={countryFlag} onChange={(e) => setCountryFlag(e.target.value)} placeholder="🇸🇳" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" maxLength={8} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCountryModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingCountryCode ? 'Enregistrer' : 'Ajouter'}
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
                    {countries.map((c) => (
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
