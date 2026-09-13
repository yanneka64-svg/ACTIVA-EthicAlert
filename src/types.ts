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
import { RoleId } from './domain/caseTypes';

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
}

export interface Witness {
  id: string;
  name: string;
  position: string;
  hierarchyRole: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
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
  declarantType?: 'Employé' | 'Consultant' | 'Prestataire' | 'Client' | 'Autre';
  entity?: string;
  email?: string;
  phone?: string;
}

export interface AlertRecord {
  id: string;
  trackingNumber: string; // ex: ACT-2026-0842
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
  
  // Risk assessment
  riskEvaluation: RiskEvaluation;
  overridePriority?: PriorityLevel;
  overrideReason?: string;

  // Impact
  impactType: string;
  estimatedImpactValue?: string;

  // Involved parties
  involvedPersons: InvolvedPerson[];
  witnesses: Witness[];
  evidences: EvidenceFile[];

  // Investigation & Management
  status: AlertStatus;
  assignedInvestigators: string[]; // Investigator IDs
  assignedInvestigatorNames: string[];
  closureSummary?: string;
  closureMessageToWhistleblower?: string;
  closedAt?: string;
  closedBy?: string;
  reopenReason?: string;
  reopenedAt?: string;
  reopenedBy?: string;

  // Communication & Notes
  internalNotes: InternalNote[];
  messages: CaseMessage[];
  correctiveMeasures: CorrectiveMeasure[];

  // === AMÉLIORATION AJOUTÉE (Phase 1) === additive, all optional — see the
  // block above AuditLogEntry for the full rationale.
  tasks?: CaseTask[];
  interviews?: CaseInterview[];
  conflictDeclarations?: ConflictDeclaration[];
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
    | 'ACCESS_DENIED';
  details: string;
  timestamp: string;
  ipAddress?: string;
}
