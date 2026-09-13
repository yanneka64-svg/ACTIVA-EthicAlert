// === AMÉLIORATION AJOUTÉE (Phase 9/10 — restructuration de la navigation) ===
// Liste unique des clés d'onglet couvertes par la barre latérale
// StaffPortalLayout — extraite dans son propre module (plutôt que dans
// App.tsx) pour que Navbar.tsx puisse la réutiliser sans créer
// d'import circulaire avec App.tsx (qui importe Navbar). Toute clé ajoutée
// ici doit rester synchronisée avec `StaffPortalLayout.tsx`'s `navItems`
// et `App.tsx`'s `renderStaffContent()`.
export const STAFF_TAB_KEYS = [
  'control_panel',
  'portal',
  'triage',
  'assignment',
  'my_cases',
  'investigations',
  'tasks',
  'evidence',
  'communications',
  'corrective_actions',
  'reports',
  'executive',
  'audit',
  'settings',
  'admin_users',
  'admin_config',
];
