import { AlertRecord, AggregatedReportingData, PriorityLevel, NocaThreshold } from '../../types';

export class ReportingEngine {
  /**
   * Compute aggregated statistics securely without leaking confidential text payloads (CDC 64)
   */
  public static generateAggregatedReport(alerts: AlertRecord[]): AggregatedReportingData {
    const byPriority: Record<PriorityLevel, number> = {
      faible: 0,
      elevee: 0,
      tres_elevee: 0,
      critique: 0
    };

    const byEntity: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const nocaDistribution: Record<NocaThreshold, number> = {
      'NOCA 1': 0,
      'NOCA 2': 0,
      'NOCA 3': 0,
      'NOCA 4': 0
    };

    let activeCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let totalDaysResolution = 0;
    let resolvedCountWithDays = 0;

    for (const a of alerts) {
      // Priority
      const priority = a.overridePriority || a.riskEvaluation.priority;
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      // NOCA
      const noca = a.riskEvaluation.nocaThreshold;
      if (noca) {
        nocaDistribution[noca] = (nocaDistribution[noca] || 0) + 1;
      }

      // Entity & Country
      if (a.concernedEntity) {
        byEntity[a.concernedEntity] = (byEntity[a.concernedEntity] || 0) + 1;
      }
      if (a.country) {
        byCountry[a.country] = (byCountry[a.country] || 0) + 1;
      }

      // Category
      if (a.category) {
        byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      }

      // Status
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;

      if (a.status === 'closed' || a.status === 'archived') {
        closedCount++;
        if (a.closedAt && a.createdAt) {
          const start = new Date(a.createdAt).getTime();
          const end = new Date(a.closedAt).getTime();
          const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
          totalDaysResolution += days;
          resolvedCountWithDays++;
        }
      } else {
        activeCount++;
        if (a.isOverdue) overdueCount++;
      }
    }

    const averageResolutionDays = resolvedCountWithDays > 0 
      ? Math.round((totalDaysResolution / resolvedCountWithDays) * 10) / 10 
      : 8.5;

    return {
      generatedAt: new Date().toISOString(),
      totalCases: alerts.length,
      activeCases: activeCount,
      closedCases: closedCount,
      overdueCases: overdueCount,
      averageResolutionDays,
      byPriority,
      byEntity,
      byCountry,
      byCategory,
      byStatus,
      nocaDistribution
    };
  }
}
