import React, { useState } from 'react';
import {
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
  X,
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  Network,
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  GitBranch,
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  Search,
  Folder,
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
  Mail,
  // === AMÉLIORATION AJOUTÉE (Visibilité de l'état des notifications e-mail) ===
  AlertTriangle,
  // === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire) ===
  KeyRound,
  Copy,
  // === AMÉLIORATION AJOUTÉE (matrices moins touffues — groupes/sections repliables) ===
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Language, UserProfile, UserRole, EscalationRecipient } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { EntityDef, CategoryDef, CountryDef, HierarchyLevels, formatCountryLabel } from '../data/activaConfig';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire) ===
// Même module que le code d'accès du lanceur d'alerte (AlertSubmissionFlow.tsx).
import { generateAccessPassword, generateSalt, hashPassword } from '../services/crypto';
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
  initialTab?: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'database' | 'governance' | 'workflow';
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  lang,
  activeUser,
  initialTab,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (navigation Admin figée après le premier clic)
  // === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : `configTab`
  // était un `useState` initialisé UNE SEULE FOIS depuis `initialTab` — un
  // clic sur un autre lien de la sidebar (StaffPortalLayout.tsx) change
  // bien `currentTab`/l'URL et donc la prop `initialTab` reçue ici, mais
  // React réutilise la même instance de ce composant (même position dans
  // l'arbre) sans jamais réexécuter l'initialiseur du `useState` : l'écran
  // restait figé sur le tout premier onglet visité, quel que soit le lien
  // cliqué ensuite. Aucun code de ce composant n'appelait plus jamais
  // `setConfigTab` par ailleurs (la sidebar est la SEULE source de
  // navigation depuis la suppression de l'ancienne rangée d'onglets interne
  // — voir plus bas) : `configTab` peut donc être dérivé directement de la
  // prop à chaque rendu, sans état local du tout.
  const configTab: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'database' | 'governance' | 'workflow' = initialTab ?? 'matrix';
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
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === même motif que entities/countries ci-dessus.
  const escalationRecipients = storage.getEscalationRecipients();

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
  // === AMÉLIORATION AJOUTÉE (page Gouvernance moins touffue) === sur
  // demande explicite de l'utilisateur : la "Vue dérivée" (information
  // calculée, lecture seule, jamais la table éditée elle-même) reste
  // repliée par défaut — elle n'apporte rien à quelqu'un qui vient juste
  // ajuster un niveau hiérarchique.
  const [showDerivedRoutingView, setShowDerivedRoutingView] = useState(false);
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
  // === AMÉLIORATION AJOUTÉE (matrice de permissions moins touffue) === sur
  // demande explicite de l'utilisateur : les 19 lignes (7 rôles × colonne)
  // restaient toutes visibles à la fois. Contrairement aux transitions de
  // workflow (une ligne = un statut indépendant), une matrice de
  // permissions sert avant tout à COMPARER les rôles entre eux sur une même
  // permission — la replier ligne par ligne dans des fenêtres séparées
  // casserait cette comparaison. Repliées par GROUPE à la place (Dossiers,
  // Preuves...), chaque section reste une vraie grille rôles × permissions
  // une fois dépliée.
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set());
  const togglePermissionGroup = (group: string) => {
    setExpandedPermissionGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };
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
  // === AMÉLIORATION AJOUTÉE (matrice de transitions moins touffue) === sur
  // demande explicite de l'utilisateur : la grille 13×13 toujours visible
  // (169 cases à cocher à l'écran en permanence) est remplacée par une
  // ligne compacte par statut de départ (puces des statuts d'arrivée déjà
  // autorisés) ; la case à cocher complète pour un statut donné ne
  // s'affiche que dans une fenêtre dédiée, ouverte au clic sur "Modifier".
  // Édite toujours le même `workflowTransitionsDraft` — "Enregistrer les
  // transitions" (inchangé) reste le seul geste qui persiste réellement.
  const [editingTransitionsFor, setEditingTransitionsFor] = useState<CaseStatus | null>(null);
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
  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  // Code de numérotation des dossiers (préfixe du format XX-YY-MM-XXXX,
  // voir storage.generateCaseNumber) — éditable ici car c'est la DARC
  // Groupe, pas le code, qui fait autorité sur sa valeur officielle.
  const [entityCode, setEntityCode] = useState('');
  const [deleteEntityConfirmId, setDeleteEntityConfirmId] = useState<string | null>(null);

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === --- Escalation Recipients CRUD state --- même motif que
  // les Entités ci-dessus.
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [recipientIdentifiant, setRecipientIdentifiant] = useState('');
  const [recipientNom, setRecipientNom] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientFonction, setRecipientFonction] = useState('');
  const [recipientGrade, setRecipientGrade] = useState(1);
  const [recipientLinkedUserId, setRecipientLinkedUserId] = useState('');
  const [recipientActive, setRecipientActive] = useState(true);
  const [deleteRecipientConfirmId, setDeleteRecipientConfirmId] = useState<string | null>(null);

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
  // === AMÉLIORATION AJOUTÉE (sous-catégories dans une fenêtre dédiée) ===
  // sur demande explicite de l'utilisateur ("le tableau est trop touffu" —
  // une première version dépliait la bande de puces directement dans le
  // tableau, jugée encore trop intrusive) : la gestion des sous-catégories
  // (ajout/retrait) s'ouvre désormais dans une fenêtre modale dédiée,
  // laissant chaque ligne du tableau strictement compacte en permanence.
  const [manageSubCategoriesId, setManageSubCategoriesId] = useState<string | null>(null);

  // --- Users CRUD state ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  // === AMÉLIORATION AJOUTÉE (identifiant de connexion distinct de l'email)
  // === Sur demande explicite : les comptes se connectent avec un
  // identifiant dédié, jamais l'adresse e-mail directement.
  const [userUsername, setUserUsername] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('investigator');
  const [userRoleTitle, setUserRoleTitle] = useState('');
  const [userEntity, setUserEntity] = useState('');
  const [userCountry, setUserCountry] = useState('');
  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null);
  // === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire,
  // expiration 4h) === identifiant + mot de passe généré, affiché UNE
  // SEULE FOIS à l'admin (à la création d'un compte, ou après une
  // régénération) — jamais repersisté en clair nulle part, jamais
  // ré-affichable ensuite. `copied` pilote juste le petit retour visuel du
  // bouton copier, même motif que ContactView.tsx.
  const [generatedCredentials, setGeneratedCredentials] = useState<{ name: string; username: string; password: string } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [resetPasswordConfirmId, setResetPasswordConfirmId] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

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
    setEntityCode('');
  };
  const openAddEntity = () => { resetEntityForm(); setShowEntityModal(true); };
  const openEditEntity = (ent: EntityDef) => {
    setEditingEntityId(ent.id);
    setEntityName(ent.name);
    setEntityCountry(ent.country);
    setEntityFlag(ent.flag);
    setEntityCode(ent.code);
    setShowEntityModal(true);
  };
  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
    // Validation stricte : le code alimente directement le numéro de
    // dossier officiel (storage.generateCaseNumber) — 2 à 6 lettres
    // majuscules uniquement, jamais vide.
    const normalizedCode = entityCode.trim().toUpperCase();
    if (!entityName.trim() || !entityCountry.trim() || !/^[A-Z]{2,6}$/.test(normalizedCode)) return;
    if (editingEntityId) {
      storage.updateEntity(editingEntityId, { name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️', code: normalizedCode }, activeUser);
      flashBanner(`Entité "${entityName.trim()}" mise à jour.`);
    } else {
      const id = `ent-${slugify(entityName)}-${Date.now().toString(36)}`;
      storage.addEntity({ id, name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️', code: normalizedCode }, activeUser);
      flashBanner(`Entité "${entityName.trim()}" ajoutée.`);
    }
    setShowEntityModal(false);
  };
  const handleDeleteEntity = (ent: EntityDef) => {
    storage.deleteEntity(ent.id, activeUser);
    setDeleteEntityConfirmId(null);
    flashBanner(`Entité "${ent.name}" supprimée.`);
  };

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === --- Escalation Recipients handlers --- même motif que
  // les Entités ci-dessus.
  const resetRecipientForm = () => {
    setEditingRecipientId(null);
    setRecipientIdentifiant('');
    setRecipientNom('');
    setRecipientEmail('');
    setRecipientFonction('');
    setRecipientGrade(1);
    setRecipientLinkedUserId('');
    setRecipientActive(true);
  };
  const openAddRecipient = () => { resetRecipientForm(); setShowRecipientModal(true); };
  const openEditRecipient = (r: EscalationRecipient) => {
    setEditingRecipientId(r.id);
    setRecipientIdentifiant(r.identifiant);
    setRecipientNom(r.nom);
    setRecipientEmail(r.email);
    setRecipientFonction(r.fonction);
    setRecipientGrade(r.grade);
    setRecipientLinkedUserId(r.linkedUserId ?? '');
    setRecipientActive(r.active);
    setShowRecipientModal(true);
  };
  const handleSaveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientIdentifiant.trim() || !recipientNom.trim() || !recipientEmail.trim() || !recipientFonction.trim()) return;
    const payload = {
      identifiant: recipientIdentifiant.trim(),
      nom: recipientNom.trim(),
      email: recipientEmail.trim(),
      fonction: recipientFonction.trim(),
      grade: recipientGrade,
      linkedUserId: recipientLinkedUserId || undefined,
      active: recipientActive,
    };
    if (editingRecipientId) {
      storage.updateEscalationRecipient(editingRecipientId, payload, activeUser);
      flashBanner(`Destinataire "${recipientNom.trim()}" mis à jour.`);
    } else {
      const id = `rec-${slugify(recipientNom)}-${Date.now().toString(36)}`;
      storage.addEscalationRecipient({ id, ...payload }, activeUser);
      flashBanner(`Destinataire "${recipientNom.trim()}" ajouté.`);
    }
    setShowRecipientModal(false);
  };
  const handleDeleteRecipient = (r: EscalationRecipient) => {
    storage.deleteEscalationRecipient(r.id, activeUser);
    setDeleteRecipientConfirmId(null);
    flashBanner(`Destinataire "${r.nom}" supprimé.`);
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
    setUserUsername('');
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
    setUserUsername(u.username);
    setUserRole(u.role);
    setUserRoleTitle(u.roleTitle);
    setUserEntity(u.entity);
    setUserCountry(u.country);
    setShowUserModal(true);
  };
  // === AMÉLIORATION AJOUTÉE (identifiant de connexion distinct de l'email) ===
  // Suggestion à partir du nom saisi (même schéma que `slugify` ci-dessus,
  // réutilisé), jamais imposée — l'admin reste libre de la modifier avant
  // d'enregistrer.
  const suggestUsername = () => {
    if (userName.trim()) setUserUsername(slugify(userName).replace(/_/g, '.'));
  };
  // === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire)
  // === handler devenu asynchrone : la création génère désormais un vrai
  // mot de passe temporaire (salé/haché, jamais stocké en clair — même
  // mécanisme que le code d'accès du lanceur d'alerte, AlertSubmissionFlow.tsx),
  // affiché une seule fois à l'admin juste après. La modification d'un
  // compte existant (`editingUserId`) ne touche jamais au mot de passe.
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userUsername.trim()) return;
    const normalizedUsername = userUsername.trim().toLowerCase();
    const usernameTaken = storage
      .getUsers()
      .some((u) => u.id !== editingUserId && u.username.toLowerCase() === normalizedUsername);
    if (usernameTaken) {
      alert(`L'identifiant "${normalizedUsername}" est déjà utilisé par un autre compte.`);
      return;
    }
    setIsSavingUser(true);
    if (editingUserId) {
      storage.updateUser(
        editingUserId,
        { name: userName.trim(), email: userEmail.trim(), username: normalizedUsername, role: userRole, roleTitle: userRoleTitle.trim(), entity: userEntity.trim(), country: userCountry.trim() },
        activeUser
      );
      flashBanner(`Compte "${userName.trim()}" mis à jour.`);
      setShowUserModal(false);
    } else {
      const id = 'usr-' + Date.now().toString(36);
      const tempPassword = generateAccessPassword();
      const passwordSalt = generateSalt();
      const passwordHash = await hashPassword(tempPassword, passwordSalt);
      storage.addUser(
        {
          id,
          name: userName.trim(),
          email: userEmail.trim(),
          username: normalizedUsername,
          role: userRole,
          roleTitle: userRoleTitle.trim() || userRole,
          entity: userEntity.trim() || 'Toutes entités',
          country: userCountry.trim() || 'Groupe ACTIVA',
          passwordHash,
          passwordSalt,
          mustChangePassword: true,
          passwordSetAt: new Date().toISOString(),
        },
        activeUser
      );
      flashBanner(`Compte "${userName.trim()}" créé.`);
      setShowUserModal(false);
      setGeneratedCredentials({ name: userName.trim(), username: normalizedUsername, password: tempPassword });
    }
    setIsSavingUser(false);
  };
  const handleDeleteUser = (u: UserProfile) => {
    if (u.id === activeUser.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte actif.');
      setDeleteUserConfirmId(null);
      return;
    }
    // === AMÉLIORATION AJOUTÉE : garde-fou anti-verrouillage total ===
    // Empêche de supprimer le dernier compte "Administrateur système" actif :
    // sans cela, la plateforme se retrouve sans aucun admin capable de créer
    // ou réinitialiser des comptes (verrouillage complet côté client, sans
    // recours puisqu'il n'y a pas de backend distant pour restaurer un accès).
    if (u.role === 'system_admin' && u.active) {
      const remainingActiveAdmins = storage
        .getUsers()
        .filter((other) => other.id !== u.id && other.role === 'system_admin' && other.active).length;
      if (remainingActiveAdmins === 0) {
        alert('Impossible de supprimer ce compte : il s\'agit du dernier administrateur système actif. Créez ou activez un autre compte "Administrateur système" avant de supprimer celui-ci.');
        setDeleteUserConfirmId(null);
        return;
      }
    }
    storage.deleteUser(u.id, activeUser);
    setDeleteUserConfirmId(null);
    flashBanner(`Compte "${u.name}" supprimé.`);
  };

  // === AMÉLIORATION AJOUTÉE (régénération du mot de passe temporaire) ===
  // Recours nécessaire si le mot de passe temporaire expire (4h, voir
  // storage.ts) avant que l'utilisateur ne se soit connecté — sans cette
  // action, un tel compte resterait bloqué sans recours.
  const handleResetPassword = async (u: UserProfile) => {
    const newPassword = await storage.resetUserPassword(u.id, activeUser);
    setResetPasswordConfirmId(null);
    setGeneratedCredentials({ name: u.name, username: u.username, password: newPassword });
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
        { key: 'cases.archive', label: 'Archiver un dossier' },
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
    // === AMÉLIORATION AJOUTÉE (alignement sidebar/contenu Admin) === BUG
    // PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : ce `py-8` s'ajoutait
    // au `lg:py-6` déjà appliqué par le conteneur parent (StaffPortalLayout,
    // "Content canvas"), faisant démarrer la première carte de ce contenu
    // ~32px plus bas que le haut de la sidebar (qui, elle, n'a pas de
    // padding interne avant sa première carte). `lg:pt-0` aligne les deux
    // sur grand écran — `pt-8` reste sur mobile, où la sidebar est masquée
    // (remplacée par le nav horizontal) et cet espace au-dessus reste utile.
    <div className="max-w-7xl mx-auto pt-8 lg:pt-0 pb-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* === AMÉLIORATION AJOUTÉE (suppression de la bande au-dessus des
          tableaux) === BUG PRÉEXISTANT CORRIGÉ, sur demande explicite de
          l'utilisateur : la carte "Configuration Système" + "Réinitialiser
          jeu de démonstration" (déjà retirée) puis le repère de section
          gris restant ("MATRICE DES RISQUES & DÉLAIS SLA", etc.) sont
          retirés — ce bandeau permanent est redondant avec le titre déjà
          actif dans la sidebar (StaffPortalLayout.tsx) et avec le titre de
          chaque carte de contenu ci-dessous. `saveBanner` (retours de
          succès CRUD, utilisé par ~20 actions de cet écran) reste affiché,
          mais seulement quand un message est réellement présent — plus de
          carte vide en permanence au-dessus des tableaux. */}
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
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>{ent.country}</span>
                      {/* === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) === */}
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold text-[10px]">{ent.code}</span>
                    </div>
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
                      <th className="py-2 pr-3 font-bold">Sous-catégories</th>
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
                              {/* === AMÉLIORATION AJOUTÉE (sous-catégories dans une
                                  fenêtre dédiée) === Remplace la liste complète des
                                  sous-catégories par un simple compte, cliquable — le
                                  détail s'ouvre dans une fenêtre modale dédiée (jamais
                                  déplié dans le tableau lui-même), sur demande explicite
                                  de l'utilisateur. */}
                              {cat.subCategories.length > 0 ? (
                                <button
                                  onClick={() => setManageSubCategoriesId(cat.id)}
                                  className="text-blue-700 hover:underline font-semibold"
                                >
                                  {cat.subCategories.length} sous-catégorie{cat.subCategories.length > 1 ? 's' : ''}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setManageSubCategoriesId(cat.id)}
                                  className="text-slate-400 hover:text-blue-700 hover:underline"
                                >
                                  Aucune — ajouter
                                </button>
                              )}
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
                                <button onClick={() => setManageSubCategoriesId(cat.id)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Gérer les sous-catégories">
                                  <Folder className="w-3.5 h-3.5" />
                                </button>
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

      {/* === AMÉLIORATION AJOUTÉE (sous-catégories dans une fenêtre dédiée)
          === Fenêtre modale de gestion des sous-catégories d'une catégorie —
          sur demande explicite de l'utilisateur, remplace tout affichage
          dans le tableau lui-même (chaque ligne reste strictement
          compacte). Même gabarit que les modales Ajouter/Modifier catégorie
          ci-dessous. */}
      {manageSubCategoriesId && (() => {
        const cat = categoriesConfig.find((c) => c.id === manageSubCategoriesId);
        if (!cat) return null;
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-blue-700" />
                    Sous-catégories
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">{cat.name}</p>
                </div>
                <button onClick={() => setManageSubCategoriesId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cat.subCategories.length === 0 && <span className="text-slate-400 italic">Aucune sous-catégorie pour le moment.</span>}
                {cat.subCategories.map((sub, si) => (
                  <span key={si} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                    {sub}
                    <button onClick={() => handleRemoveSubCategory(cat.id, sub)} className="text-slate-400 hover:text-rose-600" title="Retirer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                <input
                  type="text"
                  value={newSubCategoryInputs[cat.id] || ''}
                  onChange={(e) => setNewSubCategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCategory(cat.id); } }}
                  placeholder="Nouvelle sous-catégorie..."
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                  autoFocus
                />
                <button
                  onClick={() => handleAddSubCategory(cat.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold whitespace-nowrap"
                >
                  + Ajouter
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <button onClick={() => setManageSubCategoriesId(null)} className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  Fermer
                </button>
              </div>
            </div>
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
                  <div className="text-[11px] text-slate-500 truncate">
                    <span className="font-mono">{u.username}</span> • {u.email} • {u.entity} ({formatCountryLabel(countries, u.country)})
                  </div>
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
                  {/* === AMÉLIORATION AJOUTÉE (régénération du mot de passe
                      temporaire) === recours si le mot de passe temporaire
                      a expiré (4h) avant la première connexion, ou si sa
                      transmission a échoué. */}
                  {resetPasswordConfirmId === u.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleResetPassword(u)} className="px-1.5 py-1 rounded bg-amber-600 text-white font-bold text-[10px]">Confirmer</button>
                      <button onClick={() => setResetPasswordConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setResetPasswordConfirmId(u.id)} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700" title="Régénérer le mot de passe">
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}
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
              {/* === AMÉLIORATION AJOUTÉE (suppression du texte explicatif)
                  === sur demande explicite de l'utilisateur : le paragraphe
                  descriptif sous ce titre est retiré (le titre seul
                  suffit) — même traitement que Gouvernance. Rappel toujours
                  vrai bien que non affiché : cette matrice est réellement
                  éditable (authz.userCan), réservée à system_admin, et la
                  case Administrateur système × Gérer la configuration reste
                  protégée côté logique (isProtectedPermissionCell). */}
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
                {PERMISSION_GROUPS.map((g) => {
                  const isGroupExpanded = expandedPermissionGroups.has(g.group);
                  return (
                  <React.Fragment key={g.group}>
                    <tr className="bg-slate-50">
                      <td colSpan={ALL_ROLE_IDS.length + 1} className="p-0 sticky left-0">
                        <button
                          type="button"
                          onClick={() => togglePermissionGroup(g.group)}
                          className="w-full flex items-center gap-1.5 p-2 font-bold text-slate-600 uppercase tracking-wide text-[10px] hover:bg-slate-100 text-left"
                        >
                          {isGroupExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                          {g.group}
                          <span className="text-slate-400 normal-case font-normal">({g.permissions.length})</span>
                        </button>
                      </td>
                    </tr>
                    {isGroupExpanded && g.permissions.map((p) => (
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
                  );
                })}
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
          {/* === AMÉLIORATION AJOUTÉE (suppression du texte explicatif) ===
              sur demande explicite de l'utilisateur : le paragraphe
              descriptif sous ce titre est retiré (le titre seul suffit). */}
          <div className="border-b border-slate-100 pb-3">
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
            <button
              type="button"
              onClick={() => setShowDerivedRoutingView((v) => !v)}
              className="w-full flex items-center gap-1.5 font-bold text-slate-900 mb-2 hover:text-slate-700"
            >
              {showDerivedRoutingView ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Vue dérivée — autorité de repli par rôle (lecture seule)
            </button>
            {showDerivedRoutingView && (
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
            )}
          </div>

          {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade
              et de routage) === Source réelle des destinataires proposés
              par "Escalader le dossier" (InvestigationDesk.tsx) et du
              dernier recours notifié quand le routage indépendant
              ci-dessus ne trouve aucune autorité interne (grade le plus
              élevé, actif) — REMPLACE le filtre par rôle codé en dur
              (senior_investigator/darc_compliance uniquement) qui
              existait avant. Un destinataire "Compte lié" obtient un
              accès in-app réel au dossier ; sans compte, seule une vraie
              notification e-mail est envoyée — jamais d'accès fictif. */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-700" />
                  Registre des destinataires d'escalade et de routage ({escalationRecipients.length})
                </h4>
              </div>
              <button
                onClick={openAddRecipient}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter un destinataire
              </button>
            </div>

            {escalationRecipients.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Aucun destinataire configuré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                      <th className="py-2 pr-3">Nom</th>
                      <th className="py-2 pr-3">Identifiant</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Fonction</th>
                      <th className="py-2 pr-3 text-right">Grade</th>
                      <th className="py-2 pr-3">Compte lié</th>
                      <th className="py-2 pr-3">Actif</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...escalationRecipients].sort((a, b) => b.grade - a.grade).map((r) => {
                      const linkedUser = r.linkedUserId ? users.find((u) => u.id === r.linkedUserId) : undefined;
                      return (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-semibold text-slate-900">{r.nom}</td>
                          <td className="py-2 pr-3 text-slate-500 font-mono">{r.identifiant}</td>
                          <td className="py-2 pr-3 text-slate-600">{r.email}</td>
                          <td className="py-2 pr-3 text-slate-600">{r.fonction}</td>
                          <td className="py-2 pr-3 text-right font-mono text-slate-700">{r.grade}</td>
                          <td className="py-2 pr-3">
                            {linkedUser ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{linkedUser.name}</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">E-mail uniquement</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                              {r.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditRecipient(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Modifier">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {deleteRecipientConfirmId === r.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDeleteRecipient(r)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                                  <button onClick={() => setDeleteRecipientConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteRecipientConfirmId(r.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* === AMÉLIORATION AJOUTÉE (Visibilité de l'état des
              notifications e-mail) === BUG PRÉEXISTANT CORRIGÉ, identifié
              lors d'une analyse critique du frontend : chaque tentative
              d'envoi (nouveau signalement, attribution, escalade, repli de
              routage) était déjà honnêtement journalisée dans l'Audit Trail
              (EMAIL_NOTIFICATION_SENT/FAILED, services/emailNotify.ts —
              jamais un faux succès), mais RIEN ne le rendait visible sans
              aller fouiller l'Audit Trail écran par écran. Carte dérivée en
              LECTURE SEULE des entrées d'audit réelles — jamais un chiffre
              fabriqué — pour que l'administrateur voie immédiatement si les
              e-mails partent vraiment dans cet environnement. */}
          <div className="pt-4 border-t border-slate-100">
            {(() => {
              const logs = storage.getAuditLogs();
              const sent = logs.filter((l) => l.actionType === 'EMAIL_NOTIFICATION_SENT').length;
              const failed = logs.filter((l) => l.actionType === 'EMAIL_NOTIFICATION_FAILED').length;
              const total = sent + failed;
              const neverWorked = total > 0 && sent === 0;
              // === AMÉLIORATION AJOUTÉE (Incohérence i18n — corrigée) ===
              // `t.email_status_never_worked` porte le nom de fichier comme
              // placeholder texte `{doc}` (jamais traduit en tant que tel) ;
              // séparé ici en 2 morceaux pour garder le style <code> sans
              // sortir ce segment du système de traduction.
              const [neverWorkedBefore, neverWorkedAfter] = t.email_status_never_worked.split('{doc}');
              return (
                <>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                    <Mail className="w-4 h-4 text-blue-700" />
                    {t.email_status_title}
                  </h4>
                  {total === 0 ? (
                    <p className="text-slate-500 text-[11px] italic">
                      {t.email_status_empty}
                    </p>
                  ) : (
                    <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      neverWorked ? 'bg-amber-50 border-amber-200' : failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      {neverWorked || failed > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <div className={neverWorked || failed > 0 ? 'text-amber-900' : 'text-emerald-900'}>
                        <p className="font-semibold">
                          {t.email_status_summary
                            .replace('{total}', String(total))
                            .replace('{sent}', String(sent))
                            .replace('{failed}', String(failed))}
                        </p>
                        {neverWorked && (
                          <p className="text-[11px] mt-1 leading-relaxed">
                            {neverWorkedBefore}
                            <code className="font-mono bg-white/60 px-1 rounded">docs/EMAIL-NOTIFICATIONS.md</code>
                            {neverWorkedAfter}
                          </p>
                        )}
                        {!neverWorked && failed > 0 && (
                          <p className="text-[11px] mt-1 leading-relaxed">
                            {t.email_status_partial_failure}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
              {/* === AMÉLIORATION AJOUTÉE (suppression du texte explicatif)
                  === sur demande explicite de l'utilisateur, le titre seul
                  suffit. Rappel toujours vrai bien que non affiché : chaque
                  ligne est un statut de départ, "Enregistrer les
                  transitions" applique le changement immédiatement
                  (storage.transitionStatus / escalateAlert), et cette table
                  ne gouverne que la structure du parcours — les conditions
                  métier de clôture restent appliquées ailleurs. */}
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              Enregistrer les transitions
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {ALL_CASE_STATUSES.map((source) => {
              const targets = (workflowTransitionsDraft[source] ?? []);
              return (
                <div key={source} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                  <div className="w-40 shrink-0 font-bold text-slate-900">{CASE_STATUS_LABELS[source].fr}</div>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                    {targets.length === 0 ? (
                      <span className="text-slate-400 italic">Statut terminal — aucune transition autorisée</span>
                    ) : (
                      targets.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold text-[10.5px] whitespace-nowrap">
                          {CASE_STATUS_LABELS[t].fr}
                        </span>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTransitionsFor(source)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-200 text-slate-600 font-semibold shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
              );
            })}
          </div>
        </form>
      )}

      {/* === AMÉLIORATION AJOUTÉE (matrice de transitions moins touffue) ===
          Fenêtre dédiée : les cases à cocher complètes pour UN SEUL statut de
          départ, plutôt que la grille entière en permanence. */}
      {editingTransitionsFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-blue-700" />
                  Transitions depuis "{CASE_STATUS_LABELS[editingTransitionsFor].fr}"
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Statuts d'arrivée autorisés depuis ce statut.</p>
              </div>
              <button type="button" onClick={() => setEditingTransitionsFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ALL_CASE_STATUSES.map((target) => {
                const isSelf = editingTransitionsFor === target;
                const checked = !isSelf && (workflowTransitionsDraft[editingTransitionsFor] ?? []).includes(target);
                return (
                  <label
                    key={target}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                      isSelf ? 'opacity-30 cursor-not-allowed border-slate-100' : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSelf}
                      onChange={() => toggleWorkflowTransitionDraft(editingTransitionsFor, target)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    {CASE_STATUS_LABELS[target].fr}
                  </label>
                );
              })}
            </div>

            <p className="text-slate-400 pt-2 border-t border-slate-100">
              Fermer cette fenêtre ne perd rien — cliquez ensuite sur "Enregistrer les transitions" pour appliquer les changements.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditingTransitionsFor(null)}
                className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold"
              >
                Fermer
              </button>
            </div>
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
                  {countries.map((c) => (
                    <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emoji drapeau (optionnel)</label>
                <input type="text" value={entityFlag} onChange={(e) => setEntityFlag(e.target.value)} placeholder="🇧🇯" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" maxLength={8} />
              </div>
              {/* === AMÉLIORATION AJOUTÉE (numérotation officielle des
                  dossiers) === code utilisé comme préfixe du numéro de
                  dossier officiel (ex. AARDC-26-09-0001). */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code entité (numérotation des dossiers) *</label>
                <input
                  type="text"
                  value={entityCode}
                  onChange={(e) => setEntityCode(e.target.value.toUpperCase())}
                  placeholder="Ex : AARDC"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono uppercase"
                  maxLength={6}
                  pattern="[A-Za-z]{2,6}"
                  title="2 à 6 lettres, ex : AARDC"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">2 à 6 lettres. Préfixe des numéros de dossier de cette entité (ex : AARDC-26-09-0001).</p>
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

      {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et
          de routage) === MODAL: ADD/EDIT RECIPIENT — même structure que la
          modale Entité ci-dessus. */}
      {showRecipientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRecipientId ? 'Modifier le destinataire' : 'Ajouter un destinataire'}
              </h3>
            </div>
            <form onSubmit={handleSaveRecipient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nom *</label>
                  <input type="text" value={recipientNom} onChange={(e) => setRecipientNom(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Identifiant *</label>
                  <input type="text" value={recipientIdentifiant} onChange={(e) => setRecipientIdentifiant(e.target.value)} placeholder="Ex : GRP-DGA-001" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                  <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grade *</label>
                  <input
                    type="number"
                    min={1}
                    value={recipientGrade}
                    onChange={(e) => setRecipientGrade(Number(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Fonction *</label>
                  <input type="text" value={recipientFonction} onChange={(e) => setRecipientFonction(e.target.value)} placeholder="Ex : Directeur Général Adjoint Groupe" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Compte activa-whistleblowing lié (optionnel)</label>
                  <select value={recipientLinkedUserId} onChange={(e) => setRecipientLinkedUserId(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">Aucun — notification e-mail uniquement</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} — {u.roleTitle}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-700">
                    <input type="checkbox" checked={recipientActive} onChange={(e) => setRecipientActive(e.target.checked)} className="rounded border-slate-300" />
                    Actif
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowRecipientModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingRecipientId ? 'Enregistrer' : 'Ajouter'}
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
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Identifiant de connexion *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      placeholder="ex : y.mebadaekani"
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                      required
                    />
                    <button type="button" onClick={suggestUsername} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold whitespace-nowrap">
                      Suggérer
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Distinct de l'email — c'est avec cet identifiant que le compte se connecte.</p>
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
                <button type="submit" disabled={isSavingUser} className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-60 text-white font-bold">
                  {isSavingUser ? 'Enregistrement…' : editingUserId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe
          temporaire, affiché une seule fois) === Identifiant + mot de passe
          générés à la création (ou à une régénération) : jamais stockés en
          clair, jamais ré-affichables une fois cette fenêtre fermée. L'admin
          doit les transmettre à l'utilisateur, qui devra changer ce mot de
          passe dès sa première connexion (StaffLoginView.tsx) — il expire
          sous 4h s'il n'est pas utilisé (storage.ts). */}
      {generatedCredentials && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mot de passe temporaire généré</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Pour {generatedCredentials.name}</p>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Identifiant</div>
                <div className="font-mono text-sm text-slate-900">{generatedCredentials.username}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mot de passe temporaire</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900 tracking-wider">{generatedCredentials.password}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${generatedCredentials.username} / ${generatedCredentials.password}`);
                      setCopiedCredential(true);
                      setTimeout(() => setCopiedCredential(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500"
                    title="Copier"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiedCredential && <span className="text-emerald-700 font-semibold">Copié ✓</span>}
                </div>
              </div>
            </div>

            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
              Ce mot de passe ne sera plus jamais affiché. Transmettez-le à l'utilisateur — il devra le changer dès sa première connexion. Il expire dans 4 heures s'il n'est pas utilisé.
            </p>

            <button
              type="button"
              onClick={() => setGeneratedCredentials(null)}
              className="w-full px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold"
            >
              J'ai transmis ces informations
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
