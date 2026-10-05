/**
 * === AMÉLIORATION AJOUTÉE (suivi du déclarant depuis n'importe quel
 * appareil) ===
 *
 * Convertit la réponse de la Cloud Function `getCaseForReporter` en
 * `AlertRecord`, la forme attendue par l'écran de suivi
 * (AlertTrackingView.tsx et ses onglets). Fonction pure, testée.
 *
 * Firebase est la référence pour ce que l'équipe fait évoluer (statut,
 * messages, dates) ; la copie locale éventuelle (même appareil que le dépôt)
 * complète ce que le serveur ne renvoie pas au déclarant (pièces jointes
 * locales, lieu, personnes qu'il a lui-même citées…).
 */
import { AlertRecord, CaseMessage } from '../types';
import { CaseStatus, Communication, ReportingMode } from './caseTypes';
import { alertStatusFromCaseStatus } from './caseToAlertSummary';

export interface ReporterCasePayload {
  caseNumber: string;
  status: CaseStatus;
  receivedAt: string;
  description: string;
  communications: Communication[];
  /** Absent si les fonctions déployées sont antérieures à cet ajout. */
  reporterCase?: {
    externalReference: string | null;
    category: string;
    subcategory: string;
    country: string;
    entity: string;
    reportingMode: ReportingMode;
    incidentDate: string | null;
    updatedAt: string;
    closedAt: string | null;
  };
}

const SENDER: Record<Communication['sender'], CaseMessage['sender']> = {
  reporter: 'whistleblower',
  investigator: 'investigator',
  system: 'admin',
};

export function reporterCaseToAlertRecord(
  payload: ReporterCasePayload,
  enteredTrackingNumber: string,
  existing?: AlertRecord | null
): AlertRecord {
  const rc = payload.reporterCase;
  const trackingNumber = rc?.externalReference || existing?.trackingNumber || enteredTrackingNumber || payload.caseNumber;
  const messages: CaseMessage[] = [...payload.communications]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((c) => ({
      id: c.messageId,
      sender: SENDER[c.sender] ?? 'admin',
      senderDisplayName: c.senderDisplayName,
      content: c.content,
      createdAt: c.createdAt,
    }));

  const base: AlertRecord = existing
    ? { ...existing }
    : ({
        id: `reporter-${payload.caseNumber}`,
        trackingNumber,
        accessCode: '',
        accessCodeHash: '',
        accessCodeSalt: '',
        channel: 'web',
        createdAt: payload.receivedAt,
        updatedAt: payload.receivedAt,
        whistleblower: { isAnonymous: true },
        category: '',
        subCategory: '',
        detailedDescription: '',
        incidentDates: '',
        incidentLocation: '',
        concernedEntity: '',
        country: '',
        isOngoing: false,
        impactType: '',
        involvedPersons: [],
        witnesses: [],
        evidences: [],
        status: 'new',
        assignedInvestigators: [],
        assignedInvestigatorNames: [],
        internalNotes: [],
        messages: [],
        correctiveMeasures: [],
        tasks: [],
      } as unknown as AlertRecord);

  return {
    ...base,
    trackingNumber,
    createdAt: existing?.createdAt ?? payload.receivedAt,
    updatedAt: rc?.updatedAt ?? base.updatedAt,
    detailedDescription: payload.description || base.detailedDescription,
    category: rc?.category || base.category,
    subCategory: rc?.subcategory || base.subCategory,
    concernedEntity: rc?.entity || base.concernedEntity,
    country: rc?.country || base.country,
    incidentDates: base.incidentDates || rc?.incidentDate || '',
    whistleblower: rc ? { ...base.whistleblower, isAnonymous: rc.reportingMode !== 'identified' } : base.whistleblower,
    status: alertStatusFromCaseStatus(payload.status),
    ...(rc?.closedAt ? { closedAt: rc.closedAt } : {}),
    messages,
  };
}
