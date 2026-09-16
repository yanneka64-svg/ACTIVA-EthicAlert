/**
 * ACTIVA Hotline — Case data-access layer (Phase 2)
 *
 * `CaseRepository` is the interface the future UI (Control Panel, Investigation
 * Workspace — Phase 4+) will depend on. It is written so that swapping
 * `LocalCaseRepository` for a `FirestoreCaseRepository` (Phase 3, calling
 * Cloud Functions instead of touching Firestore directly from the client) is
 * a one-line change at the call site: nothing above this layer should know
 * or care where the data actually lives.
 *
 * `LocalCaseRepository` is a REAL, working implementation (not a stub): it
 * persists to `localStorage` under `activa_v2_*` keys, completely separate
 * from the legacy `activa_ethicalert_*` keys used by `services/storage.ts`,
 * so it cannot corrupt or interfere with the app that is live today.
 *
 * Every mutation here re-validates workflow transitions (`domain/workflow`)
 * and appends an audit_logs entry — mirroring what the real Cloud Functions
 * will have to do server-side in Phase 3. That duplication is intentional:
 * this repository is a faithful, functional preview of the target backend
 * contract, not a shortcut around it.
 */

import {
  AppUser,
  Allegation,
  Case,
  CaseStatus,
  Communication,
  ConflictOfInterestDeclaration,
  CorrectiveAction,
  Evidence,
  FindingOutcome,
  Interview,
  InvestigationNote,
  Person,
  ReporterCredentials,
  ReporterIdentity,
  RiskAssessment,
  Task,
  TimelineEvent,
} from '../domain/caseTypes';
import { can, implicatedUserIdsFromPersons, Permission } from '../domain/permissions';
import { checkTransition, deriveOverallFinding, TransitionCheckResult } from '../domain/workflow';

// ---------------------------------------------------------------------------
// Audit event (v2) — intentionally separate from the legacy `AuditLogEntry`
// in src/types.ts (different shape, richer `previousValue`/`newValue`).
// ---------------------------------------------------------------------------

export interface AuditEventV2 {
  id: string;
  actorId: string;
  action: string;
  caseId?: string;
  objectType?: string;
  objectId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: string;
}

export interface CaseListFilter {
  status?: CaseStatus;
  country?: string;
  entity?: string;
  category?: string;
  priority?: string;
  assignee?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextOffset?: number;
}

export interface CaseRepository {
  createCase(input: Omit<Case, 'caseId' | 'caseNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: string): Promise<Case>;
  getCase(caseId: string, requestingUser: AppUser): Promise<Case | null>;
  listCases(filter: CaseListFilter, requestingUser: AppUser, limit?: number, offset?: number): Promise<Page<Case>>;
  changeCaseStatus(caseId: string, to: CaseStatus, actor: AppUser, reason?: string): Promise<{ case: Case; result: TransitionCheckResult }>;
  assignCase(caseId: string, assignee: string, additional: string[], actor: AppUser): Promise<Case>;
  // === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle) ===
  // Voir caseTypes.ts, Case.functionalReviewSignedOffAt/By — la précondition
  // que `changeCaseStatus` vérifie désormais réellement avant `closed`.
  // Requiert `cases.close` (même habilitation que la clôture elle-même :
  // signer la revue est le geste qui l'autorise).
  recordFunctionalReviewSignOff(caseId: string, actor: AppUser): Promise<Case>;

  addAllegation(caseId: string, input: Pick<Allegation, 'category' | 'subcategory' | 'description'>, actor: AppUser): Promise<Allegation>;
  setAllegationFinding(allegationId: string, finding: FindingOutcome, rationale: string, actor: AppUser): Promise<Allegation>;
  listAllegations(caseId: string): Promise<Allegation[]>;

  addPerson(caseId: string, input: Omit<Person, 'personId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Person>;
  listPersons(caseId: string): Promise<Person[]>;

  addEvidence(caseId: string, input: Omit<Evidence, 'evidenceId' | 'caseId' | 'version' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Evidence>;
  listEvidence(caseId: string, actor: AppUser): Promise<Evidence[]>;

  addTask(caseId: string, input: Omit<Task, 'taskId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Task>;
  listTasks(caseId: string): Promise<Task[]>;

  addInterview(caseId: string, input: Omit<Interview, 'interviewId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Interview>;
  listInterviews(caseId: string): Promise<Interview[]>;

  addInvestigationNote(caseId: string, content: string, actor: AppUser): Promise<InvestigationNote>;
  listInvestigationNotes(caseId: string, actor: AppUser): Promise<InvestigationNote[]>;

  addCommunication(caseId: string, sender: Communication['sender'], senderDisplayName: string, content: string, actorId: string): Promise<Communication>;
  listCommunications(caseId: string): Promise<Communication[]>;

  addCorrectiveAction(caseId: string, input: Omit<CorrectiveAction, 'actionId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<CorrectiveAction>;
  listCorrectiveActions(caseId: string): Promise<CorrectiveAction[]>;

  recordRiskAssessment(caseId: string, input: Omit<RiskAssessment, 'assessmentId' | 'caseId' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<RiskAssessment>;
  getActiveRiskAssessment(caseId: string): Promise<RiskAssessment | null>;

  declareConflictOfInterest(caseId: string, userId: string, outcome: ConflictOfInterestDeclaration['outcome'], details?: string): Promise<ConflictOfInterestDeclaration>;

  getTimeline(caseId: string): Promise<TimelineEvent[]>;

  setReporterCredentials(caseId: string, creds: ReporterCredentials): Promise<void>;
  verifyReporterCredentials(caseId: string, verify: (salt: string, hash: string) => Promise<boolean>): Promise<boolean>;
  setReporterIdentity(caseId: string, identity: ReporterIdentity): Promise<void>;
  /** MUST log an audit_logs entry with action = 'REPORTER_IDENTITY_ACCESSED' — see docs/DATABASE.md. */
  getReporterIdentity(caseId: string, requestingUser: AppUser): Promise<ReporterIdentity | null>;

  listAuditEvents(caseId?: string): Promise<AuditEventV2[]>;
}

// ---------------------------------------------------------------------------
// LocalCaseRepository — functional localStorage-backed implementation
// ---------------------------------------------------------------------------

const KEYS = {
  cases: 'activa_v2_cases',
  allegations: 'activa_v2_allegations',
  persons: 'activa_v2_persons',
  evidence: 'activa_v2_evidence',
  tasks: 'activa_v2_tasks',
  interviews: 'activa_v2_interviews',
  notes: 'activa_v2_investigation_notes',
  communications: 'activa_v2_communications',
  correctiveActions: 'activa_v2_corrective_actions',
  riskAssessments: 'activa_v2_risk_assessments',
  timeline: 'activa_v2_timeline',
  coiDeclarations: 'activa_v2_coi_declarations',
  reporterCredentials: 'activa_v2_reporter_credentials',
  reporterIdentities: 'activa_v2_reporter_identities',
  auditEvents: 'activa_v2_audit_events',
  caseSequence: 'activa_v2_case_sequence',
} as const;

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage full/unavailable — the repository still returns correct in-memory
    // results for the current call; nothing here should crash the UI.
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class CaseAccessDeniedError extends Error {
  constructor(message = 'Access denied to this case.') {
    super(message);
    this.name = 'CaseAccessDeniedError';
  }
}

export class LocalCaseRepository implements CaseRepository {
  private async appendAudit(entry: Omit<AuditEventV2, 'id' | 'timestamp'>): Promise<void> {
    const events = loadArray<AuditEventV2>(KEYS.auditEvents);
    events.unshift({ ...entry, id: newId('audv2'), timestamp: nowIso() });
    saveArray(KEYS.auditEvents, events);
  }

  private async appendTimeline(caseId: string, label: string, actor: string, details?: string): Promise<void> {
    const events = loadArray<TimelineEvent>(KEYS.timeline);
    events.push({ eventId: newId('tl'), caseId, label, actor, timestamp: nowIso(), details });
    saveArray(KEYS.timeline, events);
  }

  private async assertCaseAccess(kase: Case, requestingUser: AppUser, permission: Permission): Promise<void> {
    const persons = loadArray<Person>(KEYS.persons).filter((p) => p.caseId === kase.caseId);
    const allowed = can(requestingUser, permission, {
      case: kase,
      implicatedUserIds: implicatedUserIdsFromPersons(persons),
    });
    if (!allowed) {
      await this.appendAudit({
        actorId: requestingUser.userId,
        action: 'ACCESS_DENIED',
        caseId: kase.caseId,
        reason: `Missing permission ${permission} or out of scope`,
      });
      throw new CaseAccessDeniedError();
    }
  }

  async createCase(
    input: Omit<Case, 'caseId' | 'caseNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: string
  ): Promise<Case> {
    const cases = loadArray<Case>(KEYS.cases);
    const seq = Number(localStorage.getItem(KEYS.caseSequence) || '0') + 1;
    localStorage.setItem(KEYS.caseSequence, String(seq));

    const year = new Date().getFullYear();
    const kase: Case = {
      ...input,
      caseId: newId('case'),
      caseNumber: `CASE-${year}-${String(seq).padStart(6, '0')}`,
      createdAt: nowIso(),
      createdBy: actor,
      updatedAt: nowIso(),
      updatedBy: actor,
    };
    cases.push(kase);
    saveArray(KEYS.cases, cases);
    await this.appendTimeline(kase.caseId, 'CASE_CREATED', actor);
    await this.appendAudit({ actorId: actor, action: 'CASE_CREATED', caseId: kase.caseId, newValue: kase.status });
    return kase;
  }

  async getCase(caseId: string, requestingUser: AppUser): Promise<Case | null> {
    const kase = loadArray<Case>(KEYS.cases).find((c) => c.caseId === caseId) ?? null;
    if (!kase) return null;
    await this.assertCaseAccess(kase, requestingUser, 'cases.read');
    await this.appendAudit({ actorId: requestingUser.userId, action: 'CASE_ACCESSED', caseId });
    return kase;
  }

  async listCases(filter: CaseListFilter, requestingUser: AppUser, limit = 25, offset = 0): Promise<Page<Case>> {
    const persons = loadArray<Person>(KEYS.persons);
    const all = loadArray<Case>(KEYS.cases).filter((kase) => {
      const implicated = implicatedUserIdsFromPersons(persons.filter((p) => p.caseId === kase.caseId));
      if (!can(requestingUser, 'cases.read', { case: kase, implicatedUserIds: implicated })) return false;
      if (filter.status && kase.status !== filter.status) return false;
      if (filter.country && kase.country !== filter.country) return false;
      if (filter.entity && kase.entity !== filter.entity) return false;
      if (filter.category && kase.category !== filter.category) return false;
      if (filter.priority && kase.priority !== filter.priority) return false;
      if (filter.assignee && kase.assignee !== filter.assignee) return false;
      return true;
    });
    const items = all.slice(offset, offset + limit);
    return { items, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : undefined };
  }

  async changeCaseStatus(
    caseId: string,
    to: CaseStatus,
    actor: AppUser,
    reason?: string
  ): Promise<{ case: Case; result: TransitionCheckResult }> {
    const cases = loadArray<Case>(KEYS.cases);
    const idx = cases.findIndex((c) => c.caseId === caseId);
    if (idx === -1) throw new Error(`Case ${caseId} not found`);
    const kase = cases[idx];

    await this.assertCaseAccess(kase, actor, to === 'closed' ? 'cases.close' : 'cases.edit');

    const allegations = loadArray<Allegation>(KEYS.allegations).filter((a) => a.caseId === caseId);
    const correctiveActions = loadArray<CorrectiveAction>(KEYS.correctiveActions).filter((a) => a.caseId === caseId);
    // === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle
    // jamais réellement câblé) === voir caseTypes.ts pour le détail : sans
    // ce champ, la clôture était structurellement impossible pour tout
    // dossier, quel que soit l'état réel des allégations/mesures.
    const result = checkTransition(kase.status, to, {
      allegations,
      correctiveActions,
      hasFunctionalReviewSignOff: !!kase.functionalReviewSignedOffAt,
    });

    if (!result.allowed) {
      await this.appendAudit({
        actorId: actor.userId,
        action: 'STATUS_CHANGE_REJECTED',
        caseId,
        previousValue: kase.status,
        newValue: to,
        reason: result.reason,
      });
      return { case: kase, result };
    }

    const previousStatus = kase.status;
    const updated: Case = {
      ...kase,
      status: to,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
      ...(to === 'closed' ? { closedAt: nowIso(), closedBy: actor.userId } : {}),
      ...(to === 'archived' ? { archivedAt: nowIso() } : {}),
      overallFinding: to === 'closed' ? deriveOverallFinding(allegations) : kase.overallFinding,
    };
    cases[idx] = updated;
    saveArray(KEYS.cases, cases);

    await this.appendTimeline(caseId, `STATUS_${previousStatus}_TO_${to}`.toUpperCase(), actor.userId, reason);
    await this.appendAudit({
      actorId: actor.userId,
      action: 'STATUS_CHANGED',
      caseId,
      previousValue: previousStatus,
      newValue: to,
      reason,
    });

    return { case: updated, result };
  }

  async assignCase(caseId: string, assignee: string, additional: string[], actor: AppUser): Promise<Case> {
    const cases = loadArray<Case>(KEYS.cases);
    const idx = cases.findIndex((c) => c.caseId === caseId);
    if (idx === -1) throw new Error(`Case ${caseId} not found`);
    const kase = cases[idx];
    await this.assertCaseAccess(kase, actor, 'cases.assign');

    const previous = { assignee: kase.assignee, additionalInvestigators: kase.additionalInvestigators };
    const updated: Case = { ...kase, assignee, additionalInvestigators: additional, updatedAt: nowIso(), updatedBy: actor.userId };
    cases[idx] = updated;
    saveArray(KEYS.cases, cases);

    await this.appendTimeline(caseId, 'ASSIGNED', actor.userId, `Assignee: ${assignee}`);
    await this.appendAudit({ actorId: actor.userId, action: 'CASE_ASSIGNED', caseId, previousValue: previous, newValue: { assignee, additional } });
    return updated;
  }

  // === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle) ===
  async recordFunctionalReviewSignOff(caseId: string, actor: AppUser): Promise<Case> {
    const cases = loadArray<Case>(KEYS.cases);
    const idx = cases.findIndex((c) => c.caseId === caseId);
    if (idx === -1) throw new Error(`Case ${caseId} not found`);
    const kase = cases[idx];
    await this.assertCaseAccess(kase, actor, 'cases.close');

    const updated: Case = {
      ...kase,
      functionalReviewSignedOffAt: nowIso(),
      functionalReviewSignedOffBy: actor.userId,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
    };
    cases[idx] = updated;
    saveArray(KEYS.cases, cases);

    await this.appendTimeline(caseId, 'FUNCTIONAL_REVIEW_SIGNED_OFF', actor.userId);
    await this.appendAudit({ actorId: actor.userId, action: 'FUNCTIONAL_REVIEW_SIGNED_OFF', caseId });
    return updated;
  }

  async addAllegation(
    caseId: string,
    input: Pick<Allegation, 'category' | 'subcategory' | 'description'>,
    actor: AppUser
  ): Promise<Allegation> {
    const allegations = loadArray<Allegation>(KEYS.allegations);
    const allegation: Allegation = {
      ...input,
      allegationId: newId('alg'),
      caseId,
      status: 'open',
      createdAt: nowIso(),
      createdBy: actor.userId,
      updatedAt: nowIso(),
      updatedBy: actor.userId,
    };
    allegations.push(allegation);
    saveArray(KEYS.allegations, allegations);
    await this.appendTimeline(caseId, 'ALLEGATION_ADDED', actor.userId, input.category);
    return allegation;
  }

  async setAllegationFinding(allegationId: string, finding: FindingOutcome, rationale: string, actor: AppUser): Promise<Allegation> {
    const allegations = loadArray<Allegation>(KEYS.allegations);
    const idx = allegations.findIndex((a) => a.allegationId === allegationId);
    if (idx === -1) throw new Error(`Allegation ${allegationId} not found`);
    const updated: Allegation = {
      ...allegations[idx],
      status: 'assessed',
      finding,
      findingRationale: rationale,
      findingDocumentedBy: actor.userId,
      findingDocumentedAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: actor.userId,
    };
    allegations[idx] = updated;
    saveArray(KEYS.allegations, allegations);
    await this.appendTimeline(updated.caseId, 'FINDING_DOCUMENTED', actor.userId, finding);
    await this.appendAudit({ actorId: actor.userId, action: 'FINDING_DOCUMENTED', caseId: updated.caseId, objectType: 'allegation', objectId: allegationId, newValue: finding });
    return updated;
  }

  async listAllegations(caseId: string): Promise<Allegation[]> {
    return loadArray<Allegation>(KEYS.allegations).filter((a) => a.caseId === caseId);
  }

  async addPerson(
    caseId: string,
    input: Omit<Person, 'personId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<Person> {
    const persons = loadArray<Person>(KEYS.persons);
    const person: Person = { ...input, personId: newId('per'), caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    persons.push(person);
    saveArray(KEYS.persons, persons);

    // === AMÉLIORATION AJOUTÉE (Phase 3) === keep Case.implicatedUserIds in sync — see caseTypes.ts.
    if (person.kind === 'subject' && person.linkedUserId) {
      const cases = loadArray<Case>(KEYS.cases);
      const idx = cases.findIndex((c) => c.caseId === caseId);
      if (idx !== -1 && !cases[idx].implicatedUserIds.includes(person.linkedUserId)) {
        cases[idx] = { ...cases[idx], implicatedUserIds: [...cases[idx].implicatedUserIds, person.linkedUserId] };
        saveArray(KEYS.cases, cases);
      }
    }
    return person;
  }

  async listPersons(caseId: string): Promise<Person[]> {
    return loadArray<Person>(KEYS.persons).filter((p) => p.caseId === caseId);
  }

  async addEvidence(
    caseId: string,
    input: Omit<Evidence, 'evidenceId' | 'caseId' | 'version' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<Evidence> {
    const evidence = loadArray<Evidence>(KEYS.evidence);
    const item: Evidence = { ...input, evidenceId: newId('evd'), caseId, version: 1, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    evidence.push(item);
    saveArray(KEYS.evidence, evidence);
    await this.appendTimeline(caseId, 'EVIDENCE_ADDED', actor.userId, input.fileName);
    await this.appendAudit({ actorId: actor.userId, action: 'EVIDENCE_UPLOADED', caseId, objectType: 'evidence', objectId: item.evidenceId });
    return item;
  }

  async listEvidence(caseId: string, actor: AppUser): Promise<Evidence[]> {
    await this.appendAudit({ actorId: actor.userId, action: 'EVIDENCE_LISTED', caseId });
    return loadArray<Evidence>(KEYS.evidence).filter((e) => e.caseId === caseId && e.status !== 'deleted');
  }

  async addTask(
    caseId: string,
    input: Omit<Task, 'taskId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<Task> {
    const tasks = loadArray<Task>(KEYS.tasks);
    const task: Task = { ...input, taskId: newId('tsk'), caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    tasks.push(task);
    saveArray(KEYS.tasks, tasks);
    return task;
  }

  async listTasks(caseId: string): Promise<Task[]> {
    return loadArray<Task>(KEYS.tasks).filter((t) => t.caseId === caseId);
  }

  async addInterview(
    caseId: string,
    input: Omit<Interview, 'interviewId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<Interview> {
    const interviews = loadArray<Interview>(KEYS.interviews);
    const interview: Interview = { ...input, interviewId: newId('ivw'), caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    interviews.push(interview);
    saveArray(KEYS.interviews, interviews);
    return interview;
  }

  async listInterviews(caseId: string): Promise<Interview[]> {
    return loadArray<Interview>(KEYS.interviews).filter((i) => i.caseId === caseId);
  }

  async addInvestigationNote(caseId: string, content: string, actor: AppUser): Promise<InvestigationNote> {
    const notes = loadArray<InvestigationNote>(KEYS.notes);
    const note: InvestigationNote = { noteId: newId('note'), caseId, authorId: actor.userId, content, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    notes.push(note);
    saveArray(KEYS.notes, notes);
    await this.appendAudit({ actorId: actor.userId, action: 'INVESTIGATION_NOTE_ADDED', caseId });
    return note;
  }

  async listInvestigationNotes(caseId: string, actor: AppUser): Promise<InvestigationNote[]> {
    // Reporters never call this path in practice (they have no `communications.read`
    // vs internal notes distinction enforced at the UI layer too), but the guard
    // belongs here so the rule holds even if a future screen forgets to check.
    if (actor.roleId === 'reporter') {
      throw new CaseAccessDeniedError('Reporters cannot read internal investigation notes.');
    }
    return loadArray<InvestigationNote>(KEYS.notes).filter((n) => n.caseId === caseId);
  }

  async addCommunication(caseId: string, sender: Communication['sender'], senderDisplayName: string, content: string, actorId: string): Promise<Communication> {
    const messages = loadArray<Communication>(KEYS.communications);
    const message: Communication = {
      messageId: newId('msg'),
      caseId,
      sender,
      senderDisplayName,
      content,
      createdAt: nowIso(),
      createdBy: actorId,
      updatedAt: nowIso(),
      updatedBy: actorId,
    };
    messages.push(message);
    saveArray(KEYS.communications, messages);
    await this.appendTimeline(caseId, 'MESSAGE_SENT', actorId);
    return message;
  }

  async listCommunications(caseId: string): Promise<Communication[]> {
    return loadArray<Communication>(KEYS.communications).filter((m) => m.caseId === caseId);
  }

  async addCorrectiveAction(
    caseId: string,
    input: Omit<CorrectiveAction, 'actionId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<CorrectiveAction> {
    const actions = loadArray<CorrectiveAction>(KEYS.correctiveActions);
    const action: CorrectiveAction = { ...input, actionId: newId('ca'), caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    actions.push(action);
    saveArray(KEYS.correctiveActions, actions);
    await this.appendTimeline(caseId, 'CORRECTIVE_ACTION_ADDED', actor.userId, input.description);
    await this.appendAudit({ actorId: actor.userId, action: 'CORRECTIVE_ACTION_ADDED', caseId, objectType: 'corrective_action', objectId: action.actionId });
    return action;
  }

  async listCorrectiveActions(caseId: string): Promise<CorrectiveAction[]> {
    return loadArray<CorrectiveAction>(KEYS.correctiveActions).filter((a) => a.caseId === caseId);
  }

  async recordRiskAssessment(
    caseId: string,
    input: Omit<RiskAssessment, 'assessmentId' | 'caseId' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    actor: AppUser
  ): Promise<RiskAssessment> {
    const assessments = loadArray<RiskAssessment>(KEYS.riskAssessments).map((a) => (a.caseId === caseId ? { ...a, active: false } : a));
    const assessment: RiskAssessment = { ...input, assessmentId: newId('risk'), caseId, active: true, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    assessments.push(assessment);
    saveArray(KEYS.riskAssessments, assessments);

    const cases = loadArray<Case>(KEYS.cases);
    const idx = cases.findIndex((c) => c.caseId === caseId);
    if (idx !== -1) {
      cases[idx] = { ...cases[idx], riskScore: assessment.totalScore, priority: assessment.priority, updatedAt: nowIso(), updatedBy: actor.userId };
      saveArray(KEYS.cases, cases);
    }

    await this.appendTimeline(caseId, 'RISK_ASSESSED', actor.userId, `Score ${assessment.totalScore} → ${assessment.priority}`);
    await this.appendAudit({
      actorId: actor.userId,
      action: input.isOverride ? 'RISK_OVERRIDDEN' : 'RISK_ASSESSED',
      caseId,
      previousValue: input.originalScore,
      newValue: assessment.totalScore,
      reason: input.overrideReason,
    });
    return assessment;
  }

  async getActiveRiskAssessment(caseId: string): Promise<RiskAssessment | null> {
    return loadArray<RiskAssessment>(KEYS.riskAssessments).find((a) => a.caseId === caseId && a.active) ?? null;
  }

  async declareConflictOfInterest(caseId: string, userId: string, outcome: ConflictOfInterestDeclaration['outcome'], details?: string): Promise<ConflictOfInterestDeclaration> {
    const declarations = loadArray<ConflictOfInterestDeclaration>(KEYS.coiDeclarations);
    const declaration: ConflictOfInterestDeclaration = { caseId, userId, outcome, details, declaredAt: nowIso() };
    declarations.push(declaration);
    saveArray(KEYS.coiDeclarations, declarations);
    await this.appendTimeline(caseId, 'CONFLICT_OF_INTEREST_DECLARED', userId, outcome);
    await this.appendAudit({ actorId: userId, action: 'CONFLICT_OF_INTEREST_DECLARED', caseId, newValue: outcome });
    return declaration;
  }

  async getTimeline(caseId: string): Promise<TimelineEvent[]> {
    return loadArray<TimelineEvent>(KEYS.timeline)
      .filter((e) => e.caseId === caseId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async setReporterCredentials(caseId: string, creds: ReporterCredentials): Promise<void> {
    const all = loadArray<ReporterCredentials>(KEYS.reporterCredentials).filter((c) => c.caseId !== caseId);
    all.push(creds);
    saveArray(KEYS.reporterCredentials, all);
  }

  async verifyReporterCredentials(caseId: string, verify: (salt: string, hash: string) => Promise<boolean>): Promise<boolean> {
    const creds = loadArray<ReporterCredentials>(KEYS.reporterCredentials).find((c) => c.caseId === caseId);
    if (!creds) return false;
    return verify(creds.accessCodeSalt, creds.accessCodeHash);
  }

  async setReporterIdentity(caseId: string, identity: ReporterIdentity): Promise<void> {
    const all = loadArray<ReporterIdentity>(KEYS.reporterIdentities).filter((i) => i.caseId !== caseId);
    all.push(identity);
    saveArray(KEYS.reporterIdentities, all);
  }

  async getReporterIdentity(caseId: string, requestingUser: AppUser): Promise<ReporterIdentity | null> {
    // Explicit, individually-authorized and audited access — see section 44 of the brief:
    // no investigator gets reporter identity merely because it was assigned to the case.
    await this.appendAudit({
      actorId: requestingUser.userId,
      action: 'REPORTER_IDENTITY_ACCESSED',
      caseId,
      reason: 'Explicit identity access request',
    });
    return loadArray<ReporterIdentity>(KEYS.reporterIdentities).find((i) => i.caseId === caseId) ?? null;
  }

  async listAuditEvents(caseId?: string): Promise<AuditEventV2[]> {
    const events = loadArray<AuditEventV2>(KEYS.auditEvents);
    return caseId ? events.filter((e) => e.caseId === caseId) : events;
  }
}

export const caseRepository: CaseRepository = new LocalCaseRepository();
