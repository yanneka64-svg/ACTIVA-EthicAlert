import { 
  UserProfile, 
  GranularPermission, 
  AlertRecord 
} from '../../types';
import { ConflictEngine } from './conflictEngine';

export const ROLE_PERMISSIONS: Record<string, GranularPermission[]> = {
  system_admin: [
    'cases.read',
    'cases.export',
    'reports.read',
    'reports.export',
    'configuration.manage',
    'users.manage',
    'audit.read'
  ],
  functional_admin: [
    'cases.read',
    'cases.create',
    'cases.assign',
    'cases.reassign',
    'cases.edit',
    'cases.close',
    'cases.reopen',
    'cases.export',
    'evidence.read',
    'evidence.upload',
    'evidence.delete',
    'communications.read',
    'communications.send',
    'reports.read',
    'reports.export',
    'audit.read'
  ],
  investigator: [
    'cases.read',
    'cases.edit',
    'evidence.read',
    'evidence.upload',
    'communications.read',
    'communications.send'
  ],
  auditor: [
    'cases.read',
    'reports.read',
    'reports.export',
    'audit.read',
    'evidence.read'
  ],
  whistleblower: [
    'cases.create',
    'evidence.upload',
    'communications.read',
    'communications.send'
  ]
};

export class SecurityEngine {
  /**
   * Check granular permission (Level 2)
   */
  public static hasPermission(user: UserProfile, permission: GranularPermission): boolean {
    const perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.includes(permission);
  }

  /**
   * 5-Level Authorization Evaluation (CDC 45 & 74)
   */
  public static evaluateCaseAccess(
    user: UserProfile,
    caseData: AlertRecord
  ): {
    canAccess: boolean;
    canViewReporterIdentity: boolean;
    canViewEvidence: boolean;
    canEdit: boolean;
    reason?: string;
  } {
    // Level 1: Authentication
    if (!user || !user.id) {
      return {
        canAccess: false,
        canViewReporterIdentity: false,
        canViewEvidence: false,
        canEdit: false,
        reason: "Utilisateur non authentifié (Niveau 1 échec)"
      };
    }

    // System Admins manage config/users, DARC functional admins manage all cases
    if (user.role === 'functional_admin' || user.role === 'auditor') {
      return {
        canAccess: true,
        canViewReporterIdentity: user.role === 'functional_admin',
        canViewEvidence: true,
        canEdit: user.role === 'functional_admin'
      };
    }

    if (user.role === 'system_admin') {
      // System administrator should NOT automatically receive unrestricted access to confidential evidence or reporter identities (CDC 67)
      return {
        canAccess: true,
        canViewReporterIdentity: false,
        canViewEvidence: false,
        canEdit: false,
        reason: "Profil Administrateur Système : accès d'audit et configuration uniquement, pièces confidentielles restreintes."
      };
    }

    // Investigators: Level 3 (Entity/Country scope) & Level 4 (Assignment & Conflict)
    if (user.role === 'investigator') {
      const isAssigned = (caseData.assignedInvestigators || []).includes(user.id) ||
        caseData.currentAssigneeId === user.id ||
        caseData.primaryInvestigatorId === user.id;

      const hasEntityScope = !user.entity || user.entity === caseData.concernedEntity || user.country === caseData.country;

      if (!isAssigned && !hasEntityScope) {
        return {
          canAccess: false,
          canViewReporterIdentity: false,
          canViewEvidence: false,
          canEdit: false,
          reason: "Dossier hors de votre périmètre géographique ou entité (Niveau 3 échec)"
        };
      }

      // Check conflict of interest (CDC 59)
      const conflicts = ConflictEngine.getDeclarationsForCase(caseData.id);
      const userConflict = conflicts.find(c => c.userId === user.id);
      if (userConflict && userConflict.conflictStatus === 'CONFLICT_IDENTIFIED') {
        return {
          canAccess: false,
          canViewReporterIdentity: false,
          canViewEvidence: false,
          canEdit: false,
          reason: "Accès suspendu : Conflit d'intérêts déclaré sur ce dossier (CDC 59)"
        };
      }

      return {
        canAccess: true,
        canViewReporterIdentity: !caseData.whistleblower.isAnonymous,
        canViewEvidence: true,
        canEdit: isAssigned
      };
    }

    // Whistleblower: only tracking own case
    return {
      canAccess: false,
      canViewReporterIdentity: false,
      canViewEvidence: false,
      canEdit: false,
      reason: "Accès réservé aux agents de conformité habilités"
    };
  }
}
