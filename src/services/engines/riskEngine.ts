import { 
  RiskEvaluation, 
  RiskAssessmentRecord, 
  PriorityLevel, 
  NocaThreshold 
} from '../../types';

export class RiskEngine {
  /**
   * Calculate automatic multi-criteria risk score (CDC 55 & Annexe 2)
   */
  public static calculateAutomaticRisk(
    financial: 1 | 2 | 3 | 4,
    hierarchy: 1 | 2 | 3 | 4,
    recidivism: 1 | 2 | 3 | 4,
    reputation: 1 | 2 | 3 | 4
  ): RiskEvaluation {
    const totalScore = financial + hierarchy + recidivism + reputation;

    let nocaThreshold: NocaThreshold = 'NOCA 1';
    let priority: PriorityLevel = 'faible';
    let expectedTreatment = 'Traitement standard sous 30 jours (DARC Filiale)';

    if (totalScore >= 13) {
      nocaThreshold = 'NOCA 4';
      priority = 'critique';
      expectedTreatment = 'Alerte immédiate Comité d’Audit & DG Groupe sous 24-48h. Mesures conservatoires.';
    } else if (totalScore >= 10) {
      nocaThreshold = 'NOCA 3';
      priority = 'tres_elevee';
      expectedTreatment = 'Instruction prioritaire sous 5 jours avec supervision DARC Groupe.';
    } else if (totalScore >= 7) {
      nocaThreshold = 'NOCA 2';
      priority = 'elevee';
      expectedTreatment = 'Traitement diligent sous 15 jours par enquêteur désigné.';
    }

    return {
      financialImpact: financial,
      hierarchyLevel: hierarchy,
      recidivism,
      reputationRisk: reputation,
      totalScore,
      nocaThreshold,
      priority,
      expectedTreatment
    };
  }

  /**
   * Apply a manual override while strictly preserving original values and auditable history (CDC 55)
   */
  public static createRiskAssessmentRecord(
    caseId: string,
    evaluation: RiskEvaluation,
    userId: string,
    overridePriority?: PriorityLevel,
    overrideReason?: string
  ): RiskAssessmentRecord {
    const isOverride = Boolean(overridePriority && overridePriority !== evaluation.priority);

    return {
      assessmentId: 'RSK-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      caseId,
      financialImpactScore: evaluation.financialImpact,
      hierarchicalLevelScore: evaluation.hierarchyLevel,
      recurrenceScore: evaluation.recidivism,
      reputationRiskScore: evaluation.reputationRisk,
      totalScore: evaluation.totalScore,
      priority: overridePriority || evaluation.priority,
      assessmentType: isOverride ? 'MANUAL' : 'AUTOMATIC',
      originalScore: evaluation.totalScore,
      overrideScore: isOverride ? this.priorityToScoreEquivalent(overridePriority!) : undefined,
      overrideReason: isOverride ? overrideReason : undefined,
      assessedBy: userId,
      assessedAt: new Date().toISOString()
    };
  }

  private static priorityToScoreEquivalent(priority: PriorityLevel): number {
    switch (priority) {
      case 'critique': return 14;
      case 'tres_elevee': return 11;
      case 'elevee': return 8;
      case 'faible': return 5;
    }
  }
}
