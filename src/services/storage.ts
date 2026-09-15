import { AlertRecord, AuditLogEntry, CaseInterview, CaseTask, ConflictDeclaration, UserProfile, UserRole, EscalationRecipient } from '../types';
import { INITIAL_ALERTS, INITIAL_AUDIT_LOGS, INITIAL_USERS, ACTIVA_ENTITIES, ALERT_CATEGORIES, ACTIVA_COUNTRIES, EntityDef, CategoryDef, CountryDef, SlaConfig, DEFAULT_SLA_CONFIG, HierarchyLevels, DEFAULT_HIERARCHY_LEVELS, INITIAL_ESCALATION_RECIPIENTS } from '../data/activaConfig';
import { saveAlertToCloud, saveAuditLogToCloud } from './firebase';
// === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
import { CaseStatus } from '../domain/caseTypes';
import { checkTransition, TransitionCheckResult, ALLOWED_TRANSITIONS, setWorkflowTransitions } from '../domain/workflow';
import { deriveCaseStatus, syncLegacyStatus } from './statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
import { getConflictedUserIds, resolveIndependentAuthority } from '../domain/independentRouting';
// === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
// routage — correctif confidentialité) === authz.ts n'importe jamais
// storage.ts (vérifié), donc aucun cycle en important cette seule
// fonction pure ici.
import { canSeeAlertConfidentiality } from './authz';
// === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
import { Permission, ROLE_PERMISSIONS } from '../domain/permissions';
import { setRolePermissionOverrides } from '../domain/permissionOverrides';

const STORAGE_KEYS = {
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
};

// Event dispatched when data changes
const DATA_CHANGE_EVENT = 'activa_storage_updated';

class StorageService {
  private alerts: AlertRecord[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private users: UserProfile[] = [];
  private activeUser: UserProfile = INITIAL_USERS[0]; // Default to B.Y. Ekani (Point de Contact)
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  // Mutable, persisted copies of the entity/category config, seeded from
  // the static ACTIVA_ENTITIES/ALERT_CATEGORIES constants exactly like
  // `users` is already seeded from INITIAL_USERS above — same pattern,
  // just extended to the two other config domains the Administration
  // screen edits.
  private entities: EntityDef[] = [];
  private categories: CategoryDef[] = [];
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // Même motif seed-then-mutate que entities/categories ci-dessus.
  private countries: CountryDef[] = [];
  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
  private slaConfig: SlaConfig = DEFAULT_SLA_CONFIG;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  // Même motif seed-then-mutate que slaConfig ci-dessus.
  private hierarchyLevels: HierarchyLevels = DEFAULT_HIERARCHY_LEVELS;
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  // Copie mutable, persistée, de la table ROLE_PERMISSIONS
  // (domain/permissions.ts) — même motif seed-then-mutate que
  // hierarchyLevels/slaConfig ci-dessus. `domain/permissions.ts` lui-même
  // n'est JAMAIS modifié : il reste la table PAR DÉFAUT (utilisée telle
  // quelle par domain/permissions.test.ts et par le modèle Firestore
  // dormant). Poussée dans domain/permissionOverrides.ts à chaque
  // changement, pour qu'authz.userCan() (donc toute l'application) reflète
  // immédiatement une édition en administration.
  private rolePermissions: Record<UserRole, Permission[]> = ROLE_PERMISSIONS;
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  // Copie mutable, persistée, de la table ALLOWED_TRANSITIONS
  // (domain/workflow.ts) — même motif seed-then-mutate que rolePermissions
  // ci-dessus. `ALLOWED_TRANSITIONS` reste la table PAR DÉFAUT, utilisée
  // telle quelle par domain/workflow.test.ts. Poussée dans
  // domain/workflow.ts (setWorkflowTransitions) à chaque changement, pour
  // que checkTransition() — donc storage.transitionStatus()/escalateAlert()
  // — reflète immédiatement une édition en administration.
  private workflowTransitions: Record<CaseStatus, CaseStatus[]> = ALLOWED_TRANSITIONS;
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === Même motif seed-then-mutate que les listes ci-dessus
  // (entities/categories/countries) — INITIAL_ESCALATION_RECIPIENTS reste
  // le jeu par défaut, this.escalationRecipients la copie éditable réelle
  // que l'écran Gouvernance et escalateAlert()/triggerIndependentRouting()
  // lisent tous les deux.
  private escalationRecipients: EscalationRecipient[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedAlerts = localStorage.getItem(STORAGE_KEYS.ALERTS);
      if (storedAlerts) {
        this.alerts = JSON.parse(storedAlerts);
      } else {
        this.alerts = [...INITIAL_ALERTS];
        this.persistAlerts();
      }

      const storedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (storedLogs) {
        this.auditLogs = JSON.parse(storedLogs);
      } else {
        this.auditLogs = [...INITIAL_AUDIT_LOGS];
        this.persistAuditLogs();
      }

      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (storedUsers) {
        this.users = JSON.parse(storedUsers);
      } else {
        this.users = [...INITIAL_USERS];
        this.persistUsers();
      }

      const storedActiveUser = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      if (storedActiveUser) {
        this.activeUser = JSON.parse(storedActiveUser);
      } else {
        this.activeUser = INITIAL_USERS[0];
      }

      // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
      const storedEntities = localStorage.getItem(STORAGE_KEYS.ENTITIES);
      if (storedEntities) {
        this.entities = JSON.parse(storedEntities);
      } else {
        this.entities = [...ACTIVA_ENTITIES];
        this.persistEntities();
      }

      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (storedCategories) {
        this.categories = JSON.parse(storedCategories);
      } else {
        this.categories = [...ALERT_CATEGORIES];
        this.persistCategories();
      }

      // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
      const storedCountries = localStorage.getItem(STORAGE_KEYS.COUNTRIES);
      if (storedCountries) {
        this.countries = JSON.parse(storedCountries);
      } else {
        this.countries = [...ACTIVA_COUNTRIES];
        this.persistCountries();
      }

      // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
      const storedSlaConfig = localStorage.getItem(STORAGE_KEYS.SLA_CONFIG);
      if (storedSlaConfig) {
        this.slaConfig = { ...DEFAULT_SLA_CONFIG, ...JSON.parse(storedSlaConfig) };
      } else {
        this.slaConfig = { ...DEFAULT_SLA_CONFIG };
        this.persistSlaConfig();
      }

      // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
      const storedHierarchyLevels = localStorage.getItem(STORAGE_KEYS.HIERARCHY_LEVELS);
      if (storedHierarchyLevels) {
        this.hierarchyLevels = { ...DEFAULT_HIERARCHY_LEVELS, ...JSON.parse(storedHierarchyLevels) };
      } else {
        this.hierarchyLevels = { ...DEFAULT_HIERARCHY_LEVELS };
        this.persistHierarchyLevels();
      }

      // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
      const storedRolePermissions = localStorage.getItem(STORAGE_KEYS.ROLE_PERMISSIONS);
      if (storedRolePermissions) {
        this.rolePermissions = { ...ROLE_PERMISSIONS, ...JSON.parse(storedRolePermissions) };
      } else {
        this.rolePermissions = { ...ROLE_PERMISSIONS };
        this.persistRolePermissions();
      }

      // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
      const storedWorkflowTransitions = localStorage.getItem(STORAGE_KEYS.WORKFLOW_TRANSITIONS);
      if (storedWorkflowTransitions) {
        this.workflowTransitions = { ...ALLOWED_TRANSITIONS, ...JSON.parse(storedWorkflowTransitions) };
      } else {
        this.workflowTransitions = { ...ALLOWED_TRANSITIONS };
        this.persistWorkflowTransitions();
      }

      // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
      const storedEscalationRecipients = localStorage.getItem(STORAGE_KEYS.ESCALATION_RECIPIENTS);
      if (storedEscalationRecipients) {
        this.escalationRecipients = JSON.parse(storedEscalationRecipients);
      } else {
        this.escalationRecipients = [...INITIAL_ESCALATION_RECIPIENTS];
        this.persistEscalationRecipients();
      }
    } catch (err) {
      console.warn('Storage init failed or running in strict sandbox, using in-memory state', err);
      this.alerts = [...INITIAL_ALERTS];
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      this.users = [...INITIAL_USERS];
      this.activeUser = INITIAL_USERS[0];
      this.entities = [...ACTIVA_ENTITIES];
      this.categories = [...ALERT_CATEGORIES];
      // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
      this.countries = [...ACTIVA_COUNTRIES];
      this.slaConfig = { ...DEFAULT_SLA_CONFIG };
      // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
      this.hierarchyLevels = { ...DEFAULT_HIERARCHY_LEVELS };
      // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
      this.rolePermissions = { ...ROLE_PERMISSIONS };
      // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
      this.workflowTransitions = { ...ALLOWED_TRANSITIONS };
      // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
      this.escalationRecipients = [...INITIAL_ESCALATION_RECIPIENTS];
    }
    // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
    // Pousse l'état courant (chargé, seedé, ou de repli) vers le pont
    // domain/permissionOverrides.ts, hors du try/catch pour couvrir les
    // deux chemins — sans cet appel, authz.userCan() continuerait de lire
    // silencieusement la table par défaut malgré une édition persistée.
    setRolePermissionOverrides(this.rolePermissions);
    // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) === même
    // raisonnement, vers domain/workflow.ts.
    setWorkflowTransitions(this.workflowTransitions);
    // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
    // Complète `code`/`active` pour toute catégorie qui n'en a pas encore
    // (catégories déjà semées avant cet ajout, ou stockage plus ancien) —
    // hors du try/catch pour couvrir les 3 chemins ci-dessus (chargé,
    // seedé, repli). `createdAt` n'est volontairement jamais backfillé
    // (voir CategoryDef dans data/activaConfig.ts) : rien à reconstituer
    // honnêtement pour une catégorie déjà existante.
    const backfilled = this.backfillCategoryDefaults(this.categories);
    if (backfilled !== this.categories) {
      this.categories = backfilled;
      this.persistCategories();
    }
  }

  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  private backfillCategoryDefaults(cats: CategoryDef[]): CategoryDef[] {
    let changed = false;
    const next = cats.map((c, idx) => {
      if (c.code && c.active !== undefined) return c;
      changed = true;
      return {
        ...c,
        code: c.code ?? `CAT-${String(idx + 1).padStart(3, '0')}`,
        active: c.active ?? true,
      };
    });
    return changed ? next : cats;
  }

  private notify() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
    }
  }

  private persistAlerts() {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(this.alerts));
    } catch (e) {
      console.error('Failed to persist alerts', e);
    }
  }

  private persistAuditLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
    } catch (e) {
      console.error('Failed to persist audit logs', e);
    }
  }

  private persistUsers() {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    } catch (e) {
      console.error('Failed to persist users', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  private persistEntities() {
    try {
      localStorage.setItem(STORAGE_KEYS.ENTITIES, JSON.stringify(this.entities));
    } catch (e) {
      console.error('Failed to persist entities', e);
    }
  }

  private persistCategories() {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
    } catch (e) {
      console.error('Failed to persist categories', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
  private persistEscalationRecipients() {
    try {
      localStorage.setItem(STORAGE_KEYS.ESCALATION_RECIPIENTS, JSON.stringify(this.escalationRecipients));
    } catch (e) {
      console.error('Failed to persist escalation recipients', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  private persistCountries() {
    try {
      localStorage.setItem(STORAGE_KEYS.COUNTRIES, JSON.stringify(this.countries));
    } catch (e) {
      console.error('Failed to persist countries', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
  private persistSlaConfig() {
    try {
      localStorage.setItem(STORAGE_KEYS.SLA_CONFIG, JSON.stringify(this.slaConfig));
    } catch (e) {
      console.error('Failed to persist SLA config', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  private persistHierarchyLevels() {
    try {
      localStorage.setItem(STORAGE_KEYS.HIERARCHY_LEVELS, JSON.stringify(this.hierarchyLevels));
    } catch (e) {
      console.error('Failed to persist hierarchy levels', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  private persistRolePermissions() {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(this.rolePermissions));
    } catch (e) {
      console.error('Failed to persist role permissions', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  private persistWorkflowTransitions() {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKFLOW_TRANSITIONS, JSON.stringify(this.workflowTransitions));
    } catch (e) {
      console.error('Failed to persist workflow transitions', e);
    }
  }

  // --- Alerts API ---
  public getAlerts(): AlertRecord[] {
    return [...this.alerts];
  }

  public getAlertById(id: string): AlertRecord | undefined {
    return this.alerts.find(a => a.id === id);
  }

  public getAlertByTracking(trackingNumber: string): AlertRecord | undefined {
    return this.alerts.find(a => a.trackingNumber.trim().toUpperCase() === trackingNumber.trim().toUpperCase());
  }

  public saveAlert(alert: AlertRecord): void {
    const existingIndex = this.alerts.findIndex(a => a.id === alert.id);
    if (existingIndex >= 0) {
      this.alerts[existingIndex] = { ...alert, updatedAt: new Date().toISOString() };
    } else {
      this.alerts.unshift(alert);
    }
    this.persistAlerts();
    this.notify();
    // Asynchronous Cloud Firestore sync
    saveAlertToCloud(alert).catch(() => {});
  }

  public deleteAlert(alertId: string): boolean {
    const initialLen = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    if (this.alerts.length !== initialLen) {
      this.persistAlerts();
      this.notify();
      return true;
    }
    return false;
  }

  // === AMÉLIORATION AJOUTÉE (Phase 1) ===
  // Tasks / Interviews / Conflict-of-interest declarations — same pattern
  // as every other mutation here: update the AlertRecord in place, persist,
  // notify, and log an audit entry. Additive fields on AlertRecord (see
  // types.ts), so an alert with none of these simply has empty arrays.

  public addTask(alertId: string, task: CaseTask, actor: UserProfile): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;
    alert.tasks = [...(alert.tasks ?? []), task];
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Tâche ajoutée sur ${alert.trackingNumber} : ${task.title}`, { id: alert.id, trackingNumber: alert.trackingNumber }, actor);
  }

  public updateTask(alertId: string, taskId: string, updates: Partial<CaseTask>, actor: UserProfile): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || !alert.tasks) return;
    alert.tasks = alert.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Tâche mise à jour sur ${alert.trackingNumber}.`, { id: alert.id, trackingNumber: alert.trackingNumber }, actor);
  }

  public addInterview(alertId: string, interview: CaseInterview, actor: UserProfile): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;
    alert.interviews = [...(alert.interviews ?? []), interview];
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Entretien planifié/consigné sur ${alert.trackingNumber}.`, { id: alert.id, trackingNumber: alert.trackingNumber }, actor);
  }

  public declareConflict(alertId: string, declaration: ConflictDeclaration, actor: UserProfile): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;
    alert.conflictDeclarations = [...(alert.conflictDeclarations ?? []), declaration];
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Déclaration de conflit d'intérêt (${declaration.outcome}) sur ${alert.trackingNumber} par ${declaration.userName}.`,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
  }

  // === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
  /**
   * Seul point d'entrée pour faire progresser un dossier dans la machine à
   * états riche (`CaseStatus`, domain/workflow.ts) — réutilise
   * `checkTransition()` telle quelle plutôt que de réinventer une
   * validation de transition. Refuse (ne lève jamais d'exception) une
   * transition invalide, exactement comme chaque autre mutation de ce
   * fichier persiste puis notifie puis journalise. Synchronise en
   * permanence `AlertRecord.status` (legacy, 7 valeurs) via
   * `syncLegacyStatus()` pour que tout écran existant qui lit encore ce
   * champ continue de fonctionner sans changement.
   *
   * LIMITE CONNUE (documentée, pas contournée en douce) : le contrôle de
   * clôture de `checkTransition()` (`to === 'closed'`) exige des
   * `Allegation[]` documentées — une notion du modèle `domain/caseTypes.ts`
   * qu'`AlertRecord` ne porte pas (un signalement local a une seule
   * catégorie/sous-catégorie, pas des allégations distinctes). Sans
   * surcharge explicite de `context`, cette méthode refusera donc toute
   * transition vers `closed`. Le flux de clôture existant
   * (InvestigationDesk.tsx, sa propre checklist sur les champs réels
   * d'AlertRecord) reste inchangé et n'utilise pas cette méthode — cette
   * limite ne concerne qu'un futur usage de `transitionStatus` pour
   * clôturer, pas le comportement actuel de l'application.
   */
  public transitionStatus(
    alertId: string,
    toStatus: CaseStatus,
    actor: UserProfile,
    reason?: string
  ): TransitionCheckResult {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return { allowed: false, reason: 'Dossier introuvable.' };

    const fromStatus = alert.workflowStatus ?? deriveCaseStatus(alert);
    const check = checkTransition(fromStatus, toStatus);
    if (!check.allowed) return check;

    alert.workflowStatus = toStatus;
    alert.status = syncLegacyStatus(toStatus);
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit(
      'STATUS_CHANGED',
      `Statut du dossier ${alert.trackingNumber} : ${fromStatus} → ${toStatus}${reason ? ` (${reason})` : ''}.`,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
    return { allowed: true };
  }

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  /**
   * Escalade un dossier vers la DARC Groupe (brief §14/§44) : transition
   * `workflowStatus` → `escalated` (réutilise `checkTransition()`, refuse
   * une escalade structurellement invalide sans lever d'exception), puis
   * enregistre le motif et le nouveau "propriétaire" (`escalatedOwnerId`,
   * un compte Groupe — voir `getGroupEscalationOwners()` dans
   * domain/escalationCriteria.ts). Le pays/entité d'origine du dossier
   * (country/concernedEntity/countryId/entityId) ne sont JAMAIS modifiés
   * ici — seul le propriétaire change, conformément au brief. Une seule
   * entrée d'audit `CASE_ESCALATED` (pas de double journalisation avec
   * `transitionStatus`, dont la logique de transition est reprise ici
   * directement plutôt qu'appelée en cascade).
   */
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === `recipientId` référence désormais EscalationRecipient.id
  // (registre admin-éditable) au lieu d'un UserProfile.id codé en dur
  // (l'ancien `getGroupEscalationOwners`, qui ne reflétait que 2 rôles
  // fixes). Quand le destinataire a un compte lié (linkedUserId) ET que
  // son plafond de confidentialité couvre ce dossier
  // (canSeeAlertConfidentiality, voir plus bas), il est réellement ajouté
  // à assignedInvestigators — BUG PRÉEXISTANT CORRIGÉ : avant ce
  // correctif, escalateAlert() ne touchait jamais assignedInvestigators,
  // donc un destinataire sans vision Groupe (ex. senior_investigator) ne
  // voyait jamais le dossier escaladé. Sans compte lié, ou avec un compte
  // insuffisamment habilité, aucun accès in-app n'est accordé — le retour
  // inclut le destinataire complet pour que l'appelant envoie une vraie
  // notification e-mail (services/emailNotify.ts), jamais depuis ce
  // fichier lui-même (emailNotify.ts importe déjà storage.ts — un import
  // dans l'autre sens créerait un cycle).
  public escalateAlert(
    alertId: string,
    reason: string,
    criteriaMatched: string[],
    recipientId: string,
    actor: UserProfile
  ): TransitionCheckResult & { recipient?: EscalationRecipient } {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return { allowed: false, reason: 'Dossier introuvable.' };

    const recipient = this.escalationRecipients.find((r) => r.id === recipientId);
    if (!recipient) return { allowed: false, reason: 'Destinataire introuvable dans le registre.' };

    const fromStatus = alert.workflowStatus ?? deriveCaseStatus(alert);
    const check = checkTransition(fromStatus, 'escalated');
    if (!check.allowed) return check;

    // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
    // routage — correctif confidentialité) === BUG PRÉEXISTANT CORRIGÉ :
    // un compte lié obtenait un accès in-app (assignedInvestigators) même
    // si son plafond de confidentialité (canSeeAlertConfidentiality, déjà
    // appliqué par le moteur d'attribution normal, domain/assignmentEngine.ts)
    // ne couvre pas le niveau du dossier — accordant une entrée qui
    // n'ouvrait en réalité AUCUN accès réel (useVisibleAlerts la filtre
    // quand même), un état incohérent silencieux. Un compte lié mais
    // insuffisamment habilité est désormais traité exactement comme un
    // destinataire sans compte : notification e-mail uniquement, jamais
    // d'accès fictif.
    const linkedUser = recipient.linkedUserId ? this.users.find((u) => u.id === recipient.linkedUserId) : undefined;
    const linkedUserCleared = linkedUser ? canSeeAlertConfidentiality(linkedUser, alert) : false;
    if (linkedUser && linkedUserCleared && !alert.assignedInvestigators.includes(linkedUser.id)) {
      alert.assignedInvestigators = [...alert.assignedInvestigators, linkedUser.id];
      alert.assignedInvestigatorNames = [...alert.assignedInvestigatorNames, linkedUser.name];
    }
    alert.workflowStatus = 'escalated';
    alert.status = syncLegacyStatus('escalated');
    alert.escalatedAt = new Date().toISOString();
    alert.escalatedBy = actor.id;
    alert.escalatedReason = reason;
    alert.escalatedOwnerId = linkedUserCleared ? linkedUser?.id : undefined;
    alert.escalatedRecipientId = recipient.id;
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    const accessNote = linkedUserCleared
      ? ' Accès au dossier accordé (compte lié).'
      : linkedUser
      ? ` Compte lié (${linkedUser.name}) mais habilitation de confidentialité insuffisante pour ce dossier — aucun accès accordé, notification e-mail uniquement.`
      : ' Aucun compte EthicAlert lié — notification e-mail uniquement.';
    this.logAudit(
      'CASE_ESCALATED',
      `Dossier ${alert.trackingNumber} escaladé vers ${recipient.nom} (${recipient.fonction}). Motif : "${reason}".` +
        (criteriaMatched.length > 0 ? ` Critères retenus : ${criteriaMatched.join(', ')}.` : '') +
        accessNote,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
    return { allowed: true, recipient };
  }

  // === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
  /**
   * Déclenche le routage indépendant d'un dossier (brief §47-68) : exclut
   * automatiquement de l'accès tout compte mis en cause/témoin lié
   * (domain/independentRouting.ts, getConflictedUserIds) et route vers
   * l'autorité indépendante de niveau hiérarchique supérieur
   * (resolveIndependentAuthority), ou marque le dossier comme nécessitant
   * une intervention manuelle si aucune autorité n'est disponible.
   *
   * Appelée dès qu'un `linkedUserId` est défini sur une personne
   * impliquée/témoin (InvestigationDesk.tsx, Phase 2). Ne passe
   * délibérément PAS par `checkTransition()`/`workflowStatus='escalated'` :
   * le routage indépendant doit pouvoir se déclencher depuis n'importe
   * quel stade du cycle de vie, pas seulement depuis `investigation` comme
   * `ALLOWED_TRANSITIONS` l'exige pour `'escalated'` — et réutiliser le
   * libellé "Escalade vers la DARC Groupe" pour ceci induirait en erreur
   * dans la Piste d'Audit. Réutilise en revanche
   * escalatedAt/By/Reason/OwnerId (déjà existants) pour enregistrer "routé
   * vers qui et pourquoi", plutôt que d'ajouter des champs dupliqués.
   *
   * Deux événements d'audit séquentiels (même principe que le §59 du
   * brief) : INDEPENDENT_ROUTING_TRIGGERED d'abord (l'exclusion),
   * puis INVESTIGATOR_ASSIGNED (nouvelle autorité trouvée) ou
   * NO_INDEPENDENT_AUTHORITY_FOUND (aucune autorité disponible).
   *
   * Les détails journalisés ne révèlent jamais l'identité de la personne
   * exclue ni le contenu du dossier (uniquement des comptes et un nombre),
   * conformément au principe de routage confidentiel du brief.
   */
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === Retourne désormais le destinataire de dernier recours
  // notifié quand aucune autorité interne n'est trouvée (branche
  // `independentRoutingUnresolved`, ci-dessous) — `undefined` dans tous
  // les autres cas (routage résolu, ou aucun destinataire actif dans le
  // registre). L'appelant (InvestigationDesk.tsx) envoie la vraie
  // notification e-mail via emailNotify.ts avec ce retour, pour éviter un
  // import storage.ts → emailNotify.ts → storage.ts circulaire.
  public triggerIndependentRouting(alertId: string, actor: UserProfile): EscalationRecipient | undefined {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return undefined;

    const conflictedIds = getConflictedUserIds(alert);
    if (conflictedIds.length === 0) return undefined; // rien à router (aucun linkedUserId sur ce dossier)

    const previousAssigned = alert.assignedInvestigators.length;
    alert.assignedInvestigators = alert.assignedInvestigators.filter((id) => !conflictedIds.includes(id));
    alert.assignedInvestigatorNames = alert.assignedInvestigators
      .map((id) => this.users.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);
    alert.independentRoutingExcludedUserIds = conflictedIds;
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();

    const removedFromAssignment = previousAssigned - alert.assignedInvestigators.length;
    this.logAudit(
      'INDEPENDENT_ROUTING_TRIGGERED',
      `Routage indépendant déclenché sur ${alert.trackingNumber} : ${conflictedIds.length} compte(s) exclu(s) de l'accès au dossier` +
        (removedFromAssignment > 0 ? ` (dont ${removedFromAssignment} retiré(s) des enquêteurs assignés)` : '') +
        '.',
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );

    const resolution = resolveIndependentAuthority(alert, this.users, this.hierarchyLevels);
    if (resolution.found) {
      const owner = resolution.candidates[0];
      if (!alert.assignedInvestigators.includes(owner.id)) {
        alert.assignedInvestigators = [...alert.assignedInvestigators, owner.id];
        alert.assignedInvestigatorNames = [...alert.assignedInvestigatorNames, owner.name];
      }
      alert.independentRoutingUnresolved = false;
      alert.escalatedAt = new Date().toISOString();
      alert.escalatedBy = actor.id;
      alert.escalatedReason = 'Routage indépendant : exclusion automatique d’une personne mise en cause de ce dossier.';
      alert.escalatedOwnerId = owner.id;
      alert.updatedAt = new Date().toISOString();
      this.persistAlerts();
      this.notify();
      this.logAudit(
        'INVESTIGATOR_ASSIGNED',
        `Dossier ${alert.trackingNumber} routé vers ${owner.name} (${owner.roleTitle}), autorité indépendante de niveau hiérarchique supérieur (périmètre ${resolution.scopeMatch === 'local' ? 'local' : 'Groupe'}).`,
        { id: alert.id, trackingNumber: alert.trackingNumber },
        actor
      );
      return undefined;
    } else {
      alert.independentRoutingUnresolved = true;
      // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et
      // de routage) === Dernier recours : le destinataire actif du grade
      // le plus élevé du registre, notifié par e-mail — jamais d'accès
      // in-app fictif (le destinataire peut n'avoir aucun compte). Si le
      // registre n'a aucun destinataire actif, ce champ reste absent et
      // rien n'est notifié : jamais un faux "quelqu'un a été prévenu".
      const fallbackRecipient = [...this.escalationRecipients]
        .filter((r) => r.active)
        .sort((a, b) => b.grade - a.grade)[0];
      if (fallbackRecipient) {
        alert.independentRoutingFallbackRecipientId = fallbackRecipient.id;
        alert.independentRoutingFallbackNotifiedAt = new Date().toISOString();
      }
      alert.updatedAt = new Date().toISOString();
      this.persistAlerts();
      this.notify();
      this.logAudit(
        'NO_INDEPENDENT_AUTHORITY_FOUND',
        `Aucune autorité indépendante disponible pour ${alert.trackingNumber} après exclusion automatique — intervention manuelle requise.` +
          (fallbackRecipient
            ? ` ${fallbackRecipient.nom} (${fallbackRecipient.fonction}) notifié(e) à titre de dernier recours.`
            : ' Aucun destinataire actif dans le registre d’escalade — personne notifié.'),
        { id: alert.id, trackingNumber: alert.trackingNumber },
        actor
      );
      return fallbackRecipient;
    }
  }

  // --- Audit Logs API ---
  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public logAudit(
    actionType: AuditLogEntry['actionType'],
    details: string,
    alert?: { id: string; trackingNumber: string },
    user?: UserProfile
  ): void {
    const currentUser = user || this.activeUser;
    const entry: AuditLogEntry = {
      id: 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      alertId: alert?.id,
      trackingNumber: alert?.trackingNumber,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      actionType,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: '197.234.219.' + Math.floor(Math.random() * 250 + 1), // Intranet ACTIVA secure gateway
    };

    this.auditLogs.unshift(entry);
    this.persistAuditLogs();
    this.notify();
    // Asynchronous Cloud Firestore audit sync
    saveAuditLogToCloud(entry).catch(() => {});
  }

  // --- Active User & Roles ---
  public getActiveUser(): UserProfile {
    return this.activeUser;
  }

  public setActiveUser(user: UserProfile): void {
    this.activeUser = user;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Could not persist active user', e);
    }
    this.notify();
  }

  public getUsers(): UserProfile[] {
    return [...this.users];
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7) === optional `actor` param, additive
  // (no existing call site passed a second argument — grep-verified before
  // this change) so a real audit entry is logged like every other mutation
  // here, without breaking any caller that predates this.
  public addUser(user: UserProfile, actor?: UserProfile): void {
    this.users.push(user);
    this.persistUsers();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Compte utilisateur "${user.name}" (${user.role}) créé par ${(actor ?? this.activeUser).name}.`, undefined, actor);
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  // Completes the Users CRUD (addUser already existed) — same
  // mutate-in-place + persist + notify + logAudit pattern used everywhere
  // else in this file.
  public updateUser(userId: string, updates: Partial<UserProfile>, actor: UserProfile): void {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    this.users[idx] = { ...this.users[idx], ...updates };
    this.persistUsers();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Profil utilisateur "${this.users[idx].name}" mis à jour par ${actor.name}.`, undefined, actor);
  }

  public deleteUser(userId: string, actor: UserProfile): boolean {
    const target = this.users.find((u) => u.id === userId);
    if (!target) return false;
    this.users = this.users.filter((u) => u.id !== userId);
    this.persistUsers();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Compte utilisateur "${target.name}" (${target.email}) supprimé par ${actor.name}.`, undefined, actor);
    return true;
  }

  // --- Entities API (Phase 7 — Administration CRUD) ---
  // Same seed-then-mutate pattern as Users: ACTIVA_ENTITIES is the factory
  // default, this.entities is the real, persisted, editable copy every
  // screen (submission form, filters, reports) now reads from.
  public getEntities(): EntityDef[] {
    return [...this.entities];
  }

  public addEntity(entity: EntityDef, actor: UserProfile): void {
    this.entities.push(entity);
    this.persistEntities();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Entité "${entity.name}" (${entity.country}) ajoutée par ${actor.name}.`, undefined, actor);
  }

  public updateEntity(entityId: string, updates: Partial<EntityDef>, actor: UserProfile): void {
    const idx = this.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return;
    this.entities[idx] = { ...this.entities[idx], ...updates };
    this.persistEntities();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Entité "${this.entities[idx].name}" mise à jour par ${actor.name}.`, undefined, actor);
  }

  public deleteEntity(entityId: string, actor: UserProfile): boolean {
    const target = this.entities.find((e) => e.id === entityId);
    if (!target) return false;
    this.entities = this.entities.filter((e) => e.id !== entityId);
    this.persistEntities();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Entité "${target.name}" supprimée par ${actor.name}.`, undefined, actor);
    return true;
  }

  // --- Escalation Recipients API (Registre des destinataires d'escalade et de routage) ---
  // Même motif exact que Entities ci-dessus.
  public getEscalationRecipients(): EscalationRecipient[] {
    return [...this.escalationRecipients];
  }

  public addEscalationRecipient(recipient: EscalationRecipient, actor: UserProfile): void {
    this.escalationRecipients.push(recipient);
    this.persistEscalationRecipients();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Destinataire d'escalade "${recipient.nom}" (${recipient.fonction}) ajouté par ${actor.name}.`, undefined, actor);
  }

  public updateEscalationRecipient(recipientId: string, updates: Partial<EscalationRecipient>, actor: UserProfile): void {
    const idx = this.escalationRecipients.findIndex((r) => r.id === recipientId);
    if (idx === -1) return;
    this.escalationRecipients[idx] = { ...this.escalationRecipients[idx], ...updates };
    this.persistEscalationRecipients();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Destinataire d'escalade "${this.escalationRecipients[idx].nom}" mis à jour par ${actor.name}.`, undefined, actor);
  }

  public deleteEscalationRecipient(recipientId: string, actor: UserProfile): boolean {
    const target = this.escalationRecipients.find((r) => r.id === recipientId);
    if (!target) return false;
    this.escalationRecipients = this.escalationRecipients.filter((r) => r.id !== recipientId);
    this.persistEscalationRecipients();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Destinataire d'escalade "${target.nom}" supprimé par ${actor.name}.`, undefined, actor);
    return true;
  }

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // --- Countries API --- même motif seed-then-mutate que les Entités
  // ci-dessus (ACTIVA_COUNTRIES est le jeu de départ, this.countries la
  // copie réelle, persistée, éditable).
  public getCountries(): CountryDef[] {
    return [...this.countries];
  }

  public addCountry(country: CountryDef, actor: UserProfile): void {
    this.countries.push(country);
    this.persistCountries();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Pays "${country.name}" (${country.code}) ajouté par ${actor.name}.`, undefined, actor);
  }

  public updateCountry(code: string, updates: Partial<CountryDef>, actor: UserProfile): void {
    const idx = this.countries.findIndex((c) => c.code === code);
    if (idx === -1) return;
    this.countries[idx] = { ...this.countries[idx], ...updates };
    this.persistCountries();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Pays "${this.countries[idx].name}" mis à jour par ${actor.name}.`, undefined, actor);
  }

  /**
   * NOUVEAU garde de sécurité (absent de `deleteEntity` ci-dessus — vérifié
   * avant cette phase, aucune entité existante ne le fait) : refuse de
   * supprimer un pays tant qu'au moins une entité y est encore rattachée,
   * pour ne jamais laisser une entité orpheline avec un pays inexistant.
   * Retourne `{ allowed: false, reason }` plutôt qu'un simple booléen pour
   * que l'écran d'administration puisse afficher pourquoi.
   */
  public deleteCountry(code: string, actor: UserProfile): { allowed: boolean; reason?: string } {
    const target = this.countries.find((c) => c.code === code);
    if (!target) return { allowed: false, reason: 'Pays introuvable.' };
    const entitiesInCountry = this.entities.filter((e) => e.country === target.name);
    if (entitiesInCountry.length > 0) {
      return {
        allowed: false,
        reason: `${entitiesInCountry.length} entité(s) sont encore rattachées à "${target.name}" (${entitiesInCountry.map((e) => e.name).join(', ')}). Réaffectez-les ou supprimez-les d'abord.`,
      };
    }
    this.countries = this.countries.filter((c) => c.code !== code);
    this.persistCountries();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Pays "${target.name}" supprimé par ${actor.name}.`, undefined, actor);
    return { allowed: true };
  }

  // --- Categories API (Phase 7 — Administration CRUD) ---
  public getCategories(): CategoryDef[] {
    return [...this.categories];
  }

  public addCategory(category: CategoryDef, actor: UserProfile): void {
    // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
    // `code` et `createdAt` réels, posés une seule fois ici à la création
    // (jamais fabriqués a posteriori) ; `active` par défaut à `true`. Le
    // même motif que `backfillCategoryDefaults` pour le calcul du code
    // (position réelle dans la liste au moment de l'ajout).
    const withDefaults: CategoryDef = {
      ...category,
      code: category.code ?? `CAT-${String(this.categories.length + 1).padStart(3, '0')}`,
      active: category.active ?? true,
      createdAt: category.createdAt ?? new Date().toISOString(),
    };
    this.categories.push(withDefaults);
    this.persistCategories();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Catégorie d'alerte "${category.name}" ajoutée par ${actor.name}.`, undefined, actor);
  }

  public updateCategory(categoryId: string, updates: Partial<Pick<CategoryDef, 'name'>>, actor: UserProfile): void {
    const idx = this.categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) return;
    this.categories[idx] = { ...this.categories[idx], ...updates };
    this.persistCategories();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Catégorie "${this.categories[idx].name}" mise à jour par ${actor.name}.`, undefined, actor);
  }

  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  public toggleCategoryActive(categoryId: string, actor: UserProfile): void {
    const idx = this.categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) return;
    const nextActive = !(this.categories[idx].active ?? true);
    this.categories[idx] = { ...this.categories[idx], active: nextActive };
    this.persistCategories();
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Catégorie "${this.categories[idx].name}" ${nextActive ? 'réactivée' : 'désactivée'} par ${actor.name}.`,
      undefined,
      actor
    );
  }

  public deleteCategory(categoryId: string, actor: UserProfile): boolean {
    const target = this.categories.find((c) => c.id === categoryId);
    if (!target) return false;
    this.categories = this.categories.filter((c) => c.id !== categoryId);
    this.persistCategories();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Catégorie "${target.name}" supprimée par ${actor.name}.`, undefined, actor);
    return true;
  }

  public addSubCategory(categoryId: string, subCategory: string, actor: UserProfile): void {
    const cat = this.categories.find((c) => c.id === categoryId);
    if (!cat || cat.subCategories.includes(subCategory)) return;
    cat.subCategories = [...cat.subCategories, subCategory];
    this.persistCategories();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Sous-catégorie "${subCategory}" ajoutée à "${cat.name}" par ${actor.name}.`, undefined, actor);
  }

  public removeSubCategory(categoryId: string, subCategory: string, actor: UserProfile): void {
    const cat = this.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.subCategories = cat.subCategories.filter((s) => s !== subCategory);
    this.persistCategories();
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Sous-catégorie "${subCategory}" retirée de "${cat.name}" par ${actor.name}.`, undefined, actor);
  }

  // --- SLA config API (Phase 7 — configuration SLA éditable) ---
  // The single source of truth AlertSubmissionFlow reads when setting a new
  // case's targetCompletionDate, and that computeRiskEvaluation's
  // expectedTreatment text is derived from — same seed-then-mutate pattern
  // as Entities/Categories/Users above.
  public getSlaConfig(): SlaConfig {
    return { ...this.slaConfig };
  }

  public updateSlaConfig(updates: Partial<SlaConfig>, actor: UserProfile): void {
    this.slaConfig = { ...this.slaConfig, ...updates };
    this.persistSlaConfig();
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Délais SLA mis à jour par ${actor.name} : NOCA1=${this.slaConfig.noca1Days}j, NOCA2=${this.slaConfig.noca2Days}j, NOCA3=${this.slaConfig.noca3Days}j, NOCA4=${this.slaConfig.noca4Days}j.`,
      undefined,
      actor
    );
  }

  // --- Hierarchy levels API (Phase 1 — routage indépendant) ---
  // Table par rôle utilisée par domain/independentRouting.ts pour trouver
  // une autorité indépendante de niveau strictement supérieur. Réservée en
  // écriture à system_admin en administration (AdminConfigView.tsx, onglet
  // Gouvernance, Phase 5) — même garde `configuration.manage` que SLA/
  // matrice de risque/catégories/entités/pays ci-dessus.
  public getHierarchyLevels(): HierarchyLevels {
    return { ...this.hierarchyLevels };
  }

  public updateHierarchyLevels(updates: Partial<HierarchyLevels>, actor: UserProfile): void {
    this.hierarchyLevels = { ...this.hierarchyLevels, ...updates };
    this.persistHierarchyLevels();
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Niveaux hiérarchiques de routage indépendant mis à jour par ${actor.name}.`,
      undefined,
      actor
    );
  }

  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  // --- Role permissions API --- rend éditable en administration
  // (AdminConfigView.tsx, onglet "Rôles & Permissions") la table jusqu'ici
  // uniquement affichée en lecture seule. `domain/permissions.ts` reste la
  // table PAR DÉFAUT, jamais modifiée — voir domain/permissionOverrides.ts.
  // Réservée en écriture à system_admin (même garde `configuration.manage`
  // que toutes les autres tables de configuration ci-dessus).
  public getRolePermissions(): Record<UserRole, Permission[]> {
    return { ...this.rolePermissions };
  }

  /**
   * Remplace la liste COMPLÈTE des permissions d'UN rôle (pas une fusion
   * partielle) — l'écran d'administration soumet toujours l'état complet
   * des cases cochées pour le rôle édité, jamais une liste de deltas.
   */
  public updateRolePermissions(role: UserRole, permissions: Permission[], actor: UserProfile): void {
    this.rolePermissions = { ...this.rolePermissions, [role]: [...permissions] };
    this.persistRolePermissions();
    // Pousse immédiatement vers le pont domain/permissionOverrides.ts —
    // sans cet appel, authz.userCan() (donc toute l'application) continuerait
    // de servir l'ancienne liste jusqu'au prochain rechargement complet.
    setRolePermissionOverrides(this.rolePermissions);
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Permissions du rôle "${role}" mises à jour par ${actor.name}.`,
      undefined,
      actor
    );
  }

  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  // --- Workflow transitions API --- rend éditable en administration
  // (AdminConfigView.tsx, onglet "Workflows & Statuts") la table de
  // transitions jusqu'ici codée en dur dans domain/workflow.ts, jamais
  // exposée dans aucun écran. `ALLOWED_TRANSITIONS` reste la table PAR
  // DÉFAUT, jamais modifiée. Réservée en écriture à system_admin (même
  // garde `configuration.manage` que toutes les autres tables de
  // configuration ci-dessus).
  public getWorkflowTransitions(): Record<CaseStatus, CaseStatus[]> {
    return { ...this.workflowTransitions };
  }

  /**
   * Remplace la liste COMPLÈTE des statuts cibles accessibles DEPUIS un
   * statut (pas une fusion partielle) — même convention que
   * updateRolePermissions ci-dessus : l'écran d'administration soumet
   * toujours l'état complet des cases cochées pour la ligne éditée.
   */
  public updateWorkflowTransitions(status: CaseStatus, targets: CaseStatus[], actor: UserProfile): void {
    this.workflowTransitions = { ...this.workflowTransitions, [status]: [...targets] };
    this.persistWorkflowTransitions();
    // Pousse immédiatement vers domain/workflow.ts — sans cet appel,
    // checkTransition() (donc storage.transitionStatus()/escalateAlert())
    // continuerait de servir l'ancienne table jusqu'au prochain
    // rechargement complet.
    setWorkflowTransitions(this.workflowTransitions);
    this.notify();
    this.logAudit(
      'CONFIG_UPDATED',
      `Transitions autorisées depuis le statut "${status}" mises à jour par ${actor.name}.`,
      undefined,
      actor
    );
  }

  // --- Draft auto-save for whistleblowers ---
  public getDraft(): any {
    try {
      const draft = localStorage.getItem(STORAGE_KEYS.DRAFT);
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  }

  public saveDraft(data: any): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(data));
    } catch (e) {
      console.warn('Draft save error', e);
    }
  }

  public clearDraft(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.warn('Draft clear error', e);
    }
  }

  // Subscribe to changes
  public subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(DATA_CHANGE_EVENT, callback);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, callback);
    };
  }

  // Reset to initial test dataset
  public resetToFactory(): void {
    this.alerts = [...INITIAL_ALERTS];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.users = [...INITIAL_USERS];
    this.activeUser = INITIAL_USERS[0];
    // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
    this.entities = [...ACTIVA_ENTITIES];
    this.categories = [...ALERT_CATEGORIES];
    // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
    this.countries = [...ACTIVA_COUNTRIES];
    // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
    this.slaConfig = { ...DEFAULT_SLA_CONFIG };
    // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
    this.hierarchyLevels = { ...DEFAULT_HIERARCHY_LEVELS };
    // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
    this.rolePermissions = { ...ROLE_PERMISSIONS };
    setRolePermissionOverrides(this.rolePermissions);
    // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
    this.workflowTransitions = { ...ALLOWED_TRANSITIONS };
    setWorkflowTransitions(this.workflowTransitions);
    this.persistAlerts();
    this.persistAuditLogs();
    this.persistUsers();
    this.persistEntities();
    this.persistCategories();
    this.persistCountries();
    this.persistSlaConfig();
    this.persistHierarchyLevels();
    this.persistRolePermissions();
    this.persistWorkflowTransitions();
    this.clearDraft();
    this.notify();
  }
}

export const storage = new StorageService();
