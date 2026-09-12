import { NotificationItem } from '../../types';

export class NotificationEngine {
  private static notifications: NotificationItem[] = [
    {
      id: 'NOTIF-INIT-1',
      recipientId: 'user_admin_darc',
      caseId: 'case_1',
      caseTrackingNumber: 'ACT-2026-0842',
      type: 'CASE_ASSIGNED',
      title: "Nouveau signalement NOCA 3 assigné",
      message: "Dossier ACT-2026-0842 (Fraude présumée règlement sinistres ACTIVA Cameroun). Échéance SLA dans 4 jours.",
      read: false,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ];

  public static getNotificationsForUser(userId: string): NotificationItem[] {
    return this.notifications.filter(n => n.recipientId === userId || n.recipientId === 'ALL_ADMINS');
  }

  public static markAsRead(notificationId: string): void {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) notif.read = true;
  }

  public static markAllAsRead(userId: string): void {
    this.notifications.forEach(n => {
      if (n.recipientId === userId || n.recipientId === 'ALL_ADMINS') {
        n.read = true;
      }
    });
  }

  public static emitNotification(
    recipientId: string,
    caseId: string,
    type: NotificationItem['type'],
    title: string,
    message: string,
    caseTrackingNumber?: string
  ): NotificationItem {
    const item: NotificationItem = {
      id: 'NOTIF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      recipientId,
      caseId,
      caseTrackingNumber,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString()
    };

    this.notifications.unshift(item);
    return item;
  }
}
