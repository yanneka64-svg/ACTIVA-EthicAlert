/**
 * === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER dans Firebase) ===
 *
 * Construit, à partir d'un signalement du formulaire public (`AlertRecord`),
 * ce qui est envoyé à la Cloud Function `createCaseAsReporter` :
 * - `buildReporterCaseDetails` : tout le contenu du formulaire au-delà du
 *   cœur (dates, lieu, personnes, témoins, impact, risque, identité en mode
 *   identifié, liste des pièces jointes) ;
 * - `clampReporterCore` : cœur du signalement ramené aux tailles acceptées
 *   par le serveur, pour qu'un texte très long ne fasse jamais refuser
 *   l'enregistrement (la version complète reste sur l'appareil) ;
 * - `buildBackfillSubmission` : rattrapage d'un signalement resté sur
 *   l'appareil (déposé avant l'envoi au serveur, ou jamais transmis).
 *
 * Pur : aucune dépendance Firebase ni stockage.
 */
import type { AlertRecord, PriorityLevel } from '../types';
import type { CasePriority, HierarchyLevel } from './caseTypes';
import type { ReporterCaseDetails, ReporterPersonDetail } from './reporterCaseDetails';
import { REPORTER_INPUT_LIMITS } from './reporterCaseInput';

const ROLE_TO_HIERARCHY: Record<string, HierarchyLevel> = {
  'Employé': 'employee',
  'Cadre': 'manager',
  'Sous-Directeur': 'senior_manager',
  'Directeur+': 'director_plus',
};

const LOCAL_PRIORITY_TO_CASE: Record<PriorityLevel, CasePriority> = {
  faible: 'low',
  elevee: 'high',
  tres_elevee: 'very_high',
  critique: 'critical',
};

export type ReporterDetailsSource = Pick<
  AlertRecord,
  | 'whistleblower'
  | 'incidentDates'
  | 'incidentLocation'
  | 'isOngoing'
  | 'impactType'
  | 'estimatedImpactValue'
  | 'customViolationType'
  | 'riskEvaluation'
  | 'involvedPersons'
  | 'witnesses'
  | 'evidences'
  | 'targetCompletionDate'
>;

function nonEmpty(v: string | undefined | null): string | undefined {
  const t = (v ?? '').trim();
  return t ? t : undefined;
}

/** Contenu détaillé du signalement (sans le cœur ni les identifiants de suivi). */
export function buildReporterCaseDetails(src: ReporterDetailsSource): ReporterCaseDetails {
  const details: ReporterCaseDetails = {};
  const incidentDates = nonEmpty(src.incidentDates);
  if (incidentDates) details.incidentDates = incidentDates;
  const incidentLocation = nonEmpty(src.incidentLocation);
  if (incidentLocation) details.incidentLocation = incidentLocation;
  if (typeof src.isOngoing === 'boolean') details.isOngoing = src.isOngoing;
  const impactType = nonEmpty(src.impactType);
  if (impactType) details.impactType = impactType;
  const estimatedImpactValue = nonEmpty(src.estimatedImpactValue);
  if (estimatedImpactValue) details.estimatedImpactValue = estimatedImpactValue;
  const customViolationType = nonEmpty(src.customViolationType);
  if (customViolationType) details.customViolationType = customViolationType;
  if (nonEmpty(src.targetCompletionDate)) details.slaDueAt = src.targetCompletionDate;

  const r = src.riskEvaluation;
  if (r && LOCAL_PRIORITY_TO_CASE[r.priority]) {
    details.risk = {
      financialImpact: r.financialImpact,
      hierarchicalLevel: r.hierarchyLevel,
      recurrence: r.recidivism,
      reputationRisk: r.reputationRisk,
      totalScore: r.totalScore,
      priority: LOCAL_PRIORITY_TO_CASE[r.priority],
    };
  }

  const toPerson = (kind: ReporterPersonDetail['kind']) => (p: { name: string; position: string; hierarchyRole: string }): ReporterPersonDetail | null => {
    const name = nonEmpty(p.name);
    if (!name) return null;
    const out: ReporterPersonDetail = { kind, name };
    const position = nonEmpty(p.position);
    if (position) out.position = position;
    const level = ROLE_TO_HIERARCHY[p.hierarchyRole];
    if (level) out.hierarchyLevel = level;
    return out;
  };
  const persons = [
    ...(src.involvedPersons ?? []).map(toPerson('subject')),
    ...(src.witnesses ?? []).map(toPerson('witness')),
  ].filter((p): p is ReporterPersonDetail => p !== null);
  if (persons.length) details.persons = persons;

  const w = src.whistleblower;
  if (w && !w.isAnonymous) {
    const identity = {
      fullName: nonEmpty(w.fullName),
      jobTitle: nonEmpty(w.jobTitle),
      department: nonEmpty(w.department),
      declarantType: nonEmpty(w.declarantType),
      email: nonEmpty(w.email),
      phone: nonEmpty(w.phone),
      entity: nonEmpty(w.entity),
      country: nonEmpty(w.declarantCountry),
    };
    const defined = Object.fromEntries(Object.entries(identity).filter(([, v]) => v !== undefined));
    if (Object.keys(defined).length) details.identity = defined;
  }

  const evidence = (src.evidences ?? [])
    .filter((e) => nonEmpty(e.name))
    .map((e) => ({ name: e.name, type: e.type || 'application/octet-stream', size: Number.isFinite(e.size) ? e.size : 0 }));
  if (evidence.length) details.evidence = evidence;

  return details;
}

export interface ReporterCore {
  category: string;
  subcategory?: string;
  country: string;
  entity: string;
  description: string;
}

function clamp(v: string | undefined, max: number, fallback: string): string {
  const t = (v ?? '').trim() || fallback;
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

/** Cœur du signalement ramené aux tailles acceptées par le serveur (jamais vide). */
export function clampReporterCore<T extends ReporterCore>(input: T): T {
  const L = REPORTER_INPUT_LIMITS;
  const subcategory = (input.subcategory ?? '').trim();
  const out: T = {
    ...input,
    category: clamp(input.category, L.category, 'Non précisé'),
    country: clamp(input.country, L.country, 'Non précisé'),
    entity: clamp(input.entity, L.entity, 'Non précisé'),
    description: clamp(input.description, L.description, '(Description non renseignée)'),
  };
  if (subcategory) out.subcategory = clamp(subcategory, L.subcategory, '');
  else delete out.subcategory;
  return out;
}

/** Le signalement est-il un dépôt du formulaire public resté sur cet appareil (jamais transmis) ? */
export function isLocalOnlyPublicReport(alert: AlertRecord): boolean {
  return (
    alert.channel === 'web' &&
    /^alt-\d{12,}$/.test(alert.id) &&
    !alert.mirroredCaseId &&
    !alert.cloudImported
  );
}

export interface BackfillSubmission extends ReporterCore {
  reportingMode: 'anonymous' | 'identified';
  confidentialityLevel: NonNullable<AlertRecord['confidentialityLevel']>;
  externalReference?: string;
  submissionId: string;
  accessCodeHash?: string;
  accessCodeSalt?: string;
  details: ReporterCaseDetails;
}

/**
 * Données d'envoi d'un signalement resté sur l'appareil. `submissionId`
 * dérivé de l'identifiant local : plusieurs essais (ou plusieurs onglets)
 * ne créent jamais deux dossiers. Le numéro de suivi déjà remis et
 * l'empreinte du code d'accès sont repris : le déclarant garde les mêmes
 * identifiants.
 */
export function buildBackfillSubmission(alert: AlertRecord): BackfillSubmission {
  const core = clampReporterCore({
    category: alert.category,
    subcategory: alert.subCategory,
    country: alert.country,
    entity: alert.concernedEntity,
    description: alert.detailedDescription,
  });
  return {
    ...core,
    reportingMode: alert.whistleblower?.isAnonymous === false ? 'identified' : 'anonymous',
    confidentialityLevel: alert.confidentialityLevel ?? 'confidential',
    ...(alert.trackingNumber ? { externalReference: alert.trackingNumber.trim().toUpperCase() } : {}),
    submissionId: `backfill-${alert.id}`.slice(0, 64),
    ...(alert.accessCodeHash && alert.accessCodeSalt ? { accessCodeHash: alert.accessCodeHash, accessCodeSalt: alert.accessCodeSalt } : {}),
    details: buildReporterCaseDetails(alert),
  };
}
