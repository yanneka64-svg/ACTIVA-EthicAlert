/**
 * === AMÉLIORATION AJOUTÉE (observabilité) ===
 *
 * Règles PURES du journal des appels aux Cloud Functions (une ligne JSON par
 * appel, lue par Cloud Logging) : gravité, appel lent, catégorie d'erreur.
 * Aucune donnée personnelle n'est jamais journalisée : ni contenu, ni nom,
 * ni e-mail, ni numéro de dossier du déclarant ; seulement le nom de la
 * fonction, la durée, le résultat, le rôle et une empreinte courte du compte.
 */

/** Au-delà de cette durée, l'appel est signalé comme lent (WARNING, `slow: true`). */
export const SLOW_CALL_MS = 3000;

export type CallSeverity = 'INFO' | 'WARNING' | 'ERROR';

/** Erreurs « normales » dues à la demande (droits, saisie, session) : pas une panne. */
const CLIENT_OUTCOMES = new Set([
  'invalid-argument',
  'permission-denied',
  'unauthenticated',
  'not-found',
  'already-exists',
  'resource-exhausted',
  'failed-precondition',
  'out-of-range',
  'cancelled',
]);

/**
 * Code de résultat d'un appel : `ok`, le code d'une HttpsError, ou
 * `internal` pour toute erreur imprévue (bogue, base injoignable…).
 */
export function callOutcome(error: unknown): string {
  if (error === undefined) return 'ok';
  const e = error as { httpErrorCode?: unknown; code?: unknown };
  if (e && typeof e === 'object' && e.httpErrorCode && typeof e.code === 'string') return e.code;
  // Erreurs gRPC de Firestore (base lente, contention de transaction…).
  if (e && typeof e === 'object' && typeof e.code === 'number') {
    const grpc: Record<number, string> = { 4: 'deadline-exceeded', 8: 'resource-exhausted', 10: 'aborted', 14: 'unavailable' };
    return grpc[e.code] ?? 'internal';
  }
  return 'internal';
}

/** Gravité : INFO si tout va bien, WARNING si lent ou refus normal, ERROR si panne. */
export function callSeverity(outcome: string, durationMs: number): CallSeverity {
  if (outcome !== 'ok' && !CLIENT_OUTCOMES.has(outcome)) return 'ERROR';
  if (outcome !== 'ok' || durationMs >= SLOW_CALL_MS) return 'WARNING';
  return 'INFO';
}

export interface CallLogInput {
  fn: string;
  durationMs: number;
  outcome: string;
  role?: string | null;
  actor?: string | null;
  correlationId: string;
}

/** Ligne de journal structurée (champs fixes pour les requêtes et alertes Cloud Logging). */
export function buildCallLogEntry(input: CallLogInput): Record<string, unknown> {
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const severity = callSeverity(input.outcome, durationMs);
  return {
    severity,
    message: `${input.fn} ${input.outcome} ${durationMs}ms`,
    event: 'callable',
    fn: input.fn,
    outcome: input.outcome,
    durationMs,
    slow: durationMs >= SLOW_CALL_MS,
    role: input.role ?? 'anonymous',
    ...(input.actor ? { actor: input.actor } : {}),
    correlationId: input.correlationId,
  };
}

/** Identifiant de corrélation fourni par le navigateur (sinon un nouveau est créé). */
export function sanitizeCorrelationId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}
