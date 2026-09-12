export type Language = 'fr' | 'en' | 'pt';

export type UserRole = 
  | 'whistleblower' 
  | 'investigator' 
  | 'functional_admin' 
  | 'system_admin' 
  | 'auditor';

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
  accessCodeHash: string; // password to access
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
    | 'CONFIG_UPDATED';
  details: string;
  timestamp: string;
  ipAddress?: string;
}
