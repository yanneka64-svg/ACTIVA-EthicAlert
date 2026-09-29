/**
 * === AMÉLIORATION AJOUTÉE (revue PR #139 — createCaseAsReporter) ===
 *
 * Validation d'exécution des données reçues par la Cloud Function publique
 * `createCaseAsReporter` (appelable sans compte). Un `as Pick<Case, …>`
 * TypeScript ne vérifie rien à l'exécution : un appel direct pouvait
 * enregistrer des objets, des textes démesurés ou des valeurs hors des
 * listes autorisées dans des champs que le reste du code traite comme des
 * chaînes et des énumérations. Seules les données validées ici sont
 * persistées.
 *
 * Pur (aucune dépendance Firebase) : partagé par le serveur et les tests.
 */
import type { Case, ConfidentialityLevel, ReportingMode } from './caseTypes';

export const REPORTER_INPUT_LIMITS = {
  category: 150,
  subcategory: 150,
  country: 100,
  entity: 150,
  description: 20000,
} as const;

const REPORTING_MODES: readonly ReportingMode[] = ['anonymous', 'identified'];
const CONFIDENTIALITY_LEVELS: readonly ConfidentialityLevel[] = ['standard', 'restricted', 'confidential', 'highly_confidential'];
/** Même alphabet que generateAccessPassword (crypto.ts), longueur 8 à 64. */
const ACCESS_CODE_RE = /^[A-Za-z0-9]{8,64}$/;
/** Numéro de suivi local, ex. AACMR-26-09-0001. */
const EXTERNAL_REFERENCE_RE = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

export interface ReporterCaseInput {
  category: string;
  subcategory: string;
  country: string;
  entity: string;
  description: string;
  reportingMode: Case['reportingMode'];
  confidentialityLevel: Case['confidentialityLevel'];
  /** Code d'accès déjà remis au lanceur d'alerte (le serveur n'en stocke que l'empreinte). */
  accessCode?: string;
  /** Numéro de suivi local déjà remis au lanceur d'alerte. */
  externalReference?: string;
}

export type ReporterCaseInputResult = { ok: true; value: ReporterCaseInput } | { ok: false; error: string };

function requiredText(raw: Record<string, unknown>, field: keyof typeof REPORTER_INPUT_LIMITS): string | null {
  const v = raw[field];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= REPORTER_INPUT_LIMITS[field] ? t : null;
}

export function parseReporterCaseInput(input: unknown): ReporterCaseInputResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid payload.' };
  const raw = input as Record<string, unknown>;

  const category = requiredText(raw, 'category');
  const country = requiredText(raw, 'country');
  const entity = requiredText(raw, 'entity');
  const description = requiredText(raw, 'description');
  if (!category || !country || !entity || !description) {
    return { ok: false, error: 'category, country, entity and description are required (bounded strings).' };
  }

  let subcategory = '';
  if (raw.subcategory !== undefined && raw.subcategory !== null && raw.subcategory !== '') {
    const s = requiredText(raw, 'subcategory');
    if (s === null) return { ok: false, error: 'Invalid subcategory.' };
    subcategory = s;
  }

  const reportingMode = raw.reportingMode ?? 'anonymous';
  if (!REPORTING_MODES.includes(reportingMode as ReportingMode)) return { ok: false, error: 'Invalid reportingMode.' };
  const confidentialityLevel = raw.confidentialityLevel ?? 'confidential';
  if (!CONFIDENTIALITY_LEVELS.includes(confidentialityLevel as ConfidentialityLevel)) return { ok: false, error: 'Invalid confidentialityLevel.' };

  const value: ReporterCaseInput = {
    category, subcategory, country, entity, description,
    reportingMode: reportingMode as ReportingMode,
    confidentialityLevel: confidentialityLevel as ConfidentialityLevel,
  };
  if (raw.accessCode !== undefined) {
    if (typeof raw.accessCode !== 'string' || !ACCESS_CODE_RE.test(raw.accessCode)) return { ok: false, error: 'Invalid accessCode.' };
    value.accessCode = raw.accessCode;
  }
  if (raw.externalReference !== undefined) {
    const ref = typeof raw.externalReference === 'string' ? raw.externalReference.trim().toUpperCase() : '';
    if (!EXTERNAL_REFERENCE_RE.test(ref)) return { ok: false, error: 'Invalid externalReference.' };
    value.externalReference = ref;
  }
  return { ok: true, value };
}
