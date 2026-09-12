import { AlertRecord, AuditLogEntry, UserProfile } from '../types';
import { INITIAL_ALERTS, INITIAL_AUDIT_LOGS, INITIAL_USERS } from '../data/activaConfig';
import { saveAlertToCloud, saveAuditLogToCloud } from './firebase';
import { SlaEngine } from './engines/slaEngine';
import { WorkflowEngine } from './engines/workflowEngine';
import { ApiClient } from './apiClient';

const STORAGE_KEYS = {
  ALERTS: 'activa_ethicalert_records_v1',
  AUDIT_LOGS: 'activa_ethicalert_audit_v1',
  USERS: 'activa_ethicalert_users_v1',
  ACTIVE_USER: 'activa_ethicalert_active_user_v1',
  DRAFT: 'activa_ethicalert_draft_v1',
};

// Event dispatched when data changes
const DATA_CHANGE_EVENT = 'activa_storage_updated';

class StorageService {
  private alerts: AlertRecord[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private users: UserProfile[] = [];
  private activeUser: UserProfile = INITIAL_USERS[0]; // Default to B.Y. Ekani (Point de Contact DARC)

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

      // Enrich initial cases with SLA & Enterprise statuses
      this.alerts = this.alerts.map(a => this.enrichCaseWithEngines(a));
    } catch (err) {
      console.warn('Storage init failed or running in strict sandbox, using in-memory state', err);
      this.alerts = [...INITIAL_ALERTS].map(a => this.enrichCaseWithEngines(a));
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      this.users = [...INITIAL_USERS];
      this.activeUser = INITIAL_USERS[0];
    }
  }

  private enrichCaseWithEngines(alert: AlertRecord): AlertRecord {
    const priority = alert.overridePriority || alert.riskEvaluation.priority;
    const sla = SlaEngine.calculateSla(alert.createdAt, priority);
    const enterpriseStatus = alert.enterpriseStatus || WorkflowEngine.mapToEnterpriseStatus(alert.status);

    // If case is closed, compute 10-year retention if not set (CDC 73)
    let retentionDate = alert.retentionDate;
    if (alert.status === 'closed' && !retentionDate) {
      const closedTime = alert.closedAt ? new Date(alert.closedAt) : new Date();
      const tenYearsLater = new Date(closedTime);
      tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
      retentionDate = tenYearsLater.toISOString();
    }

    return {
      ...alert,
      enterpriseStatus,
      slaStartAt: alert.slaStartAt || sla.slaStartAt,
      slaDueAt: alert.slaDueAt || sla.slaDueAt,
      slaDaysRemaining: sla.daysRemaining,
      isOverdue: alert.status === 'closed' ? false : sla.isOverdue,
      retentionDate,
      legalHold: alert.legalHold ?? false
    };
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
    const enriched = this.enrichCaseWithEngines(alert);
    const existingIndex = this.alerts.findIndex(a => a.id === alert.id);
    if (existingIndex >= 0) {
      this.alerts[existingIndex] = { ...enriched, updatedAt: new Date().toISOString() };
    } else {
      this.alerts.unshift(enriched);
    }
    this.persistAlerts();
    this.notify();

    // Asynchronous Cloud Firestore sync
    saveAlertToCloud(enriched).catch(() => {});

    // Sync to backend API
    ApiClient.createCase({
      trackingNumber: enriched.trackingNumber,
      accessCodeHash: enriched.accessCodeHash,
      concernedEntity: enriched.concernedEntity,
      country: enriched.country,
      category: enriched.category,
      subCategory: enriched.subCategory,
      detailedDescription: enriched.detailedDescription,
      riskScores: {
        financialImpact: enriched.riskEvaluation.financialImpact,
        hierarchyLevel: enriched.riskEvaluation.hierarchyLevel,
        recidivism: enriched.riskEvaluation.recidivism,
        reputationRisk: enriched.riskEvaluation.reputationRisk
      },
      whistleblower: enriched.whistleblower,
      channel: enriched.channel
    }).catch(() => {});
  }

  public toggleLegalHold(caseId: string, enabled: boolean, user: UserProfile): boolean {
    const alert = this.alerts.find(a => a.id === caseId);
    if (!alert) return false;

    alert.legalHold = enabled;
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    this.notify();

    this.logAudit(
      'LEGAL_HOLD_TOGGLED',
      `Mise sous séquestre légale (Legal Hold) ${enabled ? 'ACTIVÉE' : 'LEVÉE'} par [${user.name}]. La suppression et l'archivage automatique sont ${enabled ? 'strictement bloqués' : 'rétablis'}.`,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      user
    );
    return true;
  }

  public deleteAlert(alertId: string): boolean {
    const target = this.alerts.find(a => a.id === alertId);
    if (target?.legalHold) {
      alert("Suppression impossible : Ce dossier est sous mise sous séquestre légale (Legal Hold - CDC 73).");
      return false;
    }

    const initialLen = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    if (this.alerts.length !== initialLen) {
      this.persistAlerts();
      this.notify();
      return true;
    }
    return false;
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
    // Sync to backend API
    ApiClient.logAudit(entry).catch(() => {});
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

  public addUser(user: UserProfile): void {
    this.users.push(user);
    this.persistUsers();
    this.notify();
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
    this.alerts = [...INITIAL_ALERTS].map(a => this.enrichCaseWithEngines(a));
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.users = [...INITIAL_USERS];
    this.activeUser = INITIAL_USERS[0];
    this.persistAlerts();
    this.persistAuditLogs();
    this.persistUsers();
    this.clearDraft();
    this.notify();
  }
}

export const storage = new StorageService();
