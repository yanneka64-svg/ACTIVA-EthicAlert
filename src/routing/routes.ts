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
