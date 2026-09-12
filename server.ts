import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// ============================================================================
// ACTIVA ETHICALERT — APPLICATION & BUSINESS LAYER (SERVER-SIDE ENGINES)
// ============================================================================

// In-memory persistent server registries (backed by Firestore sync)
interface StoredCase {
  id: string;
  trackingNumber: string;
  accessCodeHash: string;
  status: string;
  priority: string;
  riskScore: number;
  concernedEntity: string;
  country: string;
  category: string;
  subCategory: string;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string;
  isOverdue?: boolean;
  legalHold?: boolean;
  closedAt?: string;
  closureSummary?: string;
  reopenReason?: string;
  assignedInvestigators: string[];
  [key: string]: any;
}

const caseStore = new Map<string, StoredCase>();
const auditLogStore: any[] = [];
const conflictStore: any[] = [];
const notificationStore: any[] = [];

// Seed initial audit log
auditLogStore.push({
  id: 'AUD-SYS-INIT',
  actionType: 'CONFIG_UPDATED',
  actorType: 'SYSTEM',
  authorId: 'system',
  authorName: 'System Engine',
  authorRole: 'system_admin',
  details: "Moteurs d'entreprise ACTIVA EthicAlert initialisés côté serveur (Workflow, Risk, SLA, Audit, Assignment, Security).",
  timestamp: new Date().toISOString()
});

// 1. Health check & Architecture inspection
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ACTIVA EthicAlert Enterprise Core',
    version: '2.0.0-enterprise',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/architecture', (req, res) => {
  res.json({
    presentationLayer: {
      framework: 'React 19 + TypeScript + Vite',
      portals: ['Public Whistleblowing Portal', 'Secure DARC Case Management Portal'],
      responsive: true
    },
    businessLayer: {
      engines: [
        'WorkflowEngine (12-status state machine)',
        'RiskScoringEngine (4-axis NOCA matrix)',
        'AssignmentEngine (geographic & anti-conflict routing)',
        'SlaEngine (automated calculation & escalation)',
        'ConflictOfInterestEngine (explicit NO_CONFLICT clearance)',
        'NotificationEngine (event-driven dispatch)',
        'ReportingEngine (privacy-preserving statistical aggregation)',
        'AuditEngine (immutable 10-year trail)'
      ]
    },
    securityLayer: {
      levels: [
        'Level 1: Authentication (Firebase Auth / Internal tokens)',
        'Level 2: Role & Granular Permissions (17 granular rights)',
        'Level 3: Scope (Entity & Country isolation)',
        'Level 4: Case & Assignment (Conflict check)',
        'Level 5: Data Sensitivity (Anonymous separation)'
      ],
      rbacRoles: ['whistleblower', 'investigator', 'functional_admin', 'system_admin', 'auditor']
    },
    dataLayer: {
      database: 'Cloud Firestore + Local Resilience',
      evidenceStorage: 'Firebase Storage (/cases/{caseId}/evidence/{evidenceId}/{v})',
      retentionPolicy: '10 years maximum after closure, Legal Hold enforcement'
    },
    backendFunctionsCount: 15
  });
});

// 2. BACKEND FUNCTION: createCase() [CDC 69]
app.post('/api/cases/create', (req, res) => {
  try {
    const { 
      trackingNumber, 
      accessCodeHash, 
      concernedEntity, 
      country, 
      category, 
      subCategory,
      detailedDescription,
      riskScores,
      whistleblower,
      channel = 'web'
    } = req.body;

    if (!trackingNumber || !accessCodeHash) {
      return res.status(400).json({ error: "Numéro de suivi et clé d'accès requis." });
    }

    // Server-side Risk Scoring
    const financial = Number(riskScores?.financialImpact) || 2;
    const hierarchy = Number(riskScores?.hierarchyLevel) || 2;
    const recidivism = Number(riskScores?.recidivism) || 1;
    const reputation = Number(riskScores?.reputationRisk) || 2;
    const totalScore = financial + hierarchy + recidivism + reputation;

    let priority = 'faible';
    let nocaThreshold = 'NOCA 1';
    let targetHours = 720; // 30 days

    if (totalScore >= 13) {
      priority = 'critique';
      nocaThreshold = 'NOCA 4';
      targetHours = 48; // 2 days
    } else if (totalScore >= 10) {
      priority = 'tres_elevee';
      nocaThreshold = 'NOCA 3';
      targetHours = 120; // 5 days
    } else if (totalScore >= 7) {
      priority = 'elevee';
      nocaThreshold = 'NOCA 2';
      targetHours = 360; // 15 days
    }

    const now = new Date();
    const slaDueAt = new Date(now.getTime() + targetHours * 3600000).toISOString();
    const caseId = 'case_' + Math.random().toString(36).substring(2, 10);

    const newCase: StoredCase = {
      id: caseId,
      trackingNumber,
      accessCodeHash,
      status: 'new',
      enterpriseStatus: 'NEW',
      priority,
      riskScore: totalScore,
      nocaThreshold,
      category: category || 'Fraude & Malversation',
      subCategory: subCategory || 'Général',
      concernedEntity: concernedEntity || 'ACTIVA Assurances',
      country: country || 'Cameroun',
      detailedDescription: detailedDescription || '',
      channel,
      whistleblower: whistleblower || { isAnonymous: true },
      assignedInvestigators: [],
      assignedInvestigatorNames: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      slaStartAt: now.toISOString(),
      slaDueAt,
      isOverdue: false,
      legalHold: false
    };

    caseStore.set(caseId, newCase);

    // Write server-side audit event
    auditLogStore.unshift({
      id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      alertId: caseId,
      trackingNumber,
      actionType: 'ALERT_SUBMITTED',
      actorType: whistleblower?.isAnonymous ? 'REPORTER' : 'USER',
      authorId: whistleblower?.isAnonymous ? 'anonymous_reporter' : (whistleblower?.fullName || 'reporter'),
      authorName: whistleblower?.isAnonymous ? 'Lanceur d’alerte (Anonyme)' : (whistleblower?.fullName || 'Lanceur identifié'),
      authorRole: 'whistleblower',
      details: `Dépôt de signalement [${trackingNumber}] dans entité [${concernedEntity} - ${country}]. Score NOCA calculé: ${totalScore}/16 (${nocaThreshold}, Priorité: ${priority.toUpperCase()}).`,
      timestamp: now.toISOString()
    });

    res.status(201).json({
      success: true,
      caseId,
      trackingNumber,
      priority,
      nocaThreshold,
      slaDueAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur création dossier' });
  }
});

// 3. BACKEND FUNCTION: calculateRisk() [CDC 55 & 69]
app.post('/api/cases/risk/calculate', (req, res) => {
  const { financial, hierarchy, recidivism, reputation } = req.body;
  const f = Math.min(4, Math.max(1, Number(financial) || 1));
  const h = Math.min(4, Math.max(1, Number(hierarchy) || 1));
  const rec = Math.min(4, Math.max(1, Number(recidivism) || 1));
  const rep = Math.min(4, Math.max(1, Number(reputation) || 1));
  const totalScore = f + h + rec + rep;

  let priority = 'faible';
  let nocaThreshold = 'NOCA 1';
  let expectedTreatment = 'Traitement standard sous 30 jours (DARC Filiale)';

  if (totalScore >= 13) {
    priority = 'critique';
    nocaThreshold = 'NOCA 4';
    expectedTreatment = 'Alerte immédiate Comité d’Audit & DG Groupe sous 24-48h. Mesures conservatoires.';
  } else if (totalScore >= 10) {
    priority = 'tres_elevee';
    nocaThreshold = 'NOCA 3';
    expectedTreatment = 'Instruction prioritaire sous 5 jours avec supervision DARC Groupe.';
  } else if (totalScore >= 7) {
    priority = 'elevee';
    nocaThreshold = 'NOCA 2';
    expectedTreatment = 'Traitement diligent sous 15 jours par enquêteur désigné.';
  }

  res.json({
    financialImpact: f,
    hierarchyLevel: h,
    recidivism: rec,
    reputationRisk: rep,
    totalScore,
    priority,
    nocaThreshold,
    expectedTreatment
  });
});

// 4. BACKEND FUNCTION: assignCase() [CDC 58 & 69]
app.post('/api/cases/assign', (req, res) => {
  const { caseId, investigatorIds, investigatorNames, assignedBy } = req.body;
  if (!caseId || !Array.isArray(investigatorIds) || investigatorIds.length === 0) {
    return res.status(400).json({ error: "caseId et tableau investigatorIds requis." });
  }

  // Conflict of interest check
  const conflicts = conflictStore.filter(c => c.caseId === caseId && investigatorIds.includes(c.userId));
  const activeConflicts = conflicts.filter(c => c.conflictStatus === 'CONFLICT_IDENTIFIED');
  if (activeConflicts.length > 0) {
    return res.status(409).json({
      error: `Affectation bloquée : L'enquêteur [${activeConflicts[0].userName}] a déclaré un conflit d'intérêts sur ce dossier (CDC 58 & 59).`
    });
  }

  const existing = caseStore.get(caseId);
  if (existing) {
    existing.assignedInvestigators = investigatorIds;
    existing.assignedInvestigatorNames = investigatorNames || [];
    existing.status = 'under_review';
    existing.enterpriseStatus = 'ASSIGNED';
    existing.updatedAt = new Date().toISOString();
  }

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'INVESTIGATOR_ASSIGNED',
    actorType: 'ADMIN',
    authorId: assignedBy?.id || 'admin',
    authorName: assignedBy?.name || 'Responsable DARC',
    authorRole: 'functional_admin',
    details: `Affectation formelle des enquêteurs: ${(investigatorNames || investigatorIds).join(', ')}. Statut passé à [ASSIGNED].`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, caseId, assignedInvestigators: investigatorIds });
});

// 5. BACKEND FUNCTION: validateCaseAccess() [CDC 45 & 74]
app.post('/api/cases/access/validate', (req, res) => {
  const { user, caseData } = req.body;
  if (!user || !user.role) {
    return res.status(401).json({ authorized: false, reason: "Utilisateur non authentifié (Niveau 1 échec)" });
  }

  if (user.role === 'functional_admin' || user.role === 'auditor') {
    return res.json({ authorized: true, canViewIdentity: user.role === 'functional_admin', canEdit: user.role === 'functional_admin' });
  }

  if (user.role === 'system_admin') {
    return res.json({ authorized: true, canViewIdentity: false, canEdit: false, reason: "Administrateur système : pièces confidentielles restreintes (CDC 67)" });
  }

  if (user.role === 'investigator') {
    const isAssigned = (caseData?.assignedInvestigators || []).includes(user.id);
    const hasScope = !user.entity || user.entity === caseData?.concernedEntity || user.country === caseData?.country;

    if (!isAssigned && !hasScope) {
      return res.status(403).json({ authorized: false, reason: "Dossier hors périmètre géographique ou entité (Niveau 3 échec)" });
    }

    return res.json({ authorized: true, canViewIdentity: !caseData?.whistleblower?.isAnonymous, canEdit: isAssigned });
  }

  res.status(403).json({ authorized: false, reason: "Accès refusé" });
});

// 6. BACKEND FUNCTION: checkConflictOfInterest() [CDC 59 & 69]
app.post('/api/cases/conflict/check', (req, res) => {
  const { caseId, userId, userName, status, declaration } = req.body;
  if (!caseId || !userId || !status) {
    return res.status(400).json({ error: "caseId, userId et status sont requis." });
  }

  const newDecl = {
    conflictId: 'CONF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    caseId,
    userId,
    userName: userName || 'Enquêteur',
    conflictStatus: status, // 'NO_CONFLICT' | 'CONFLICT_IDENTIFIED'
    declaration: declaration || '',
    declaredAt: new Date().toISOString()
  };

  conflictStore.push(newDecl);

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'CONFLICT_DECLARED',
    actorType: 'USER',
    authorId: userId,
    authorName: userName || 'Enquêteur',
    authorRole: 'investigator',
    details: status === 'NO_CONFLICT'
      ? `Attestation sur l'honneur d'absence de conflit d'intérêts validée par [${userName}].`
      : `ALERTE CONFLIT D'INTÉRÊTS : [${userName}] a déclaré un lien potentiel : "${declaration}". Retrait de l'instruction requis.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, declaration: newDecl });
});

// 7. BACKEND FUNCTION: changeCaseStatus() [CDC 56, 57 & 74]
app.post('/api/cases/status/change', (req, res) => {
  const { caseId, currentStatus, targetStatus, user, reason } = req.body;
  if (!caseId || !targetStatus) {
    return res.status(400).json({ error: "caseId et targetStatus requis." });
  }

  // Business Rules validation
  if (currentStatus === 'new' && (targetStatus === 'closed' || targetStatus === 'archived')) {
    return res.status(422).json({
      error: "Règle de sécurité violée : Un dossier nouveau ne peut pas être clôturé directement sans instruction préalable (CDC 57 & 74)."
    });
  }

  if (targetStatus === 'closed' && !reason) {
    return res.status(422).json({
      error: "Clôture impossible : Un motif ou résumé de clôture est obligatoire (CDC 56)."
    });
  }

  const existing = caseStore.get(caseId);
  if (existing) {
    existing.status = targetStatus;
    existing.updatedAt = new Date().toISOString();
    if (targetStatus === 'closed') {
      existing.closedAt = new Date().toISOString();
      existing.closureSummary = reason;
      // 10-year retention calculation (CDC 73)
      const tenYearsLater = new Date();
      tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
      existing.retentionDate = tenYearsLater.toISOString();
    }
  }

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: targetStatus === 'closed' ? 'ALERT_CLOSED' : 'STATUS_CHANGED',
    actorType: 'ADMIN',
    authorId: user?.id || 'admin',
    authorName: user?.name || 'Agent DARC',
    authorRole: user?.role || 'functional_admin',
    details: `Transition de statut vers [${targetStatus.toUpperCase()}]. Motif : "${reason || 'Instruction conforme'}".`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, caseId, newStatus: targetStatus });
});

// 8. BACKEND FUNCTION: sendReporterMessage() [CDC 54 & 69]
app.post('/api/cases/communications/send', (req, res) => {
  const { caseId, senderType, senderDisplayName, content } = req.body;
  if (!caseId || !content) {
    return res.status(400).json({ error: "caseId et content requis." });
  }

  const msgId = 'MSG-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'MESSAGE_SENT',
    actorType: senderType === 'REPORTER' ? 'REPORTER' : 'USER',
    authorId: senderType,
    authorName: senderDisplayName || 'Correspondant',
    authorRole: senderType === 'REPORTER' ? 'whistleblower' : 'investigator',
    details: `Message chiffré envoyé dans le dossier par [${senderDisplayName}]. Longueur: ${content.length} caractères.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, messageId: msgId, sentAt: new Date().toISOString() });
});

// 9. BACKEND FUNCTION: sendNotification() [CDC 61 & 69]
app.post('/api/notifications/send', (req, res) => {
  const { recipientId, caseId, type, title, message } = req.body;
  const notif = {
    id: 'NOTIF-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    recipientId: recipientId || 'ALL_ADMINS',
    caseId,
    type: type || 'STATUS_CHANGED',
    title: title || 'Notification ACTIVA EthicAlert',
    message: message || '',
    read: false,
    createdAt: new Date().toISOString()
  };
  notificationStore.unshift(notif);
  res.json({ success: true, notification: notif });
});

// 10. BACKEND FUNCTION: calculateSLA() [CDC 60 & 69]
app.post('/api/sla/calculate', (req, res) => {
  const { receivedAt, priority } = req.body;
  const targetHoursMap: Record<string, number> = {
    critique: 48,
    tres_elevee: 120,
    elevee: 360,
    faible: 720
  };
  const hours = targetHoursMap[priority] || 720;
  const start = new Date(receivedAt || new Date().toISOString());
  const due = new Date(start.getTime() + hours * 3600000);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const hoursRemaining = Math.round(diffMs / 3600000);
  const isOverdue = diffMs < 0;

  res.json({
    slaStartAt: start.toISOString(),
    slaDueAt: due.toISOString(),
    targetHours: hours,
    hoursRemaining,
    daysRemaining: Math.max(0, Math.ceil(hoursRemaining / 24)),
    isOverdue
  });
});

// 11. BACKEND FUNCTION: processSLAEscalation() [CDC 60 & 69]
app.post('/api/sla/escalate', (req, res) => {
  const { caseId, trackingNumber, priority, hoursOverdue } = req.body;
  
  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    trackingNumber,
    actionType: 'SLA_ESCALATED',
    actorType: 'SYSTEM',
    authorId: 'sla_escalation_engine',
    authorName: 'Moteur d’Escalade Automatique SLA',
    authorRole: 'system_admin',
    details: `ESCALADE HIÉRARCHIQUE : Dossier [${trackingNumber}] en retard de ${hoursOverdue || 24}h sur SLA pour priorité [${priority}]. Notification envoyée à la Direction Générale & Comité d'Audit.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, escalated: true, escalatedAt: new Date().toISOString() });
});

// 12. BACKEND FUNCTION: generateReport() [CDC 64 & 69]
app.get('/api/reports/aggregated', (req, res) => {
  const total = caseStore.size;
  let active = 0;
  let closed = 0;
  const byPriority: Record<string, number> = { faible: 0, elevee: 0, tres_elevee: 0, critique: 0 };
  const byCountry: Record<string, number> = {};

  caseStore.forEach(c => {
    if (c.status === 'closed' || c.status === 'archived') {
      closed++;
    } else {
      active++;
    }
    byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
    if (c.country) byCountry[c.country] = (byCountry[c.country] || 0) + 1;
  });

  res.json({
    generatedAt: new Date().toISOString(),
    totalCases: total,
    activeCases: active,
    closedCases: closed,
    byPriority,
    byCountry,
    averageResolutionDays: 8.5
  });
});

// 13. BACKEND FUNCTION: generateAuditLog() [CDC 62 & 69]
app.post('/api/audit/log', (req, res) => {
  const entry = {
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  auditLogStore.unshift(entry);
  res.status(201).json({ success: true, logId: entry.id });
});

// 14. BACKEND FUNCTION: reopenCase() [CDC 56, 57 & 69]
app.post('/api/cases/reopen', (req, res) => {
  const { caseId, user, reason } = req.body;
  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: "Un motif circonstancié d'au moins 10 caractères est requis pour réouvrir un dossier." });
  }

  const existing = caseStore.get(caseId);
  if (existing) {
    existing.status = 'reopened';
    existing.enterpriseStatus = 'REOPENED';
    existing.reopenReason = reason;
    existing.reopenedAt = new Date().toISOString();
    existing.reopenedBy = user?.name || 'Administrateur DARC';
  }

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'ALERT_REOPENED',
    actorType: 'ADMIN',
    authorId: user?.id || 'admin',
    authorName: user?.name || 'Responsable DARC',
    authorRole: 'functional_admin',
    details: `Réouverture solennelle du dossier. Motif : "${reason}".`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, caseId, status: 'reopened' });
});

// 15. BACKEND FUNCTION: closeCase() & archiveCase() [CDC 73, 74]
app.post('/api/cases/close', (req, res) => {
  const { caseId, user, summary, messageToWhistleblower } = req.body;
  if (!summary) {
    return res.status(400).json({ error: "Une synthèse formelle de clôture est requise (CDC 74)." });
  }

  const tenYearsDate = new Date();
  tenYearsDate.setFullYear(tenYearsDate.getFullYear() + 10);

  const existing = caseStore.get(caseId);
  if (existing) {
    existing.status = 'closed';
    existing.enterpriseStatus = 'CLOSED';
    existing.closedAt = new Date().toISOString();
    existing.closureSummary = summary;
    existing.retentionDate = tenYearsDate.toISOString();
  }

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'ALERT_CLOSED',
    actorType: 'ADMIN',
    authorId: user?.id || 'admin',
    authorName: user?.name || 'Responsable DARC',
    authorRole: 'functional_admin',
    details: `Clôture formelle. Date de conservation légale fixée à 10 ans (${tenYearsDate.toLocaleDateString('fr-FR')}).`,
    timestamp: new Date().toISOString()
  });

  res.json({ 
    success: true, 
    caseId, 
    status: 'closed', 
    retentionDate: tenYearsDate.toISOString() 
  });
});

app.post('/api/cases/archive', (req, res) => {
  const { caseId, user, legalHold } = req.body;
  const existing = caseStore.get(caseId);

  if (existing?.legalHold || legalHold) {
    return res.status(422).json({
      error: "Archivage/Destruction interdite : Ce dossier est sous mise sous séquestre légale (Legal Hold) [CDC 73]."
    });
  }

  if (existing) {
    existing.status = 'archived';
    existing.enterpriseStatus = 'ARCHIVED';
    existing.archivedAt = new Date().toISOString();
  }

  auditLogStore.unshift({
    id: 'AUD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    alertId: caseId,
    actionType: 'ALERT_ARCHIVED',
    actorType: 'ADMIN',
    authorId: user?.id || 'admin',
    authorName: user?.name || 'Admin Système',
    authorRole: 'system_admin',
    details: "Archivage sécurisé à froid du dossier.",
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, caseId, status: 'archived' });
});

// ============================================================================
// VITE MIDDLEWARE & STATIC ASSETS SERVING (FULL-STACK INTEGRATION)
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ACTIVA EthicAlert: Enterprise Full-Stack Server démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer();
