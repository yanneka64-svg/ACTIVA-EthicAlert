/**
 * ACTIVA Hotline — Target domain model (Phase 2)
 *
 * This is the normalized, Firestore-ready data model described in
 * `docs/DATABASE.md`. It is introduced ADDITIVELY: nothing in `src/types.ts`
 * (the legacy `AlertRecord` model consumed by the existing UI) is modified or
 * removed. This model is not yet wired into any screen — it exists so that
 * `src/data-access/caseRepository.ts` and `src/data-access/migrateLegacy.ts`
 * have a real, strongly-typed target to build against, ready for the Phase 3+
 * work (real backend, Control Panel, Investigation Workspace) to consume.
 *
 * Field-by-field rationale lives in docs/DATABASE.md — keep both in sync.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type ISODateString = string;

export type CaseLanguage = 'fr' | 'en' | 'pt';

export type HierarchyLevel = 'employee' | 'manager' | 'senior_manager' | 'director_plus';

export type ConfidentialityLevel = 'restricted' | 'confidential' | 'highly_confidential';

export type ReportingMode = 'anonymous' | 'identified';

export type SlaStatus = 'ok' | 'at_risk' | 'overdue' | 'escalated';

/** Every mutation-worthy record carries these so partial updates can be audited/merged safely. */
export interface Auditable {
  createdAt: ISODateString;
  createdBy: string; // userId, or 'system' / 'reporter'
  updatedAt: ISODateString;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Case lifecycle (see src/domain/workflow.ts for the state machine itself)
// ---------------------------------------------------------------------------

export type CaseStatus =
  | 'new'
  | 'triage'
  | 'under_review'
  | 'assigned'
  | 'investigation'
  | 'pending_information'
  | 'escalated'
  | 'conclusion_pending'
  | 'functional_review'
  | 'closed'
  | 'reopened'
  | 'archived'
  | 'duplicate'
  | 'out_of_scope';

export type CasePriority = 'low' | 'high' | 'very_high' | 'critical';

// ---------------------------------------------------------------------------
// Case (central object)
// ---------------------------------------------------------------------------

export interface Case extends Auditable {
  caseId: string; // immutable internal id, never displayed
  caseNumber: string; // e.g. "CASE-2026-000123" — human-facing, sequential, server-generated
  status: CaseStatus;

  category: string;
  subcategory: string;
  country: string;
  entity: string;

  reportingMode: ReportingMode;
  priority: CasePriority;
  riskScore: number; // denormalized copy of the latest active RiskAssessment.totalScore
  confidentialityLevel: ConfidentialityLevel;

  assignee?: string; // primary investigator userId
  additionalInvestigators: string[]; // userIds
  reviewer?: string; // functional reviewer userId

  slaStartAt?: ISODateString;
  slaDueAt?: ISODateString;
  slaStatus: SlaStatus;

  receivedAt: ISODateString;
  incidentDate?: ISODateString;
  incidentDateUnknown: boolean;

  description: string;
  impactType?: string;
  estimatedImpactValue?: string;

  closedAt?: ISODateString;
  closedBy?: string;
  archivedAt?: ISODateString;
  retentionUntil?: ISODateString; // computed at closure from the configured retention rule
  legalHold: boolean;

  // Global finding, ALWAYS DERIVED from Allegation.finding[] — never set directly by a human or an AI.
  overallFinding?: 'substantiated' | 'partially_substantiated' | 'unsubstantiated' | 'inconclusive' | 'mixed';
}

// ---------------------------------------------------------------------------
// Reporter identity & credentials — kept OUT of `Case` on purpose (see
// docs/DATABASE.md "isolation des identifiants"): an investigator granted
// read access to a Case must not automatically receive the reporter's
// voluntarily-provided identity.
// ---------------------------------------------------------------------------

export interface ReporterIdentity {
  caseId: string;
  isAnonymous: boolean;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  reporterType?: 'employee' | 'consultant' | 'supplier' | 'customer' | 'business_partner' | 'other';
  email?: string;
  phone?: string;
  // Every read of this document by a staff user MUST be written to audit_logs
  // with actionType = 'REPORTER_IDENTITY_ACCESSED' (see caseRepository.ts).
}

export interface ReporterCredentials {
  caseId: string;
  accessCodeHash: string;
  accessCodeSalt: string;
}

// ---------------------------------------------------------------------------
// Allegations
// ---------------------------------------------------------------------------

export type FindingOutcome =
  | 'SUBSTANTIATED'
  | 'PARTIALLY_SUBSTANTIATED'
  | 'UNSUBSTANTIATED'
  | 'INCONCLUSIVE'
  | 'OUT_OF_SCOPE'
  | 'DUPLICATE';

export interface Allegation extends Auditable {
  allegationId: string;
  caseId: string;
  category: string;
  subcategory: string;
  description: string;
  status: 'open' | 'assessed';
  finding?: FindingOutcome;
  findingRationale?: string;
  findingDocumentedBy?: string;
  findingDocumentedAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Persons (subjects & witnesses unified, distinguished by `kind`)
// ---------------------------------------------------------------------------

export interface Person extends Auditable {
  personId: string;
  caseId: string;
  kind: 'subject' | 'witness';
  name: string;
  position?: string;
  entity?: string;
  country?: string;
  hierarchyLevel?: HierarchyLevel;
  allegedRole?: string; // only meaningful for kind = 'subject'; always neutral wording (never "guilty")
  contactInfo?: string; // witnesses only, optional
  notes?: string;
  /**
   * If this person is also a platform user, their userId goes here.
   * The repository MUST refuse to grant that userId access to this case
   * (see docs/DATABASE.md — "un utilisateur mis en cause ne doit jamais
   * accéder à son propre dossier").
   */
  linkedUserId?: string;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface Evidence extends Auditable {
  evidenceId: string;
  caseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
  /** Never a public URL — resolved through a signed, short-lived, audited Cloud Function call. */
  storagePath?: string;
  version: number;
  previousVersionId?: string;
  sha256Hash?: string;
  confidentiality: 'standard' | 'restricted';
  status: 'active' | 'superseded' | 'deleted';
}

// ---------------------------------------------------------------------------
// Tasks & Interviews
// ---------------------------------------------------------------------------

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface Task extends Auditable {
  taskId: string;
  caseId: string;
  title: string;
  description?: string;
  owner: string; // userId
  priority: CasePriority;
  dueDate: ISODateString;
  status: TaskStatus;
  completedAt?: ISODateString;
  notes?: string;
}

export interface Interview extends Auditable {
  interviewId: string;
  caseId: string;
  intervieweePersonId?: string; // linked Person, if applicable
  intervieweeLabel: string; // free text fallback
  scheduledAt?: ISODateString;
  conductedAt?: ISODateString;
  conductedBy: string; // userId
  summary?: string;
  status: 'planned' | 'completed' | 'cancelled';
}

// ---------------------------------------------------------------------------
// Notes & Communications — kept as two DISTINCT entities/collections on
// purpose: a reporter must never be able to read investigation_notes.
// ---------------------------------------------------------------------------

export interface InvestigationNote extends Auditable {
  noteId: string;
  caseId: string;
  authorId: string;
  content: string;
}

export interface Communication extends Auditable {
  messageId: string;
  caseId: string;
  sender: 'reporter' | 'investigator' | 'system';
  senderDisplayName: string;
  content: string;
  attachments?: string[]; // Evidence ids
}

// ---------------------------------------------------------------------------
// Findings (global, aggregated view — see Allegation.finding for the source of truth)
// ---------------------------------------------------------------------------

export interface FindingSummary {
  caseId: string;
  overallFinding: Case['overallFinding'];
  summary: string;
  documentedBy: string;
  documentedAt: ISODateString;
  /** Set only once a human reviewer has signed off — never true from AI output alone. */
  humanApproved: boolean;
}

// ---------------------------------------------------------------------------
// Corrective actions
// ---------------------------------------------------------------------------

export type CorrectiveActionStatus = 'open' | 'in_progress' | 'completed' | 'overdue' | 'not_applicable';

export interface CorrectiveAction extends Auditable {
  actionId: string;
  caseId: string;
  description: string;
  owner: string;
  entity?: string;
  dueDate: ISODateString;
  priority: CasePriority;
  status: CorrectiveActionStatus;
  completedAt?: ISODateString;
  supportingEvidenceIds?: string[];
  effectivenessReviewDue?: ISODateString;
  effectivenessReviewedAt?: ISODateString;
  effectivenessReviewedBy?: string;
}

// ---------------------------------------------------------------------------
// Risk assessment — preserves original vs override, per section 20 of the brief
// ---------------------------------------------------------------------------

export interface RiskAssessment extends Auditable {
  assessmentId: string;
  caseId: string;
  financialImpact: 1 | 2 | 3 | 4;
  hierarchicalLevel: 1 | 2 | 3 | 4;
  recurrence: 1 | 2 | 3 | 4;
  reputationRisk: 1 | 2 | 3 | 4;
  totalScore: number;
  priority: CasePriority;
  isOverride: boolean;
  originalScore?: number;
  overrideReason?: string;
  active: boolean; // only one RiskAssessment per case should be active at a time
}

// ---------------------------------------------------------------------------
// Timeline — generated FROM real recorded events, never hand-authored
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  eventId: string;
  caseId: string;
  label: string; // e.g. "REPORT_RECEIVED", "RISK_ASSESSED", "ASSIGNED"...
  actor: string;
  timestamp: ISODateString;
  details?: string;
}

// ---------------------------------------------------------------------------
// Conflict of interest declarations
// ---------------------------------------------------------------------------

export interface ConflictOfInterestDeclaration {
  caseId: string;
  userId: string;
  declaredAt: ISODateString;
  outcome: 'no_conflict' | 'conflict_identified';
  details?: string;
}

// ---------------------------------------------------------------------------
// Users, roles, permissions (see src/domain/permissions.ts for the enforcement logic)
// ---------------------------------------------------------------------------

export type RoleId =
  | 'reporter'
  | 'investigator'
  | 'senior_investigator'
  | 'functional_admin'
  | 'darc_compliance'
  | 'consultation'
  | 'system_admin'
  | 'executive';

export interface AppUser {
  userId: string;
  name: string;
  email: string;
  roleId: RoleId;
  countries: string[]; // scope — empty array = no country restriction (global, admin-style roles only)
  entities: string[]; // scope
  active: boolean;
  mfaEnabled: boolean;
  createdAt: ISODateString;
  disabledAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Configuration (must never be hard-coded in components — see permissions.ts /
// workflow.ts for how this is consumed once Phase 7 wires it up)
// ---------------------------------------------------------------------------

export interface RiskMatrixLevelConfig {
  level: 1 | 2 | 3 | 4;
  label: string;
  description: string;
}

export interface RiskMatrixConfig {
  financialImpact: RiskMatrixLevelConfig[];
  hierarchicalLevel: RiskMatrixLevelConfig[];
  recurrence: RiskMatrixLevelConfig[];
  reputationRisk: RiskMatrixLevelConfig[];
  priorityThresholds: Array<{ priority: CasePriority; minScore: number; maxScore: number; slaHours: number }>;
}

export interface SlaRuleConfig {
  priority: CasePriority;
  targetHours: number;
  reminderBeforeHours: number[];
  escalateToRoleId: RoleId;
}
