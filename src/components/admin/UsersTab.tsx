/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Neuvième et dernière étape du refactor par onglet d'AdminConfigView.tsx
 * (voir les PR précédentes #90-#97 pour le contexte général et les étapes
 * déjà faites — après celle-ci, les 8 onglets d'AdminConfigView sont tous
 * extraits). Extraction de l'onglet "Utilisateurs" (table CRUD + modale
 * Ajouter/Modifier + modale d'affichage unique des identifiants générés)
 * hors du composant monolithique, sans aucun changement de comportement.
 *
 * Code strictement déplacé, pas réécrit : mêmes state/handlers/JSX que les
 * anciens blocs `{configTab === 'users' && (...)}`, `{showUserModal &&
 * (...)}` et `{generatedCredentials && (...)}`. `users`/`entities`/
 * `countries` (lus depuis storage.ts par AdminConfigView) et `activeUser`
 * deviennent des props ; `flashBanner` devient la prop `onSaved`.
 * `slugify`, défini une seule fois dans AdminConfigView et déjà partagé
 * avec les onglets Entités/Gouvernance/Catégories, est passé en prop plutôt
 * que dupliqué.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Copy, CheckCircle2, Cloud, HardDrive } from 'lucide-react';
import { Language, UserProfile, UserRole } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { EntityDef, CountryDef, formatCountryLabel } from '../../data/activaConfig';
import { storage } from '../../services/storage';
// === AMÉLIORATION AJOUTÉE (création de comptes — mot de passe temporaire) ===
// Même module que le code d'accès du lanceur d'alerte (AlertSubmissionFlow.tsx).
import { generateAccessPassword, generateSalt, hashPassword } from '../../services/crypto';
// === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
// enregistrés dans Firebase) === quand l'administrateur connecté est un
// compte Firebase ayant `users.manage`, les comptes sont créés et gérés dans
// Firebase (Auth + Firestore) via les Cloud Functions ; sinon, comportement
// local inchangé.
import {
  canManageFirebaseStaffAccounts,
  createFirebaseStaffAccount,
  deleteFirebaseStaffAccount,
  isStaffAuthConfigured,
  resetFirebaseStaffAccountPassword,
  staffErrorCode,
  syncStaffDirectory,
  updateFirebaseStaffAccount,
} from '../../services/staffAccountsClient';

interface UsersTabProps {
  users: UserProfile[];
  entities: EntityDef[];
  countries: CountryDef[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  slugify: (name: string) => string;
  lang?: Language;
}

export const UsersTab: React.FC<UsersTabProps> = ({ users, entities, countries, activeUser, onSaved, slugify, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
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

  // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
  // `cloudMode` : vrai si Firebase est configuré ET que l'administrateur est
  // connecté à Firebase avec la permission `users.manage`. `null` pendant la
  // vérification. L'annuaire Firebase est rechargé à l'ouverture de l'onglet.
  const firebaseConfigured = isStaffAuthConfigured();
  const [cloudMode, setCloudMode] = useState<boolean | null>(firebaseConfigured ? null : false);
  useEffect(() => {
    if (!firebaseConfigured) return;
    let cancelled = false;
    canManageFirebaseStaffAccounts().then((ok) => {
      if (cancelled) return;
      setCloudMode(ok);
      if (ok) syncStaffDirectory().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseConfigured]);

  // La liste suit les changements de storage.ts (annuaire Firebase rechargé
  // en arrière-plan) : sans cela, elle ne s'actualiserait qu'au prochain
  // rendu du parent. Avant tout changement, c'est la prop `users`, inchangée.
  const [directoryTick, setDirectoryTick] = useState(0);
  useEffect(() => storage.subscribe(() => setDirectoryTick((n) => n + 1)), []);
  const listedUsers = directoryTick === 0 ? users : storage.getUsers();

  // Message d'erreur lisible pour une Cloud Function de gestion des comptes.
  const cloudErrorMessage = (e: unknown, username: string): string => {
    const code = staffErrorCode(e);
    if (code === 'functions/already-exists') return t.users_username_taken.replace('{username}', username);
    if (code === 'functions/failed-precondition') return t.users_cloud_precondition;
    if (code === 'functions/permission-denied') return t.users_cloud_admin_required;
    return t.users_cloud_error;
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
  // Suggestion à partir du nom saisi (même schéma que `slugify`, réutilisé),
  // jamais imposée — l'admin reste libre de la modifier avant d'enregistrer.
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
      alert(t.users_username_taken.replace('{username}', normalizedUsername));
      return;
    }
    setIsSavingUser(true);
    // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
    const editingUser = editingUserId ? storage.getUsers().find((u) => u.id === editingUserId) : undefined;
    const editingFirebaseUser = editingUser?.authSource === 'firebase';
    if (editingFirebaseUser || (!editingUserId && cloudMode)) {
      if (editingFirebaseUser && !cloudMode) {
        alert(t.users_cloud_admin_required);
        setIsSavingUser(false);
        return;
      }
      const account = {
        name: userName.trim(),
        email: userEmail.trim(),
        username: normalizedUsername,
        role: userRole,
        roleTitle: userRoleTitle.trim(),
        entity: userEntity.trim(),
        country: userCountry.trim(),
      };
      try {
        if (editingUserId) {
          await updateFirebaseStaffAccount(editingUserId, account);
          await syncStaffDirectory();
          storage.logAudit('CONFIG_UPDATED', `Profil utilisateur "${account.name}" mis à jour dans Firebase par ${activeUser.name}.`, undefined, activeUser);
          onSaved(t.users_updated.replace('{name}', account.name));
          setShowUserModal(false);
        } else {
          const { tempPassword } = await createFirebaseStaffAccount(account);
          await syncStaffDirectory();
          storage.logAudit('CONFIG_UPDATED', `Compte utilisateur "${account.name}" (${account.role}) créé dans Firebase par ${activeUser.name}.`, undefined, activeUser);
          onSaved(t.users_created.replace('{name}', account.name));
          setShowUserModal(false);
          setGeneratedCredentials({ name: account.name, username: normalizedUsername, password: tempPassword });
        }
      } catch (err) {
        alert(cloudErrorMessage(err, normalizedUsername));
      }
      setIsSavingUser(false);
      return;
    }
    if (editingUserId) {
      storage.updateUser(
        editingUserId,
        { name: userName.trim(), email: userEmail.trim(), username: normalizedUsername, role: userRole, roleTitle: userRoleTitle.trim(), entity: userEntity.trim(), country: userCountry.trim() },
        activeUser
      );
      onSaved(t.users_updated.replace('{name}', userName.trim()));
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
      onSaved(t.users_created.replace('{name}', userName.trim()));
      setShowUserModal(false);
      setGeneratedCredentials({ name: userName.trim(), username: normalizedUsername, password: tempPassword });
    }
    setIsSavingUser(false);
  };
  const handleDeleteUser = (u: UserProfile) => {
    if (u.id === activeUser.id) {
      alert(t.users_cannot_delete_self);
      setDeleteUserConfirmId(null);
      return;
    }
    // === AMÉLIORATION AJOUTÉE : garde-fou anti-verrouillage total ===
    // Empêche de supprimer le dernier compte "Administrateur système" actif :
    // sans cela, la plateforme se retrouve sans aucun admin capable de créer
    // ou réinitialiser des comptes (verrouillage complet côté client, sans
    // recours puisqu'il n'y a pas de backend distant pour restaurer un accès).
    // === AMÉLIORATION AJOUTÉE (correctif) === `active` absent signifie
    // « actif » (types.ts, UserProfile.active) : `!== false` au lieu d'un
    // test de vérité, sinon un autre administrateur bien actif mais sans ce
    // champ n'était pas compté et la suppression était refusée à tort.
    if (u.role === 'system_admin' && u.active !== false) {
      const remainingActiveAdmins = storage
        .getUsers()
        .filter((other) => other.id !== u.id && other.role === 'system_admin' && other.active !== false).length;
      if (remainingActiveAdmins === 0) {
        alert(t.users_last_admin);
        setDeleteUserConfirmId(null);
        return;
      }
    }
    // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
    if (u.authSource === 'firebase') {
      setDeleteUserConfirmId(null);
      if (!cloudMode) {
        alert(t.users_cloud_admin_required);
        return;
      }
      deleteFirebaseStaffAccount(u.id)
        .then(() => syncStaffDirectory())
        .then(() => {
          storage.logAudit('CONFIG_UPDATED', `Compte utilisateur "${u.name}" (${u.email}) supprimé de Firebase par ${activeUser.name}.`, undefined, activeUser);
          onSaved(t.users_deleted.replace('{name}', u.name));
        })
        .catch((err) => alert(cloudErrorMessage(err, u.username)));
      return;
    }
    storage.deleteUser(u.id, activeUser);
    setDeleteUserConfirmId(null);
    onSaved(t.users_deleted.replace('{name}', u.name));
  };

  // === AMÉLIORATION AJOUTÉE (régénération du mot de passe temporaire) ===
  // Recours nécessaire si le mot de passe temporaire expire (4h, voir
  // storage.ts) avant que l'utilisateur ne se soit connecté — sans cette
  // action, un tel compte resterait bloqué sans recours.
  const handleResetPassword = async (u: UserProfile) => {
    // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
    if (u.authSource === 'firebase') {
      setResetPasswordConfirmId(null);
      if (!cloudMode) {
        alert(t.users_cloud_admin_required);
        return;
      }
      try {
        const tempPassword = await resetFirebaseStaffAccountPassword(u.id);
        await syncStaffDirectory();
        storage.logAudit('CONFIG_UPDATED', `Mot de passe temporaire régénéré dans Firebase pour "${u.name}" par ${activeUser.name}.`, undefined, activeUser);
        setGeneratedCredentials({ name: u.name, username: u.username, password: tempPassword });
      } catch (err) {
        alert(cloudErrorMessage(err, u.username));
      }
      return;
    }
    const newPassword = await storage.resetUserPassword(u.id, activeUser);
    setResetPasswordConfirmId(null);
    setGeneratedCredentials({ name: u.name, username: u.username, password: newPassword });
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {t.users_title}
            </h3>
          </div>
          <button
            onClick={openAddUser}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> {t.users_add_account}
          </button>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
            Indique où les comptes créés ici sont enregistrés. */}
        {firebaseConfigured && cloudMode !== null && (
          <p
            id="users-storage-notice"
            className={`flex items-start gap-2 rounded-lg border p-2.5 leading-relaxed ${
              cloudMode ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {cloudMode ? <Cloud className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <HardDrive className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            {cloudMode ? t.users_cloud_enabled : t.users_cloud_local_only}
          </p>
        )}

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {listedUsers.map((u) => (
            <div key={u.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {u.name}
                  {/* === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) === */}
                  {firebaseConfigured && (
                    <span
                      className={`ml-2 align-middle px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        u.authSource === 'firebase' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.authSource === 'firebase' ? t.users_badge_firebase : t.users_badge_local}
                    </span>
                  )}
                </div>
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
                <button onClick={() => openEditUser(u)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title={t.btn_modify}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {/* === AMÉLIORATION AJOUTÉE (régénération du mot de passe
                    temporaire) === recours si le mot de passe temporaire
                    a expiré (4h) avant la première connexion, ou si sa
                    transmission a échoué. */}
                {resetPasswordConfirmId === u.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleResetPassword(u)} className="px-1.5 py-1 rounded bg-amber-600 text-white font-bold text-[10px]">{t.common_confirm}</button>
                    <button onClick={() => setResetPasswordConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">{t.btn_cancel}</button>
                  </div>
                ) : (
                  <button onClick={() => setResetPasswordConfirmId(u.id)} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700" title={t.users_regen_password}>
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}
                {deleteUserConfirmId === u.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDeleteUser(u)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">{t.common_confirm}</button>
                    <button onClick={() => setDeleteUserConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">{t.btn_cancel}</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteUserConfirmId(u.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title={t.common_delete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: ADD/EDIT USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUserId ? t.users_edit_account : t.users_add_account}
              </h3>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.users_full_name}</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.users_email}</label>
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">{t.users_username}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.users_username_ph}) */
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                      required
                    />
                    <button type="button" onClick={suggestUsername} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold whitespace-nowrap">
                      {t.users_suggest}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{t.users_username_hint}</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.users_role}</label>
                  {/* === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du
                      modèle de rôles) === les 10 rôles réels de l'application
                      (auparavant 4 options ne couvrant que l'ancien modèle à
                      5 valeurs — "Lanceur d'alerte" n'y figurait jamais non
                      plus, un compte créé ici étant toujours un compte
                      collaborateur). */}
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value as UserRole)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="investigator">{t.users_role_investigator}</option>
                    <option value="senior_investigator">{t.users_role_senior_investigator}</option>
                    <option value="functional_admin">{t.users_role_functional_admin}</option>
                    <option value="darc_compliance">{t.role_badge_darc_compliance}</option>
                    <option value="consultation">{t.role_badge_consultation}</option>
                    <option value="executive">{t.role_badge_executive}</option>
                    <option value="system_admin">{t.users_role_system_admin}</option>
                    <option value="security_admin">{t.users_role_security_admin}</option>
                    <option value="audit_committee">{t.role_badge_audit_committee}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.users_job_title}</label>
                  <input type="text" value={userRoleTitle} onChange={(e) => setUserRoleTitle(e.target.value)} /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.users_job_title_ph}) */ className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.op_col_entity}</label>
                  <select value={userEntity} onChange={(e) => setUserEntity(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">{t.users_all_entities}</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.op_col_country}</label>
                  <select value={userCountry} onChange={(e) => setUserCountry(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">{t.users_group_activa}</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowUserModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" disabled={isSavingUser} className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-60 text-white font-bold">
                  {isSavingUser ? t.users_saving : editingUserId ? t.users_save : t.users_add}
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
                <h3 className="text-sm font-bold text-slate-900">{t.users_temp_creds_title}</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">{t.users_for_name.replace('{name}', generatedCredentials.name)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t.login_username}</div>
                  <div className="font-mono text-sm text-slate-900 truncate">{generatedCredentials.username}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCredentialField('username', generatedCredentials.username)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                  title={t.users_copy_username}
                >
                  {copiedField === 'username' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t.users_temp_password}</div>
                  <div className="font-mono font-bold text-sm text-slate-900 tracking-wider truncate">{generatedCredentials.password}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCredentialField('password', generatedCredentials.password)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                  title={t.users_copy_password}
                >
                  {copiedField === 'password' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
              {t.users_temp_password_note}
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {t.users_copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> {t.users_copy_all}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setGeneratedCredentials(null); setCopiedField(null); }}
                className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold"
              >
                {t.users_done}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
