/**
 * === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER dans Firebase) ===
 *
 * Jusqu'ici, `createCaseAsReporter` ne recevait que le cœur du signalement
 * (catégorie, pays, entité, description). Tout le reste du formulaire —
 * dates et lieu des faits, personnes mises en cause, témoins, impact,
 * évaluation du risque, identité du déclarant (mode identifié), liste des
 * pièces jointes — ne restait que sur l'appareil du déclarant : l'équipe
 * DARC recevait un dossier incomplet.
 *
 * Ce module définit ces « détails » et leur nettoyage côté serveur.
 * Nettoyage TOLÉRANT, jamais bloquant : un champ trop long est tronqué, une
 * entrée invalide est ignorée, mais le signalement lui-même est toujours
 * enregistré (perdre une alerte pour un détail mal formé serait pire).
 *
 * Pur (aucune dépendance Firebase ni navigateur) : partagé par la Cloud
 * Function, le formulaire et les tests.
 */
import type { CasePriority, HierarchyLevel } from './caseTypes';

export const REPORTER_DETAILS_LIMITS = {
  text: 300,
  longText: 2000,
  name: 150,
  persons: 30,
  evidence: 20,
  fileName: 255,
  fileType: 120,
} as const;

export interface ReporterPersonDetail {
  kind: 'subject' | 'witness';
  name: string;
  position?: string;
  hierarchyLevel?: HierarchyLevel;
}

export interface ReporterRiskDetail {
  financialImpact: 1 | 2 | 3 | 4;
  hierarchicalLevel: 1 | 2 | 3 | 4;
  recurrence: 1 | 2 | 3 | 4;
  reputationRisk: 1 | 2 | 3 | 4;
  totalScore: number;
  priority: CasePriority;
}

export interface ReporterIdentityDetail {
  fullName?: string;
  jobTitle?: string;
  department?: string;
  declarantType?: string;
  email?: string;
  phone?: string;
  entity?: string;
  country?: string;
}

export interface ReporterEvidenceDetail {
  name: string;
  type: string;
  size: number;
}

export interface ReporterCaseDetails {
  incidentDates?: string;
  incidentLocation?: string;
  isOngoing?: boolean;
  impactType?: string;
  estimatedImpactValue?: string;
  customViolationType?: string;
  /** Échéance de traitement calculée par le formulaire (SLA). */
  slaDueAt?: string;
  risk?: ReporterRiskDetail;
  persons?: ReporterPersonDetail[];
  /** Mode identifié uniquement : stocké à part (reporter_identities), accès audité. */
  identity?: ReporterIdentityDetail;
  /** Métadonnées des pièces jointes (le contenu reste sur l'appareil du déclarant). */
  evidence?: ReporterEvidenceDetail[];
}

const HIERARCHY_LEVELS: readonly HierarchyLevel[] = ['employee', 'manager', 'senior_manager', 'director_plus'];
const CASE_PRIORITIES: readonly CasePriority[] = ['low', 'high', 'very_high', 'critical'];

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function score(v: unknown): 1 | 2 | 3 | 4 | null {
  return v === 1 || v === 2 || v === 3 || v === 4 ? v : null;
}

function sanitizeRisk(raw: unknown): ReporterRiskDetail | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const financialImpact = score(r.financialImpact);
  const hierarchicalLevel = score(r.hierarchicalLevel);
  const recurrence = score(r.recurrence);
  const reputationRisk = score(r.reputationRisk);
  const totalScore = typeof r.totalScore === 'number' && Number.isFinite(r.totalScore) && r.totalScore >= 0 && r.totalScore <= 1000 ? r.totalScore : null;
  const priority = CASE_PRIORITIES.includes(r.priority as CasePriority) ? (r.priority as CasePriority) : null;
  if (!financialImpact || !hierarchicalLevel || !recurrence || !reputationRisk || totalScore === null || !priority) return undefined;
  return { financialImpact, hierarchicalLevel, recurrence, reputationRisk, totalScore, priority };
}

function sanitizePersons(raw: unknown): ReporterPersonDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ReporterPersonDetail[] = [];
  for (const item of raw) {
    if (out.length >= REPORTER_DETAILS_LIMITS.persons) break;
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const kind = p.kind === 'subject' || p.kind === 'witness' ? p.kind : null;
    const name = text(p.name, REPORTER_DETAILS_LIMITS.name);
    if (!kind || !name) continue;
    const person: ReporterPersonDetail = { kind, name };
    const position = text(p.position, REPORTER_DETAILS_LIMITS.name);
    if (position) person.position = position;
    if (HIERARCHY_LEVELS.includes(p.hierarchyLevel as HierarchyLevel)) person.hierarchyLevel = p.hierarchyLevel as HierarchyLevel;
    out.push(person);
  }
  return out.length ? out : undefined;
}

function sanitizeIdentity(raw: unknown): ReporterIdentityDetail | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: ReporterIdentityDetail = {};
  for (const key of ['fullName', 'jobTitle', 'department', 'declarantType', 'email', 'phone', 'entity', 'country'] as const) {
    const v = text(r[key], REPORTER_DETAILS_LIMITS.name);
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeEvidence(raw: unknown): ReporterEvidenceDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ReporterEvidenceDetail[] = [];
  for (const item of raw) {
    if (out.length >= REPORTER_DETAILS_LIMITS.evidence) break;
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const name = text(e.name, REPORTER_DETAILS_LIMITS.fileName);
    if (!name) continue;
    const size = typeof e.size === 'number' && Number.isFinite(e.size) && e.size >= 0 ? Math.min(Math.round(e.size), 1e10) : 0;
    out.push({ name, type: text(e.type, REPORTER_DETAILS_LIMITS.fileType) ?? 'application/octet-stream', size });
  }
  return out.length ? out : undefined;
}

/** Échéance acceptée seulement si c'est une date valide entre aujourd'hui et +2 ans. */
function sanitizeDueDate(v: unknown, now: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  if (Number.isNaN(t) || t < now - 24 * 3600 * 1000 || t > now + 730 * 24 * 3600 * 1000) return undefined;
  return new Date(t).toISOString();
}

/**
 * Nettoie les détails reçus. Ne lève jamais : renvoie `{}` pour une entrée
 * absente ou inutilisable. `identity` n'est conservée qu'en mode identifié.
 */
export function sanitizeReporterCaseDetails(raw: unknown, reportingMode: 'anonymous' | 'identified', now: number = Date.now()): ReporterCaseDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: ReporterCaseDetails = {};
  const incidentDates = text(r.incidentDates, REPORTER_DETAILS_LIMITS.text);
  if (incidentDates) out.incidentDates = incidentDates;
  const incidentLocation = text(r.incidentLocation, REPORTER_DETAILS_LIMITS.text);
  if (incidentLocation) out.incidentLocation = incidentLocation;
  if (typeof r.isOngoing === 'boolean') out.isOngoing = r.isOngoing;
  const impactType = text(r.impactType, REPORTER_DETAILS_LIMITS.text);
  if (impactType) out.impactType = impactType;
  const estimatedImpactValue = text(r.estimatedImpactValue, REPORTER_DETAILS_LIMITS.name);
  if (estimatedImpactValue) out.estimatedImpactValue = estimatedImpactValue;
  const customViolationType = text(r.customViolationType, REPORTER_DETAILS_LIMITS.longText);
  if (customViolationType) out.customViolationType = customViolationType;
  const slaDueAt = sanitizeDueDate(r.slaDueAt, now);
  if (slaDueAt) out.slaDueAt = slaDueAt;
  const risk = sanitizeRisk(r.risk);
  if (risk) out.risk = risk;
  const persons = sanitizePersons(r.persons);
  if (persons) out.persons = persons;
  if (reportingMode === 'identified') {
    const identity = sanitizeIdentity(r.identity);
    if (identity) out.identity = identity;
  }
  const evidence = sanitizeEvidence(r.evidence);
  if (evidence) out.evidence = evidence;
  return out;
}

// ---------------------------------------------------------------------------
// Identifiants de suivi déjà hachés (rattrapage des signalements anciens)
// ---------------------------------------------------------------------------

/** Empreinte PBKDF2 standard de l'application, ou ancienne empreinte SHA-256 itérée (64 hex). */
const ACCESS_HASH_RE = /^(pbkdf2_sha256\$600000\$[0-9a-f]{64}|[0-9a-f]{64})$/;
const ACCESS_SALT_RE = /^[0-9a-f]{8,128}$/;

/**
 * Empreinte + sel du code d'accès d'un signalement ancien (le code en clair
 * n'est plus connu de l'appareil). Formats stricts : jamais un nombre
 * d'itérations choisi par l'appelant.
 */
export function parseHashedAccessCode(hash: unknown, salt: unknown): { accessCodeHash: string; accessCodeSalt: string } | null {
  if (typeof hash !== 'string' || typeof salt !== 'string') return null;
  if (!ACCESS_HASH_RE.test(hash) || !ACCESS_SALT_RE.test(salt)) return null;
  return { accessCodeHash: hash, accessCodeSalt: salt };
}
