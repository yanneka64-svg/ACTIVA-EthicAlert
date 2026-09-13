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
import { AlertRecord, AppNotification, AuditLogEntry, EnterpriseWorkflowStatus, SlaStatus } from '../types';

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

function isVisibleToUser(alert: AlertRecord, userId: string, isGlobalViewer: boolean): boolean {
  return isGlobalViewer || alert.assignedInvestigators.includes(userId);
}

/**
 * Derives a real, current notification list from existing data — never a
 * hand-authored or separately-persisted list. Read/dismissed state is
 * intentionally left to the calling component (e.g. a per-session
 * dismissed-id set) rather than stored here, since there is no
 * `AppNotification` collection in `storage.ts`; this function is the
 * single source new callers should use so notification logic isn't
 * duplicated per screen.
 */
export function generateNotifications(
  alerts: AlertRecord[],
  auditLogs: AuditLogEntry[],
  userId: string,
  isGlobalViewer: boolean
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const visible = alerts.filter((a) => isVisibleToUser(a, userId, isGlobalViewer));

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
