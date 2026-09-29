/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : fermer le relais e-mail ouvert) ===
 *
 * Garde-fou partagé par les DEUX points d'envoi d'e-mail du dépôt :
 * `api/notify-email.ts` (Vercel) et `notifyEmail` (functions/src/index.ts,
 * Cloud Functions). Jusqu'ici, n'importe qui sur Internet pouvait leur
 * demander d'envoyer n'importe quel sujet/corps à n'importe quelle adresse
 * (relais ouvert → hameçonnage au nom d'ACTIVA, domaine d'envoi grillé,
 * quota Resend épuisé).
 *
 * Le contrat HTTP est INCHANGÉ (POST {to, subject, body}) : le seul
 * appelant réel, `src/services/emailNotify.ts`, continue de fonctionner
 * sans modification. On n'accepte simplement plus que ce que ce client
 * envoie réellement :
 * - `Origin` obligatoire et égal à l'application elle-même (même hôte que
 *   la requête, ou liste explicite `NOTIFY_ALLOWED_ORIGINS`) ;
 * - un destinataire unique, syntaxiquement valide, sans injection
 *   d'en-tête ; domaine obligatoirement dans `NOTIFY_ALLOWED_RECIPIENT_DOMAINS`
 *   (=== AMÉLIORATION AJOUTÉE (revue PR #139) === échec fermé si absent) ;
 * - un sujet d'une ligne commençant par « [activa-whistleblowing] » (tous
 *   les modèles d'emailNotify.ts le font) ;
 * - un corps borné, dont TOUT lien pointe vers l'application elle-même
 *   (neutralise l'injection de liens d'hameçonnage) ;
 * - un débit maximal par adresse IP (limiteur en mémoire, voir plus bas).
 *
 * Ce n'est PAS l'authentification forte : un attaquant déterminé peut
 * forger l'en-tête Origin. La correction définitive (e-mails construits et
 * envoyés côté serveur par createCase/assignCase, sans point d'envoi
 * public) arrive avec le passage au plan Blaze — voir docs/DEVOPS-RUNBOOK.md.
 * Ce garde-fou rend en attendant le relais inutilisable pour du phishing.
 *
 * Pur (aucune dépendance Node/navigateur) : importable par Vercel, par les
 * Cloud Functions (functions/tsconfig.json inclut déjà ../src/domain) et
 * testé par Vitest (notifyEmailGuard.test.ts).
 */

/** Préfixe porté par tous les sujets construits dans src/services/emailNotify.ts. */
export const NOTIFY_SUBJECT_PREFIX = '[activa-whistleblowing] ';
export const NOTIFY_MAX_SUBJECT_LENGTH = 200;
export const NOTIFY_MAX_BODY_LENGTH = 5000;
export const NOTIFY_MAX_EMAIL_LENGTH = 254;
/** Débit par défaut : 60 envois / 10 min / IP (une soumission publique notifie chaque Opérateur). */
export const NOTIFY_DEFAULT_RATE_LIMIT = 60;
export const NOTIFY_RATE_WINDOW_MS = 10 * 60 * 1000;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

export type HeaderBag = Record<string, string | string[] | undefined>;

export interface NotifyGuardInput {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  headers?: HeaderBag;
}

export interface NotifyGuardEnv {
  /** Liste séparée par des virgules d'origines supplémentaires autorisées (ex. domaine personnalisé). */
  allowedOrigins?: string;
  /** Liste séparée par des virgules de domaines destinataires autorisés ; vide = tous. */
  allowedRecipientDomains?: string;
}

export type NotifyGuardResult =
  | { ok: true; to: string; subject: string; body: string; origin: string }
  | { ok: false; status: 400 | 403 | 503; error: string };

/** Découpe une variable d'environnement « a, b ,c » en liste normalisée (minuscules, sans vides). */
export function parseCsvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** Première valeur d'un en-tête HTTP, quel que soit le format fourni par le runtime. */
export function headerValue(headers: HeaderBag | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Adresse IP cliente (première entrée de X-Forwarded-For), ou « unknown ». */
export function clientIp(headers: HeaderBag | undefined, fallback?: string): string {
  const fwd = headerValue(headers, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headerValue(headers, 'x-real-ip') ?? fallback ?? 'unknown';
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Origines considérées comme « l'application elle-même » : celles de la
 * requête (Host / X-Forwarded-Host, qu'une réécriture Firebase Hosting ou
 * Vercel positionne) plus la liste explicite de l'environnement.
 */
export function allowedOriginsFor(headers: HeaderBag | undefined, env: NotifyGuardEnv): Set<string> {
  const set = new Set(parseCsvList(env.allowedOrigins));
  for (const h of ['x-forwarded-host', 'host']) {
    const host = headerValue(headers, h);
    if (host) {
      for (const one of host.split(',')) {
        const h2 = one.trim().toLowerCase();
        set.add(`https://${h2}`);
        // `vercel dev` / émulateur Firebase en local : servis en http.
        if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h2)) set.add(`http://${h2}`);
      }
    }
  }
  return set;
}

/** Valide une demande d'envoi ; ne renvoie `ok: true` que pour ce qu'emailNotify.ts envoie réellement. */
export function validateNotifyEmailRequest(input: NotifyGuardInput, env: NotifyGuardEnv = {}): NotifyGuardResult {
  const { to, subject, body, headers } = input;
  if (typeof to !== 'string' || typeof subject !== 'string' || typeof body !== 'string' || !to || !subject || !body) {
    // Même message qu'avant l'ajout du garde-fou (contrat inchangé).
    return { ok: false, status: 400, error: 'to, subject and body are required.' };
  }

  const allowed = allowedOriginsFor(headers, env);
  const rawOrigin = headerValue(headers, 'origin');
  const origin = rawOrigin ? originOf(rawOrigin) : null;
  if (!origin || !allowed.has(origin)) {
    return { ok: false, status: 403, error: 'Origin not allowed.' };
  }

  const recipient = to.trim();
  if (recipient.length > NOTIFY_MAX_EMAIL_LENGTH || !EMAIL_RE.test(recipient)) {
    return { ok: false, status: 400, error: 'Invalid recipient address.' };
  }
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === liste de domaines
  // destinataires OBLIGATOIRE (échec fermé) : l'en-tête Origin/Host peut être
  // forgé par un client hors navigateur, c'est donc cette liste qui empêche
  // réellement d'utiliser le point d'envoi comme relais vers des adresses
  // externes. Sans configuration, aucun e-mail ne part (503 explicite,
  // journalisé EMAIL_NOTIFICATION_FAILED côté client).
  const domains = parseCsvList(env.allowedRecipientDomains);
  if (domains.length === 0) {
    return { ok: false, status: 503, error: 'Email service not configured: NOTIFY_ALLOWED_RECIPIENT_DOMAINS is missing.' };
  }
  const domain = recipient.split('@')[1].toLowerCase();
  if (!domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return { ok: false, status: 403, error: 'Recipient domain not allowed.' };
  }

  if (/[\r\n]/.test(subject) || subject.length > NOTIFY_MAX_SUBJECT_LENGTH || !subject.startsWith(NOTIFY_SUBJECT_PREFIX)) {
    return { ok: false, status: 400, error: 'Invalid subject.' };
  }

  if (body.length > NOTIFY_MAX_BODY_LENGTH) {
    return { ok: false, status: 400, error: 'Body too long.' };
  }
  for (const link of body.match(URL_RE) ?? []) {
    const linkOrigin = originOf(link);
    if (!linkOrigin || !allowed.has(linkOrigin)) {
      return { ok: false, status: 400, error: 'Body links must point to the application itself.' };
    }
  }

  return { ok: true, to: recipient, subject, body, origin };
}

/**
 * Limiteur à fenêtre fixe, en mémoire. Best effort : propre à chaque
 * instance serverless (remis à zéro à chaque démarrage à froid), il borne
 * néanmoins le débit d'un abus depuis une même IP sur une instance chaude.
 * Le plafond global reste `maxInstances` côté Cloud Functions.
 */
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { windowStart: number; count: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** `true` si la requête est acceptée, `false` si le quota de la fenêtre est dépassé. */
  hit(key: string, now: number = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: now, count: 1 });
      this.prune(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private prune(now: number): void {
    if (this.hits.size < 5000) return;
    for (const [k, v] of this.hits) if (now - v.windowStart >= this.windowMs) this.hits.delete(k);
  }
}

/** Lit la limite configurée (`NOTIFY_RATE_LIMIT`), repli sur la valeur par défaut si absente/invalide. */
export function rateLimitFromEnv(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : NOTIFY_DEFAULT_RATE_LIMIT;
}

// === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié pour notifyEmail) ===
// L'origine n'authentifie personne (un client hors navigateur la forge). La
// Cloud Function exige donc en plus un appelant VÉRIFIÉ : jeton d'identité
// Firebase d'un compte du personnel (claim `role`), ou jeton App Check de
// l'application pour le dépôt public anonyme. Ces deux helpers purs
// extraient les jetons ; leur vérification cryptographique (Admin SDK) reste
// dans functions/src/index.ts.

/** Jeton `Authorization: Bearer …`, ou `undefined`. */
export function bearerToken(headers: HeaderBag | undefined): string | undefined {
  const raw = headerValue(headers, 'authorization');
  const m = raw ? /^Bearer\s+(\S+)$/i.exec(raw) : null;
  return m ? m[1] : undefined;
}

/** Jeton App Check (`X-Firebase-AppCheck`), ou `undefined`. */
export function appCheckToken(headers: HeaderBag | undefined): string | undefined {
  return headerValue(headers, 'x-firebase-appcheck');
}

/** Claims d'un jeton d'identité vérifié : compte du personnel = claim `role` non vide. */
export function isStaffClaims(claims: Record<string, unknown> | null | undefined): boolean {
  return typeof claims?.role === 'string' && claims.role.trim().length > 0;
}
