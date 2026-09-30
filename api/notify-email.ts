/**
 * === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
 *
 * Fonction serverless (déployable sur Vercel — voir
 * docs/EMAIL-NOTIFICATIONS.md pour la marche à suivre complète) : c'est le
 * SEUL point de ce dépôt qui envoie réellement un e-mail. L'application
 * cliente (src/) reste un pur SPA localStorage, sans capacité d'envoi
 * propre — ce fichier vit volontairement hors de `src/` (non inclus dans
 * `tsconfig.app.json`, non empaqueté par Vite) car il tourne sur un
 * runtime Node serveur, jamais dans le navigateur : une clé API d'envoi
 * d'e-mail ne doit jamais être exposée côté client.
 *
 * Fournisseur : Resend (https://resend.com), choisi pour sa simplicité —
 * une seule requête HTTP, pas de SDK à installer, un plan gratuit
 * suffisant pour ce volume. Appelé ici via `fetch` brut (disponible
 * nativement dans le runtime Node des fonctions Vercel), sans dépendance
 * ajoutée à `package.json`.
 *
 * Comportement honnête (brief §32 — jamais une fausse réussite) :
 * - Si `RESEND_API_KEY` n'est pas configurée, répond 503 explicitement —
 *   jamais un faux 200.
 * - Toute erreur de l'API Resend est répercutée telle quelle (code +
 *   message tronqué) au lieu d'être avalée.
 * - `src/services/emailNotify.ts` (le seul appelant réel, côté client)
 *   journalise CHAQUE tentative dans l'Audit Trail avec son issue réelle,
 *   jamais un succès supposé.
 */

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : relais e-mail fermé) ===
// Garde-fou partagé avec la Cloud Function notifyEmail (même module pur,
// testé par src/domain/notifyEmailGuard.test.ts). Extension `.js` : ce
// projet est en `"type": "module"`, Node ESM exige l'extension du fichier
// compilé pour un import relatif.
import {
  FixedWindowRateLimiter,
  NOTIFY_RATE_WINDOW_MS,
  clientIp,
  rateLimitFromEnv,
  validateNotifyEmailRequest,
  type HeaderBag,
} from '../src/domain/notifyEmailGuard.js';

interface MinimalRequest {
  method?: string;
  body?: unknown;
  // === AMÉLIORATION AJOUTÉE === en-têtes/IP lus par le garde-fou (Origin, Host, X-Forwarded-For).
  headers?: HeaderBag;
  socket?: { remoteAddress?: string };
}

interface MinimalResponse {
  status(code: number): MinimalResponse;
  json(data: unknown): void;
}

interface NotifyEmailPayload {
  to?: string;
  subject?: string;
  body?: string;
}

// === AMÉLIORATION AJOUTÉE === limiteur par IP (best effort, par instance chaude).
const rateLimiter = new FixedWindowRateLimiter(rateLimitFromEnv(process.env.NOTIFY_RATE_LIMIT), NOTIFY_RATE_WINDOW_MS);

export default async function handler(req: MinimalRequest, res: MinimalResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST.' });
    return;
  }

  // === AMÉLIORATION AJOUTÉE (Audit DevOps — Vercel n'est plus utilisé) ===
  // Le projet Vercel n'est plus l'hébergement de l'application (Firebase
  // Hosting + Cloud Function notifyEmail). Ce point d'envoi est donc
  // DÉSACTIVÉ par défaut : même si une clé RESEND_API_KEY traîne encore
  // dans l'environnement Vercel, il n'enverra plus rien dès le prochain
  // déploiement Vercel. Réactivation explicite uniquement :
  // NOTIFY_VERCEL_ENABLED=true (+ NOTIFY_ALLOWED_RECIPIENT_DOMAINS). Le
  // client (emailNotify.ts) journalise ce refus comme un échec réel.
  if (process.env.NOTIFY_VERCEL_ENABLED !== 'true') {
    res.status(410).json({ error: 'Email endpoint disabled on Vercel — notifications are sent by the Firebase Cloud Function notifyEmail.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // === AMÉLIORATION AJOUTÉE === jamais un faux succès : l'appelant
    // (emailNotify.ts) journalise ce 503 comme un échec réel, avec sa
    // vraie raison ("service non configuré"), pas un envoi silencieux.
    res.status(503).json({ error: 'Email service not configured: RESEND_API_KEY is missing.' });
    return;
  }

  const { to, subject, body } = (req.body ?? {}) as NotifyEmailPayload;
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'to, subject and body are required.' });
    return;
  }

  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === n'accepte plus que ce
  // que src/services/emailNotify.ts envoie réellement : Origin = l'app,
  // destinataire unique valide (domaines restreints si
  // NOTIFY_ALLOWED_RECIPIENT_DOMAINS est défini), sujet préfixé
  // « [activa-whistleblowing] », liens du corps vers l'app uniquement.
  const guard = validateNotifyEmailRequest(
    { to, subject, body, headers: req.headers },
    { allowedOrigins: process.env.NOTIFY_ALLOWED_ORIGINS, allowedRecipientDomains: process.env.NOTIFY_ALLOWED_RECIPIENT_DOMAINS }
  );
  if (!guard.ok) {
    console.warn(`notify-email refused (${guard.status}): ${guard.error}`);
    res.status(guard.status).json({ error: guard.error });
    return;
  }
  if (!rateLimiter.hit(clientIp(req.headers, req.socket?.remoteAddress))) {
    res.status(429).json({ error: 'Too many notification requests — retry later.' });
    return;
  }

  // === AMÉLIORATION AJOUTÉE === adresse d'envoi configurable
  // (`NOTIFY_FROM_EMAIL`) — un domaine vérifié chez Resend une fois le
  // compte en place (voir docs/EMAIL-NOTIFICATIONS.md) ; repli sur le
  // domaine de test fourni par Resend, utilisable sans domaine propre le
  // temps de la mise en route.
  const fromAddress = process.env.NOTIFY_FROM_EMAIL || 'ACTIVA EthicAlert <onboarding@resend.dev>';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        // === AMÉLIORATION AJOUTÉE === valeurs normalisées par le garde-fou.
        to: [guard.to],
        subject: guard.subject,
        text: guard.body,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      res.status(502).json({ error: `Resend error (${resendRes.status}): ${errText.slice(0, 300)}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error while calling Resend.' });
  }
}
