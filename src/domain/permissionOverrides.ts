// === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
//
// Jusqu'ici, l'onglet "Rôles & Permissions" de l'administration
// (AdminConfigView.tsx) n'était qu'un AFFICHAGE en lecture seule de la
// table `ROLE_PERMISSIONS` codée en dur dans domain/permissions.ts —
// aucune façon de la modifier sans changer le code source. Ce module rend
// cette table réellement éditable en administration, SANS toucher à
// `ROLE_PERMISSIONS`/`roleHasPermission` eux-mêmes (domain/permissions.ts
// reste inchangé : toujours la table par défaut, toujours utilisée telle
// quelle par domain/permissions.test.ts et par le modèle Firestore dormant
// `can()`/`data-access/caseRepository.ts`).
//
// Contrainte d'architecture qui justifie ce module séparé plutôt qu'un
// import direct : `services/storage.ts` (qui doit PERSISTER la table
// éditée) importe déjà, directement ou indirectement,
// `services/authz.ts` (via statusMapping.ts et domain/independentRouting.ts).
// Si `authz.userCan()` importait `storage.ts` pour lire la table éditée,
// cela créerait un cycle storage → authz → storage. Ce petit module joue
// le rôle de pont : un registre mutable EN MÉMOIRE, sans dépendance vers
// storage.ts ni authz.ts, que storage.ts alimente (au démarrage et à
// chaque modification) et qu'authz.ts consulte — même principe que la
// séparation domain/routingConflicts.ts déjà utilisée pour éviter un cycle
// équivalent entre assignmentEngine.ts et independentRouting.ts.
//
// `getEffectiveRolePermissions()` retombe sur `ROLE_PERMISSIONS` par
// défaut tant que storage.ts n'a rien poussé (ex. tests qui n'initialisent
// jamais le singleton `storage`) — comportement strictement identique à
// avant cette amélioration pour quiconque n'édite jamais cette table.

import { RoleId } from './caseTypes';
import { Permission, ROLE_PERMISSIONS } from './permissions';

let overrides: Record<RoleId, Permission[]> | null = null;

/** Appelé par storage.ts — jamais directement par un écran. */
export function setRolePermissionOverrides(next: Record<RoleId, Permission[]>): void {
  overrides = next;
}

export function getEffectiveRolePermissions(): Record<RoleId, Permission[]> {
  return overrides ?? ROLE_PERMISSIONS;
}

export function roleHasEffectivePermission(role: RoleId, permission: Permission): boolean {
  return getEffectiveRolePermissions()[role]?.includes(permission) ?? false;
}
