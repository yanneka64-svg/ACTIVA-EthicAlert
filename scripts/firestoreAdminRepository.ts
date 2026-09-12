/**
 * ACTIVA Hotline — Firestore-backed CaseRepository (Admin SDK)
 *
 * This is a NODE-ONLY, SERVER-SIDE implementation of the same `CaseRepository`
 * contract defined in `src/data-access/caseRepository.ts`. It must never be
 * imported from `src/` — it uses `firebase-admin`, which requires a service
 * account and has full read/write access bypassing all Security Rules. That
 * is by design for a trusted backend context (a seed/import script today,
 * Cloud Functions in Phase 3) and is exactly why it must never ship to the
 * browser bundle.
 *
 * It reuses the SAME workflow/permission logic as `LocalCaseRepository`
 * (`src/domain/workflow.ts`, `src/domain/permissions.ts`) so client and
 * "server" never diverge on what counts as a valid transition or an
 * authorized read — the whole point of Phase 2's domain layer being
 * storage-agnostic.
 */

import { App } from 'firebase-admin/app';
import { Firestore } from 'firebase-admin/firestore';

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
} from '../src/domain/caseTypes';
import { can, implicatedUserIdsFromPersons, Permission } from '../src/domain/permissions';
import { checkTransition, deriveOverallFinding, TransitionCheckResult } from '../src/domain/workflow';
import { AuditEventV2, CaseAccessDeniedError, CaseListFilter, CaseRepository, Page } from '../src/data-access/caseRepository';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class FirestoreAdminCaseRepository implements CaseRepository {
  private db: Firestore;

  constructor(app: App, private getFirestoreFn: (app: App, dbId?: string) => Firestore, databaseId?: string) {
    this.db = getFirestoreFn(app, databaseId);
    // The domain model uses optional fields (e.g. Case.closedAt) that are simply
    // absent from the object rather than explicitly null — Firestore rejects
    // `undefined` by default, so this mirrors the permissive behavior the
    // localStorage-backed LocalCaseRepository already has via JSON.stringify.
    this.db.settings({ ignoreUndefinedProperties: true });
  }

  private caseDoc(caseId: string) {
    return this.db.collection('cases').doc(caseId);
  }
  private sub(caseId: string, name: string) {
    return this.caseDoc(caseId).collection(name);
  }

  private async appendAudit(entry: Omit<AuditEventV2, 'id' | 'timestamp'>): Promise<void> {
    const id = newId('audv2');
    await this.db.collection('audit_logs').doc(id).set({ ...entry, id, timestamp: nowIso() });
  }

  private async appendTimeline(caseId: string, label: string, actor: string, details?: string): Promise<void> {
    const eventId = newId('tl');
    await this.sub(caseId, 'timeline').doc(eventId).set({ eventId, caseId, label, actor, timestamp: nowIso(), details: details ?? null });
  }

  private async assertCaseAccess(kase: Case, requestingUser: AppUser, permission: Permission): Promise<void> {
    const personsSnap = await this.sub(kase.caseId, 'persons').get();
    const persons = personsSnap.docs.map((d) => d.data() as Person);
    const allowed = can(requestingUser, permission, { case: kase, implicatedUserIds: implicatedUserIdsFromPersons(persons) });
    if (!allowed) {
      await this.appendAudit({ actorId: requestingUser.userId, action: 'ACCESS_DENIED', caseId: kase.caseId, reason: `Missing permission ${permission} or out of scope` });
      throw new CaseAccessDeniedError();
    }
  }

  private async nextCaseSequence(): Promise<number> {
    const counterRef = this.db.collection('counters').doc('cases');
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists ? (snap.data()?.value as number) : 0) + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      return next;
    });
  }

  async createCase(input: Omit<Case, 'caseId' | 'caseNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: string): Promise<Case> {
    const seq = await this.nextCaseSequence();
    const year = new Date().getFullYear();
    const caseId = newId('case');
    const kase: Case = {
      ...input,
      caseId,
      caseNumber: `CASE-${year}-${String(seq).padStart(6, '0')}`,
      createdAt: nowIso(),
      createdBy: actor,
      updatedAt: nowIso(),
      updatedBy: actor,
    };
    await this.caseDoc(caseId).set(kase);
    await this.appendTimeline(caseId, 'CASE_CREATED', actor);
    await this.appendAudit({ actorId: actor, action: 'CASE_CREATED', caseId, newValue: kase.status });
    return kase;
  }

  async getCase(caseId: string, requestingUser: AppUser): Promise<Case | null> {
    const snap = await this.caseDoc(caseId).get();
    if (!snap.exists) return null;
    const kase = snap.data() as Case;
    await this.assertCaseAccess(kase, requestingUser, 'cases.read');
    await this.appendAudit({ actorId: requestingUser.userId, action: 'CASE_ACCESSED', caseId });
    return kase;
  }

  async listCases(filter: CaseListFilter, requestingUser: AppUser, limit = 25, offset = 0): Promise<Page<Case>> {
    // A straightforward full-collection scan is acceptable for a seed/verification
    // script against a handful of demo cases; Phase 4's real Control Panel must
    // use indexed, server-side `where`/`orderBy`/`startAfter` queries instead
    // (see docs/ARCHITECTURE.md — "Do not load the entire case database into the client").
    const snap = await this.db.collection('cases').get();
    const all: Case[] = [];
    for (const doc of snap.docs) {
      const kase = doc.data() as Case;
      const personsSnap = await this.sub(kase.caseId, 'persons').get();
      const implicated = implicatedUserIdsFromPersons(personsSnap.docs.map((d) => d.data() as Person));
      if (!can(requestingUser, 'cases.read', { case: kase, implicatedUserIds: implicated })) continue;
      if (filter.status && kase.status !== filter.status) continue;
      if (filter.country && kase.country !== filter.country) continue;
      if (filter.entity && kase.entity !== filter.entity) continue;
      if (filter.category && kase.category !== filter.category) continue;
      if (filter.priority && kase.priority !== filter.priority) continue;
      if (filter.assignee && kase.assignee !== filter.assignee) continue;
      all.push(kase);
    }
    const items = all.slice(offset, offset + limit);
    return { items, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : undefined };
  }

  async changeCaseStatus(caseId: string, to: CaseStatus, actor: AppUser, reason?: string): Promise<{ case: Case; result: TransitionCheckResult }> {
    const snap = await this.caseDoc(caseId).get();
    if (!snap.exists) throw new Error(`Case ${caseId} not found`);
    const kase = snap.data() as Case;
    await this.assertCaseAccess(kase, actor, to === 'closed' ? 'cases.close' : 'cases.edit');

    const allegations = (await this.sub(caseId, 'allegations').get()).docs.map((d) => d.data() as Allegation);
    const correctiveActions = (await this.sub(caseId, 'corrective_actions').get()).docs.map((d) => d.data() as CorrectiveAction);
    const result = checkTransition(kase.status, to, { allegations, correctiveActions });

    if (!result.allowed) {
      await this.appendAudit({ actorId: actor.userId, action: 'STATUS_CHANGE_REJECTED', caseId, previousValue: kase.status, newValue: to, reason: result.reason });
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
    await this.caseDoc(caseId).set(updated);
    await this.appendTimeline(caseId, `STATUS_${previousStatus}_TO_${to}`.toUpperCase(), actor.userId, reason);
    await this.appendAudit({ actorId: actor.userId, action: 'STATUS_CHANGED', caseId, previousValue: previousStatus, newValue: to, reason });
    return { case: updated, result };
  }

  async assignCase(caseId: string, assignee: string, additional: string[], actor: AppUser): Promise<Case> {
    const snap = await this.caseDoc(caseId).get();
    if (!snap.exists) throw new Error(`Case ${caseId} not found`);
    const kase = snap.data() as Case;
    await this.assertCaseAccess(kase, actor, 'cases.assign');
    const previous = { assignee: kase.assignee, additionalInvestigators: kase.additionalInvestigators };
    const updated: Case = { ...kase, assignee, additionalInvestigators: additional, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.caseDoc(caseId).set(updated);
    await this.appendTimeline(caseId, 'ASSIGNED', actor.userId, `Assignee: ${assignee}`);
    await this.appendAudit({ actorId: actor.userId, action: 'CASE_ASSIGNED', caseId, previousValue: previous, newValue: { assignee, additional } });
    return updated;
  }

  async addAllegation(caseId: string, input: Pick<Allegation, 'category' | 'subcategory' | 'description'>, actor: AppUser): Promise<Allegation> {
    const allegationId = newId('alg');
    const allegation: Allegation = { ...input, allegationId, caseId, status: 'open', createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'allegations').doc(allegationId).set(allegation);
    await this.appendTimeline(caseId, 'ALLEGATION_ADDED', actor.userId, input.category);
    return allegation;
  }

  async setAllegationFinding(allegationId: string, finding: FindingOutcome, rationale: string, actor: AppUser): Promise<Allegation> {
    // Requires a collectionGroup query since we only have the allegationId here.
    const results = await this.db.collectionGroup('allegations').where('allegationId', '==', allegationId).limit(1).get();
    if (results.empty) throw new Error(`Allegation ${allegationId} not found`);
    const doc = results.docs[0];
    const updated: Allegation = { ...(doc.data() as Allegation), status: 'assessed', finding, findingRationale: rationale, findingDocumentedBy: actor.userId, findingDocumentedAt: nowIso(), updatedAt: nowIso(), updatedBy: actor.userId };
    await doc.ref.set(updated);
    await this.appendTimeline(updated.caseId, 'FINDING_DOCUMENTED', actor.userId, finding);
    await this.appendAudit({ actorId: actor.userId, action: 'FINDING_DOCUMENTED', caseId: updated.caseId, objectType: 'allegation', objectId: allegationId, newValue: finding });
    return updated;
  }

  async listAllegations(caseId: string): Promise<Allegation[]> {
    return (await this.sub(caseId, 'allegations').get()).docs.map((d) => d.data() as Allegation);
  }

  async addPerson(caseId: string, input: Omit<Person, 'personId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Person> {
    const personId = newId('per');
    const person: Person = { ...input, personId, caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'persons').doc(personId).set(person);
    return person;
  }

  async listPersons(caseId: string): Promise<Person[]> {
    return (await this.sub(caseId, 'persons').get()).docs.map((d) => d.data() as Person);
  }

  async addEvidence(caseId: string, input: Omit<Evidence, 'evidenceId' | 'caseId' | 'version' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Evidence> {
    const evidenceId = newId('evd');
    const item: Evidence = { ...input, evidenceId, caseId, version: 1, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'evidence').doc(evidenceId).set(item);
    await this.appendTimeline(caseId, 'EVIDENCE_ADDED', actor.userId, input.fileName);
    await this.appendAudit({ actorId: actor.userId, action: 'EVIDENCE_UPLOADED', caseId, objectType: 'evidence', objectId: evidenceId });
    return item;
  }

  async listEvidence(caseId: string, actor: AppUser): Promise<Evidence[]> {
    await this.appendAudit({ actorId: actor.userId, action: 'EVIDENCE_LISTED', caseId });
    const docs = (await this.sub(caseId, 'evidence').get()).docs.map((d) => d.data() as Evidence);
    return docs.filter((e) => e.status !== 'deleted');
  }

  async addTask(caseId: string, input: Omit<Task, 'taskId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Task> {
    const taskId = newId('tsk');
    const task: Task = { ...input, taskId, caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'tasks').doc(taskId).set(task);
    return task;
  }

  async listTasks(caseId: string): Promise<Task[]> {
    return (await this.sub(caseId, 'tasks').get()).docs.map((d) => d.data() as Task);
  }

  async addInterview(caseId: string, input: Omit<Interview, 'interviewId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<Interview> {
    const interviewId = newId('ivw');
    const interview: Interview = { ...input, interviewId, caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'interviews').doc(interviewId).set(interview);
    return interview;
  }

  async listInterviews(caseId: string): Promise<Interview[]> {
    return (await this.sub(caseId, 'interviews').get()).docs.map((d) => d.data() as Interview);
  }

  async addInvestigationNote(caseId: string, content: string, actor: AppUser): Promise<InvestigationNote> {
    const noteId = newId('note');
    const note: InvestigationNote = { noteId, caseId, authorId: actor.userId, content, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'investigation_notes').doc(noteId).set(note);
    await this.appendAudit({ actorId: actor.userId, action: 'INVESTIGATION_NOTE_ADDED', caseId });
    return note;
  }

  async listInvestigationNotes(caseId: string, actor: AppUser): Promise<InvestigationNote[]> {
    if (actor.roleId === 'reporter') throw new CaseAccessDeniedError('Reporters cannot read internal investigation notes.');
    return (await this.sub(caseId, 'investigation_notes').get()).docs.map((d) => d.data() as InvestigationNote);
  }

  async addCommunication(caseId: string, sender: Communication['sender'], senderDisplayName: string, content: string, actorId: string): Promise<Communication> {
    const messageId = newId('msg');
    const message: Communication = { messageId, caseId, sender, senderDisplayName, content, createdAt: nowIso(), createdBy: actorId, updatedAt: nowIso(), updatedBy: actorId };
    await this.sub(caseId, 'communications').doc(messageId).set(message);
    await this.appendTimeline(caseId, 'MESSAGE_SENT', actorId);
    return message;
  }

  async listCommunications(caseId: string): Promise<Communication[]> {
    return (await this.sub(caseId, 'communications').get()).docs.map((d) => d.data() as Communication);
  }

  async addCorrectiveAction(caseId: string, input: Omit<CorrectiveAction, 'actionId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<CorrectiveAction> {
    const actionId = newId('ca');
    const action: CorrectiveAction = { ...input, actionId, caseId, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    await this.sub(caseId, 'corrective_actions').doc(actionId).set(action);
    await this.appendTimeline(caseId, 'CORRECTIVE_ACTION_ADDED', actor.userId, input.description);
    await this.appendAudit({ actorId: actor.userId, action: 'CORRECTIVE_ACTION_ADDED', caseId, objectType: 'corrective_action', objectId: actionId });
    return action;
  }

  async listCorrectiveActions(caseId: string): Promise<CorrectiveAction[]> {
    return (await this.sub(caseId, 'corrective_actions').get()).docs.map((d) => d.data() as CorrectiveAction);
  }

  async recordRiskAssessment(caseId: string, input: Omit<RiskAssessment, 'assessmentId' | 'caseId' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>, actor: AppUser): Promise<RiskAssessment> {
    const existing = await this.sub(caseId, 'risk_assessments').where('active', '==', true).get();
    const batch = this.db.batch();
    existing.docs.forEach((d) => batch.update(d.ref, { active: false }));
    const assessmentId = newId('risk');
    const assessment: RiskAssessment = { ...input, assessmentId, caseId, active: true, createdAt: nowIso(), createdBy: actor.userId, updatedAt: nowIso(), updatedBy: actor.userId };
    batch.set(this.sub(caseId, 'risk_assessments').doc(assessmentId), assessment);
    await batch.commit();

    await this.caseDoc(caseId).update({ riskScore: assessment.totalScore, priority: assessment.priority, updatedAt: nowIso(), updatedBy: actor.userId });
    await this.appendTimeline(caseId, 'RISK_ASSESSED', actor.userId, `Score ${assessment.totalScore} → ${assessment.priority}`);
    await this.appendAudit({ actorId: actor.userId, action: input.isOverride ? 'RISK_OVERRIDDEN' : 'RISK_ASSESSED', caseId, previousValue: input.originalScore, newValue: assessment.totalScore, reason: input.overrideReason });
    return assessment;
  }

  async getActiveRiskAssessment(caseId: string): Promise<RiskAssessment | null> {
    const snap = await this.sub(caseId, 'risk_assessments').where('active', '==', true).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as RiskAssessment);
  }

  async declareConflictOfInterest(caseId: string, userId: string, outcome: ConflictOfInterestDeclaration['outcome'], details?: string): Promise<ConflictOfInterestDeclaration> {
    const declaration: ConflictOfInterestDeclaration = { caseId, userId, outcome, details, declaredAt: nowIso() };
    await this.sub(caseId, 'coi_declarations').doc(newId('coi')).set(declaration);
    await this.appendTimeline(caseId, 'CONFLICT_OF_INTEREST_DECLARED', userId, outcome);
    await this.appendAudit({ actorId: userId, action: 'CONFLICT_OF_INTEREST_DECLARED', caseId, newValue: outcome });
    return declaration;
  }

  async getTimeline(caseId: string): Promise<TimelineEvent[]> {
    const snap = await this.sub(caseId, 'timeline').orderBy('timestamp', 'asc').get();
    return snap.docs.map((d) => d.data() as TimelineEvent);
  }

  async setReporterCredentials(caseId: string, creds: ReporterCredentials): Promise<void> {
    await this.db.collection('reporter_credentials').doc(caseId).set(creds);
  }

  async verifyReporterCredentials(caseId: string, verify: (salt: string, hash: string) => Promise<boolean>): Promise<boolean> {
    const snap = await this.db.collection('reporter_credentials').doc(caseId).get();
    if (!snap.exists) return false;
    const creds = snap.data() as ReporterCredentials;
    return verify(creds.accessCodeSalt, creds.accessCodeHash);
  }

  async setReporterIdentity(caseId: string, identity: ReporterIdentity): Promise<void> {
    await this.db.collection('reporter_identities').doc(caseId).set(identity);
  }

  async getReporterIdentity(caseId: string, requestingUser: AppUser): Promise<ReporterIdentity | null> {
    await this.appendAudit({ actorId: requestingUser.userId, action: 'REPORTER_IDENTITY_ACCESSED', caseId, reason: 'Explicit identity access request' });
    const snap = await this.db.collection('reporter_identities').doc(caseId).get();
    return snap.exists ? (snap.data() as ReporterIdentity) : null;
  }

  async listAuditEvents(caseId?: string): Promise<AuditEventV2[]> {
    let query: FirebaseFirestore.Query = this.db.collection('audit_logs');
    if (caseId) query = query.where('caseId', '==', caseId);
    return (await query.get()).docs.map((d) => d.data() as AuditEventV2);
  }
}
