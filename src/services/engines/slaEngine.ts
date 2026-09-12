import { PriorityLevel, AlertRecord, SlaRule } from '../../types';

export const DEFAULT_SLA_RULES: Record<PriorityLevel, SlaRule> = {
  critique: {
    ruleId: 'SLA-CRITIQUE',
    priority: 'critique',
    targetHours: 48, // 2 days
    escalationLevel: 1, // Direct Executive / Audit Committee
    reminderScheduleHours: [12, 24, 36]
  },
  tres_elevee: {
    ruleId: 'SLA-TRES-ELEVEE',
    priority: 'tres_elevee',
    targetHours: 120, // 5 days
    escalationLevel: 2,
    reminderScheduleHours: [48, 96]
  },
  elevee: {
    ruleId: 'SLA-ELEVEE',
    priority: 'elevee',
    targetHours: 360, // 15 days
    escalationLevel: 3,
    reminderScheduleHours: [120, 240]
  },
  faible: {
    ruleId: 'SLA-FAIBLE',
    priority: 'faible',
    targetHours: 720, // 30 days
    escalationLevel: 4,
    reminderScheduleHours: [360, 600]
  }
};

export class SlaEngine {
  /**
   * Calculate SLA timeline boundaries for a case (CDC 60)
   */
  public static calculateSla(
    receivedAt: string,
    priority: PriorityLevel,
    customTargetHours?: number
  ): {
    slaStartAt: string;
    slaDueAt: string;
    daysRemaining: number;
    hoursRemaining: number;
    isOverdue: boolean;
    rule: SlaRule;
  } {
    const rule = DEFAULT_SLA_RULES[priority] || DEFAULT_SLA_RULES.faible;
    const hours = customTargetHours || rule.targetHours;

    const startDate = new Date(receivedAt || new Date().toISOString());
    const dueDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
    const now = new Date();

    const diffMs = dueDate.getTime() - now.getTime();
    const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));
    const daysRemaining = Math.max(0, Math.ceil(hoursRemaining / 24));
    const isOverdue = diffMs < 0;

    return {
      slaStartAt: startDate.toISOString(),
      slaDueAt: dueDate.toISOString(),
      daysRemaining,
      hoursRemaining,
      isOverdue,
      rule
    };
  }

  /**
   * Process and check if an alert needs escalation (CDC 60 & 61)
   */
  public static checkEscalationNeed(alert: AlertRecord): {
    needsEscalation: boolean;
    reason?: string;
  } {
    if (alert.status === 'closed' || alert.status === 'archived') {
      return { needsEscalation: false };
    }

    const priority = alert.overridePriority || alert.riskEvaluation.priority;
    const sla = this.calculateSla(alert.createdAt, priority);

    if (sla.isOverdue) {
      return {
        needsEscalation: true,
        reason: `Délai SLA de traitement (${sla.rule.targetHours}h) dépassé de ${Math.abs(sla.hoursRemaining)}h pour priorité [${priority.toUpperCase()}].`
      };
    }

    return { needsEscalation: false };
  }
}
