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
import { UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { Permission } from '../../domain/permissions';
import { RoleId } from '../../domain/caseTypes';

interface RolesPermissionsTabProps {
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
}

export const RolesPermissionsTab: React.FC<RolesPermissionsTabProps> = ({ activeUser, onSaved }) => {
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
    onSaved(changedCount > 0 ? `Permissions mises à jour pour ${changedCount} rôle(s).` : 'Aucune modification à enregistrer.');
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
  );
};
