import { CaseConflictDeclaration } from '../../types';

export class ConflictEngine {
  private static declarations: CaseConflictDeclaration[] = [];

  public static getDeclarationsForCase(caseId: string): CaseConflictDeclaration[] {
    return this.declarations.filter(d => d.caseId === caseId);
  }

  public static isInvestigatorCleared(caseId: string, userId: string): boolean {
    const dec = this.declarations.find(d => d.caseId === caseId && d.userId === userId);
    // Explicit NO_CONFLICT confirmation required before taking action (CDC 59)
    if (!dec) return false;
    return dec.conflictStatus === 'NO_CONFLICT' || dec.conflictStatus === 'RESOLVED';
  }

  public static recordDeclaration(
    caseId: string,
    userId: string,
    userName: string,
    status: 'NO_CONFLICT' | 'CONFLICT_IDENTIFIED',
    text: string
  ): CaseConflictDeclaration {
    // Remove previous declaration for this user on this case if any
    this.declarations = this.declarations.filter(d => !(d.caseId === caseId && d.userId === userId));

    const newDecl: CaseConflictDeclaration = {
      conflictId: 'CONF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      caseId,
      userId,
      userName,
      conflictStatus: status,
      declaration: text,
      declaredAt: new Date().toISOString()
    };

    this.declarations.push(newDecl);
    return newDecl;
  }

  public static resolveConflict(
    conflictId: string,
    adminName: string,
    resolutionNote: string
  ): boolean {
    const target = this.declarations.find(d => d.conflictId === conflictId);
    if (!target) return false;

    target.conflictStatus = 'RESOLVED';
    target.resolvedBy = adminName;
    target.resolution = resolutionNote;
    target.resolvedAt = new Date().toISOString();
    return true;
  }
}
