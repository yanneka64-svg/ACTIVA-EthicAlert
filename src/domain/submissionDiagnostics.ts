/**
 * === AMÉLIORATION AJOUTÉE (diagnostic des dépôts retardés) ===
 *
 * Quand un dépôt n'a pas abouti du premier coup, l'appareil joint à l'envoi
 * suivant la raison technique du premier échec. Le serveur l'inscrit dans la
 * piste d'audit (REPORTER_SUBMISSION_RECOVERED) : on connaît ainsi la cause
 * exacte, appareil par appareil, sans jamais rien de personnel (ni adresse
 * IP, ni agent utilisateur complet : seulement des catégories).
 *
 * Pur : partagé par le navigateur et les Cloud Functions.
 */
export type DiagnosticPlatform = 'ios' | 'android' | 'desktop' | 'other';
export type DiagnosticBrowser = 'safari' | 'chrome' | 'firefox' | 'samsung' | 'opera' | 'edge' | 'inapp' | 'other';
export type DiagnosticVia = 'site' | 'direct' | 'api';

export interface SubmissionDiagnostics {
  /** Code de la première erreur (ex. functions/internal, client-deadline). */
  firstError: string;
  /** Nombre d'essais avant celui-ci. */
  attempts: number;
  /** Chemin qui a finalement abouti. */
  via: DiagnosticVia;
  platform: DiagnosticPlatform;
  browser: DiagnosticBrowser;
}

const CODE_RE = /^[A-Za-z0-9/_.-]{1,60}$/;
const PLATFORMS: readonly DiagnosticPlatform[] = ['ios', 'android', 'desktop', 'other'];
const BROWSERS: readonly DiagnosticBrowser[] = ['safari', 'chrome', 'firefox', 'samsung', 'opera', 'edge', 'inapp', 'other'];
const VIAS: readonly DiagnosticVia[] = ['site', 'direct', 'api'];

/** Catégories d'appareil et de navigateur (jamais l'agent utilisateur complet). */
export function classifyUserAgent(ua: string): { platform: DiagnosticPlatform; browser: DiagnosticBrowser } {
  const s = String(ua ?? '');
  const platform: DiagnosticPlatform = /iPhone|iPad|iPod/i.test(s) ? 'ios' : /Android/i.test(s) ? 'android' : /Windows|Macintosh|Linux|CrOS/i.test(s) ? 'desktop' : 'other';
  const browser: DiagnosticBrowser = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(s)
    ? 'inapp'
    : /SamsungBrowser/i.test(s)
      ? 'samsung'
      : /OPR\/|Opera|OPiOS|OPT\//i.test(s)
        ? 'opera'
        : /Edg\/|EdgiOS|EdgA/i.test(s)
          ? 'edge'
          : /Firefox|FxiOS/i.test(s)
            ? 'firefox'
            : /Chrome|CriOS/i.test(s)
              ? 'chrome'
              : /Safari/i.test(s)
                ? 'safari'
                : 'other';
  return { platform, browser };
}

/** Code d'erreur ramené à une forme sûre et courte. */
export function normalizeErrorCode(code: unknown): string {
  const c = String(code ?? '').trim().slice(0, 60);
  return CODE_RE.test(c) ? c : 'unknown';
}

/** Valide ce qu'envoie le navigateur ; `null` si absent ou invalide (jamais bloquant). */
export function sanitizeSubmissionDiagnostics(raw: unknown): SubmissionDiagnostics | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.firstError !== 'string' || !CODE_RE.test(r.firstError)) return null;
  const attempts = Number(r.attempts);
  return {
    firstError: r.firstError,
    attempts: Number.isFinite(attempts) ? Math.max(0, Math.min(1000, Math.floor(attempts))) : 0,
    via: VIAS.includes(r.via as DiagnosticVia) ? (r.via as DiagnosticVia) : 'site',
    platform: PLATFORMS.includes(r.platform as DiagnosticPlatform) ? (r.platform as DiagnosticPlatform) : 'other',
    browser: BROWSERS.includes(r.browser as DiagnosticBrowser) ? (r.browser as DiagnosticBrowser) : 'other',
  };
}
