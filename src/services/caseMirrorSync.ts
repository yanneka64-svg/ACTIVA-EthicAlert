/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14 : miroir des
 * mutations secondaires de dossier) ===
 *
 * Regroupe ICI (plutôt que huit fichiers quasi identiques) le miroir
 * best-effort de chaque mutation « secondaire » de dossier qui a un
 * équivalent Cloud Function direct et une source locale claire : tâches,
 * entretiens, déclarations de conflit d'intérêt, notes d'investigation,
 * communications, mesures correctives, évaluation de risque, personnes
 * impliquées/témoins. Même discipline exacte que statusMirrorSync.ts/
 * assignmentMirrorSync.ts/casesCloudSync.ts : jamais bloquant, jamais
 * d'erreur remontée à l'appelant, jamais lu au-delà d'un booléen de succès
 * (aucune de ces mutations n'a besoin d'un identifiant retour, contrairement
 * à la création de dossier — Phases 4/13 — puisqu'elles s'appliquent
 * toujours à un dossier déjà lié).
 *
 * === Ce qui N'EST PAS miré ici, et pourquoi ===
 * - `addAllegation`/`setAllegationFinding`/`recordFunctionalReviewSignOff` :
 *   AlertRecord (le modèle local) ne porte aucune notion d'Allégation
 *   distincte du dossier — un signalement local a une seule catégorie/
 *   sous-catégorie, jamais un tableau `Allegation[]` documenté séparément
 *   (voir storage.ts `transitionStatus`, même limite déjà documentée pour
 *   la clôture, et data-access/migrateLegacy.ts qui affronte exactement le
 *   même trou). Sans donnée locale correspondante, il n'existe rien
 *   d'honnête à mirer.
 * - `removePersonLink` : aucun flux local ne permet aujourd'hui de délier
 *   une personne impliquée d'un compte une fois le rattachement fait (seul
 *   `handleAddPerson`/« Lier à un compte » existent, jamais l'inverse) —
 *   rien à mirer, pas une omission.
 * - `addEvidence`/`getEvidenceDownloadUrl` : Cloud Storage for Firebase
 *   n'est même pas provisionné sur ce projet (docs/FIREBASE-SETUP.md,
 *   « New, harder wall ») — hors périmètre, déjà scopé séparément Phase 9.
 *
 * === Correspondances de champs — réutilise les tables déjà prouvées ===
 * `data-access/migrateLegacy.ts` a déjà résolu, testé et documenté
 * exactement ces mêmes correspondances de champs (legacy AlertRecord →
 * modèle réel) pour la migration historique — `TASK_PRIORITY_TO_CASE_PRIORITY`/
 * `HIERARCHY_ROLE_TO_LEVEL` ci-dessous reprennent ses tables `PRIORITY_MAP`/
 * `HIERARCHY_MAP` à l'identique plutôt que de les réinventer. Une mesure
 * corrective locale (`CorrectiveMeasure`) n'a pas de champ `priority` propre
 * — `migrateLegacy.ts` réutilise déjà la priorité du DOSSIER pour cette
 * raison (jamais une valeur inventée) ; `mirrorAddCorrectiveAction`
 * ci-dessous fait de même, sur appel de l'appelant qui a ce contexte.
 */
import { CasePriority, HierarchyLevel } from '../domain/caseTypes';
import { TaskPriority } from '../types';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

async function call<Req, Res>(name: string, input: Req): Promise<Res | null> {
  if (!isPhase4Configured()) return null;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<Req, Res>(functions, name);
    const response = await fn(input);
    return response.data;
  } catch {
    return null;
  }
}

/** Même table que data-access/migrateLegacy.ts `PRIORITY_MAP` — réutilisée telle quelle, pas redéfinie indépendamment. */
export const LOCAL_PRIORITY_TO_CASE_PRIORITY: Record<'faible' | 'elevee' | 'tres_elevee' | 'critique', CasePriority> = {
  faible: 'low',
  elevee: 'high',
  tres_elevee: 'very_high',
  critique: 'critical',
};

/** `CaseTask.priority` (3 valeurs) n'a pas d'équivalent exact dans `CasePriority` (4 valeurs, sans "medium") — correspondance approximative documentée, jamais une valeur inventée au hasard : "medium" prend la valeur intermédiaire réelle la plus proche. */
export const TASK_PRIORITY_TO_CASE_PRIORITY: Record<TaskPriority, CasePriority> = {
  low: 'low',
  medium: 'high',
  high: 'very_high',
};

/** Même table que data-access/migrateLegacy.ts `HIERARCHY_MAP`. */
export const HIERARCHY_ROLE_TO_LEVEL: Record<string, HierarchyLevel> = {
  'Employé': 'employee',
  'Cadre': 'manager',
  'Sous-Directeur': 'senior_manager',
  'Directeur+': 'director_plus',
};

export interface TaskMirrorInput {
  caseId: string;
  title: string;
  description?: string;
  owner: string;
  priority: CasePriority;
  dueDate: string;
}
export async function mirrorAddTask(input: TaskMirrorInput): Promise<boolean> {
  return (await call('addTask', input)) !== null;
}

export interface InterviewMirrorInput {
  caseId: string;
  intervieweePersonId?: string;
  intervieweeLabel: string;
  scheduledAt?: string;
}
export async function mirrorAddInterview(input: InterviewMirrorInput): Promise<boolean> {
  return (await call('addInterview', input)) !== null;
}

export interface ConflictDeclarationMirrorInput {
  caseId: string;
  outcome: 'no_conflict' | 'conflict_identified';
  details?: string;
}
export async function mirrorDeclareConflict(input: ConflictDeclarationMirrorInput): Promise<boolean> {
  return (await call('declareConflictOfInterest', input)) !== null;
}

export interface NoteMirrorInput {
  caseId: string;
  content: string;
}
export async function mirrorAddInvestigationNote(input: NoteMirrorInput): Promise<boolean> {
  return (await call('addInvestigationNote', input)) !== null;
}

export interface CommunicationMirrorInput {
  caseId: string;
  content: string;
}
export async function mirrorAddCommunication(input: CommunicationMirrorInput): Promise<boolean> {
  return (await call('addCommunication', input)) !== null;
}

export interface CorrectiveActionMirrorInput {
  caseId: string;
  description: string;
  owner: string;
  entity?: string;
  dueDate: string;
  priority: CasePriority;
}
export async function mirrorAddCorrectiveAction(input: CorrectiveActionMirrorInput): Promise<boolean> {
  return (await call('addCorrectiveAction', input)) !== null;
}

export interface RiskAssessmentMirrorInput {
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
}
export async function mirrorRecordRiskAssessment(input: RiskAssessmentMirrorInput): Promise<boolean> {
  return (await call('recordRiskAssessment', input)) !== null;
}

export interface PersonMirrorInput {
  caseId: string;
  kind: 'subject' | 'witness';
  name: string;
  position?: string;
  hierarchyLevel?: HierarchyLevel;
  linkedUserId?: string;
}
export async function mirrorAddPerson(input: PersonMirrorInput): Promise<boolean> {
  return (await call('addPerson', input)) !== null;
}
