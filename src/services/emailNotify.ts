/**
 * === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
 *
 * Client des notifications e-mail réelles, sur retour utilisateur :
 * - À la soumission d'un signalement public → notifie chaque compte
 *   Opérateur (vision globale, ceux qui voient la Boîte de réception).
 * - À l'attribution d'un dossier → notifie chaque Enquêteur nouvellement
 *   attribué.
 *
 * Envoi RÉEL via `api/notify-email.ts` (fonction serverless déployée à
 * part — voir docs/EMAIL-NOTIFICATIONS.md). Cette application (src/) reste
 * un SPA localStorage sans backend propre : ce module n'a physiquement
 * aucun moyen d'envoyer un e-mail lui-même, il ne fait qu'appeler ce
 * endpoint. Discipline "jamais de fausse réussite" (brief §32) : chaque
 * tentative — réussie ou non — est journalisée dans l'Audit Trail avec son
 * issue réelle (`EMAIL_NOTIFICATION_SENT`/`EMAIL_NOTIFICATION_FAILED`),
 * jamais supposée réussie parce que l'appel a été émis. Un échec ici
 * (endpoint non déployé, clé API absente, erreur réseau) n'interrompt
 * jamais le flux principal (soumission/attribution déjà enregistrée avant
 * cet appel) — au pire, l'audit trail montre l'échec.
 */
import { UserProfile, EscalationRecipient } from '../types';
import { storage } from './storage';

const NOTIFY_ENDPOINT = '/api/notify-email';

// === AMÉLIORATION AJOUTÉE === acteur système pour les notifications
// déclenchées par le dépôt public d'un signalement (aucun compte staff
// n'est "connecté" à ce moment-là) — même motif que l'acteur "Lanceur
// d'alerte" déjà construit à la volée dans AlertSubmissionFlow.tsx pour
// l'entrée ALERT_SUBMITTED, jamais un compte réel emprunté.
const SYSTEM_ACTOR: UserProfile = {
  id: 'system-notifications',
  name: 'Système activa-whistleblowing',
  email: 'systeme@activa-hotline.internal',
  username: 'system-notifications',
  role: 'reporter',
  roleTitle: 'Notifications automatiques',
  entity: 'Groupe ACTIVA',
  country: 'Groupe ACTIVA',
};

interface NotifyResult {
  ok: boolean;
  reason?: string;
}

async function sendOne(to: string, subject: string, body: string): Promise<NotifyResult> {
  try {
    const res = await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const reason = (payload && typeof payload === 'object' && 'error' in payload) ? String((payload as { error: unknown }).error) : `HTTP ${res.status}`;
      return { ok: false, reason };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Erreur réseau inconnue' };
  }
}

// Référence minimale d'un dossier — mêmes 2 champs que `logAudit` attend
// déjà partout ailleurs dans ce fichier, jamais un `id` de repli fabriqué.
interface CaseRef {
  id: string;
  trackingNumber: string;
}

// === AMÉLIORATION AJOUTÉE === Boîte de réception : notifie chaque compte
// Opérateur (vision globale) d'un nouveau signalement public. `operators`
// doit déjà être filtré par l'appelant (ex. `isGlobalCaseViewer`) — ce
// module ne redécide jamais lui-même qui est "Opérateur".
export function notifyNewAlertToOperators(operators: UserProfile[], alert: CaseRef): void {
  operators
    .filter((u) => !!u.email)
    .forEach((u) => {
      sendOne(
        u.email,
        `[activa-whistleblowing] Nouveau signalement — ${alert.trackingNumber}`,
        `Un nouveau signalement vient d'être déposé et attend le tri dans la Boîte de réception.\n\nRéférence : ${alert.trackingNumber}\n\nConnectez-vous à activa-whistleblowing pour le consulter.`
      ).then((result) => {
        storage.logAudit(
          result.ok ? 'EMAIL_NOTIFICATION_SENT' : 'EMAIL_NOTIFICATION_FAILED',
          result.ok
            ? `Notification e-mail envoyée à ${u.name} (${u.email}) pour le nouveau signalement ${alert.trackingNumber}.`
            : `Échec de l'envoi de la notification e-mail à ${u.name} (${u.email}) pour le signalement ${alert.trackingNumber} : ${result.reason ?? 'raison inconnue'}.`,
          alert,
          SYSTEM_ACTOR
        );
      });
    });
}

// === AMÉLIORATION AJOUTÉE === lien direct et partageable vers un dossier
// (`/cases/:trackingNumber`, voir routing/routes.ts — le même mécanisme que
// les liens de dossier déjà partageables ailleurs dans l'app). Construit à
// partir de `window.location.origin` plutôt que d'une URL codée en dur :
// reste exact quel que soit le domaine réel de déploiement (aperçu Netlify,
// domaine personnalisé, etc.). `undefined` hors navigateur (aucun cas réel
// aujourd'hui, ce module n'étant appelé que depuis des gestionnaires
// d'événements côté client, mais reste honnête plutôt que de fabriquer une
// URL fictive).
function caseDeepLink(alert: CaseRef): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/cases/${encodeURIComponent(alert.trackingNumber)}`;
}

// === AMÉLIORATION AJOUTÉE === Attribution : notifie chaque Enquêteur
// NOUVELLEMENT attribué (jamais quelqu'un déjà attribué avant ce
// changement précis — à l'appelant de ne passer que la différence).
// `actor` est le vrai compte qui a effectué l'attribution (Opérateur),
// pour que l'entrée d'audit reflète qui a déclenché la notification. Le
// message contient désormais un lien direct et cliquable vers le dossier
// (sur demande explicite), pas seulement une mention du nom de la
// plateforme — toujours suivi du même rappel de périmètre que le message
// texte précédent.
export function notifyAssignmentToInvestigators(newlyAssigned: UserProfile[], alert: CaseRef, actor: UserProfile): void {
  const link = caseDeepLink(alert);
  newlyAssigned
    .filter((u) => !!u.email)
    .forEach((u) => {
      sendOne(
        u.email,
        `[activa-whistleblowing] Dossier attribué — ${alert.trackingNumber}`,
        `Un dossier vient de vous être attribué.\n\nRéférence : ${alert.trackingNumber}\n\n` +
          (link ? `Accédez-y directement : ${link}\n\n` : '') +
          `Vous ne pouvez consulter que les dossiers qui vous sont attribués.`
      ).then((result) => {
        storage.logAudit(
          result.ok ? 'EMAIL_NOTIFICATION_SENT' : 'EMAIL_NOTIFICATION_FAILED',
          result.ok
            ? `Notification e-mail envoyée à ${u.name} (${u.email}) pour l'attribution du dossier ${alert.trackingNumber}.`
            : `Échec de l'envoi de la notification e-mail à ${u.name} (${u.email}) pour l'attribution du dossier ${alert.trackingNumber} : ${result.reason ?? 'raison inconnue'}.`,
          alert,
          actor
        );
      });
    });
}

// === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
// routage) === Escalade (storage.escalateAlert) et routage indépendant
// non résolu (storage.triggerIndependentRouting, dernier recours) :
// contrairement aux 2 fonctions ci-dessus, le destinataire est un
// EscalationRecipient — pas forcément un UserProfile avec compte. Même
// discipline "jamais de fausse réussite" : chaque tentative journalisée
// avec son issue réelle.
export function notifyEscalationRecipient(recipient: EscalationRecipient, alert: CaseRef, actor: UserProfile, context: string): void {
  if (!recipient.email) return;
  sendOne(
    recipient.email,
    `[activa-whistleblowing] ${context} — ${alert.trackingNumber}`,
    `${context} concernant le dossier ${alert.trackingNumber}.\n\nRéférence : ${alert.trackingNumber}\n\n` +
      (recipient.linkedUserId
        ? 'Connectez-vous à activa-whistleblowing pour y accéder.'
        : "Vous n'avez pas de compte activa-whistleblowing — ce message est une notification informative ; contactez l'équipe DARC Groupe pour toute action nécessaire.")
  ).then((result) => {
    storage.logAudit(
      result.ok ? 'EMAIL_NOTIFICATION_SENT' : 'EMAIL_NOTIFICATION_FAILED',
      result.ok
        ? `Notification e-mail envoyée à ${recipient.nom} (${recipient.email}) — ${context} pour le dossier ${alert.trackingNumber}.`
        : `Échec de l'envoi de la notification e-mail à ${recipient.nom} (${recipient.email}) — ${context} pour le dossier ${alert.trackingNumber} : ${result.reason ?? 'raison inconnue'}.`,
      alert,
      actor
    );
  });
}
