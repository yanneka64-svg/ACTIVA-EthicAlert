// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
// `UserRole` était un union à 5 valeurs propre à ce modèle de démonstration
// local, en parallèle du modèle RBAC à 10 rôles + permissions granulaires
// déjà construit et testé dans src/domain/ (Phase 2, puis étendu Phase 12.1)
// mais jamais branché sur l'application réelle. Décision explicite de
// l'utilisateur : remplacer ce modèle, pas le dupliquer — `UserRole` est
// désormais un simple alias de `RoleId`, source de vérité unique. Toute la
// logique d'habilitation (qui voit quoi) passe maintenant par
// `src/services/authz.ts`, qui s'appuie sur `src/domain/permissions.ts`
// (roleHasPermission / can) au lieu de comparaisons de rôle codées en dur
// éparpillées dans chaque écran.
import { RoleId, ConfidentialityLevel, CaseStatus } from './domain/caseTypes';

export type Language = 'fr' | 'en' | 'pt';

export type UserRole = RoleId;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  entity: string;
  country: string;
  avatar?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // Périmètre d'habilitation réel du collaborateur, en complément (jamais en
  // remplacement) des champs `entity`/`country` ci-dessus qui restent le
  // simple libellé d'affichage "entité de rattachement" utilisé partout
  // aujourd'hui. Tableau vide ou absent = aucune restriction (rôles à
  // vision Groupe : functional_admin, darc_compliance, consultation,
  // executive — voir GLOBAL_VISIBILITY_ROLES dans domain/permissions.ts).
  // Non consommé par aucun écran avant la Phase 2 (src/hooks/useVisibleAlerts.ts).
  countries?: string[];
  entities?: string[];
  // Plafond de confidentialité propre à CE compte, quand il doit différer
  // du plafond par défaut du rôle (ROLE_MAX_CONFIDENTIALITY). Absent =
  // comportement inchangé (plafond du rôle appliqué tel quel).
  sensitivityClearance?: ConfidentialityLevel;
  // Disponibilité pour se voir attribuer de nouveaux dossiers (moteur de
  // compatibilité d'attribution, Phase 4). Absent traité comme `true` —
  // aucun compte existant ne devient silencieusement indisponible.
  active?: boolean;
}

export type AlertStatus = 
  | 'new'
  | 'under_review'
  | 'investigation'
  | 'corrective_action'
  | 'closed'
  | 'archived'
  | 'reopened';

export type PriorityLevel = 'faible' | 'elevee' | 'tres_elevee' | 'critique';
export type NocaThreshold = 'NOCA 1' | 'NOCA 2' | 'NOCA 3' | 'NOCA 4';

// === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
// Dimension SÉVÉRITÉ, distincte du RISQUE (RiskEvaluation.priority/NOCA
// ci-dessus). Aujourd'hui les deux notions sont fusionnées dans un seul
// score NOCA ; ce nouveau champ, optionnel, permet de les évaluer
// séparément sans toucher au champ `priority`/`riskEvaluation` existant
// (voir AlertRecord.severity plus bas).
export type SeverityLevel = 'mineure' | 'moderee' | 'majeure' | 'critique';

export interface RiskEvaluation {
  financialImpact: 1 | 2 | 3 | 4; // <5k€, 5-10k€, 10-20k€, >20k€
  hierarchyLevel: 1 | 2 | 3 | 4; // Employe, Cadre, Sous Directeur, Directeur
  recidivism: 1 | 2 | 3 | 4; // Aucune, Possible, Confirmee (3), Confirmee (4)
  reputationRisk: 1 | 2 | 3 | 4; // Negligeable, Modere, Eleve, Eleve
  totalScore: number;
  nocaThreshold: NocaThreshold;
  priority: PriorityLevel;
  expectedTreatment: string;
}

export interface InvolvedPerson {
  id: string;
  name: string;
  position: string;
  hierarchyRole: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  // Rattachement optionnel de cette personne mise en cause à un compte réel
  // de la plateforme (UserProfile.id), renseigné au triage par un
  // opérateur/enquêteur qui la reconnaît (voir InvestigationDesk.tsx,
  // Phase 2). Absent = personne externe, comportement inchangé. Dès que
  // ce champ est défini, le routage indépendant (domain/independentRouting.ts,
  // Phase 3-4) exclut automatiquement ce compte de l'accès au dossier.
  linkedUserId?: string;
}

export interface Witness {
  id: string;
  name: string;
  position: string;
  hierarchyRole: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  // Même rattachement optionnel que InvolvedPerson.linkedUserId ci-dessus.
  // Un témoin lié est un facteur de conflit pour une CIBLE de routage
  // (il ne peut pas hériter le dossier), mais n'est PAS exclu de la
  // visibilité du dossier — seule la personne mise en cause l'est (§49).
  linkedUserId?: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl?: string;
}

export interface InternalNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  isPrivate: boolean; // strictly internal
}

export interface CaseMessage {
  id: string;
  sender: 'whistleblower' | 'investigator' | 'admin';
  senderDisplayName: string;
  content: string;
  createdAt: string;
  attachments?: EvidenceFile[];
}

export interface CorrectiveMeasure {
  id: string;
  title: string;
  description: string;
  responsiblePerson: string;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'implemented' | 'verified';
  documentedBy: string;
  documentedAt: string;
}

export interface WhistleblowerInfo {
  isAnonymous: boolean;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  declarantType?: 'Employé' | 'Consultant' | 'Prestataire' | 'Fournisseur' | 'Client' | 'Partenaire' | 'Autre';
  entity?: string;
  email?: string;
  phone?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 26 — champ additif, maquette de référence) ===
  // Pays du déclarant (distinct du pays de l'entité concernée) — optionnel,
  // n'affecte aucun enregistrement existant qui ne le renseigne pas.
  declarantCountry?: string;
}

export interface AlertRecord {
  id: string;
  trackingNumber: string; // ex: ACT-2026-0842
  accessCode?: string; // ex: 7F3K-9Q2Q
  accessCodeHash: string; // salted iterated-SHA-256 hash of the access password (never plaintext)
  accessCodeSalt: string; // per-record random salt used to compute accessCodeHash
  channel: 'web' | 'qr_code' | 'direct';
  createdAt: string;
  updatedAt: string;
  targetCompletionDate?: string;
  
  // Whistleblower info (if not anonymous)
  whistleblower: WhistleblowerInfo;

  // Incident Details
  category: string;
  subCategory: string;
  customViolationType?: string;
  detailedDescription: string;
  incidentDates: string; // no future dates
  incidentLocation: string;
  concernedEntity: string;
  country: string;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // Identifiants stables (FK vers ACTIVA_COUNTRIES.code / ACTIVA_ENTITIES.id
  // dans src/data/activaConfig.ts), en complément — jamais en remplacement —
  // des champs texte libre `concernedEntity`/`country` ci-dessus, que tous
  // les écrans existants continuent de lire sans changement. Optionnels :
  // un dossier créé avant cette phase n'en dispose pas et reste valide (le
  // rattachement pays/entité "structurant" au sens du moteur de visibilité
  // — Phase 2 — ne s'applique alors simplement pas à ce dossier).
  countryId?: string;
  entityId?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 26 — champ additif, maquette de référence) ===
  // Indique si les faits signalés sont toujours en cours au moment du dépôt.
  // Optionnel : les dossiers existants sans cette information restent valides.
  isOngoing?: boolean;

  // Risk assessment
  riskEvaluation: RiskEvaluation;
  overridePriority?: PriorityLevel;
  overrideReason?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // Dimension SÉVÉRITÉ, volontairement distincte du RISQUE ci-dessus
  // (riskEvaluation/overridePriority restent le score NOCA existant,
  // inchangé). Optionnel : un dossier sans valeur n'est simplement pas
  // encore évalué sur cet axe.
  severity?: SeverityLevel;

  // Impact
  impactType: string;
  estimatedImpactValue?: string;

  // Involved parties
  involvedPersons: InvolvedPerson[];
  witnesses: Witness[];
  evidences: EvidenceFile[];

  // Investigation & Management
  status: AlertStatus;
  // === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
  // Nouveau statut "riche" (14 valeurs, domain/caseTypes.ts CaseStatus),
  // réutilisant la machine à états déjà testée de domain/workflow.ts,
  // maintenu en permanence synchronisé avec `status` ci-dessus (jamais une
  // seconde source de vérité indépendante) via
  // storage.transitionStatus()/services/statusMapping.ts. `status` reste
  // le champ que tout écran existant continue de lire sans changement.
  // Optionnel : absent tant qu'aucune transition n'est passée par le
  // nouveau chemin.
  workflowStatus?: CaseStatus;
  assignedInvestigators: string[]; // Investigator IDs
  assignedInvestigatorNames: string[];
  closureSummary?: string;
  closureMessageToWhistleblower?: string;
  closedAt?: string;
  closedBy?: string;
  reopenReason?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // Escalade vers la DARC Groupe (brief §14/§44). Le pays/entité d'origine
  // ci-dessus (country/concernedEntity/countryId/entityId) ne sont JAMAIS
  // modifiés par une escalade — seul le "propriétaire" du dossier change,
  // via escalatedOwnerId (voir Phase 5, storage.escalateAlert). Optionnels :
  // absent tant qu'aucune escalade n'a eu lieu.
  escalatedAt?: string;
  escalatedBy?: string;
  escalatedReason?: string;
  escalatedOwnerId?: string;
  // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
  // Routage indépendant (brief §47-68) : lorsqu'une personne mise en cause
  // est rattachée à un compte réel (InvolvedPerson.linkedUserId/
  // Witness.linkedUserId), storage.triggerIndependentRouting() (Phase 4)
  // calcule ici les comptes exclus de tout accès au dossier, et réutilise
  // escalatedAt/By/Reason/OwnerId ci-dessus (jamais de champs dupliqués)
  // pour enregistrer vers qui le dossier a été routé et pourquoi.
  // independentRoutingUnresolved = true quand aucune autorité indépendante
  // n'a été trouvée (ex. le rôle opérationnel le plus élevé est lui-même
  // mis en cause) : nécessite une intervention manuelle, volontairement un
  // indicateur orthogonal plutôt qu'une extension de workflowStatus.
  independentRoutingExcludedUserIds?: string[];
  independentRoutingUnresolved?: boolean;

  // Communication & Notes
  internalNotes: InternalNote[];
  messages: CaseMessage[];
  correctiveMeasures: CorrectiveMeasure[];

  // === AMÉLIORATION AJOUTÉE (Phase 1) === additive, all optional — see the
  // block above AuditLogEntry for the full rationale.
  tasks?: CaseTask[];
  interviews?: CaseInterview[];
  conflictDeclarations?: ConflictDeclaration[];
  // === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
  // Réutilise `ConfidentialityLevel` du modèle domain/ (même valeurs que
  // celles déjà appliquées par `can()`/`ROLE_MAX_CONFIDENTIALITY`) plutôt
  // que d'en recréer un. Optionnel et rétrocompatible : un dossier sans
  // cette valeur (tout enregistrement créé avant cette phase) est traité
  // comme `restricted` — le niveau le moins sensible, donc son accès ne se
  // restreint jamais silencieusement pour personne — voir
  // src/services/authz.ts `canSeeAlertConfidentiality`.
  confidentialityLevel?: ConfidentialityLevel;
}

// === AMÉLIORATION AJOUTÉE (Phase 1 — frontend completion, data model extension) ===
// Everything below is purely additive to support the enterprise-grade
// screens (Control Panel, investigator workspace, notifications) the
// frontend-completion brief asks for, without touching a single existing
// field above. All new AlertRecord fields are optional so every existing
// record (seeded or already in a user's localStorage) keeps working
// unchanged; nothing here is consumed by a screen until later phases wire
// it in explicitly.

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface CaseTask {
  id: string;
  title: string;
  description?: string;
  owner: string; // UserProfile.id
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
}

export interface CaseInterview {
  id: string;
  intervieweeName: string;
  intervieweePersonId?: string; // InvolvedPerson.id or Witness.id, if linked
  scheduledAt?: string;
  conductedAt?: string;
  conductedBy: string;
  summary?: string;
  status: 'planned' | 'completed' | 'cancelled';
}

export interface ConflictDeclaration {
  id: string;
  userId: string;
  userName: string;
  declaredAt: string;
  outcome: 'no_conflict' | 'conflict_identified';
  details?: string;
}

// Richer 12-status lifecycle the brief's Control Panel/workspace vocabulary
// uses (§14-33). Derived FROM the existing, authoritative `AlertStatus` by
// a pure function (src/services/statusMapping.ts) — never stored as a
// separate source of truth, so nothing that reads `AlertRecord.status`
// today is affected.
export type EnterpriseWorkflowStatus =
  | 'NEW'
  | 'TRIAGE'
  | 'ASSIGNED'
  | 'INVESTIGATION'
  | 'PENDING_INFORMATION'
  | 'ESCALATED'
  | 'CONCLUSION_PENDING'
  | 'FUNCTIONAL_REVIEW'
  | 'CLOSED'
  | 'REOPENED'
  | 'ARCHIVED';

export type SlaStatus = 'on_track' | 'at_risk' | 'overdue';

// A real, computed (never hand-authored) notification — generated from
// existing AlertRecord/AuditLogEntry data by storage.ts, not a separately
// persisted, editable record. See storage.getNotifications().
export interface AppNotification {
  id: string;
  type: 'new_message' | 'sla_at_risk' | 'sla_overdue' | 'task_overdue' | 'case_reopened' | 'evidence_added' | 'closure_requested';
  alertId: string;
  trackingNumber: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AuditLogEntry {
  id: string;
  alertId?: string;
  trackingNumber?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  actionType: 
    | 'ALERT_SUBMITTED' 
    | 'ALERT_ACCESSED' 
    | 'PRIORITY_MODIFIED' 
    | 'INVESTIGATOR_ASSIGNED' 
    | 'MESSAGE_SENT' 
    | 'INTERNAL_NOTE_ADDED' 
    | 'CORRECTIVE_MEASURE_ADDED' 
    | 'STATUS_CHANGED' 
    | 'ALERT_CLOSED' 
    | 'ALERT_REOPENED'
    | 'ALERT_ARCHIVED'
    | 'REPORT_GENERATED'
    | 'CONFIG_UPDATED'
    | 'LEGAL_HOLD_TOGGLED'
    // === AMÉLIORATION AJOUTÉE : traçabilité des tentatives d'accès refusées (rate limiting) ===
    | 'ACCESS_DENIED'
    // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
    | 'CASE_ESCALATED'
    // === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
    | 'INDEPENDENT_ROUTING_TRIGGERED'
    | 'NO_INDEPENDENT_AUTHORITY_FOUND';
  details: string;
  timestamp: string;
  ipAddress?: string;
}
