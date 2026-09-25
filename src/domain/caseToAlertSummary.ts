/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5 : fusion
 * Centre de Pilotage) ===
 *
 * Convertit un `Case` réel (Firestore, via la Cloud Function `listCases`)
 * en un objet de la FORME `AlertRecord` (src/types.ts), pour que le Centre
 * de Pilotage (ControlPanel.tsx) puisse afficher un dossier qui n'existe
 * QUE dans le vrai backend au milieu de ses données locales, sans dupliquer
 * ses calculs de KPI/graphiques (qui attendent tous un `AlertRecord[]`).
 *
 * **Portée volontairement limitée au Centre de Pilotage.** Une
 * investigation dédiée (voir le plan) a confirmé que ce dernier ne lit
 * jamais les champs tableau/sous-collection d'un `AlertRecord`
 * (`involvedPersons`, `evidences`, `messages`, `internalNotes`, `tasks`,
 * `interviews`, `conflictDeclarations`) — uniquement des champs
 * scalaires/résumé (statut, catégorie, pays, priorité, score de risque,
 * dates, assignation). Ce fichier remplit donc ces tableaux VIDES, jamais
 * `undefined` (pour ne jamais faire planter un `.length`/`.flatMap`
 * existant), mais ne prétend jamais les avoir réellement récupérés :
 * aucune Cloud Function de liste n'existe encore pour ces
 * sous-collections (`listPersons`/`listEvidence`/`listCommunications`/...
 * — voir `src/data-access/firestoreCaseRepository.ts`). C'est précisément
 * pour cette raison que ce convertisseur ne doit PAS être réutilisé pour
 * `InvestigationDesk.tsx`/`OperatorCaseDesk.tsx` : leur vue détail rendrait
 * ces tableaux vides comme si le dossier n'avait réellement aucune
 * personne/preuve/message, ce qui serait trompeur, jamais seulement
 * "pas encore chargé".
 *
 * **Autres limitations honnêtes, documentées plutôt que masquées :**
 * - `assignedInvestigatorNames` reste toujours vide : `Case.assignee`/
 *   `additionalInvestigators` sont de vrais uids Firebase Auth, sans aucune
 *   correspondance avec les comptes locaux (`storage.getUsers()`) — aucune
 *   table de correspondance n'existe aujourd'hui (voir le plan, Phase 6+).
 * - Les 4 sous-scores de `riskEvaluation` (impact financier, niveau
 *   hiérarchique, récidive, risque réputationnel) ne sont pas dans `Case`
 *   lui-même (ils vivent dans sa sous-collection `risk_assessments`, non
 *   récupérable ici pour la même raison que ci-dessus) — fixés à 1
 *   (valeur plancher), jamais devinés. Seuls `totalScore`/`priority`/
 *   `nocaThreshold`, réellement présents sur `Case`, sont fidèles.
 */
import { AlertRecord, AlertStatus, NocaThreshold, PriorityLevel } from '../types';
import { Case, CasePriority, CaseStatus } from './caseTypes';

const STATUS_FROM_CASE: Record<CaseStatus, AlertStatus> = {
  new: 'new',
  triage: 'new',
  under_review: 'under_review',
  assigned: 'under_review',
  investigation: 'investigation',
  pending_information: 'under_review',
  escalated: 'investigation',
  conclusion_pending: 'corrective_action',
  functional_review: 'corrective_action',
  closed: 'closed',
  reopened: 'reopened',
  archived: 'archived',
  duplicate: 'archived',
  out_of_scope: 'archived',
};

const PRIORITY_FROM_CASE: Record<CasePriority, PriorityLevel> = {
  low: 'faible',
  high: 'elevee',
  very_high: 'tres_elevee',
  critical: 'critique',
};

const NOCA_FROM_PRIORITY: Record<PriorityLevel, NocaThreshold> = {
  faible: 'NOCA 1',
  elevee: 'NOCA 2',
  tres_elevee: 'NOCA 3',
  critique: 'NOCA 4',
};

/**
 * Préfixe distinct des ids legacy (`alt-...`) pour qu'un dossier réel ne
 * puisse jamais collisionner avec un dossier local, même par coïncidence.
 */
export function caseSummaryId(caseId: string): string {
  return `case-${caseId}`;
}

export function caseToAlertSummary(kase: Case): AlertRecord {
  const priority = PRIORITY_FROM_CASE[kase.priority];

  return {
    id: caseSummaryId(kase.caseId),
    trackingNumber: kase.caseNumber,
    accessCode: '',
    accessCodeHash: '',
    accessCodeSalt: '',
    channel: 'web',
    createdAt: kase.createdAt,
    updatedAt: kase.updatedAt,
    targetCompletionDate: kase.slaDueAt,
    confidentialityLevel: kase.confidentialityLevel,
    whistleblower: { isAnonymous: kase.reportingMode !== 'identified' },
    category: kase.category,
    subCategory: kase.subcategory,
    detailedDescription: kase.description,
    incidentDates: kase.incidentDate ?? '',
    incidentLocation: '',
    concernedEntity: kase.entity,
    country: kase.country,
    isOngoing: false,
    impactType: kase.impactType ?? '',
    estimatedImpactValue: kase.estimatedImpactValue,
    riskEvaluation: {
      // === AMÉLIORATION AJOUTÉE : sous-scores non disponibles (voir
      // en-tête de ce fichier) — jamais devinés, fixés à la valeur
      // plancher plutôt que fabriqués.
      financialImpact: 1,
      hierarchyLevel: 1,
      recidivism: 1,
      reputationRisk: 1,
      totalScore: kase.riskScore,
      nocaThreshold: NOCA_FROM_PRIORITY[priority],
      priority,
      expectedTreatment: '',
    },
    involvedPersons: [],
    witnesses: [],
    evidences: [],
    status: STATUS_FROM_CASE[kase.status],
    // === AMÉLIORATION AJOUTÉE : jamais de nom résolu (voir en-tête) ===
    assignedInvestigators: kase.assignee ? [kase.assignee, ...kase.additionalInvestigators] : [],
    assignedInvestigatorNames: [],
    closedAt: kase.closedAt,
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    tasks: [],
    interviews: [],
    conflictDeclarations: [],
  };
}
