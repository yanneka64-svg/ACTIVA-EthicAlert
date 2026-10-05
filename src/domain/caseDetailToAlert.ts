/**
 * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
 *
 * Convertit le détail COMPLET d'un dossier Firebase (Cloud Function
 * `getCaseDetails` : dossier + personnes, tâches, entretiens, notes,
 * communications, mesures correctives, évaluation de risque active,
 * déclarations de conflit, métadonnées de pièces) en `AlertRecord`, le
 * format lu par tous les écrans du portail.
 *
 * Contrairement à `caseToAlertSummary` (résumé pour le Centre de Pilotage,
 * tableaux volontairement vides), ici chaque tableau est réellement rempli
 * depuis Firebase : la fiche dossier peut donc s'appuyer dessus.
 *
 * Correspondances : inverses exactes des tables déjà utilisées dans l'autre
 * sens (data-access/migrateLegacy.ts, services/caseMirrorSync.ts, mesure
 * corrective envoyée sous la forme « titre — description »). Valeurs sans
 * équivalent local, documentées plutôt que devinées :
 * - tâche annulée (`cancelled`) : absente du statut local → omise ;
 * - action corrective `overdue` → `in_progress`, `not_applicable` →
 *   `verified` (plus d'action attendue) ;
 * - pièces : métadonnées seulement (le contenu du fichier n'est pas
 *   stocké dans Firebase tant que Cloud Storage n'est pas branché).
 *
 * Fusion avec la copie locale existante : seuls les champs dont Firebase
 * est la référence sont remplacés (CLOUD_FIELDS). Les champs propres au
 * navigateur (escalade, rapport d'enquête, synthèse de clôture, pièces
 * jointes avec contenu…) sont conservés, pour qu'une synchronisation
 * n'efface jamais un travail local.
 */
import {
  AlertRecord,
  CaseInterview,
  CaseMessage,
  CaseTask,
  ConflictDeclaration,
  CorrectiveMeasure,
  EvidenceFile,
  InternalNote,
  InvolvedPerson,
  PriorityLevel,
  TaskPriority,
  Witness,
} from '../types';
import {
  Case,
  CasePriority,
  Communication,
  ConflictOfInterestDeclaration,
  CorrectiveAction,
  Evidence,
  HierarchyLevel,
  Interview,
  InvestigationNote,
  Person,
  RiskAssessment,
  Task,
} from './caseTypes';
import { caseSummaryId, caseToAlertSummary } from './caseToAlertSummary';

/** Réponse de la Cloud Function `getCaseDetails` pour un dossier. */
export interface CaseDetail {
  case: Case;
  persons: Person[];
  tasks: Task[];
  interviews: Interview[];
  notes: InvestigationNote[];
  communications: Communication[];
  correctiveActions: CorrectiveAction[];
  riskAssessment: RiskAssessment | null;
  coiDeclarations: ConflictOfInterestDeclaration[];
  evidence: Evidence[];
}

const HIERARCHY_TO_ROLE: Record<HierarchyLevel, InvolvedPerson['hierarchyRole']> = {
  employee: 'Employé',
  manager: 'Cadre',
  senior_manager: 'Sous-Directeur',
  director_plus: 'Directeur+',
};

/** Inverse de TASK_PRIORITY_TO_CASE_PRIORITY (caseMirrorSync.ts). */
const CASE_PRIORITY_TO_TASK_PRIORITY: Record<CasePriority, TaskPriority> = {
  low: 'low',
  high: 'medium',
  very_high: 'high',
  critical: 'high',
};

const CASE_PRIORITY_TO_LOCAL: Record<CasePriority, PriorityLevel> = {
  low: 'faible',
  high: 'elevee',
  very_high: 'tres_elevee',
  critical: 'critique',
};

const CORRECTIVE_STATUS_TO_LOCAL: Record<CorrectiveAction['status'], CorrectiveMeasure['status']> = {
  open: 'planned',
  in_progress: 'in_progress',
  completed: 'implemented',
  overdue: 'in_progress',
  not_applicable: 'verified',
};

const SENDER_TO_LOCAL: Record<Communication['sender'], CaseMessage['sender']> = {
  reporter: 'whistleblower',
  investigator: 'investigator',
  system: 'admin',
};

/** Séparateur utilisé à l'envoi d'une mesure corrective (useCorrectiveMeasureForm.ts). */
const CORRECTIVE_TITLE_SEPARATOR = ' — ';

/** Champs dont Firebase est la référence pour un dossier chargé depuis Firebase. */
const CLOUD_FIELDS: (keyof AlertRecord)[] = [
  'id',
  'trackingNumber',
  'channel',
  'createdAt',
  'updatedAt',
  'targetCompletionDate',
  'confidentialityLevel',
  'category',
  'subCategory',
  'detailedDescription',
  'incidentDates',
  // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
  'incidentLocation',
  'isOngoing',
  'customViolationType',
  'concernedEntity',
  'country',
  'impactType',
  'estimatedImpactValue',
  'riskEvaluation',
  'involvedPersons',
  'witnesses',
  'status',
  'workflowStatus',
  'assignedInvestigators',
  'assignedInvestigatorNames',
  'closedAt',
  'closedBy',
  'internalNotes',
  'messages',
  'correctiveMeasures',
  'tasks',
  'interviews',
  'conflictDeclarations',
  'mirroredCaseId',
  'mirroredCaseNumber',
  'cloudImported',
];

function personToLocal(p: Person): InvolvedPerson {
  return {
    id: p.personId,
    name: p.name,
    position: p.position ?? '',
    hierarchyRole: p.hierarchyLevel ? HIERARCHY_TO_ROLE[p.hierarchyLevel] : 'Employé',
    ...(p.linkedUserId ? { linkedUserId: p.linkedUserId } : {}),
  };
}

function correctiveToLocal(a: CorrectiveAction): CorrectiveMeasure {
  const sep = a.description.indexOf(CORRECTIVE_TITLE_SEPARATOR);
  const title = sep > 0 ? a.description.slice(0, sep) : a.description;
  const description = sep > 0 ? a.description.slice(sep + CORRECTIVE_TITLE_SEPARATOR.length) : '';
  return {
    id: a.actionId,
    title,
    description,
    responsiblePerson: a.owner,
    dueDate: a.dueDate,
    status: CORRECTIVE_STATUS_TO_LOCAL[a.status] ?? 'planned',
    documentedBy: a.createdBy,
    documentedAt: a.createdAt,
    ...(a.completedAt ? { closedAt: a.completedAt } : {}),
  };
}

/**
 * Convertit le détail d'un dossier Firebase et le fusionne avec sa copie
 * locale éventuelle. `nameOf` résout un identifiant de compte en nom affiché
 * (annuaire du personnel) ; à défaut, l'identifiant brut est conservé.
 */
export function caseDetailToAlertRecord(
  detail: CaseDetail,
  existing: AlertRecord | undefined,
  nameOf: (userId: string) => string | undefined
): AlertRecord {
  const kase = detail.case;
  const base = caseToAlertSummary(kase);
  const displayName = (id: string | undefined) => (id ? nameOf(id) ?? id : '');
  const risk = detail.riskAssessment;

  const tasks: CaseTask[] = detail.tasks
    .filter((t) => t.status !== 'cancelled')
    .map((t) => ({
      id: t.taskId,
      title: t.title,
      ...(t.description ? { description: t.description } : {}),
      owner: t.owner,
      dueDate: t.dueDate,
      priority: CASE_PRIORITY_TO_TASK_PRIORITY[t.priority] ?? 'medium',
      status: t.status as CaseTask['status'],
      createdAt: t.createdAt,
      createdBy: t.createdBy,
      ...(t.completedAt ? { completedAt: t.completedAt } : {}),
    }));

  const interviews: CaseInterview[] = detail.interviews.map((i) => ({
    id: i.interviewId,
    intervieweeName: i.intervieweeLabel,
    ...(i.intervieweePersonId ? { intervieweePersonId: i.intervieweePersonId } : {}),
    ...(i.scheduledAt ? { scheduledAt: i.scheduledAt } : {}),
    ...(i.conductedAt ? { conductedAt: i.conductedAt } : {}),
    conductedBy: i.conductedBy,
    ...(i.summary ? { summary: i.summary } : {}),
    status: i.status,
  }));

  const internalNotes: InternalNote[] = detail.notes.map((n) => ({
    id: n.noteId,
    authorId: n.authorId,
    authorName: displayName(n.authorId),
    authorRole: '',
    content: n.content,
    createdAt: n.createdAt,
    isPrivate: true,
  }));

  const messages: CaseMessage[] = detail.communications.map((c) => ({
    id: c.messageId,
    sender: SENDER_TO_LOCAL[c.sender] ?? 'admin',
    senderDisplayName: c.senderDisplayName,
    content: c.content,
    createdAt: c.createdAt,
  }));

  const conflictDeclarations: ConflictDeclaration[] = detail.coiDeclarations.map((d) => ({
    id: `coi-${d.userId}-${d.declaredAt}`,
    userId: d.userId,
    userName: displayName(d.userId),
    declaredAt: d.declaredAt,
    outcome: d.outcome,
    ...(d.details ? { details: d.details } : {}),
  }));

  const cloudEvidence: EvidenceFile[] = detail.evidence.map((e) => ({
    id: e.evidenceId,
    name: e.fileName,
    size: e.fileSize,
    type: e.fileType,
    uploadedAt: e.createdAt,
    ...(e.description ? { description: e.description } : {}),
    uploadedBy: displayName(e.createdBy),
  }));

  const assigned = base.assignedInvestigators;
  const fresh: AlertRecord = {
    ...base,
    id: caseSummaryId(kase.caseId),
    trackingNumber: kase.externalReference || kase.caseNumber,
    channel: kase.createdBy === 'reporter' ? 'web' : 'direct',
    workflowStatus: kase.status,
    riskEvaluation: risk
      ? {
          ...base.riskEvaluation,
          financialImpact: risk.financialImpact,
          hierarchyLevel: risk.hierarchicalLevel,
          recidivism: risk.recurrence,
          reputationRisk: risk.reputationRisk,
          totalScore: risk.totalScore,
          priority: CASE_PRIORITY_TO_LOCAL[risk.priority] ?? base.riskEvaluation.priority,
        }
      : base.riskEvaluation,
    involvedPersons: detail.persons.filter((p) => p.kind === 'subject').map(personToLocal),
    witnesses: detail.persons.filter((p) => p.kind === 'witness').map(personToLocal) as Witness[],
    evidences: cloudEvidence,
    assignedInvestigatorNames: assigned.map((id) => displayName(id)),
    ...(kase.closedBy ? { closedBy: displayName(kase.closedBy) } : {}),
    internalNotes,
    messages,
    correctiveMeasures: detail.correctiveActions.map(correctiveToLocal),
    tasks,
    interviews,
    conflictDeclarations,
    mirroredCaseId: kase.caseId,
    mirroredCaseNumber: kase.caseNumber,
    cloudImported: true,
  };

  if (!existing) return fresh;

  const merged: AlertRecord = { ...existing };
  for (const key of CLOUD_FIELDS) {
    (merged as unknown as Record<string, unknown>)[key] = (fresh as unknown as Record<string, unknown>)[key];
  }
  // Pièces : celles connues de Firebase, plus celles ajoutées dans ce
  // navigateur (avec leur contenu) que Firebase ne connaît pas encore.
  const cloudIds = new Set(cloudEvidence.map((e) => e.id));
  merged.evidences = [...cloudEvidence, ...existing.evidences.filter((e) => !cloudIds.has(e.id))];
  return merged;
}
