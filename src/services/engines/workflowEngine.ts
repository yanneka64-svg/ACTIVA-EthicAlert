import { 
  EnterpriseWorkflowStatus, 
  AlertStatus, 
  UserRole, 
  AlertRecord 
} from '../../types';

export interface TransitionRule {
  from: EnterpriseWorkflowStatus;
  to: EnterpriseWorkflowStatus;
  allowedRoles: UserRole[];
  requiredFields?: (keyof AlertRecord)[];
  description: string;
}

// Enterprise State Machine definition (CDC 56 & 57)
export const WORKFLOW_TRANSITIONS: TransitionRule[] = [
  {
    from: 'NEW',
    to: 'TRIAGE',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Prise en charge initiale et qualification DARC"
  },
  {
    from: 'TRIAGE',
    to: 'UNDER_REVIEW',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Analyse préliminaire et évaluation des risques NOCA"
  },
  {
    from: 'UNDER_REVIEW',
    to: 'ASSIGNED',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Désignation des enquêteurs et vérification des conflits d'intérêts"
  },
  {
    from: 'ASSIGNED',
    to: 'INVESTIGATION',
    allowedRoles: ['investigator', 'functional_admin'],
    description: "Ouverture des investigations de terrain après attestation d'absence de conflit"
  },
  {
    from: 'INVESTIGATION',
    to: 'PENDING_INFORMATION',
    allowedRoles: ['investigator', 'functional_admin'],
    description: "Demande de compléments d'informations au lanceur d'alerte"
  },
  {
    from: 'PENDING_INFORMATION',
    to: 'INVESTIGATION',
    allowedRoles: ['investigator', 'functional_admin', 'whistleblower'],
    description: "Reprise suite à la réception des pièces complémentaires"
  },
  {
    from: 'INVESTIGATION',
    to: 'ESCALATED',
    allowedRoles: ['investigator', 'functional_admin'],
    description: "Escalade hiérarchique au Comité d'Audit / Direction Générale"
  },
  {
    from: 'ESCALATED',
    to: 'INVESTIGATION',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Retour d'escalade avec orientations du Comité"
  },
  {
    from: 'INVESTIGATION',
    to: 'CONCLUSION_PENDING',
    allowedRoles: ['investigator', 'functional_admin'],
    description: "Finalisation du rapport d'enquête et synthèse des allégations"
  },
  {
    from: 'CONCLUSION_PENDING',
    to: 'FUNCTIONAL_REVIEW',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Revue de conformité et validation des mesures correctives par la DARC"
  },
  {
    from: 'FUNCTIONAL_REVIEW',
    to: 'CLOSED',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Clôture formelle et verrouillage du dossier"
  },
  {
    from: 'CLOSED',
    to: 'REOPENED',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Réouverture exceptionnelle sur éléments nouveaux probants"
  },
  {
    from: 'REOPENED',
    to: 'INVESTIGATION',
    allowedRoles: ['functional_admin', 'system_admin'],
    description: "Reprise des investigations suite à réouverture"
  },
  {
    from: 'CLOSED',
    to: 'ARCHIVED',
    allowedRoles: ['system_admin'],
    description: "Archivage sécurisé après expiration ou rétention légale"
  }
];

export class WorkflowEngine {
  /**
   * Convert legacy status to EnterpriseWorkflowStatus
   */
  public static mapToEnterpriseStatus(status: AlertStatus): EnterpriseWorkflowStatus {
    switch (status) {
      case 'new': return 'NEW';
      case 'under_review': return 'UNDER_REVIEW';
      case 'investigation': return 'INVESTIGATION';
      case 'corrective_action': return 'FUNCTIONAL_REVIEW';
      case 'closed': return 'CLOSED';
      case 'archived': return 'ARCHIVED';
      case 'reopened': return 'REOPENED';
      default: return 'NEW';
    }
  }

  /**
   * Convert EnterpriseWorkflowStatus back to AlertStatus
   */
  public static mapToAlertStatus(status: EnterpriseWorkflowStatus): AlertStatus {
    switch (status) {
      case 'NEW':
      case 'TRIAGE': return 'new';
      case 'UNDER_REVIEW':
      case 'ASSIGNED': return 'under_review';
      case 'INVESTIGATION':
      case 'PENDING_INFORMATION':
      case 'ESCALATED':
      case 'CONCLUSION_PENDING': return 'investigation';
      case 'FUNCTIONAL_REVIEW': return 'corrective_action';
      case 'CLOSED': return 'closed';
      case 'ARCHIVED': return 'archived';
      case 'REOPENED': return 'reopened';
      default: return 'new';
    }
  }

  /**
   * Validate if a state transition is authorized (CDC 57)
   */
  public static validateTransition(
    caseData: AlertRecord,
    targetStatus: EnterpriseWorkflowStatus,
    userRole: UserRole,
    reason?: string
  ): { valid: boolean; error?: string } {
    const currentStatus = caseData.enterpriseStatus || this.mapToEnterpriseStatus(caseData.status);

    if (currentStatus === targetStatus) {
      return { valid: true };
    }

    // Direct jump prevention: A case cannot jump from NEW directly to CLOSED
    if ((currentStatus === 'NEW' || currentStatus === 'TRIAGE') && (targetStatus === 'CLOSED' || targetStatus === 'ARCHIVED')) {
      return { 
        valid: false, 
        error: `Transition interdite : Un dossier en état [${currentStatus}] ne peut pas être clôturé directement sans instruction préalable.` 
      };
    }

    // Closure requirements: must have documented summary and review
    if (targetStatus === 'CLOSED') {
      if (!caseData.closureSummary && !reason) {
        return { 
          valid: false, 
          error: "Clôture impossible : Un motif ou une synthèse formelle de clôture est obligatoire (CDC 56 & 74)." 
        };
      }
    }

    // Reopening requirements: must have explicit reason
    if (targetStatus === 'REOPENED' && (!reason || reason.trim().length < 10)) {
      return { 
        valid: false, 
        error: "Réouverture refusée : Un motif circonstancié d'au moins 10 caractères est requis pour toute réouverture (CDC 57)." 
      };
    }

    // Archiving check: must be CLOSED first
    if (targetStatus === 'ARCHIVED' && currentStatus !== 'CLOSED') {
      return { 
        valid: false, 
        error: "Archivage impossible : Seul un dossier préalablement clôturé peut être archivé (CDC 73)." 
      };
    }

    // Legal hold check: cannot archive if under legal hold
    if (targetStatus === 'ARCHIVED' && caseData.legalHold) {
      return {
        valid: false,
        error: "Opération bloquée : Ce dossier est sous mise sous séquestre légale (Legal Hold) et ne peut être archivé ou supprimé."
      };
    }

    // Find rule in state machine
    const rule = WORKFLOW_TRANSITIONS.find(
      t => t.from === currentStatus && t.to === targetStatus
    );

    if (!rule) {
      // Fallback for flexible operational adjustments if user is functional_admin
      if (userRole === 'functional_admin' || userRole === 'system_admin') {
        return { valid: true };
      }
      return { 
        valid: false, 
        error: `Transition non autorisée de [${currentStatus}] vers [${targetStatus}] selon la matrice du workflow ACTIVA.` 
      };
    }

    if (!rule.allowedRoles.includes(userRole)) {
      return { 
        valid: false, 
        error: `Droits insuffisants : Le rôle [${userRole}] n'a pas l'habilitation pour valider le passage à [${targetStatus}].` 
      };
    }

    return { valid: true };
  }
}
