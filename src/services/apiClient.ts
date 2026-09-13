/**
 * ACTIVA EthicAlert - Enterprise Backend API Client
 * Connects frontend portals directly to server-side business engines.
 */

export interface ApiCreateCasePayload {
  trackingNumber: string;
  accessCodeHash: string;
  concernedEntity: string;
  country: string;
  category: string;
  subCategory?: string;
  detailedDescription: string;
  riskScores: {
    financialImpact: number;
    hierarchyLevel: number;
    recidivism: number;
    reputationRisk: number;
  };
  whistleblower: any;
  channel?: string;
}

export class ApiClient {
  public static async checkHealth(): Promise<any> {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch {
      return { status: 'offline-fallback' };
    }
  }

  public static async getArchitecture(): Promise<any> {
    try {
      const res = await fetch('/api/architecture');
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async createCase(payload: ApiCreateCasePayload): Promise<any> {
    try {
      const res = await fetch('/api/cases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.warn("API createCase fallback:", e);
      return { success: true, offline: true };
    }
  }

  public static async calculateRisk(scores: {
    financial: number;
    hierarchy: number;
    recidivism: number;
    reputation: number;
  }): Promise<any> {
    try {
      const res = await fetch('/api/cases/risk/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scores)
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async assignCase(caseId: string, investigatorIds: string[], investigatorNames: string[], assignedBy: any): Promise<any> {
    try {
      const res = await fetch('/api/cases/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, investigatorIds, investigatorNames, assignedBy })
      });
      return await res.json();
    } catch {
      return { success: true, offline: true };
    }
  }

  public static async checkConflict(caseId: string, userId: string, userName: string, status: 'NO_CONFLICT' | 'CONFLICT_IDENTIFIED', declaration: string): Promise<any> {
    try {
      const res = await fetch('/api/cases/conflict/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, userId, userName, status, declaration })
      });
      return await res.json();
    } catch {
      return { success: true, offline: true };
    }
  }

  public static async changeStatus(caseId: string, currentStatus: string, targetStatus: string, user: any, reason?: string): Promise<any> {
    try {
      const res = await fetch('/api/cases/status/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, currentStatus, targetStatus, user, reason })
      });
      return await res.json();
    } catch {
      return { success: true, offline: true };
    }
  }

  public static async logAudit(entry: any): Promise<any> {
    try {
      const res = await fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      return await res.json();
    } catch {
      return { success: true, offline: true };
    }
  }

  public static async getAggregatedReport(): Promise<any> {
    try {
      const res = await fetch('/api/reports/aggregated');
      return await res.json();
    } catch {
      return null;
    }
  }
}
