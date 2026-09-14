import { AlertRecord, AuditLogEntry, CaseInterview, CaseTask, ConflictDeclaration, UserProfile } from '../types';
import { INITIAL_ALERTS, INITIAL_AUDIT_LOGS, INITIAL_USERS, ACTIVA_ENTITIES, ALERT_CATEGORIES, ACTIVA_COUNTRIES, EntityDef, CategoryDef, CountryDef, SlaConfig, DEFAULT_SLA_CONFIG, HierarchyLevels, DEFAULT_HIERARCHY_LEVELS } from '../data/activaConfig';
import { saveAlertToCloud, saveAuditLogToCloud } from './firebase';
// === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
import { CaseStatus } from '../domain/caseTypes';
import { checkTransition, TransitionCheckResult } from '../domain/workflow';
import { deriveCaseStatus, syncLegacyStatus } from './statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
import { getConflictedUserIds, resolveIndependentAuthority } from '../domain/independentRouting';

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
    }
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
  public escalateAlert(
    alertId: string,
    reason: string,
    criteriaMatched: string[],
    ownerId: string,
    actor: UserProfile
  ): TransitionCheckResult {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return { allowed: false, reason: 'Dossier introuvable.' };

    const fromStatus = alert.workflowStatus ?? deriveCaseStatus(alert);
    const check = checkTransition(fromStatus, 'escalated');
    if (!check.allowed) return check;

    const owner = this.users.find((u) => u.id === ownerId);
    alert.workflowStatus = 'escalated';
    alert.status = syncLegacyStatus('escalated');
    alert.escalatedAt = new Date().toISOString();
    alert.escalatedBy = actor.id;
    alert.escalatedReason = reason;
    alert.escalatedOwnerId = ownerId;
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();
    this.logAudit(
      'CASE_ESCALATED',
      `Dossier ${alert.trackingNumber} escaladé vers ${owner?.name ?? ownerId} (DARC Groupe). Motif : "${reason}".` +
        (criteriaMatched.length > 0 ? ` Critères retenus : ${criteriaMatched.join(', ')}.` : ''),
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
    return { allowed: true };
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
  public triggerIndependentRouting(alertId: string, actor: UserProfile): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;

    const conflictedIds = getConflictedUserIds(alert);
    if (conflictedIds.length === 0) return; // rien à router (aucun linkedUserId sur ce dossier)

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
    } else {
      alert.independentRoutingUnresolved = true;
      alert.updatedAt = new Date().toISOString();
      this.persistAlerts();
      this.notify();
      this.logAudit(
        'NO_INDEPENDENT_AUTHORITY_FOUND',
        `Aucune autorité indépendante disponible pour ${alert.trackingNumber} après exclusion automatique — intervention manuelle requise.`,
        { id: alert.id, trackingNumber: alert.trackingNumber },
        actor
      );
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
    this.categories.push(category);
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
    this.persistAlerts();
    this.persistAuditLogs();
    this.persistUsers();
    this.persistEntities();
    this.persistCategories();
    this.persistCountries();
    this.persistSlaConfig();
    this.persistHierarchyLevels();
    this.clearDraft();
    this.notify();
  }
}

export const storage = new StorageService();
