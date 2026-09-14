/**
 * === AMÉLIORATION AJOUTÉE (Phase 1 — frontend completion, data model extension) ===
 *
 * Pure, storage-agnostic helpers that derive the richer enterprise-grade
 * view (12-status lifecycle, SLA state, notifications) FROM the existing,
 * authoritative `AlertRecord` fields — nothing here is a new source of
 * truth, nothing here is stored. `AlertRecord.status` stays exactly what
 * every existing screen already reads; these functions only compute a
 * presentation-layer view on top of it, the same way
 * `computeRiskEvaluation()` in `data/activaConfig.ts` already computes a
 * derived value from raw inputs.
 */
import { AlertRecord, AlertStatus, AppNotification, AuditLogEntry, EnterpriseWorkflowStatus, SlaStatus, UserProfile } from '../types';
import { CaseStatus } from '../domain/caseTypes';
// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
import { isGlobalCaseViewer, isImplicated } from './authz';

/** Legacy AlertStatus -> the richer enterprise lifecycle the Control Panel/workspace UI uses. */
export function mapToEnterpriseStatus(alert: AlertRecord): EnterpriseWorkflowStatus {
  switch (alert.status) {
    case 'new':
      return alert.assignedInvestigators.length > 0 ? 'ASSIGNED' : 'NEW';
    case 'under_review':
      return 'TRIAGE';
    case 'investigation':
      return 'INVESTIGATION';
    case 'corrective_action':
      return 'CONCLUSION_PENDING';
    case 'closed':
      return 'CLOSED';
    case 'reopened':
      return 'REOPENED';
    case 'archived':
      return 'ARCHIVED';
    default:
      return 'NEW';
  }
}

// === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
/**
 * Statut CaseStatus (14 valeurs, domain/workflow.ts) de départ pour un
 * dossier qui n'a encore jamais transité par le nouveau chemin
 * (`AlertRecord.workflowStatus` absent) — sert de `from` à
 * `checkTransition()` dans `storage.transitionStatus()`. Réutilise très
 * exactement `mapToEnterpriseStatus()` ci-dessus : les valeurs
 * d'`EnterpriseWorkflowStatus` (NEW/TRIAGE/ASSIGNED/INVESTIGATION/
 * CONCLUSION_PENDING/CLOSED/REOPENED/ARCHIVED) sont, par construction, un
 * sous-ensemble en majuscules des valeurs de `CaseStatus` — aucune
 * nouvelle table de correspondance à maintenir séparément.
 */
export function deriveCaseStatus(alert: AlertRecord): CaseStatus {
  return mapToEnterpriseStatus(alert).toLowerCase() as CaseStatus;
}

/**
 * Direction inverse : une fois un dossier passé par
 * `storage.transitionStatus()`, quel `AlertStatus` (7 valeurs) legacy lui
 * attribuer pour que tout écran existant qui lit encore `alert.status`
 * (badges, filtres, KPIs) continue de se comporter correctement ? `CaseStatus`
 * distingue plus d'étapes que `AlertStatus` n'en connaît (ex :
 * pending_information/escalated/functional_review n'ont pas d'équivalent
 * direct) — ces valeurs sont ramenées au bucket legacy actif le plus
 * proche (`investigation` ou `corrective_action`) plutôt que de casser une
 * égalité stricte inexistante.
 */
export function syncLegacyStatus(status: CaseStatus): AlertStatus {
  switch (status) {
    case 'new':
    case 'assigned':
      return 'new';
    case 'triage':
    case 'under_review':
      return 'under_review';
    case 'investigation':
    case 'pending_information':
    case 'escalated':
      return 'investigation';
    case 'conclusion_pending':
    case 'functional_review':
      return 'corrective_action';
    case 'closed':
    case 'duplicate':
    case 'out_of_scope':
      return 'closed';
    case 'reopened':
      return 'reopened';
    case 'archived':
      return 'archived';
    default:
      return 'new';
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AT_RISK_WINDOW_MS = 2 * ONE_DAY_MS;

/**
 * Computed from the existing `targetCompletionDate` (already set by
 * `AlertSubmissionFlow`/`InvestigationDesk`'s priority-change flow) — no
 * new input required. Closed/archived cases are never "overdue": the SLA
 * clock stops mattering once a case is done, matching how a real SLA
 * policy works.
 */
export function computeSlaStatus(alert: AlertRecord): SlaStatus {
  if (alert.status === 'closed' || alert.status === 'archived') return 'on_track';
  if (!alert.targetCompletionDate) return 'on_track';
  const remainingMs = new Date(alert.targetCompletionDate).getTime() - Date.now();
  if (remainingMs < 0) return 'overdue';
  if (remainingMs < AT_RISK_WINDOW_MS) return 'at_risk';
  return 'on_track';
}

// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
// La personne mise en cause d'un dossier (§49) ne doit jamais recevoir de
// notification qui révélerait ne serait-ce que l'existence du dossier —
// vérifiée EN PREMIER, avant la règle de visibilité normale, exactement
// comme dans useVisibleAlerts.computeVisibleAlerts (Phase 4).
function isVisibleToUser(alert: AlertRecord, activeUser: UserProfile, isGlobalViewer: boolean): boolean {
  if (isImplicated(activeUser, alert)) return false;
  return isGlobalViewer || alert.assignedInvestigators.includes(activeUser.id);
}

/**
 * Derives a real, current notification list from existing data — never a
 * hand-authored or separately-persisted list. Read/dismissed state is
 * intentionally left to the calling component (e.g. a per-session
 * dismissed-id set) rather than stored here, since there is no
 * `AppNotification` collection in `storage.ts`; this function is the
 * single source new callers should use so notification logic isn't
 * duplicated per screen.
 *
 * === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
 * Signature simplifiée : prend désormais `activeUser: UserProfile` au lieu
 * de `userId`/`isGlobalViewer` séparés — l'unique appelant (Navbar.tsx)
 * calculait déjà `isGlobalViewer` via `isGlobalCaseViewer(activeUser)`
 * juste avant d'appeler cette fonction ; la calculer ICI, une seule fois,
 * évite de la dupliquer côté appelant ET permet d'appliquer la nouvelle
 * exclusion `isImplicated` sans élargir la signature davantage.
 */
export function generateNotifications(
  alerts: AlertRecord[],
  auditLogs: AuditLogEntry[],
  activeUser: UserProfile
): AppNotification[] {
  const isGlobalViewer = isGlobalCaseViewer(activeUser);
  const notifications: AppNotification[] = [];
  const visible = alerts.filter((a) => isVisibleToUser(a, activeUser, isGlobalViewer));

  for (const alert of visible) {
    const sla = computeSlaStatus(alert);
    if (sla === 'overdue') {
      notifications.push({
        id: `sla-overdue-${alert.id}`,
        type: 'sla_overdue',
        alertId: alert.id,
        trackingNumber: alert.trackingNumber,
        message: `Dossier ${alert.trackingNumber} en dépassement de délai SLA.`,
        createdAt: alert.targetCompletionDate || alert.updatedAt,
        read: false,
      });
    } else if (sla === 'at_risk') {
      notifications.push({
        id: `sla-at-risk-${alert.id}`,
        type: 'sla_at_risk',
        alertId: alert.id,
        trackingNumber: alert.trackingNumber,
        message: `Dossier ${alert.trackingNumber} approche de l'échéance SLA.`,
        createdAt: alert.updatedAt,
        read: false,
      });
    }

    for (const task of alert.tasks ?? []) {
      if (task.status !== 'completed' && new Date(task.dueDate).getTime() < Date.now()) {
        notifications.push({
          id: `task-overdue-${task.id}`,
          type: 'task_overdue',
          alertId: alert.id,
          trackingNumber: alert.trackingNumber,
          message: `Tâche en retard sur ${alert.trackingNumber} : ${task.title}`,
          createdAt: task.dueDate,
          read: false,
        });
      }
    }

    if (alert.status === 'reopened' && alert.reopenedAt) {
      notifications.push({
        id: `reopened-${alert.id}-${alert.reopenedAt}`,
        type: 'case_reopened',
        alertId: alert.id,
        trackingNumber: alert.trackingNumber,
        message: `Dossier ${alert.trackingNumber} rouvert.`,
        createdAt: alert.reopenedAt,
        read: false,
      });
    }

    const lastMessage = alert.messages[alert.messages.length - 1];
    if (lastMessage && lastMessage.sender === 'whistleblower') {
      notifications.push({
        id: `msg-${lastMessage.id}`,
        type: 'new_message',
        alertId: alert.id,
        trackingNumber: alert.trackingNumber,
        message: `Nouveau message du lanceur d'alerte sur ${alert.trackingNumber}.`,
        createdAt: lastMessage.createdAt,
        read: false,
      });
    }
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
