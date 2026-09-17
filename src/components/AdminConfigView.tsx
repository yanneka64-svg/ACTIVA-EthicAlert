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
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  Search,
  Folder,
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
  Mail,
  // === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire) ===
  KeyRound,
  Copy,
} from 'lucide-react';
import { Language, UserProfile, UserRole, EscalationRecipient } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { CategoryDef, formatCountryLabel } from '../data/activaConfig';
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
// === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
// onglet) === premier onglet extrait dans son propre composant (voir
// src/components/admin/RolesPermissionsTab.tsx) ; c'est ce composant qui
// importe désormais Permission/RoleId/ChevronRight/ChevronDown, plus
// utilisés directement ici.
import { RolesPermissionsTab } from './admin/RolesPermissionsTab';
import { OrganizationCountriesTab } from './admin/OrganizationCountriesTab';
import { EntitiesTab } from './admin/EntitiesTab';

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
  initialTab?: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'database' | 'governance';
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
  const configTab: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'database' | 'governance' = initialTab ?? 'matrix';
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
  // === AMÉLIORATION AJOUTÉE (refonte de la fenêtre d'identifiants générés) ===
  // Remplace l'unique booléen `copiedCredential` par un suivi par champ, pour
  // que chacun des 3 boutons de copie (identifiant seul / mot de passe seul /
  // les deux) affiche son propre retour visuel "Copié" indépendamment des
  // autres — comportement de copie inchangé, seul l'affichage est plus riche.
  const [copiedField, setCopiedField] = useState<'username' | 'password' | 'both' | null>(null);
  const copyCredentialField = (field: 'username' | 'password' | 'both', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
  };
  const [resetPasswordConfirmId, setResetPasswordConfirmId] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const slugify = (name: string) =>
    name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

  const flashBanner = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(''), 3000);
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
          2. ENTITIES TAB.
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/EntitiesTab.tsx (modale Ajouter/Modifier
          entité incluse). */}
      {configTab === 'entities' && (
        <EntitiesTab entities={entities} countries={countries} activeUser={activeUser} onSaved={flashBanner} slugify={slugify} />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
          ORGANIZATION TAB (pays) — même motif CRUD que l'onglet Entités
          ci-dessus, un niveau au-dessus dans la hiérarchie ACTIVA GROUP →
          Pays → Entité → Utilisateurs (brief §2). Un pays supprimé alors
          qu'une entité y est encore rattachée est refusé — voir
          storage.deleteCountry(). Validation frontend uniquement (comme
          partout ailleurs dans cet écran) : signalé, pas contourné. */}
      {/* === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/OrganizationCountriesTab.tsx (modale
          Ajouter/Modifier pays incluse). */}
      {configTab === 'organization' && (
        <OrganizationCountriesTab countries={countries} entities={entities} activeUser={activeUser} onSaved={flashBanner} />
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
                Profils et Habilitations
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
          application actually enforces (see src/services/authz.ts).
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/RolesPermissionsTab.tsx. */}
      {configTab === 'roles' && <RolesPermissionsTab activeUser={activeUser} onSaved={flashBanner} />}

      {/* === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
          GOUVERNANCE TAB. La hiérarchie par rôle utilisée par
          domain/independentRouting.ts (niveaux + vue dérivée en lecture
          seule) a été retirée de cet écran sur demande explicite — les
          niveaux restent en place côté données (storage.getHierarchyLevels,
          toujours utilisés par le moteur de routage indépendant), seul cet
          écran d'édition disparaît. */}
      {configTab === 'governance' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
          {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade
              et de routage) === Source réelle des destinataires proposés
              par "Escalader le dossier" (InvestigationDesk.tsx) et du
              dernier recours notifié quand le routage indépendant
              ne trouve aucune autorité interne (grade le plus
              élevé, actif) — REMPLACE le filtre par rôle codé en dur
              (senior_investigator/darc_compliance uniquement) qui
              existait avant. Un destinataire "Compte lié" obtient un
              accès in-app réel au dossier ; sans compte, seule une vraie
              notification e-mail est envoyée — jamais d'accès fictif. */}
          <div>
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

          {/* === AMÉLIORATION AJOUTÉE (carte "État des notifications e-mail"
              retirée de l'affichage, sur demande explicite) === Le suivi
              continue normalement en arrière-plan : chaque tentative d'envoi
              (nouveau signalement, attribution, escalade, repli de routage)
              reste journalisée dans la base (Audit Trail,
              EMAIL_NOTIFICATION_SENT/FAILED, services/emailNotify.ts) — rien
              n'est désactivé, seule cette carte de lecture n'est plus
              rendue ici. */}
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
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === Modals */}

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
          {/* === AMÉLIORATION AJOUTÉE (refonte de la fenêtre d'identifiants
              générés) === Mêmes données (generatedCredentials.name/username/
              password) et même fermeture (setGeneratedCredentials(null)) que
              la version précédente — seule la présentation change : copie
              individuelle de chaque champ en plus de la copie groupée déjà
              existante, retour visuel "Copié" propre à chaque bouton, mise en
              page un peu plus aérée. */}
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-4.5 h-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Identifiants temporaires générés</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Pour {generatedCredentials.name}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Identifiant</div>
                  <div className="font-mono text-sm text-slate-900 truncate">{generatedCredentials.username}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCredentialField('username', generatedCredentials.username)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                  title="Copier l'identifiant"
                >
                  {copiedField === 'username' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mot de passe temporaire</div>
                  <div className="font-mono font-bold text-sm text-slate-900 tracking-wider truncate">{generatedCredentials.password}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCredentialField('password', generatedCredentials.password)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                  title="Copier le mot de passe"
                >
                  {copiedField === 'password' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
              Ce mot de passe ne sera plus jamais affiché. Transmettez-le à l'utilisateur — il devra le changer dès sa première connexion. Il expire dans 4 heures s'il n'est pas utilisé.
            </p>

            {/* === AMÉLIORATION AJOUTÉE (libellés raccourcis, boutons sur une
                seule ligne) === Mêmes actions qu'avant (copie groupée puis
                fermeture), juste des libellés à 1-2 mots côte à côte plutôt
                qu'empilés en pleine largeur. */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyCredentialField('both', `${generatedCredentials.username} / ${generatedCredentials.password}`)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
              >
                {copiedField === 'both' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copier tout
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setGeneratedCredentials(null); setCopiedField(null); }}
                className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold"
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
