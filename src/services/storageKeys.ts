/**
 * === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
 *
 * Clés localStorage et nom de l'événement de changement de données,
 * déplacés tels quels depuis storage.ts (mêmes valeurs, aucune clé
 * renommée — les données déjà stockées dans les navigateurs restent lues à
 * l'identique). Désormais exportés : les tests (ex.
 * storage.staffAccounts.test.ts) peuvent s'y référer au lieu de recopier
 * les clés littérales.
 */
export const STORAGE_KEYS = {
  ALERTS: 'activa_ethicalert_records_v1',
  AUDIT_LOGS: 'activa_ethicalert_audit_v1',
  USERS: 'activa_ethicalert_users_v1',
  ACTIVE_USER: 'activa_ethicalert_active_user_v1',
  DRAFT: 'activa_ethicalert_draft_v1',
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  ENTITIES: 'activa_ethicalert_entities_v1',
  CATEGORIES: 'activa_ethicalert_categories_v1',
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  COUNTRIES: 'activa_ethicalert_countries_v1',
  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
  SLA_CONFIG: 'activa_ethicalert_sla_config_v1',
  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  HIERARCHY_LEVELS: 'activa_ethicalert_hierarchy_levels_v1',
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  ROLE_PERMISSIONS: 'activa_ethicalert_role_permissions_v1',
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  WORKFLOW_TRANSITIONS: 'activa_ethicalert_workflow_transitions_v1',
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
  ESCALATION_RECIPIENTS: 'activa_ethicalert_escalation_recipients_v1',
  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  CASE_NUMBER_COUNTERS: 'activa_ethicalert_case_number_counters_v1',
  // === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
  EMAIL_NOTIFICATIONS: 'activa_ethicalert_email_notifications_v1',
};

// Event dispatched when data changes
export const DATA_CHANGE_EVENT = 'activa_storage_updated';
