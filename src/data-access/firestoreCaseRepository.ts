/**
 * ACTIVA Hotline — FirestoreCaseRepository (Phase 3)
 *
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 3) ===
 *
 * Implémentation cliente de `CaseRepository` (caseRepository.ts) qui appelle
 * les Cloud Functions réelles (functions/src/index.ts, dont `listCases`,
 * livré en Phase 1) via `httpsCallable`, plutôt que de lire/écrire
 * `localStorage` comme `LocalCaseRepository`. Exactement le "one-line
 * change at the call site" que le commentaire d'en-tête de
 * caseRepository.ts annonçait depuis la Phase 2 — mais **non branché à
 * l'UI dans cette phase** : `LocalCaseRepository` reste la seule
 * implémentation réellement utilisée tant que les Cloud Functions ne sont
 * pas déployées (voir docs/FIREBASE-SETUP.md — plan Spark, mise à niveau
 * Blaze nécessaire, hors de portée de cette session).
 *
 * === Choix de conception : un aller-retour supplémentaire après chaque
 * mutation ===
 * La plupart des Cloud Functions renvoient volontairement un payload
 * minimal (souvent juste `{xxxId}` ou `{ok:true}`, jamais l'objet complet —
 * voir leurs commentaires respectifs), alors que `CaseRepository` promet de
 * renvoyer l'objet créé/modifié en entier. Plutôt que de reconstruire cet
 * objet côté client (risque de dérive silencieuse si la logique serveur
 * évolue — `overallFinding`, `closedAt`, etc. sont dérivés côté serveur),
 * chaque méthode fait un second appel `getDoc` en lecture directe du
 * document désormais à jour. C'est un compromis assumé : un aller-retour de
 * plus par mutation, mais une garantie d'exactitude — jamais de valeur
 * devinée. Vérifié réel et autorisé par les règles déployées pour un
 * document connu par son id, y compris en sous-collection (`firestore.rules`
 * ne bloque que les requêtes `list`/query, jamais un `get()` d'un document
 * précis — voir le commentaire au-dessus de `match /cases/{caseId}`).
 * Une optimisation future (faire renvoyer l'objet complet directement par
 * chaque Cloud Function) est possible mais volontairement hors périmètre
 * ici : governance de ce fichier seul, sans toucher aux fonctions déjà
 * écrites et documentées.
 *
 * === Ce qui n'est PAS implémenté ici, et pourquoi ===
 * - `listAllegations`/`listPersons`/`listEvidence`/`listTasks`/
 *   `listInterviews`/`listInvestigationNotes`/`listCommunications`/
 *   `listCorrectiveActions`/`getActiveRiskAssessment`/`getTimeline`/
 *   `listAuditEvents` : aucune Cloud Function de LISTE n'existe encore pour
 *   ces sous-collections (seul `listCases`, Phase 1, existe) — même mur de
 *   "provabilité" des règles Firestore que celui qui a motivé `listCases`
 *   (voir son commentaire). Lèvent une erreur explicite plutôt que de
 *   silencieusement renvoyer une liste vide, qui donnerait l'impression
 *   fausse que le dossier n'a aucune donnée.
 * - `setReporterCredentials`/`verifyReporterCredentials`/
 *   `setReporterIdentity` : intentionnellement réservés à l'Admin SDK
 *   (jamais exposés à AUCUN client, personnel compris — voir
 *   docs/DATABASE.md "isolation des identifiants" et
 *   `firestore.rules`' `reporter_credentials`/`reporter_identities`,
 *   fermés à `allow read, write: if false`). Lèvent une erreur différente,
 *   qui ne dit jamais "pas encore disponible" mais "jamais disponible
 *   depuis un client, par conception".
 */

import { doc, getDoc } from 'firebase/firestore';
import { FunctionsError, httpsCallable } from 'firebase/functions';

import {
  Allegation,
  AppUser,
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
import { TransitionCheckResult } from '../domain/workflow';
import { getPhase4Firebase, getPhase4Functions } from '../services/firebaseClient';
import {
  AuditEventV2,
  CaseAccessDeniedError,
  CaseListFilter,
  CaseRepository,
  Page,
} from './caseRepository';

/** Jamais disponible depuis un client (personnel compris) — Admin SDK uniquement, par conception. */
export class ServerOnlyOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} n'est jamais accessible depuis un client — réservé à l'Admin SDK par conception (voir docs/DATABASE.md).`);
    this.name = 'ServerOnlyOperationError';
  }
}

/** Pas encore disponible : aucune Cloud Function de liste n'existe pour cette sous-collection (voir l'en-tête de ce fichier). */
export class ListNotYetAvailableError extends Error {
  constructor(operation: string) {
    super(`${operation} n'est pas encore disponible : aucune Cloud Function de liste n'existe pour cette sous-collection (voir functions/src/index.ts).`);
    this.name = 'ListNotYetAvailableError';
  }
}

async function call<Req, Res>(name: string) {
  const functions = await getPhase4Functions();
  return httpsCallable<Req, Res>(functions, name);
}

/** Traduit une erreur `httpsCallable` en une erreur du vocabulaire `CaseRepository` — jamais un code Firebase brut qui fuiterait un détail d'implémentation à l'appelant. */
function translateError(err: unknown): never {
  if (err instanceof FunctionsError) {
    if (err.code === 'functions/permission-denied') throw new CaseAccessDeniedError(err.message);
    if (err.code === 'functions/not-found') throw new Error(err.message);
    if (err.code === 'functions/invalid-argument' || err.code === 'functions/failed-precondition') throw new Error(err.message);
  }
  throw err;
}

async function getCaseDoc(caseId: string): Promise<Case> {
  const { db } = getPhase4Firebase();
  const snap = await getDoc(doc(db, 'cases', caseId));
  if (!snap.exists()) throw new Error(`Case ${caseId} not found.`);
  return snap.data() as Case;
}

async function getSubDoc<T>(caseId: string, sub: string, id: string): Promise<T> {
  const { db } = getPhase4Firebase();
  const snap = await getDoc(doc(db, 'cases', caseId, sub, id));
  if (!snap.exists()) throw new Error(`${sub}/${id} not found on case ${caseId}.`);
  return snap.data() as T;
}

export class FirestoreCaseRepository implements CaseRepository {
  async createCase(
    input: Omit<Case, 'caseId' | 'caseNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: string
  ): Promise<Case> {
    try {
      const fn = await call<
        Pick<Case, 'category' | 'subcategory' | 'country' | 'entity' | 'reportingMode' | 'description' | 'confidentialityLevel'>,
        { caseId: string; caseNumber: string }
      >('createCase');
      const { data } = await fn({
        category: input.category,
        subcategory: input.subcategory,
        country: input.country,
        entity: input.entity,
        reportingMode: input.reportingMode,
        description: input.description,
        confidentialityLevel: input.confidentialityLevel,
      });
      return getCaseDoc(data.caseId);
    } catch (err) {
      return translateError(err);
    }
  }

  async getCase(caseId: string, _requestingUser: AppUser): Promise<Case | null> {
    // Lecture directe (getDoc), même patron que CaseLookup.tsx — aucune
    // Cloud Function dédiée n'existe pour ce cas, et n'en a jamais eu
    // besoin : un `get()` d'un document connu passe déjà les règles
    // déployées. `_requestingUser` n'est pas utilisé : c'est
    // `firestore.rules` (via le token Firebase Auth réel de l'appelant)
    // qui autorise ou refuse, jamais ce paramètre côté client.
    const { db } = getPhase4Firebase();
    const snap = await getDoc(doc(db, 'cases', caseId));
    return snap.exists() ? (snap.data() as Case) : null;
  }

  async listCases(filter: CaseListFilter, _requestingUser: AppUser, limit = 25, offset = 0): Promise<Page<Case>> {
    try {
      const fn = await call<{ filter: CaseListFilter; limit: number; offset: number }, Page<Case>>('listCases');
      const { data } = await fn({ filter, limit, offset });
      return data;
    } catch (err) {
      return translateError(err);
    }
  }

  async changeCaseStatus(caseId: string, to: CaseStatus, _actor: AppUser, reason?: string): Promise<{ case: Case; result: TransitionCheckResult }> {
    try {
      const fn = await call<{ caseId: string; to: CaseStatus; reason?: string }, { ok: true; status: CaseStatus }>('changeCaseStatus');
      await fn({ caseId, to, reason });
      return { case: await getCaseDoc(caseId), result: { allowed: true } };
    } catch (err) {
      if (err instanceof FunctionsError && err.code === 'functions/failed-precondition') {
        // === AMÉLIORATION AJOUTÉE === Même comportement que
        // LocalCaseRepository.changeCaseStatus : une transition refusée
        // pour une raison métier (checkTransition) n'est jamais une
        // exception ici — elle revient dans `result.allowed = false`, pour
        // que l'UI puisse l'afficher en ligne plutôt que d'attraper un
        // throw. Seules les erreurs d'autorisation/réseau restent des
        // exceptions (voir translateError plus bas).
        return { case: await getCaseDoc(caseId), result: { allowed: false, reason: err.message } };
      }
      return translateError(err);
    }
  }

  async assignCase(caseId: string, assignee: string, additional: string[], _actor: AppUser): Promise<Case> {
    try {
      const fn = await call<{ caseId: string; assignee: string; additionalInvestigators?: string[] }, { ok: true }>('assignCase');
      await fn({ caseId, assignee, additionalInvestigators: additional });
      return getCaseDoc(caseId);
    } catch (err) {
      return translateError(err);
    }
  }

  async recordFunctionalReviewSignOff(caseId: string, _actor: AppUser): Promise<Case> {
    try {
      const fn = await call<{ caseId: string }, { ok: true }>('recordFunctionalReviewSignOff');
      await fn({ caseId });
      return getCaseDoc(caseId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addAllegation(caseId: string, input: Pick<Allegation, 'category' | 'subcategory' | 'description'>, _actor: AppUser): Promise<Allegation> {
    try {
      const fn = await call<{ caseId: string; category: string; subcategory?: string; description: string }, { allegationId: string }>('addAllegation');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<Allegation>(caseId, 'allegations', data.allegationId);
    } catch (err) {
      return translateError(err);
    }
  }

  async setAllegationFinding(allegationId: string, finding: FindingOutcome, rationale: string, _actor: AppUser): Promise<Allegation> {
    try {
      // === AMÉLIORATION AJOUTÉE === La signature de `CaseRepository` ne
      // fournit pas le `caseId` (seul l'allegationId est connu de
      // l'appelant), pourtant nécessaire pour relire le document à jour
      // ensuite (une collectionGroup query côté client n'est pas autorisée
      // par firestore.rules — même contrainte de « provabilité » que
      // `listCases`). La Cloud Function `setAllegationFinding`
      // (functions/src/index.ts) a donc été ajustée pour renvoyer aussi
      // `caseId` dans sa réponse — un ajout pur, sans changement de
      // comportement côté serveur.
      const fn = await call<{ allegationId: string; finding: FindingOutcome; rationale: string }, { ok: true; caseId: string }>('setAllegationFinding');
      const { data } = await fn({ allegationId, finding, rationale });
      return getSubDoc<Allegation>(data.caseId, 'allegations', allegationId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addPerson(
    caseId: string,
    input: Omit<Person, 'personId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<Person> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { personId: string }>('addPerson');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<Person>(caseId, 'persons', data.personId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addEvidence(
    caseId: string,
    input: Omit<Evidence, 'evidenceId' | 'caseId' | 'version' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<Evidence> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { evidenceId: string }>('addEvidence');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<Evidence>(caseId, 'evidence', data.evidenceId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addTask(
    caseId: string,
    input: Omit<Task, 'taskId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<Task> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { taskId: string }>('addTask');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<Task>(caseId, 'tasks', data.taskId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addInterview(
    caseId: string,
    input: Omit<Interview, 'interviewId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<Interview> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { interviewId: string }>('addInterview');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<Interview>(caseId, 'interviews', data.interviewId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addInvestigationNote(caseId: string, content: string, _actor: AppUser): Promise<InvestigationNote> {
    try {
      const fn = await call<{ caseId: string; content: string }, { noteId: string }>('addInvestigationNote');
      const { data } = await fn({ caseId, content });
      return getSubDoc<InvestigationNote>(caseId, 'investigation_notes', data.noteId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addCommunication(
    caseId: string,
    _sender: Communication['sender'],
    _senderDisplayName: string,
    content: string,
    _actorId: string
  ): Promise<Communication> {
    // === AMÉLIORATION AJOUTÉE === `_sender`/`_senderDisplayName` acceptés
    // pour respecter la signature de l'interface mais jamais transmis à la
    // Cloud Function : celle-ci force toujours sender='investigator' et le
    // nom d'affichage du token vérifié, exactement comme son commentaire
    // l'explique — jamais une identité déclarée par le client.
    try {
      const fn = await call<{ caseId: string; content: string }, { messageId: string }>('addCommunication');
      const { data } = await fn({ caseId, content });
      return getSubDoc<Communication>(caseId, 'communications', data.messageId);
    } catch (err) {
      return translateError(err);
    }
  }

  async addCorrectiveAction(
    caseId: string,
    input: Omit<CorrectiveAction, 'actionId' | 'caseId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<CorrectiveAction> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { actionId: string }>('addCorrectiveAction');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<CorrectiveAction>(caseId, 'corrective_actions', data.actionId);
    } catch (err) {
      return translateError(err);
    }
  }

  async recordRiskAssessment(
    caseId: string,
    input: Omit<RiskAssessment, 'assessmentId' | 'caseId' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    _actor: AppUser
  ): Promise<RiskAssessment> {
    try {
      const fn = await call<{ caseId: string } & typeof input, { assessmentId: string }>('recordRiskAssessment');
      const { data } = await fn({ caseId, ...input });
      return getSubDoc<RiskAssessment>(caseId, 'risk_assessments', data.assessmentId);
    } catch (err) {
      return translateError(err);
    }
  }

  async getActiveRiskAssessment(_caseId: string): Promise<RiskAssessment | null> {
    throw new ListNotYetAvailableError('getActiveRiskAssessment');
  }

  async declareConflictOfInterest(
    caseId: string,
    _userId: string,
    outcome: ConflictOfInterestDeclaration['outcome'],
    details?: string
  ): Promise<ConflictOfInterestDeclaration> {
    // === AMÉLIORATION AJOUTÉE === `_userId` accepté pour respecter la
    // signature de l'interface mais jamais transmis : la Cloud Function
    // force toujours `userId` à l'uid du token vérifié — un appelant ne
    // peut jamais déclarer un conflit d'intérêt AU NOM de quelqu'un d'autre.
    try {
      const fn = await call<{ caseId: string; outcome: ConflictOfInterestDeclaration['outcome']; details?: string }, { ok: true }>('declareConflictOfInterest');
      await fn({ caseId, outcome, details });
      // Pas d'id renvoyé par cette Cloud Function (déclaration write-only,
      // jamais relue ensuite par aucun des deux repositories existants non
      // plus) — reconstruit l'objet tel que la fonction serveur vient de
      // l'écrire, seule `declaredAt` est une approximation cliente (à la
      // seconde près, sans impact fonctionnel).
      return { caseId, userId: _userId, outcome, details, declaredAt: new Date().toISOString() };
    } catch (err) {
      return translateError(err);
    }
  }

  async getReporterIdentity(caseId: string, _requestingUser: AppUser): Promise<ReporterIdentity | null> {
    try {
      const fn = await call<{ caseId: string }, ReporterIdentity | null>('getReporterIdentity');
      const { data } = await fn({ caseId });
      return data;
    } catch (err) {
      return translateError(err);
    }
  }

  // ---------------------------------------------------------------------
  // Pas encore disponible : aucune Cloud Function de liste n'existe pour
  // ces sous-collections (voir l'en-tête de ce fichier).
  // ---------------------------------------------------------------------

  async listAllegations(_caseId: string): Promise<Allegation[]> {
    throw new ListNotYetAvailableError('listAllegations');
  }

  async listPersons(_caseId: string): Promise<Person[]> {
    throw new ListNotYetAvailableError('listPersons');
  }

  async listEvidence(_caseId: string, _actor: AppUser): Promise<Evidence[]> {
    throw new ListNotYetAvailableError('listEvidence');
  }

  async listTasks(_caseId: string): Promise<Task[]> {
    throw new ListNotYetAvailableError('listTasks');
  }

  async listInterviews(_caseId: string): Promise<Interview[]> {
    throw new ListNotYetAvailableError('listInterviews');
  }

  async listInvestigationNotes(_caseId: string, _actor: AppUser): Promise<InvestigationNote[]> {
    throw new ListNotYetAvailableError('listInvestigationNotes');
  }

  async listCommunications(_caseId: string): Promise<Communication[]> {
    throw new ListNotYetAvailableError('listCommunications');
  }

  async listCorrectiveActions(_caseId: string): Promise<CorrectiveAction[]> {
    throw new ListNotYetAvailableError('listCorrectiveActions');
  }

  async getTimeline(_caseId: string): Promise<TimelineEvent[]> {
    throw new ListNotYetAvailableError('getTimeline');
  }

  async listAuditEvents(_caseId?: string): Promise<AuditEventV2[]> {
    throw new ListNotYetAvailableError('listAuditEvents');
  }

  // ---------------------------------------------------------------------
  // Jamais accessible depuis un client, par conception — voir l'en-tête de
  // ce fichier et docs/DATABASE.md "isolation des identifiants".
  // ---------------------------------------------------------------------

  async setReporterCredentials(_caseId: string, _creds: ReporterCredentials): Promise<void> {
    throw new ServerOnlyOperationError('setReporterCredentials');
  }

  async verifyReporterCredentials(_caseId: string, _verify: (salt: string, hash: string) => Promise<boolean>): Promise<boolean> {
    throw new ServerOnlyOperationError('verifyReporterCredentials');
  }

  async setReporterIdentity(_caseId: string, _identity: ReporterIdentity): Promise<void> {
    throw new ServerOnlyOperationError('setReporterIdentity');
  }
}
