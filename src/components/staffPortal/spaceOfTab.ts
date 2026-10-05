/**
 * === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par
 * section) ===
 *
 * `ADMIN_TABS` et `spaceOfTab` déplacés tels quels depuis
 * StaffPortalLayout.tsx (fonction pure, sans état). Aucun changement de
 * comportement.
 */
import type { SpaceKey } from '../../domain/staffSpaces';

// === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de données"
// retiré) === 'admin_database' retiré de cette liste, sur demande explicite
// de l'utilisateur (voir aussi routing/routes.ts et App.tsx). `admin_workflow`
// retiré ici en fusionnant avec `main`, qui n'a jamais extrait de composant
// d'onglet Workflow lors de son propre refactor d'AdminConfigView.tsx (voir
// App.tsx) — le backend (`storage.getWorkflowTransitions`/
// `updateWorkflowTransitions`) reste intact, seule cette entrée de menu vers
// un écran qui n'existe plus dans la nouvelle structure disparaît.
export const ADMIN_TABS =['settings', 'admin_users', 'admin_roles', 'admin_config', 'admin_audit', 'admin_reports', 'admin_organization', 'admin_governance', 'admin_entities', 'admin_categories', 'admin_notifications'];

// Dérive l'espace concerné par un `currentTab` donné — `null` pour un onglet
// "partagé" (Dossiers, Recherche, Rapports, registres...) qui n'appartient à
// aucun espace en particulier, pour ne JAMAIS faire changer l'espace
// visuellement sélectionné quand on clique dessus (voir l'effet plus bas).
export function spaceOfTab(tab: string): SpaceKey | null {
  if (tab.startsWith('op_')) return 'operator';
  if (tab.startsWith('inv_')) return 'investigator';
  if (ADMIN_TABS.includes(tab)) return 'admin';
  return null;
}
