/**
 * ACTIVA Hotline — Legacy → target model migration (Phase 2)
 *
 * Converts existing `AlertRecord` documents (the model consumed by the
 * current UI, `src/types.ts`) into the normalized `Case` + child-collection
 * documents described in `docs/DATABASE.md`, using the real `CaseRepository`
 * (so every write goes through the same validation/audit path a production
 * import would). It never mutates or deletes the legacy records — this is a
 * one-way, additive copy, safe to run repeatedly against a fresh target
 * repository without touching the live app.
 *
 * KNOWN, DOCUMENTED LIMITATION: the legacy model has no per-allegation
 * `finding` field, so migrated allegations are always created with
 * `status: 'open'` (no finding), even for legacy alerts already `closed`.
 * This is intentional — inventing a finding that was never actually
 * documented would violate the "no fake data" rule. A closed legacy case
 * therefore CANNOT be re-closed through the real `workflow.checkTransition`
 * gate until a human backfills its finding; that is the correct, honest
 * behavior for a historical import, not a bug.
 */

import { AlertRecord, CorrectiveMeasure } from '../types';
import { AppUser, CasePriority, CaseStatus, ConfidentialityLevel, HierarchyLevel } from '../domain/caseTypes';
import { CaseRepository } from './caseRepository';

/** Synthetic actor used to attribute migration writes in the audit trail. */
export const MIGRATION_SYSTEM_USER: AppUser = {
  userId: 'system-migration',
  name: 'ACTIVA Hotline — Import historique',
  email: 'system@activa-hotline.internal',
  roleId: 'functional_admin',
  countries: [],
  entities: [],
  active: true,
  mfaEnabled: false,
  createdAt: new Date(0).toISOString(),
};

const STATUS_MAP: Record<AlertRecord['status'], CaseStatus> = {
  new: 'new',
  under_review: 'under_review',
  investigation: 'investigation',
  // No direct equivalent: the legacy "measures being documented" state sits
  // between investigation and closure in the target workflow.
  corrective_action: 'conclusion_pending',
  closed: 'closed',
  archived: 'archived',
  reopened: 'reopened',
};

const PRIORITY_MAP: Record<AlertRecord['riskEvaluation']['priority'], CasePriority> = {
  faible: 'low',
  elevee: 'high',
  tres_elevee: 'very_high',
  critique: 'critical',
};

const HIERARCHY_MAP: Record<string, HierarchyLevel> = {
  'Employé': 'employee',
  'Cadre': 'manager',
  'Sous-Directeur': 'senior_manager',
  'Directeur+': 'director_plus',
};

const CORRECTIVE_STATUS_MAP: Record<CorrectiveMeasure['status'], 'open' | 'in_progress' | 'completed' | 'overdue' | 'not_applicable'> = {
  planned: 'open',
  in_progress: 'in_progress',
  implemented: 'completed',
  verified: 'completed',
};

function confidentialityForPriority(priority: CasePriority): ConfidentialityLevel {
  if (priority === 'critical' || priority === 'very_high') return 'highly_confidential';
  if (priority === 'high') return 'confidential';
  return 'restricted';
}

export interface MigrationResult {
  legacyId: string;
  legacyTrackingNumber: string;
  caseId: string;
  caseNumber: string;
  warnings: string[];
}

export async function migrateLegacyAlertsToCases(
  alerts: AlertRecord[],
  repository: CaseRepository
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const alert of alerts) {
    const warnings: string[] = [];
    const priority = PRIORITY_MAP[alert.overridePriority ?? alert.riskEvaluation.priority];
    const confidentialityLevel = confidentialityForPriority(priority);
    const [primaryAssignee, ...additionalInvestigators] = alert.assignedInvestigators;

    const kase = await repository.createCase(
      {
        status: STATUS_MAP[alert.status],
        category: alert.category,
        subcategory: alert.subCategory,
        country: alert.country,
        entity: alert.concernedEntity,
        reportingMode: alert.whistleblower.isAnonymous ? 'anonymous' : 'identified',
        priority,
        riskScore: alert.riskEvaluation.totalScore,
        confidentialityLevel,
        assignee: primaryAssignee,
        additionalInvestigators,
        slaStatus: 'ok', // recomputed once the SLA engine (Phase 7) runs against this record
        receivedAt: alert.createdAt,
        incidentDateUnknown: true, // legacy `incidentDates` is free text, not a parseable ISO date
        description: alert.detailedDescription,
        impactType: alert.impactType,
        estimatedImpactValue: alert.estimatedImpactValue,
        closedAt: alert.closedAt,
        closedBy: alert.closedBy,
        legalHold: false,
      },
      MIGRATION_SYSTEM_USER.userId
    );

    if (alert.status === 'closed') {
      warnings.push(
        'Legacy case was closed without a per-allegation finding on record; the migrated allegation is left "open" — a human must document a finding before this case can be closed again through the workflow engine.'
      );
    }
    if (alert.customViolationType) {
      warnings.push(`customViolationType "${alert.customViolationType}" preserved only in the allegation description.`);
    }

    await repository.addAllegation(
      kase.caseId,
      {
        category: alert.category,
        subcategory: alert.subCategory,
        description: alert.customViolationType
          ? `${alert.detailedDescription}\n\n[Précision du déclarant] ${alert.customViolationType}`
          : alert.detailedDescription,
      },
      MIGRATION_SYSTEM_USER
    );

    for (const p of alert.involvedPersons) {
      await repository.addPerson(
        kase.caseId,
        { kind: 'subject', name: p.name, position: p.position, hierarchyLevel: HIERARCHY_MAP[p.hierarchyRole] },
        MIGRATION_SYSTEM_USER
      );
    }
    for (const w of alert.witnesses) {
      await repository.addPerson(
        kase.caseId,
        { kind: 'witness', name: w.name, position: w.position, hierarchyLevel: HIERARCHY_MAP[w.hierarchyRole] },
        MIGRATION_SYSTEM_USER
      );
    }

    for (const ev of alert.evidences) {
      await repository.addEvidence(
        kase.caseId,
        {
          fileName: ev.name,
          fileType: ev.type,
          fileSize: ev.size,
          confidentiality: 'standard',
          status: 'active',
        },
        MIGRATION_SYSTEM_USER
      );
    }
    if (alert.evidences.length > 0) {
      warnings.push(`${alert.evidences.length} evidence item(s) migrated as metadata only — no binary content exists in the legacy model to migrate.`);
    }

    for (const m of alert.correctiveMeasures) {
      await repository.addCorrectiveAction(
        kase.caseId,
        {
          description: m.title ? `${m.title} — ${m.description}` : m.description,
          owner: m.responsiblePerson,
          dueDate: m.dueDate,
          priority,
          status: CORRECTIVE_STATUS_MAP[m.status],
          completedAt: m.status === 'implemented' || m.status === 'verified' ? m.documentedAt : undefined,
        },
        MIGRATION_SYSTEM_USER
      );
    }

    await repository.recordRiskAssessment(
      kase.caseId,
      {
        financialImpact: alert.riskEvaluation.financialImpact,
        hierarchicalLevel: alert.riskEvaluation.hierarchyLevel,
        recurrence: alert.riskEvaluation.recidivism,
        reputationRisk: alert.riskEvaluation.reputationRisk,
        totalScore: alert.riskEvaluation.totalScore,
        priority: PRIORITY_MAP[alert.riskEvaluation.priority],
        isOverride: false,
      },
      MIGRATION_SYSTEM_USER
    );
    if (alert.overridePriority) {
      await repository.recordRiskAssessment(
        kase.caseId,
        {
          financialImpact: alert.riskEvaluation.financialImpact,
          hierarchicalLevel: alert.riskEvaluation.hierarchyLevel,
          recurrence: alert.riskEvaluation.recidivism,
          reputationRisk: alert.riskEvaluation.reputationRisk,
          totalScore: alert.riskEvaluation.totalScore,
          priority: PRIORITY_MAP[alert.overridePriority],
          isOverride: true,
          originalScore: alert.riskEvaluation.totalScore,
          overrideReason: alert.overrideReason,
        },
        MIGRATION_SYSTEM_USER
      );
    }

    for (const msg of alert.messages) {
      await repository.addCommunication(
        kase.caseId,
        msg.sender === 'whistleblower' ? 'reporter' : msg.sender === 'investigator' ? 'investigator' : 'system',
        msg.senderDisplayName,
        msg.content,
        MIGRATION_SYSTEM_USER.userId
      );
    }

    for (const note of alert.internalNotes) {
      await repository.addInvestigationNote(kase.caseId, note.content, MIGRATION_SYSTEM_USER);
    }

    await repository.setReporterCredentials(kase.caseId, {
      caseId: kase.caseId,
      accessCodeHash: alert.accessCodeHash,
      accessCodeSalt: alert.accessCodeSalt,
    });

    if (!alert.whistleblower.isAnonymous) {
      await repository.setReporterIdentity(kase.caseId, {
        caseId: kase.caseId,
        isAnonymous: false,
        fullName: alert.whistleblower.fullName,
        jobTitle: alert.whistleblower.jobTitle,
        department: alert.whistleblower.department,
        email: alert.whistleblower.email,
        phone: alert.whistleblower.phone,
      });
    }

    results.push({
      legacyId: alert.id,
      legacyTrackingNumber: alert.trackingNumber,
      caseId: kase.caseId,
      caseNumber: kase.caseNumber,
      warnings,
    });
  }

  return results;
}
