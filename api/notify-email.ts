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

interface MinimalRequest {
  method?: string;
  body?: unknown;
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

export default async function handler(req: MinimalRequest, res: MinimalResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST.' });
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
        to: [to],
        subject,
        text: body,
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
