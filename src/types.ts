export type Language = 'fr' | 'en' | 'pt';

// --- Level 2: Roles & Granular Permissions (CDC 46) ---
export type UserRole = 
  | 'whistleblower' 
  | 'investigator' 
  | 'functional_admin' 
  | 'system_admin' 
  | 'auditor';

export type GranularPermission = 
  | 'cases.read'
  | 'cases.create'
  | 'cases.assign'
  | 'cases.reassign'
  | 'cases.edit'
  | 'cases.close'
  | 'cases.reopen'
  | 'cases.export'
  | 'evidence.read'
  | 'evidence.upload'
  | 'evidence.delete'
  | 'communications.read'
  | 'communications.send'
  | 'reports.read'
  | 'reports.export'
  | 'configuration.manage'
  | 'users.manage'
  | 'audit.read';

export interface RoleDefinition {
  roleId: string;
  name: string;
  description: string;
  permissions: GranularPermission[];
}

export interface UserProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  roleIds?: string[];
  roleTitle: string;
  entity: string;
  entityIds?: string[];
  country: string;
  countryIds?: string[];
  department?: string;
  jobTitle?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  mfaEnabled?: boolean;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

// --- Workflow Statuses (CDC 56) ---
export type EnterpriseWorkflowStatus = 
  | 'NEW'
  | 'TRIAGE'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'INVESTIGATION'
  | 'PENDING_INFORMATION'
  | 'ESCALATED'
  | 'CONCLUSION_PENDING'
  | 'FUNCTIONAL_REVIEW'
  | 'CLOSED'
  | 'REOPENED'
  | 'ARCHIVED';

// Backward compatibility alias
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

// --- Risk Scoring (CDC 55) ---
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

export interface RiskAssessmentRecord {
  assessmentId: string;
  caseId: string;
  financialImpactScore: number;
  hierarchicalLevelScore: number;
  recurrenceScore: number;
  reputationRiskScore: number;
  totalScore: number;
  priority: PriorityLevel;
  assessmentType: 'AUTOMATIC' | 'MANUAL';
  originalScore?: number;
  overrideScore?: number;
  overrideReason?: string;
  assessedBy: string;
  assessedAt: string;
}

// --- Allegations Model (CDC 50) ---
export type AllegationFinding = 
  | 'SUBSTANTIATED'
  | 'PARTIALLY_SUBSTANTIATED'
  | 'UNSUBSTANTIATED'
  | 'INCONCLUSIVE'
  | 'OUT_OF_SCOPE'
  | 'DUPLICATE';

export interface AllegationItem {
  allegationId: string;
  caseId: string;
  categoryId: string;
  subcategoryId?: string;
  description: string;
  status: 'PENDING' | 'INVESTIGATING' | 'EVALUATED';
  finding?: AllegationFinding;
  findingRationale?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Persons Involved (CDC 51) ---
export interface InvolvedPerson {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position: string;
  entityId?: string;
  countryId?: string;
  hierarchicalLevel?: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  hierarchyRole?: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  roleInCase?: 'SUBJECT' | 'PRIMARY_SUBJECT' | 'SECONDARY_SUBJECT';
  contactInformation?: string;
  notes?: string;
}

export interface Witness {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position: string;
  entityId?: string;
  countryId?: string;
  hierarchicalLevel?: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  hierarchyRole?: 'Employé' | 'Cadre' | 'Sous-Directeur' | 'Directeur+';
  roleInCase?: 'DIRECT_WITNESS' | 'CORROBORATING_WITNESS';
  contactInformation?: string;
  notes?: string;
}

// --- Evidence Architecture (CDC 52) ---
export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl?: string;
  storagePath?: string; // /cases/{caseId}/evidence/{evidenceId}/{version}
  version?: number;
  hash?: string;
  confidentialityLevel?: 'NORMAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  status?: 'ACTIVE' | 'ARCHIVED';
  uploadedBy?: string;
}

// --- Investigation Workspace (CDC 53) ---
export interface InvestigationTask {
  taskId: string;
  caseId: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string;
  completedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  confidentialityLevel?: 'INTERNAL_ONLY' | 'DARC_MANAGERS_ONLY';
  isPrivate: boolean; // strictly internal
}

// --- Communication Model (CDC 54) ---
export type MessageSenderType = 'REPORTER' | 'INVESTIGATOR' | 'SYSTEM' | 'FUNCTIONAL_ADMINISTRATOR';

export interface CaseMessage {
  id: string;
  sender: 'whistleblower' | 'investigator' | 'admin';
  senderType?: MessageSenderType;
  senderId?: string;
  senderDisplayName: string;
  content: string;
  createdAt: string;
  readAt?: string;
  visibility?: 'ALL_PARTIES' | 'DESK_ONLY';
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

// --- Anonymous Reporter Access & Identity Separation (CDC 49) ---
export interface ReporterAccess {
  accessId: string;
  caseId: string;
  accessCodeHash: string;
  passwordHash?: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  lastAccessAt?: string;
}

export interface ReporterIdentity {
  caseId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  function?: string;
  department?: string;
  reporterType?: 'Employé' | 'Consultant' | 'Prestataire' | 'Client' | 'Autre';
  entityId?: string;
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

// --- Conflict of Interest Model (CDC 59) ---
export interface CaseConflictDeclaration {
  conflictId: string;
  caseId: string;
  userId: string;
  userName: string;
  conflictStatus: 'NO_CONFLICT' | 'CONFLICT_IDENTIFIED' | 'RESOLVED';
  conflictType?: 'SUBJECT_RELATION' | 'HIERARCHICAL' | 'FINANCIAL' | 'PERSONAL';
  declaration: string;
  declaredAt: string;
  resolvedBy?: string;
  resolution?: string;
  resolvedAt?: string;
}

// --- Core Alert/Case Record (CDC 48) ---
export interface AlertRecord {
  id: string;
  trackingNumber: string; // ex: ACT-2026-0842
  accessCodeHash: string; // password to access
  channel: 'web' | 'qr_code' | 'direct';
  createdAt: string;
  updatedAt: string;
  targetCompletionDate?: string;
  
  // Whistleblower info (if not anonymous)
  whistleblower: WhistleblowerInfo;

  // Incident Details
  category: string;
  categoryId?: string;
  subCategory: string;
  subcategoryId?: string;
  customViolationType?: string;
  detailedDescription: string;
  incidentDates: string; // no future dates
  incidentLocation: string;
  concernedEntity: string;
  entityId?: string;
  country: string;
  countryId?: string;
  
  // Risk assessment & Priority
  riskEvaluation: RiskEvaluation;
  riskScore?: number;
  overridePriority?: PriorityLevel;
  overrideReason?: string;

  // Impact
  impactType: string;
  estimatedImpactValue?: string;

  // Involved parties
  involvedPersons: InvolvedPerson[];
  witnesses: Witness[];
  evidences: EvidenceFile[];
  allegations?: AllegationItem[];

  // Investigation & Management
  status: AlertStatus;
  enterpriseStatus?: EnterpriseWorkflowStatus;
  assignedInvestigators: string[]; // Investigator IDs
  assignedInvestigatorNames: string[];
  currentAssigneeId?: string;
  primaryInvestigatorId?: string;
  reviewerId?: string;

  // SLA tracking (CDC 60)
  slaStartAt?: string;
  slaDueAt?: string;
  slaDaysRemaining?: number;
  isOverdue?: boolean;

  // Retention & Archival (CDC 73)
  retentionDate?: string; // 10 years maximum after closure
  legalHold?: boolean;
  archivedAt?: string;

  // Closure
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
  tasks?: InvestigationTask[];
}

// --- SLA Rules Engine (CDC 60) ---
export interface SlaRule {
  ruleId: string;
  priority: PriorityLevel;
  category?: string;
  targetHours: number;
  escalationLevel: number;
  reminderScheduleHours: number[];
}

// --- Notification Engine (CDC 61) ---
export interface NotificationItem {
  id: string;
  recipientId: string;
  caseId: string;
  caseTrackingNumber?: string;
  type: 'CASE_ASSIGNED' | 'SLA_APPROACHING' | 'SLA_OVERDUE' | 'NEW_MESSAGE' | 'STATUS_CHANGED' | 'CONFLICT_DECLARED';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// --- Audit Log Architecture (CDC 62) ---
export interface AuditLogEntry {
  id: string;
  alertId?: string;
  caseId?: string;
  trackingNumber?: string;
  actorId?: string;
  authorId: string;
  actorType?: 'USER' | 'SYSTEM' | 'REPORTER' | 'ADMIN';
  authorName: string;
  authorRole: string;
  action?: string;
  actionType: 
    | 'ALERT_SUBMITTED' 
    | 'ALERT_ACCESSED' 
    | 'PRIORITY_MODIFIED' 
    | 'INVESTIGATOR_ASSIGNED' 
    | 'CONFLICT_DECLARED'
    | 'MESSAGE_SENT' 
    | 'INTERNAL_NOTE_ADDED' 
    | 'CORRECTIVE_MEASURE_ADDED' 
    | 'STATUS_CHANGED' 
    | 'SLA_ESCALATED'
    | 'ALERT_CLOSED' 
    | 'ALERT_REOPENED' 
    | 'ALERT_ARCHIVED' 
    | 'LEGAL_HOLD_TOGGLED'
    | 'REPORT_GENERATED' 
    | 'CONFIG_UPDATED';
  objectType?: string;
  objectId?: string;
  previousValue?: string;
  newValue?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  ipMetadata?: string;
  reason?: string;
}

// --- Reporting Aggregation (CDC 64) ---
export interface AggregatedReportingData {
  generatedAt: string;
  totalCases: number;
  activeCases: number;
  closedCases: number;
  overdueCases: number;
  averageResolutionDays: number;
  byPriority: Record<PriorityLevel, number>;
  byEntity: Record<string, number>;
  byCountry: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  nocaDistribution: Record<NocaThreshold, number>;
}
