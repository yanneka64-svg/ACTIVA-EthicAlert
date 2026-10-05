/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Deuxième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx
 * (voir la PR précédente pour la première étape et le contexte général) :
 * extraction du contenu de l'onglet "Rôles & permissions" hors du composant
 * monolithique AdminConfigView.tsx (2159 lignes, aucun découpage interne),
 * sans aucun changement de comportement. Choisi en premier car c'est
 * l'onglet le plus autonome — aucune modale, état déjà entièrement local à
 * cet onglet (vérifié par grep : aucun des identifiants déplacés ici
 * n'était référencé ailleurs dans AdminConfigView.tsx).
 *
 * Code strictement déplacé, pas réécrit : mêmes state/constantes/handlers/
 * JSX que l'ancien bloc `{configTab === 'roles' && (...)}`, seule
 * `flashBanner` devient la prop `onSaved` (déjà appelée exactement de la
 * même façon par AdminConfigView, qui garde `saveBanner`/`flashBanner` —
 * partagé avec les ~20 autres actions CRUD de cet écran).
 */
import React, { useState } from 'react';
import { ShieldCheck, ChevronRight, ChevronDown } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (écran aéré) ===
import { Check, Columns3, Lock, UserCog } from 'lucide-react';
import { SaveBar, SegmentedTabs, Switch } from '../ui/AdminControls';
import { Language, UserProfile } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { storage } from '../../services/storage';
import { Permission } from '../../domain/permissions';
import { RoleId } from '../../domain/caseTypes';

interface RolesPermissionsTabProps {
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  lang?: Language;
}

export const RolesPermissionsTab: React.FC<RolesPermissionsTabProps> = ({ activeUser, onSaved, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  // --- Role permissions state --- même motif seed-then-edit-then-save que
  // la configuration SLA/gouvernance d'AdminConfigView. `rolePermissionsDraft`
  // est une copie locale éditée par cases à cocher ; seul un clic sur
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
  // === AMÉLIORATION AJOUTÉE (écran aéré) === vue « un rôle à la fois »
  // (interrupteurs par permission) ou vue comparative (matrice).
  const [rolesView, setRolesView] = useState<'role' | 'compare'>('role');
  const [selectedRole, setSelectedRole] = useState<RoleId>('investigator');
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
  // la suppression de son propre compte (handleDeleteUser d'AdminConfigView)
  // : sans configuration.manage, PERSONNE ne peut plus revenir ici pour la
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
    onSaved(changedCount > 0 ? t.roles_saved.replace('{n}', String(changedCount)) : t.roles_no_change);
  };

  // === AMÉLIORATION AJOUTÉE (écran aéré) === modifications non enregistrées
  const savedRolePermissions = storage.getRolePermissions();
  const rolesDirty = Object.keys(rolePermissionsDraft).some((r) => {
    const a = [...(savedRolePermissions[r as RoleId] ?? [])].sort().join('|');
    const b = [...(rolePermissionsDraft[r as RoleId] ?? [])].sort().join('|');
    return a !== b;
  });

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
  const ROLE_ID_LABELS: Record<RoleId, string> = {
    reporter: t.role_badge_reporter,
    investigator: t.users_role_investigator,
    senior_investigator: t.users_role_senior_investigator,
    functional_admin: t.users_role_functional_admin,
    darc_compliance: t.role_badge_darc_compliance,
    consultation: t.roles_consultation,
    system_admin: t.users_role_system_admin,
    security_admin: t.users_role_security_admin,
    audit_committee: t.roles_audit_committee,
    executive: t.role_badge_executive,
  };
  const PERMISSION_GROUPS: { group: string; permissions: { key: Permission; label: string }[] }[] = [
    {
      group: t.roles_group_cases,
      permissions: [
        { key: 'cases.read', label: t.perm_cases_read },
        { key: 'cases.create', label: t.perm_cases_create },
        { key: 'cases.assign', label: t.perm_cases_assign },
        { key: 'cases.reassign', label: t.perm_cases_reassign },
        { key: 'cases.edit', label: t.perm_cases_edit },
        { key: 'cases.close', label: t.perm_cases_close },
        { key: 'cases.reopen', label: t.perm_cases_reopen },
        { key: 'cases.archive', label: t.perm_cases_archive },
        { key: 'cases.export', label: t.perm_cases_export },
      ],
    },
    {
      group: t.roles_group_evidence,
      permissions: [
        { key: 'evidence.read', label: t.perm_evidence_read },
        { key: 'evidence.upload', label: t.perm_evidence_upload },
        { key: 'evidence.delete', label: t.perm_evidence_delete },
      ],
    },
    {
      group: t.roles_group_communications,
      permissions: [
        { key: 'communications.read', label: t.perm_comms_read },
        { key: 'communications.send', label: t.perm_comms_send },
      ],
    },
    {
      group: t.roles_group_reports,
      permissions: [
        { key: 'reports.read', label: t.perm_reports_read },
        { key: 'reports.export', label: t.perm_reports_export },
      ],
    },
    {
      group: t.roles_group_admin,
      permissions: [
        { key: 'configuration.manage', label: t.perm_config_manage },
        { key: 'users.manage', label: t.perm_users_manage },
        { key: 'audit.read', label: t.perm_audit_read },
        // === AMÉLIORATION AJOUTÉE (Phase 12 — RBAC étendu) ===
        { key: 'security.manage', label: t.perm_security_manage },
      ],
    },
  ];

  return (
    <form onSubmit={handleSaveRolePermissions} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            {t.roles_matrix_title}
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
        {/* === AMÉLIORATION AJOUTÉE (écran aéré) === deux vues ; l'enregistrement
            passe par la barre collante en bas (même action « submit »). */}
        <SegmentedTabs<'role' | 'compare'>
          idPrefix="roles-view"
          value={rolesView}
          onChange={setRolesView}
          tabs={[
            { key: 'role', label: t.roles_view_by_role || 'Par rôle', icon: <UserCog className="w-3.5 h-3.5" /> },
            { key: 'compare', label: t.roles_view_compare || 'Vue comparative', icon: <Columns3 className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      {rolesView === 'role' && (
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-4 items-start">
          <nav className="activa-enter rounded-2xl border border-slate-200 bg-slate-50/50 p-1.5 space-y-0.5" aria-label={t.roles_matrix_title}>
            {ALL_ROLE_IDS.map((r) => {
              const active = r === selectedRole;
              const n = (rolePermissionsDraft[r] ?? []).length;
              const total = PERMISSION_GROUPS.reduce((acc, g) => acc + g.permissions.length, 0);
              return (
                <button
                  key={r}
                  type="button"
                  id={`role-pick-${r}`}
                  onClick={() => setSelectedRole(r)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-300 ${
                    active ? 'bg-white shadow-sm ring-1 ring-blue-200 text-blue-800' : 'text-slate-700 hover:bg-white/70'
                  }`}
                >
                  <span className="font-semibold truncate">{ROLE_ID_LABELS[r]}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${active ? 'bg-blue-600 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
                    {n}/{total}
                  </span>
                </button>
              );
            })}
          </nav>
          <div key={selectedRole} className="activa-enter grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {PERMISSION_GROUPS.map((g) => (
              <section key={g.group} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <h4 className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g.group}</h4>
                <ul className="divide-y divide-slate-100">
                  {g.permissions.map((p) => {
                    const protectedCell = isProtectedPermissionCell(selectedRole, p.key);
                    const checked = (rolePermissionsDraft[selectedRole] ?? []).includes(p.key);
                    return (
                      <li key={p.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className={`font-medium ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{p.label}</span>
                        {protectedCell ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400" title={t.roles_protected}>
                            <Lock className="w-3 h-3" />
                            {t.roles_protected_short || 'Protégé'}
                          </span>
                        ) : (
                          <Switch
                            id={`perm-${selectedRole}-${p.key.replace('.', '-')}`}
                            checked={checked}
                            onChange={() => toggleRolePermissionDraft(selectedRole, p.key)}
                            label={undefined}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {rolesView === 'compare' && (
      <div className="activa-enter overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="p-2 text-left sticky left-0 bg-slate-50 z-10"></th>
              {ALL_ROLE_IDS.map((r) => (
                <th key={r} className="p-2.5 text-center font-bold text-slate-600 bg-slate-50 text-[10px] uppercase tracking-wide align-bottom">
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
                            title={protectedCell ? t.roles_protected : undefined}
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
      )}

      {/* === AMÉLIORATION AJOUTÉE (écran aéré) === */}
      <SaveBar
        type="submit"
        dirty={rolesDirty}
        onSave={() => undefined}
        saveLabel={t.roles_save}
      />
    </form>
  );
};
