/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.2 — routage par URL) ===
 *
 * Table unique tab-key ↔ URL, façon brief section 30. Choix d'architecture
 * délibéré : plutôt que de réécrire chaque écran existant en éléments
 * <Route> imbriqués (gros risque de régression sur ~15 écrans qui
 * fonctionnent déjà), App.tsx garde son mécanisme interne `currentTab` /
 * `setCurrentTab` strictement inchangé pour tous les composants enfants
 * (Navbar, StaffPortalLayout, chaque écran) — seule la SOURCE DE VÉRITÉ de
 * `currentTab` change : elle vient désormais de l'URL réelle
 * (`useLocation`) plutôt que d'un `useState` local, et `setCurrentTab`
 * appelle réellement `navigate()`. Résultat : vraies URLs, bouton
 * précédent/suivant du navigateur, rechargement de page qui préserve
 * l'écran, liens de dossier partageables — sans toucher un seul composant
 * d'écran existant.
 */

export const TAB_TO_PATH: Record<string, string> = {
  home: '/',
  new_alert: '/report',
  track: '/track',
  // === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de l'accueil) ===
  // Redevient un vrai onglet public avec sa propre URL, au lieu d'une simple
  // ancre de défilement sur la page d'accueil — voir FaqView.tsx.
  faq: '/faq',
  // === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
  // Même logique que /faq juste au-dessus : vrai onglet avec sa propre URL,
  // voir ContactView.tsx.
  contact: '/contact',
  firebase_lookup: '/lookup',
  login: '/login',
  control_panel: '/dashboard',
  portal: '/cases',
  triage: '/cases/triage',
  assignment: '/cases/assignment',
  my_cases: '/cases/mine',
  investigations: '/investigation',
  tasks: '/investigation/tasks',
  evidence: '/investigation/evidence',
  communications: '/investigation/communications',
  corrective_actions: '/investigation/corrective-actions',
  reports: '/reports',
  executive: '/executive',
  audit: '/audit-log',
  settings: '/admin',
  admin_users: '/admin/users',
  admin_config: '/admin/categories',
  // === AMÉLIORATION AJOUTÉE (Phase 6 — évolution multi-pays/multi-entité) ===
  // BUG PRÉEXISTANT CORRIGÉ : `admin_roles` (bouton "Rôles & Permissions" de
  // la barre latérale, StaffPortalLayout.tsx) n'avait jamais eu d'entrée
  // ici. `pathForTab('admin_roles')` retombait donc sur `'/'` (repli), ce
  // qui renvoyait silencieusement l'utilisateur admin vers la page
  // d'accueil publique au lieu de l'écran Rôles & Permissions — vérifié en
  // direct avant correction. Découvert en travaillant sur ce fichier pour
  // la présente phase, corrigé ici plutôt que laissé de côté.
  admin_roles: '/admin/roles',

  // === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
  // Nouveaux préfixes d'URL additifs (brief section 25) — chaque nouvelle
  // route réutilise un écran déjà réel et fonctionnel (voir App.tsx
  // renderStaffContent), avec un `initialFilter` préréglé différent,
  // exactement comme triage/assignment/my_cases le font déjà depuis la
  // Phase 9. Aucune route existante ci-dessus n'est retirée ni renommée.
  op_dashboard: '/operator/dashboard',
  op_inbox: '/operator/inbox',
  op_pending_info: '/operator/pending-information',
  op_assign: '/operator/assign',
  op_processed: '/operator/processed',
  op_search: '/operator/search',
  op_reports: '/operator/reports',
  op_communications: '/operator/communications',

  inv_dashboard: '/investigator/dashboard',
  inv_my_cases: '/investigator/cases',
  inv_to_process: '/investigator/to-process',
  inv_in_progress: '/investigator/in-progress',
  inv_pending: '/investigator/pending',
  inv_tasks: '/investigator/tasks',
  inv_evidence: '/investigator/evidence',
  inv_communications: '/investigator/communications',
  inv_reports: '/investigator/reports',
  inv_search: '/investigator/search',

  admin_audit: '/admin/audit',
  admin_reports: '/admin/reports',
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  admin_organization: '/admin/organization',
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  admin_governance: '/admin/governance',
  // === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
  // Nouvelle entrée de barre latérale, partagée (pas spécifique à un
  // espace) — voir StaffPortalLayout.tsx. `op_search`/`inv_search`
  // (Phase 6) gardent leurs propres URLs, déjà existantes, également
  // reliées au nouvel écran AdvancedSearchView.tsx (App.tsx).
  advanced_search: '/search/advanced',
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  admin_workflow: '/admin/workflow',
};

const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab])
);

// Sub-paths of /cases/* that are NOT a tracking-number deep link — kept in
// sync with TAB_TO_PATH above (their own path already appears there).
const CASES_STATIC_SUBPATHS = new Set(['triage', 'assignment', 'mine']);

export interface ResolvedRoute {
  tab: string;
  /** Present only for a genuine /cases/:trackingNumber deep link. */
  trackingNumber?: string;
}

/** Pure function: URL pathname → { tab, trackingNumber? }. Never touches the DOM/router itself. */
export function resolveRoute(pathname: string): ResolvedRoute {
  const known = PATH_TO_TAB[pathname];
  if (known) return { tab: known };

  const caseMatch = pathname.match(/^\/cases\/([^/]+)\/?$/);
  if (caseMatch && !CASES_STATIC_SUBPATHS.has(caseMatch[1])) {
    return { tab: 'portal', trackingNumber: decodeURIComponent(caseMatch[1]) };
  }

  // Unknown path (including /how-it-works — same page as home, see
  // WhistleblowerHome's #how-it-works-section anchor) falls back to the
  // public homepage rather than a blank screen — never a dead link.
  return { tab: 'home' };
}

export function pathForTab(tab: string): string {
  return TAB_TO_PATH[tab] ?? '/';
}
