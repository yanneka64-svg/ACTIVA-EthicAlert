import { AlertRecord, AuditLogEntry, CaseInterview, CaseTask, ConflictDeclaration, UserProfile } from '../types';
import { INITIAL_ALERTS, INITIAL_AUDIT_LOGS, INITIAL_USERS, ACTIVA_ENTITIES, ALERT_CATEGORIES, EntityDef, CategoryDef } from '../data/activaConfig';
import { saveAlertToCloud, saveAuditLogToCloud } from './firebase';

const STORAGE_KEYS = {
  ALERTS: 'activa_ethicalert_records_v1',
  AUDIT_LOGS: 'activa_ethicalert_audit_v1',
  USERS: 'activa_ethicalert_users_v1',
  ACTIVE_USER: 'activa_ethicalert_active_user_v1',
  DRAFT: 'activa_ethicalert_draft_v1',
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  ENTITIES: 'activa_ethicalert_entities_v1',
  CATEGORIES: 'activa_ethicalert_categories_v1',
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
    } catch (err) {
      console.warn('Storage init failed or running in strict sandbox, using in-memory state', err);
      this.alerts = [...INITIAL_ALERTS];
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      this.users = [...INITIAL_USERS];
      this.activeUser = INITIAL_USERS[0];
      this.entities = [...ACTIVA_ENTITIES];
      this.categories = [...ALERT_CATEGORIES];
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
    this.persistAlerts();
    this.persistAuditLogs();
    this.persistUsers();
    this.persistEntities();
    this.persistCategories();
    this.clearDraft();
    this.notify();
  }
}

export const storage = new StorageService();
