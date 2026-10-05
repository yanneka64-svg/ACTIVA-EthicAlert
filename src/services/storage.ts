import { AlertRecord, AuditLogEntry, CaseMessage, CaseInterview, CaseTask, ConflictDeclaration, UserProfile, UserRole, EscalationRecipient } from '../types';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === signalement des échecs d'enregistrement localStorage.
import { reportPersistFailure } from './persistFailure';
import { INITIAL_ALERTS, INITIAL_AUDIT_LOGS, INITIAL_USERS, ACTIVA_ENTITIES, ALERT_CATEGORIES, ACTIVA_COUNTRIES, EntityDef, CategoryDef, CountryDef, SlaConfig, DEFAULT_SLA_CONFIG, HierarchyLevels, DEFAULT_HIERARCHY_LEVELS, INITIAL_ESCALATION_RECIPIENTS } from '../data/activaConfig';
import { saveAlertToCloud, saveAuditLogToCloud } from './firebase';
// === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
import { CaseStatus } from '../domain/caseTypes';
import { checkTransition, TransitionCheckResult, ALLOWED_TRANSITIONS, setWorkflowTransitions } from '../domain/workflow';
import { deriveCaseStatus, syncLegacyStatus, applyCaseStatus } from './statusMapping';
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
// === AMÉLIORATION AJOUTÉE (création de comptes par l'admin — mot de passe
// temporaire) === même module de hachage salé déjà utilisé pour le code
// d'accès du lanceur d'alerte (AlertSubmissionFlow.tsx/AlertTrackingView.tsx) —
// jamais réimplémenté séparément.
import { generateAccessPassword, generateSalt, hashPassword, verifyPassword } from './crypto';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === mise à niveau transparente des empreintes héritées.
import { needsRehash } from './crypto';

// === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
// `STORAGE_KEYS` et `DATA_CHANGE_EVENT` déplacés tels quels dans
// ./storageKeys.ts (mêmes valeurs), désormais exportés.
import { STORAGE_KEYS, DATA_CHANGE_EVENT } from './storageKeys';
// === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
import { diffPortalUpdate, PORTAL_LOCAL_ONLY_KEYS } from '../domain/portalUpdate';
import type { PortalConfigSection } from '../domain/portalConfig';
import { DEFAULT_EMAIL_NOTIFICATION_SETTINGS, sanitizeEmailNotificationSettings, type EmailNotificationSettings } from '../domain/emailNotificationRules';

// === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === ancien envoi des
// statuts vers changeCaseStatus, remplacé par applyPortalUpdate (voir plus bas).
const LEGACY_STATUS_MIRROR = false;
import * as storageBackfill from './storageBackfill';

class StorageService {
  private alerts: AlertRecord[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private users: UserProfile[] = [];
  // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de démonstration ===
  // Simple placeholder transitoire, toujours remplacé de façon synchrone par
  // init() (appelé depuis le constructeur juste après) — même convention que
  // `alerts`/`auditLogs`/`users` ci-dessus (tableaux vides en placeholder).
  private activeUser: UserProfile = {} as UserProfile;
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
  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  // Compteur séquentiel par entité et par mois, clé `${entityCode}-${YYMM}`,
  // utilisé par generateCaseNumber() ci-dessous pour produire le numéro de
  // dossier officiel Groupe (format XX-YY-MM-XXXX). Même motif
  // seed-then-mutate/persisté que les autres champs de cette classe.
  private caseNumberCounters: Record<string, number> = {};

  constructor() {
    this.init();
    // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
    this.configSyncReady = true;
  }

  // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
  /**
   * Configuration partagée : toute modification faite en administration est
   * envoyée au serveur (services/configSync.ts) ; la configuration reçue du
   * serveur est appliquée sans être renvoyée. Jamais pendant l'initialisation
   * (valeurs par défaut) ni pendant une remise à zéro locale.
   */
  private configSyncReady = false;
  private applyingSharedConfig = false;

  private onConfigPersist(section: PortalConfigSection): void {
    if (!this.configSyncReady || this.applyingSharedConfig) return;
    const value = this.getSharedConfigSection(section);
    import('./configSync').then(({ pushSharedConfigSection }) => pushSharedConfigSection(section, value)).catch(() => {});
  }

  /** Valeur actuelle d'une section de configuration partagée. */
  public getSharedConfigSection(section: PortalConfigSection): unknown {
    switch (section) {
      case 'entities': return this.entities;
      case 'countries': return this.countries;
      case 'categories': return this.categories;
      case 'slaConfig': return this.slaConfig;
      case 'hierarchyLevels': return this.hierarchyLevels;
      case 'rolePermissions': return this.rolePermissions;
      case 'workflowTransitions': return this.workflowTransitions;
      case 'escalationRecipients': return this.escalationRecipients;
      case 'emailNotifications': return this.getEmailNotificationSettings();
    }
  }

  /**
   * Applique une section reçue du serveur (sans audit ni renvoi). Renvoie
   * `true` si quelque chose a changé.
   */
  public applySharedConfigSection(section: PortalConfigSection, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (JSON.stringify(this.getSharedConfigSection(section)) === JSON.stringify(value)) return false;
    this.applyingSharedConfig = true;
    try {
      switch (section) {
        case 'entities':
          if (!Array.isArray(value)) return false;
          this.entities = value as EntityDef[];
          this.persistEntities();
          break;
        case 'countries':
          if (!Array.isArray(value)) return false;
          this.countries = value as CountryDef[];
          this.persistCountries();
          break;
        case 'categories':
          if (!Array.isArray(value)) return false;
          this.categories = value as CategoryDef[];
          this.persistCategories();
          break;
        case 'escalationRecipients':
          if (!Array.isArray(value)) return false;
          this.escalationRecipients = value as EscalationRecipient[];
          this.persistEscalationRecipients();
          break;
        case 'slaConfig':
          this.slaConfig = { ...DEFAULT_SLA_CONFIG, ...(value as Partial<SlaConfig>) };
          this.persistSlaConfig();
          break;
        case 'hierarchyLevels':
          this.hierarchyLevels = { ...DEFAULT_HIERARCHY_LEVELS, ...(value as Partial<HierarchyLevels>) };
          this.persistHierarchyLevels();
          break;
        case 'rolePermissions':
          this.rolePermissions = { ...ROLE_PERMISSIONS, ...(value as Partial<Record<UserRole, Permission[]>>) };
          this.persistRolePermissions();
          setRolePermissionOverrides(this.rolePermissions);
          break;
        case 'workflowTransitions':
          this.workflowTransitions = { ...ALLOWED_TRANSITIONS, ...(value as Partial<Record<CaseStatus, CaseStatus[]>>) };
          this.persistWorkflowTransitions();
          setWorkflowTransitions(this.workflowTransitions);
          break;
        case 'emailNotifications':
          this.persistEmailNotificationSettings(sanitizeEmailNotificationSettings(value));
          break;
      }
    } finally {
      this.applyingSharedConfig = false;
    }
    this.notify();
    return true;
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

      // === AMÉLIORATION AJOUTÉE (correctif — verrouillage total hors
      // recours) === BUG PRÉEXISTANT CORRIGÉ, signalé par un utilisateur
      // réel : supprimer TOUS les comptes staff (Administration →
      // Utilisateurs) laissait `localStorage` avec un tableau vide plutôt
      // qu'absent — `if (storedUsers)` restait vrai pour la chaîne "[]",
      // donc plus personne ne pouvait jamais se reconnecter, sans aucun
      // recours (pas de backend, pas d'admin externe pour recréer un
      // compte). Un tableau STOCKÉ MAIS VIDE est désormais traité comme un
      // état cassé plutôt qu'un choix délibéré (aucun produit sérieux ne
      // laisse un administrateur se retirer lui-même tout accès sans
      // filet) : un compte de secours réel est réamorcé, avec le même
      // repli "demo" documenté que les autres comptes de démonstration
      // (voir verifyStaffLogin ci-dessous) — jamais un accès fictif, juste
      // un identifiant réel et déjà connu pour sortir de l'impasse.
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (storedUsers) {
        const parsedUsers: UserProfile[] = JSON.parse(storedUsers);
        if (parsedUsers.length > 0) {
          // === AMÉLIORATION AJOUTÉE : correctif — connexion bloquée
          // indéfiniment sur un navigateur avec des comptes antérieurs à
          // l'ajout de `username` === BUG RÉEL SIGNALÉ : un compte persisté
          // AVANT l'introduction de l'identifiant de connexion (ex. l'ancien
          // compte de secours, sans `username`) faisait planter
          // `u.username.toLowerCase()` dans verifyStaffLogin — exception non
          // rattrapée, promesse jamais résolue, bouton "Vérification…"
          // bloqué indéfiniment, quel que soit le mot de passe saisi. Chaque
          // compte chargé sans `username` reçoit désormais un identifiant de
          // secours dérivé de son email, et l'état corrigé est repersisté —
          // plus jamais de compte injoignable silencieusement.
          const migrated = parsedUsers
            .map((u) => (u.username ? u : { ...u, username: u.email.split('@')[0] }))
            // === AMÉLIORATION AJOUTÉE : compte de secours jamais utilisé → mot de passe temporaire actuel ===
            .map((u) => this.upgradeEmergencySeed(u));
          this.users = migrated;
          if (migrated.some((u, i) => u !== parsedUsers[i])) this.persistUsers();
        } else {
          this.users = this.emergencyAdminSeed();
          this.persistUsers();
        }
      } else {
        // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de
        // démonstration === INITIAL_USERS est désormais vide (voir
        // activaConfig.ts) — un navigateur tout neuf réamorce directement
        // le compte de secours réel plutôt que de persister un tableau
        // vide et attendre un rechargement pour se corriger.
        this.users = INITIAL_USERS.length > 0 ? [...INITIAL_USERS] : this.emergencyAdminSeed();
        this.persistUsers();
      }

      const storedActiveUser = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      if (storedActiveUser) {
        this.activeUser = JSON.parse(storedActiveUser);
      } else {
        // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de
        // démonstration === `INITIAL_USERS[0]` référençait directement le
        // tableau de seed, désormais vide — `this.users[0]` est la bonne
        // source : déjà résolu ci-dessus (comptes réels stockés, ou repli
        // sur le compte de secours), jamais `undefined`.
        this.activeUser = this.users[0];
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

      // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
      const storedCaseNumberCounters = localStorage.getItem(STORAGE_KEYS.CASE_NUMBER_COUNTERS);
      if (storedCaseNumberCounters) {
        this.caseNumberCounters = JSON.parse(storedCaseNumberCounters);
      } else {
        this.caseNumberCounters = {};
        this.persistCaseNumberCounters();
      }
    } catch (err) {
      console.warn('Storage init failed or running in strict sandbox, using in-memory state', err);
      this.alerts = [...INITIAL_ALERTS];
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de
      // démonstration === même repli que le chemin localStorage ci-dessus
      // (this.users ne doit jamais être vide, sans quoi this.activeUser
      // serait `undefined`).
      this.users = INITIAL_USERS.length > 0 ? [...INITIAL_USERS] : this.emergencyAdminSeed();
      this.activeUser = this.users[0];
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
      // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
      this.caseNumberCounters = {};
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

    // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
    // Même motif que backfillCategoryDefaults ci-dessus : une entité déjà
    // stockée avant l'ajout du champ `code` (localStorage plus ancien) reçoit
    // un code générique, jamais un code officiel deviné à sa place.
    const entitiesBackfilled = this.backfillEntityDefaults(this.entities);
    if (entitiesBackfilled !== this.entities) {
      this.entities = entitiesBackfilled;
      this.persistEntities();
    }
    // Aligne les compteurs sur les dossiers déjà existants (seed ou import),
    // pour ne jamais réémettre un numéro déjà utilisé — recalculé à chaque
    // démarrage (idempotent, ne fait que remonter un compteur, jamais le
    // redescendre) plutôt que fait confiance à un compteur persisté qui
    // pourrait être en retard sur des dossiers ajoutés autrement.
    const countersSeeded = this.seedCaseNumberCountersFromAlerts(this.caseNumberCounters, this.alerts);
    if (countersSeeded !== this.caseNumberCounters) {
      this.caseNumberCounters = countersSeeded;
      this.persistCaseNumberCounters();
    }
  }

  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  private backfillEntityDefaults(defs: EntityDef[]): EntityDef[] {
    // === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
    // Corps déplacé tel quel dans ./storageBackfill.ts (fonction pure, testée
    // isolément) ; méthode conservée sous le même nom.
    return storageBackfill.backfillEntityDefaults(defs);
  }

  // Numéro de dossier officiel : XX(code entité)-YY(année)-MM(mois)-XXXX
  // (ex. AARDC-26-09-0001). Dérive, sans jamais redescendre, le plus haut
  // numéro déjà utilisé par entité+mois à partir des dossiers existants —
  // protège contre toute collision même si le compteur persisté est en
  // retard (dossiers seedés, importés, ou ajoutés hors de generateCaseNumber).
  private seedCaseNumberCountersFromAlerts(counters: Record<string, number>, alerts: AlertRecord[]): Record<string, number> {
    // === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
    // Corps déplacé tel quel dans ./storageBackfill.ts (fonction pure, testée
    // isolément) ; méthode conservée sous le même nom.
    return storageBackfill.seedCaseNumberCountersFromAlerts(counters, alerts);
  }

  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  private backfillCategoryDefaults(cats: CategoryDef[]): CategoryDef[] {
    // === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
    // Corps déplacé tel quel dans ./storageBackfill.ts (fonction pure, testée
    // isolément) ; méthode conservée sous le même nom.
    return storageBackfill.backfillCategoryDefaults(cats);
  }

  private notify() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
    }
  }

  // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
  /**
   * Dernier état connu du serveur pour chaque dossier lié au serveur
   * (`mirroredCaseId`). À chaque enregistrement, l'écart avec cet état
   * (attribution, statut, clôture, réouverture, escalade, routage, rapport,
   * tâches, rattachements) est envoyé au serveur par services/portalSync.ts.
   * Un seul point de passage : toutes les actions des écrans, y compris
   * celles qui modifient un dossier sur place, passent par persistAlerts().
   */
  private portalBaseline: Map<string, AlertRecord> | null = null;

  private static portalSnapshot(a: AlertRecord): AlertRecord {
    return {
      ...a,
      assignedInvestigators: [...(a.assignedInvestigators ?? [])],
      independentRoutingExcludedUserIds: a.independentRoutingExcludedUserIds ? [...a.independentRoutingExcludedUserIds] : undefined,
      tasks: a.tasks?.map((t) => ({ ...t })),
      involvedPersons: (a.involvedPersons ?? []).map((p) => ({ ...p })),
      witnesses: (a.witnesses ?? []).map((p) => ({ ...p })),
    };
  }

  /**
   * État de référence = ce qui vient d'être reçu du serveur. Les champs que
   * seul le portail connaît prennent la valeur que le serveur a réellement
   * (`serverPortal`) : une valeur saisie auparavant dans ce navigateur et
   * inconnue du serveur lui est donc envoyée une fois.
   */
  private resetPortalBaseline(records: AlertRecord[]): void {
    if (!this.portalBaseline) return;
    for (const r of records) {
      if (!r.mirroredCaseId) continue;
      const snap = StorageService.portalSnapshot(r) as unknown as Record<string, unknown>;
      if (r.serverPortal) {
        for (const key of PORTAL_LOCAL_ONLY_KEYS) snap[key] = r.serverPortal[key] ?? undefined;
      }
      this.portalBaseline.set(r.id, snap as unknown as AlertRecord);
    }
  }

  /** Première utilisation : la référence est le dernier état enregistré dans le navigateur. */
  private ensurePortalBaseline(): Map<string, AlertRecord> {
    if (!this.portalBaseline) {
      let stored: AlertRecord[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.ALERTS) || '[]');
        stored = Array.isArray(parsed) ? parsed : [];
      } catch {
        stored = [];
      }
      this.portalBaseline = new Map(stored.filter((a) => a?.mirroredCaseId).map((a) => [a.id, StorageService.portalSnapshot(a)]));
    }
    return this.portalBaseline;
  }

  private syncPortalChanges(): void {
    try {
      this.ensurePortalBaseline();
      if (!this.portalBaseline) return;
      for (const a of this.alerts) {
        if (!a.mirroredCaseId) continue;
        const snap = StorageService.portalSnapshot(a);
        const base = this.portalBaseline.get(a.id);
        this.portalBaseline.set(a.id, snap);
        if (!base) continue; // dossier tout juste lié : rien à rattraper
        const patch = diffPortalUpdate(base, snap);
        if (!patch) continue;
        const caseId = a.mirroredCaseId;
        import('./portalSync').then(({ queuePortalUpdate }) => queuePortalUpdate(caseId, patch)).catch(() => {});
      }
    } catch (e) {
      console.warn('[storage] synchronisation serveur impossible', e);
    }
  }

  private persistAlerts() {
    // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
    this.syncPortalChanges();
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(this.alerts));
    } catch (e) {
      console.error('Failed to persist alerts', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('alerts', e);
    }
  }

  private persistAuditLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
    } catch (e) {
      console.error('Failed to persist audit logs', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('audit logs', e);
    }
  }

  private persistUsers() {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    } catch (e) {
      console.error('Failed to persist users', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('users', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (correctif — verrouillage total hors recours)
  // === Compte admin réamorcé UNIQUEMENT quand `this.users` serait sinon
  // vide au chargement — jamais si au moins un compte existe déjà.
  // `system_admin` (et non `functional_admin`) : c'est le seul rôle qui
  // donne accès à Utilisateurs/Rôles & Permissions, condition nécessaire
  // pour recréer les autres comptes ensuite sans aide extérieure.
  //
  // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
  // BUG PRÉEXISTANT CORRIGÉ : le mot de passe temporaire de ce compte de
  // secours était jusqu'ici documenté EN CLAIR dans ce commentaire, lisible
  // par quiconque a accès au dépôt. `passwordHash`/`passwordSalt`
  // ci-dessous sont le salage+hachage (services/crypto.ts, même algorithme,
  // inchangé) d'un NOUVEAU mot de passe temporaire généré aléatoirement,
  // communiqué séparément et de façon sécurisée à l'administrateur (jamais
  // committé en clair). `mustChangePassword: true` + `passwordSetAt`
  // (calculé au moment réel de l'amorçage, jamais figé) imposent toujours
  // son remplacement dès la première connexion, avec la même expiration de
  // 4h que tout autre mot de passe temporaire (voir TEMP_PASSWORD_TTL_MS)
  // si non utilisé.
  private emergencyAdminSeed(): UserProfile[] {
    return [
      {
        id: 'usr-emergency-admin',
        name: 'MEBADA EKANI Yannick',
        email: 'by.ekani@group-activa.com',
        username: 'y.mebadaekani',
        role: 'system_admin',
        roleTitle: 'Group Forensic Analyst',
        entity: 'Toutes entités',
        country: 'Groupe ACTIVA',
        countries: [],
        entities: [],
        active: true,
        // === AMÉLIORATION AJOUTÉE : nouveau mot de passe temporaire (communiqué
        // séparément à l'administrateur, jamais committé en clair) ===
        passwordHash: StorageService.EMERGENCY_SEED_HASH,
        passwordSalt: StorageService.EMERGENCY_SEED_SALT,
        mustChangePassword: true,
        passwordSetAt: new Date().toISOString(),
      },
    ];
  }

  // === AMÉLIORATION AJOUTÉE : identifiants du compte de secours ===
  // Hash/sel du mot de passe temporaire actuel (services/crypto.ts). Les
  // empreintes des anciens mots de passe de secours sont conservées pour que
  // `upgradeEmergencySeed` aligne un compte de secours jamais utilisé (mot
  // de passe perdu ou expiré) sur le mot de passe temporaire actuel.
  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : rotation du mot de passe
  // de secours) === Nouveau mot de passe temporaire de 16 caractères (CSPRNG,
  // même alphabet que generateAccessPassword), empreinte PBKDF2-HMAC-SHA256
  // 600 000 itérations — l'empreinte embarquée dans le code publié n'est plus
  // attaquable par force brute. Communiqué séparément à l'administrateur,
  // jamais committé en clair. L'empreinte précédente (SHA-256 itéré) rejoint
  // la liste ci-dessous : un compte de secours encore jamais utilisé est
  // aligné sur ce nouveau mot de passe au prochain chargement.
  private static readonly EMERGENCY_SEED_HASH = 'pbkdf2_sha256$600000$618bd189adae0c986f1783b3c4149d6345597fdb565097b919f77a12e408c988';
  private static readonly EMERGENCY_SEED_SALT = '162f87b68b97c86c91702e3758fa4e0f';
  private static readonly EMERGENCY_SEED_HASHES = [
    'ebea5dbccaaa1486532559de832900744b5ee8f92634be43a4abddf35fa52b6e',
    '667119d165a09b0db2cc89b70c540d87dec4b0ce20ec90a13cf9e27ae105fe9e',
    StorageService.EMERGENCY_SEED_HASH,
  ];

  /**
   * === AMÉLIORATION AJOUTÉE : récupération du compte de secours ===
   * Tant que le compte de secours n'a jamais été utilisé (empreinte d'un mot
   * de passe de secours toujours en place ET changement obligatoire en
   * attente), il reçoit le mot de passe temporaire actuel avec une nouvelle
   * fenêtre de validité : l'administrateur ne peut plus être bloqué par un
   * mot de passe perdu ou expiré. Dès qu'il a défini son propre mot de
   * passe, ce compte n'est plus jamais modifié ici.
   */
  private upgradeEmergencySeed(u: UserProfile): UserProfile {
    if (u.id !== 'usr-emergency-admin' || !u.mustChangePassword) return u;
    if (!u.passwordHash || !StorageService.EMERGENCY_SEED_HASHES.includes(u.passwordHash)) return u;
    return {
      ...u,
      passwordHash: StorageService.EMERGENCY_SEED_HASH,
      passwordSalt: StorageService.EMERGENCY_SEED_SALT,
      passwordSetAt: new Date().toISOString(),
    };
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  private persistEntities() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('entities');
    try {
      localStorage.setItem(STORAGE_KEYS.ENTITIES, JSON.stringify(this.entities));
    } catch (e) {
      console.error('Failed to persist entities', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('entities', e);
    }
  }

  private persistCategories() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('categories');
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
    } catch (e) {
      console.error('Failed to persist categories', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('categories', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de routage) ===
  private persistEscalationRecipients() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('escalationRecipients');
    try {
      localStorage.setItem(STORAGE_KEYS.ESCALATION_RECIPIENTS, JSON.stringify(this.escalationRecipients));
    } catch (e) {
      console.error('Failed to persist escalation recipients', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('escalation recipients', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  private persistCaseNumberCounters() {
    try {
      localStorage.setItem(STORAGE_KEYS.CASE_NUMBER_COUNTERS, JSON.stringify(this.caseNumberCounters));
    } catch (e) {
      console.error('Failed to persist case number counters', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('case number counters', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  private persistCountries() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('countries');
    try {
      localStorage.setItem(STORAGE_KEYS.COUNTRIES, JSON.stringify(this.countries));
    } catch (e) {
      console.error('Failed to persist countries', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('countries', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
  private persistSlaConfig() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('slaConfig');
    try {
      localStorage.setItem(STORAGE_KEYS.SLA_CONFIG, JSON.stringify(this.slaConfig));
    } catch (e) {
      console.error('Failed to persist SLA config', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('SLA config', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  private persistHierarchyLevels() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('hierarchyLevels');
    try {
      localStorage.setItem(STORAGE_KEYS.HIERARCHY_LEVELS, JSON.stringify(this.hierarchyLevels));
    } catch (e) {
      console.error('Failed to persist hierarchy levels', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('hierarchy levels', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) ===
  private persistRolePermissions() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('rolePermissions');
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(this.rolePermissions));
    } catch (e) {
      console.error('Failed to persist role permissions', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('role permissions', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  private persistWorkflowTransitions() {
    // === AMÉLIORATION AJOUTÉE (Phase 3) === configuration partagée entre les postes.
    this.onConfigPersist('workflowTransitions');
    try {
      localStorage.setItem(STORAGE_KEYS.WORKFLOW_TRANSITIONS, JSON.stringify(this.workflowTransitions));
    } catch (e) {
      console.error('Failed to persist workflow transitions', e);
      // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === échec rendu visible (PersistFailureBanner).
      reportPersistFailure('workflow transitions', e);
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

  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  // Format Groupe fourni par la DARC : XX(code entité)-YY(année)-
  // MM(mois)-XXXX(n° séquentiel sur 4 chiffres, remis à 0001 chaque début
  // de mois, PAR ENTITÉ). Remplace l'ancien suffixe aléatoire ACT-2026-XXXX
  // (Phase 26) utilisé par AlertSubmissionFlow. `entityCode` doit être
  // EntityDef.code (jamais deviné ici) ; `referenceDate` est injectable
  // pour les tests, sinon la date réelle de soumission.
  public generateCaseNumber(entityCode: string, referenceDate: Date = new Date()): string {
    const code = entityCode.trim().toUpperCase() || 'GRP';
    const yy = String(referenceDate.getFullYear()).slice(-2);
    const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const key = `${code}-${yy}${mm}`;
    const next = (this.caseNumberCounters[key] ?? 0) + 1;
    this.caseNumberCounters[key] = next;
    this.persistCaseNumberCounters();
    return `${code}-${yy}-${mm}-${String(next).padStart(4, '0')}`;
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

  /**
   * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
   * Remplace la copie locale des dossiers chargés depuis Firebase
   * (`cloudImported`) par `records`, sans toucher aux dossiers créés dans ce
   * navigateur. Un dossier qui n'est plus renvoyé par Firebase (supprimé, ou
   * plus visible pour ce compte : réattribué, mis en cause…) disparaît donc
   * aussi de ce navigateur. Synchronisation technique : ni audit, ni
   * `updatedAt`, ni écriture cloud ; rien n'est réécrit si rien n'a changé.
   */
  public replaceCloudImportedAlerts(records: AlertRecord[]): void {
    const incoming = records.map((r) => ({ ...r, cloudImported: true as const }));
    const previous = this.alerts.filter((a) => a.cloudImported);
    if (JSON.stringify(previous) === JSON.stringify(incoming)) return;
    const ids = new Set(incoming.map((r) => r.id));
    const kept = this.alerts.filter((a) => !a.cloudImported && !ids.has(a.id));
    this.alerts = [...kept, ...incoming];
    // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
    // état reçu du serveur : référence, jamais renvoyé.
    this.ensurePortalBaseline();
    this.resetPortalBaseline(incoming);
    this.persistAlerts();
    this.notify();
  }

  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 7 : lien
  // dossier local ↔ dossier réel) === Appelée en best-effort par
  // AlertSubmissionFlow.tsx une fois que le miroir Phase 4
  // (services/casesCloudSync.ts) a réussi, pour retenir l'identifiant réel
  // sur l'AlertRecord local. Silencieuse si le dossier n'existe déjà plus
  // (suppression concurrente, cas limite) : pas de logAudit ici, purement
  // technique et jamais affiché à l'écran, même principe que le miroir
  // lui-même ; pas de mise à jour de `updatedAt` non plus, pour ne jamais
  // faire apparaître ce lien comme une modification métier du dossier.
  /**
   * === AMÉLIORATION AJOUTÉE (messagerie déclarant → équipe) ===
   * Ajoute à un dossier créé dans ce navigateur les messages du déclarant
   * enregistrés sur le serveur (réponses envoyées depuis son téléphone).
   * Seuls les messages absents (même identifiant) sont ajoutés, triés par
   * date ; ni audit ni renvoi vers le serveur (ils en viennent).
   */
  public mergeReporterMessagesFromCloud(alertId: string, messages: CaseMessage[]): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || messages.length === 0) return;
    const known = new Set(alert.messages.map((m) => m.id));
    const added = messages.filter((m) => !known.has(m.id));
    // === AMÉLIORATION AJOUTÉE (documents du déclarant) === un message déjà
    // présent sans sa pièce jointe (version antérieure) la reçoit.
    const incomingById = new Map(messages.map((m) => [m.id, m]));
    let enriched = false;
    const current = alert.messages.map((m) => {
      const inc = incomingById.get(m.id);
      if (inc?.attachments?.length && !m.attachments?.length) {
        enriched = true;
        return { ...m, attachments: inc.attachments };
      }
      return m;
    });
    if (added.length === 0 && !enriched) return;
    alert.messages = [...current, ...added].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    this.persistAlerts();
    this.notify();
  }

  public linkMirroredCase(alertId: string, caseId: string, caseNumber: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;
    alert.mirroredCaseId = caseId;
    alert.mirroredCaseNumber = caseNumber;
    this.persistAlerts();
    this.notify();
  }

  /**
   * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : codes d'accès hérités) ===
   * Appelée par AlertTrackingView APRÈS une vérification réussie du code
   * d'accès du lanceur d'alerte : une empreinte encore au format historique
   * (SHA-256 itéré, ou code de démonstration stocké sans sel) est remplacée
   * par une empreinte PBKDF2 (nouveau sel). Même code d'accès, rien d'autre
   * ne change : ni `updatedAt`, ni entrée d'audit, ni synchronisation cloud
   * (même principe purement technique que `linkMirroredCase`). Un échec
   * n'affecte jamais l'accès au dossier.
   */
  public async upgradeAccessCodeHashIfNeeded(alertId: string, accessCode: string): Promise<void> {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || !accessCode || !alert.accessCodeHash) return;
    if (alert.accessCodeSalt && !needsRehash(alert.accessCodeHash)) return;
    try {
      const salt = generateSalt();
      const hash = await hashPassword(accessCode, salt);
      alert.accessCodeSalt = salt;
      alert.accessCodeHash = hash;
      this.persistAlerts();
    } catch (e) {
      console.warn('Access code hash upgrade skipped', e);
    }
  }

  // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 2) ===
  /** Une pièce de ce dossier est désormais enregistrée sur le serveur (téléchargeable depuis tout poste). */
  public markEvidenceStoredOnServer(alertId: string, evidenceId: string, caseId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return;
    let changed = false;
    alert.evidences = alert.evidences.map((e) => {
      if (e.id !== evidenceId || e.cloudCaseId) return e;
      changed = true;
      return { ...e, cloudCaseId: caseId };
    });
    if (alert.investigationReportFile?.id === evidenceId && !alert.investigationReportFile.cloudCaseId) {
      alert.investigationReportFile = { ...alert.investigationReportFile, cloudCaseId: caseId };
      changed = true;
    }
    if (!changed) return;
    this.persistAlerts();
    this.notify();
  }

  // === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
  /** Réglages des notifications e-mail (partagés entre les postes, appliqués par le serveur). */
  public getEmailNotificationSettings(): EmailNotificationSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_NOTIFICATIONS);
      return raw ? sanitizeEmailNotificationSettings(JSON.parse(raw)) : DEFAULT_EMAIL_NOTIFICATION_SETTINGS;
    } catch {
      return DEFAULT_EMAIL_NOTIFICATION_SETTINGS;
    }
  }

  private persistEmailNotificationSettings(settings: EmailNotificationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EMAIL_NOTIFICATIONS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to persist email notification settings', e);
    }
    this.onConfigPersist('emailNotifications');
  }

  /** Enregistre les réglages (validés) et les partage avec le serveur. Lève une Error si une adresse est invalide. */
  public updateEmailNotificationSettings(settings: EmailNotificationSettings, actor: UserProfile): void {
    const clean = sanitizeEmailNotificationSettings(settings);
    this.persistEmailNotificationSettings(clean);
    this.notify();
    this.logAudit('CONFIG_UPDATED', `Notifications e-mail (superviseurs, DARC, DGA, DRH) mises à jour par ${actor.name}.`, undefined, actor);
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
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14 : miroir
    // des mutations secondaires) === best-effort, jamais bloquant,
    // uniquement si ce dossier porte un lien réel actif. Import dynamique
    // (storage.ts est importé par la quasi-totalité de l'application).
    const mirroredCaseId = alert.mirroredCaseId;
    if (mirroredCaseId) {
      import('./caseMirrorSync')
        .then(({ mirrorAddTask, TASK_PRIORITY_TO_CASE_PRIORITY }) =>
          mirrorAddTask({
            caseId: mirroredCaseId,
            title: task.title,
            description: task.description,
            owner: task.owner,
            priority: TASK_PRIORITY_TO_CASE_PRIORITY[task.priority],
            dueDate: task.dueDate,
            clientId: task.id, // === AMÉLIORATION AJOUTÉE === même identifiant côté serveur
          })
        )
        .catch(() => {});
    }
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
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    const mirroredCaseId = alert.mirroredCaseId;
    if (mirroredCaseId) {
      import('./caseMirrorSync')
        .then(({ mirrorAddInterview }) =>
          mirrorAddInterview({
            caseId: mirroredCaseId,
            intervieweePersonId: interview.intervieweePersonId,
            intervieweeLabel: interview.intervieweeName,
            scheduledAt: interview.scheduledAt,
          })
        )
        .catch(() => {});
    }
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
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    const mirroredCaseId = alert.mirroredCaseId;
    if (mirroredCaseId) {
      import('./caseMirrorSync')
        .then(({ mirrorDeclareConflict }) =>
          mirrorDeclareConflict({ caseId: mirroredCaseId, outcome: declaration.outcome, details: declaration.details })
        )
        .catch(() => {});
    }
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
    // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
    // périmètre) === 'duplicate'/'out_of_scope' se synchronisent vers le
    // statut legacy 'closed' (syncLegacyStatus) mais, contrairement à une
    // vraie clôture (handleCloseAlert, InvestigationDesk.tsx),
    // closedAt/closedBy n'étaient jusqu'ici jamais renseignés par cette
    // méthode générique — un dossier ainsi classé restait invisible de
    // l'onglet Opérateur "Dossiers clôturés" (colonne "Clôturé le" vide,
    // prédicat `assignedInvestigators.length > 0` jamais vrai pour un
    // dossier jamais attribué). Corrigé ici plutôt que dupliqué côté UI.
    if ((toStatus === 'duplicate' || toStatus === 'out_of_scope') && !alert.closedAt) {
      alert.closedAt = alert.updatedAt;
      alert.closedBy = actor.name;
    }
    this.persistAlerts();
    this.notify();
    this.logAudit(
      'STATUS_CHANGED',
      `Statut du dossier ${alert.trackingNumber} : ${fromStatus} → ${toStatus}${reason ? ` (${reason})` : ''}.`,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 10 : miroir
    // du changement de statut) === best-effort, jamais attendu, jamais
    // bloquant — uniquement si ce dossier porte un lien réel actif (Phase
    // 7). Import dynamique : storage.ts est importé par la quasi-totalité
    // de l'application, jamais d'import statique d'un module qui touche
    // firebase/functions ici — voir services/statusMirrorSync.ts.
    const mirroredCaseId = alert.mirroredCaseId;
    // === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === le statut est
    // désormais enregistré par applyPortalUpdate (syncPortalChanges) ; l'ancien
    // envoi vers changeCaseStatus, refusé par la machine d'états du serveur,
    // n'inscrivait que de faux « changement de statut refusé » dans l'audit.
    if (mirroredCaseId && LEGACY_STATUS_MIRROR) {
      import('./statusMirrorSync')
        .then(({ mirrorStatusChangeToRealBackend }) => mirrorStatusChangeToRealBackend({ caseId: mirroredCaseId, to: toStatus, reason }))
        .catch(() => {});
    }
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
    // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
    // cause racine) === `applyCaseStatus` (services/statusMapping.ts)
    // remplace les deux affectations manuelles précédentes — même résultat,
    // mais désormais le même point de passage unique que
    // transitionStatus()/InvestigationDesk.tsx (clôture/réouverture/
    // archivage), pour qu'un futur appelant n'ait plus jamais à dupliquer
    // "status: X, workflowStatus: X" à la main.
    Object.assign(alert, applyCaseStatus(alert, 'escalated'));
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
      : ' Aucun compte activa-whistleblowing lié — notification e-mail uniquement.';
    this.logAudit(
      'CASE_ESCALATED',
      `Dossier ${alert.trackingNumber} escaladé vers ${recipient.nom} (${recipient.fonction}). Motif : "${reason}".` +
        (criteriaMatched.length > 0 ? ` Critères retenus : ${criteriaMatched.join(', ')}.` : '') +
        accessNote,
      { id: alert.id, trackingNumber: alert.trackingNumber },
      actor
    );
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 11 : miroir
    // de l'escalade) === même mécanisme exact que transitionStatus()
    // (Phase 10, services/statusMirrorSync.ts réutilisé tel quel) — best-
    // effort, jamais bloquant, uniquement si ce dossier porte un lien réel
    // actif. `to: 'escalated'` est une transition CaseStatus valide comme
    // une autre pour changeCaseStatus côté serveur ; seul le côté
    // "nouveau propriétaire" (assignedInvestigators/escalatedOwnerId,
    // ci-dessus) reste local pour l'instant — mirer aussi l'attribution
    // réelle (assignCase) est un chantier séparé, pas mélangé ici.
    const mirroredCaseId = alert.mirroredCaseId;
    // === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === le statut est
    // désormais enregistré par applyPortalUpdate (syncPortalChanges) ; l'ancien
    // envoi vers changeCaseStatus, refusé par la machine d'états du serveur,
    // n'inscrivait que de faux « changement de statut refusé » dans l'audit.
    if (mirroredCaseId && LEGACY_STATUS_MIRROR) {
      import('./statusMirrorSync')
        .then(({ mirrorStatusChangeToRealBackend }) => mirrorStatusChangeToRealBackend({ caseId: mirroredCaseId, to: 'escalated', reason }))
        .catch(() => {});
    }
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
      // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 12 :
      // miroir de l'attribution) === best-effort, jamais bloquant,
      // uniquement si ce dossier porte un lien réel actif ET qu'une
      // autorité a réellement été trouvée (voir assignmentMirrorSync.ts —
      // le cas "aucune autorité disponible" n'a pas d'équivalent honnête
      // côté serveur, jamais miré). `owner` devient l'assigné principal
      // réel, le reste de la liste locale (déjà filtrée des comptes
      // exclus) devient les enquêteurs additionnels.
      const mirroredCaseId = alert.mirroredCaseId;
      if (mirroredCaseId) {
        // === AMÉLIORATION AJOUTÉE (revue PR #139) === le backend identifie le
        // personnel par son compte Firebase (UID), pas par l'id local : on
        // transmet l'e-mail, identité commune résolue en UID côté serveur
        // (resolveStaffUid, functions/src/index.ts).
        const backendIdentity = (id: string) => this.users.find((u) => u.id === id)?.email || id;
        const additionalInvestigators = alert.assignedInvestigators.filter((id) => id !== owner.id).map(backendIdentity);
        import('./assignmentMirrorSync')
          .then(({ mirrorAssignmentToRealBackend }) => mirrorAssignmentToRealBackend({ caseId: mirroredCaseId, assignee: owner.email || owner.id, additionalInvestigators }))
          .catch(() => {});
      }
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
    // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 4) ===
    // copie sur le serveur : piste d'audit commune à tous les postes.
    import('./auditSync').then(({ queuePortalAudit }) => queuePortalAudit(entry)).catch(() => {});
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

  /**
   * === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) ===
   * Remplace la copie locale de l'annuaire Firebase (comptes
   * `authSource: 'firebase'`) par `accounts`, sans toucher aux comptes
   * locaux. Toute empreinte de mot de passe éventuellement reçue est
   * retirée : ces comptes ne se connectent que par Firebase Auth. La
   * session active est mise à jour si son compte figure dans l'annuaire.
   * Synchronisation technique : pas d'entrée d'audit.
   */
  public replaceFirebaseDirectory(accounts: UserProfile[]): void {
    const firebaseAccounts = accounts.map((a) => {
      const { passwordHash: _h, passwordSalt: _s, ...rest } = a;
      return { ...rest, authSource: 'firebase' as const };
    });
    const ids = new Set(firebaseAccounts.map((a) => a.id));
    const local = this.users.filter((u) => u.authSource !== 'firebase' && !ids.has(u.id));
    this.users = [...local, ...firebaseAccounts];
    this.persistUsers();
    const refreshedActive = firebaseAccounts.find((a) => a.id === this.activeUser?.id);
    if (refreshedActive) {
      this.setActiveUser({ ...this.activeUser, ...refreshedActive });
      return;
    }
    this.notify();
  }

  // === AMÉLIORATION AJOUTÉE (création de comptes par l'admin — mot de
  // passe temporaire, expiration 4h) ===
  // Durée de validité d'un mot de passe temporaire (tant qu'il n'a pas été
  // changé) : demande explicite de l'utilisateur (initialement 24h, réduite
  // à 4h sur nouvelle demande explicite).
  private static readonly TEMP_PASSWORD_TTL_MS = 4 * 60 * 60 * 1000;

  /**
   * Vérifie un IDENTIFIANT (jamais l'adresse e-mail, demande explicite —
   * `username`, distinct de `email`) + mot de passe pour la connexion staff.
   * Repli explicite pour d'éventuels comptes sans `passwordHash` (aucun
   * n'existe plus par défaut, mais un compte migré à la main pourrait en
   * manquer) — mot de passe fixe "demo". Un compte réellement créé par un
   * administrateur (voir AdminConfigView.tsx) passe lui par le hachage salé
   * réel ci-dessous.
   */
  public async verifyStaffLogin(
    username: string,
    password: string
  ): Promise<{ ok: true; user: UserProfile; mustChangePassword: boolean } | { ok: false; reason: 'not_found' | 'wrong_password' | 'expired' }> {
    // `u.username?.` : défense supplémentaire (voir migration dans init()) —
    // un compte sans identifiant ne doit jamais faire planter la connexion,
    // juste ne correspondre à aucune saisie.
    const user = this.users.find((u) => u.username?.toLowerCase() === username.trim().toLowerCase());
    if (!user) return { ok: false, reason: 'not_found' };
    // === AMÉLIORATION AJOUTÉE (comptes du personnel dans Firebase) === un
    // compte copié depuis l'annuaire Firebase n'a pas d'empreinte locale :
    // sans ce garde-fou, le repli "demo" ci-dessous l'ouvrirait. Il se
    // connecte uniquement par Firebase Auth (StaffLoginView.tsx).
    if (user.authSource === 'firebase') return { ok: false, reason: 'not_found' };

    if (!user.passwordHash || !user.passwordSalt) {
      return password === 'demo' ? { ok: true, user, mustChangePassword: false } : { ok: false, reason: 'wrong_password' };
    }

    if (user.mustChangePassword && user.passwordSetAt) {
      const ageMs = Date.now() - new Date(user.passwordSetAt).getTime();
      if (ageMs > StorageService.TEMP_PASSWORD_TTL_MS) {
        return { ok: false, reason: 'expired' };
      }
    }

    const passwordOk = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!passwordOk) return { ok: false, reason: 'wrong_password' };
    // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === le mot de passe vient
    // d'être prouvé : une empreinte encore au format historique (SHA-256
    // itéré) est recalculée en PBKDF2, sans aucune action de l'utilisateur.
    await this.upgradePasswordHashIfNeeded(user, password);
    return { ok: true, user, mustChangePassword: !!user.mustChangePassword };
  }

  /**
   * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) ===
   * Remplace une empreinte héritée par une empreinte PBKDF2 (nouveau sel)
   * après une vérification réussie. Mise à niveau purement technique : même
   * mot de passe, aucune entrée d'audit, `passwordSetAt` inchangé (aucune
   * incidence sur l'expiration ni sur l'obligation de changement).
   * Jamais pour un mot de passe TEMPORAIRE (`mustChangePassword`) : il sera
   * remplacé au premier changement (déjà en PBKDF2), et le compte de
   * secours doit garder son empreinte reconnaissable par
   * `upgradeEmergencySeed`. Un échec n'empêche jamais la connexion.
   */
  private async upgradePasswordHashIfNeeded(user: UserProfile, password: string): Promise<void> {
    if (user.mustChangePassword || !needsRehash(user.passwordHash)) return;
    try {
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      // Mise à jour en place : l'objet renvoyé à l'appelant (session active)
      // porte ainsi la même empreinte que la liste persistée.
      user.passwordSalt = salt;
      user.passwordHash = hash;
      this.persistUsers();
    } catch (e) {
      console.warn('Password hash upgrade skipped', e);
    }
  }

  /** Changement de mot de passe par l'utilisateur (première connexion ou volontaire) — lève l'obligation de changement. */
  public async changePassword(userId: string, newPassword: string, actor: UserProfile): Promise<void> {
    const salt = generateSalt();
    const hash = await hashPassword(newPassword, salt);
    this.updateUser(
      userId,
      { passwordHash: hash, passwordSalt: salt, mustChangePassword: false, passwordSetAt: new Date().toISOString() },
      actor
    );
    this.logAudit('CONFIG_UPDATED', `Mot de passe changé par ${actor.name}.`, undefined, actor);
  }

  /**
   * Régénère un mot de passe temporaire (admin) — utilisé à la création d'un
   * compte, ou pour en réémettre un si le précédent a expiré sans avoir été
   * utilisé. Retourne le mot de passe en clair UNE SEULE FOIS (jamais
   * persisté ailleurs qu'en tant que hash) — à l'appelant de l'afficher à
   * l'admin puis de l'oublier.
   */
  public async resetUserPassword(userId: string, actor: UserProfile): Promise<string> {
    const target = this.users.find((u) => u.id === userId);
    if (!target) throw new Error(`User ${userId} not found`);
    const plaintext = generateAccessPassword();
    const salt = generateSalt();
    const hash = await hashPassword(plaintext, salt);
    this.updateUser(
      userId,
      { passwordHash: hash, passwordSalt: salt, mustChangePassword: true, passwordSetAt: new Date().toISOString() },
      actor
    );
    this.logAudit('CONFIG_UPDATED', `Mot de passe temporaire régénéré pour "${target.name}" par ${actor.name}.`, undefined, actor);
    return plaintext;
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
    // === AMÉLIORATION AJOUTÉE (Phase 3) === remise à zéro LOCALE : la
    // configuration partagée du serveur n'est jamais écrasée par celle-ci.
    this.applyingSharedConfig = true;
    this.alerts = [...INITIAL_ALERTS];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.users = INITIAL_USERS.length > 0 ? [...INITIAL_USERS] : this.emergencyAdminSeed();
    this.activeUser = this.users[0];
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
    this.applyingSharedConfig = false;
    this.notify();
  }
}

export const storage = new StorageService();
