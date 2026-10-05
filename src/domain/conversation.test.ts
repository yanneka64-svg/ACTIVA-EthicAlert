/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés, anonymat, documents) ===
 */
import { describe, expect, it } from 'vitest';
import type { Communication } from './caseTypes';
import { isTypingNow, safeFileName, sanitizeCommunicationsForReporter, TEAM_DISPLAY_NAME, TYPING_TTL_MS } from './conversation';
import { applyReporterConversation } from './reporterCaseToAlert';
import { reporterMessagesFromCommunications } from '../services/staffConversation';
import type { AlertRecord } from '../types';

const staffMsg = {
  messageId: 'm1',
  caseId: 'case-1',
  sender: 'investigator',
  senderDisplayName: 'MEBADA EKANI Barnabé Yannick',
  authorName: 'MEBADA EKANI Barnabé Yannick',
  content: 'Bonjour',
  createdAt: '2026-10-05T11:24:07Z',
  createdBy: 'uid-staff-123',
  updatedAt: '2026-10-05T11:24:07Z',
  updatedBy: 'uid-staff-123',
} as unknown as Communication;

const reporterMsg = {
  messageId: 'm2',
  caseId: 'case-1',
  sender: 'reporter',
  senderDisplayName: 'Lanceur d’alerte',
  content: 'Voici la facture',
  createdAt: '2026-10-05T11:30:00Z',
  createdBy: 'reporter',
  updatedAt: '2026-10-05T11:30:00Z',
  updatedBy: 'reporter',
  attachmentFiles: [{ evidenceId: 'ev-1', fileName: 'facture.pdf', fileType: 'application/pdf', fileSize: 2048 }],
} as unknown as Communication;

describe('sanitizeCommunicationsForReporter (anonymat de l’équipe)', () => {
  it('ne transmet jamais le nom ni l’identifiant d’un membre du personnel', () => {
    const out = sanitizeCommunicationsForReporter([reporterMsg, staffMsg]);
    const json = JSON.stringify(out);
    expect(json).not.toContain('MEBADA');
    expect(json).not.toContain('uid-staff-123');
    expect(out[0]).toEqual({ messageId: 'm1', sender: 'investigator', senderDisplayName: TEAM_DISPLAY_NAME, content: 'Bonjour', createdAt: '2026-10-05T11:24:07Z' });
  });

  it('trie par date et conserve les pièces jointes du déclarant', () => {
    const out = sanitizeCommunicationsForReporter([reporterMsg, staffMsg]);
    expect(out.map((m) => m.messageId)).toEqual(['m1', 'm2']);
    expect(out[1].attachmentFiles).toEqual([{ evidenceId: 'ev-1', fileName: 'facture.pdf', fileType: 'application/pdf', fileSize: 2048 }]);
  });
});

describe('isTypingNow', () => {
  const now = Date.parse('2026-10-05T12:00:10Z');
  it('affiche « en train d’écrire » quelques secondes après le dernier signal', () => {
    expect(isTypingNow('2026-10-05T12:00:08Z', now)).toBe(true);
    expect(isTypingNow(new Date(now - TYPING_TTL_MS - 1).toISOString(), now)).toBe(false);
    expect(isTypingNow(null, now)).toBe(false);
    expect(isTypingNow('n/a', now)).toBe(false);
  });
});

describe('safeFileName', () => {
  it('retire tout chemin et les caractères interdits', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\docs\\a<b>.pdf')).toBe('a_b_.pdf');
    expect(safeFileName('')).toBe('document');
  });
});

describe('conversation en direct — portail et suivi', () => {
  it("côté équipe : seuls les messages du déclarant sont ajoutés, avec leurs documents téléchargeables", () => {
    const out = reporterMessagesFromCommunications([staffMsg, reporterMsg], 'case-1');
    expect(out).toHaveLength(1);
    expect(out[0].attachments?.[0]).toMatchObject({ id: 'ev-1', name: 'facture.pdf', cloudCaseId: 'case-1' });
  });

  it('côté déclarant : le message automatique de dépôt reste en tête', () => {
    const alert = {
      status: 'new',
      messages: [{ id: 'msg-init', sender: 'admin', senderDisplayName: 'DARC Groupe ACTIVA', content: 'Reçu', createdAt: '2026-10-05T11:15:58Z' }],
    } as unknown as AlertRecord;
    const r = applyReporterConversation(alert, sanitizeCommunicationsForReporter([staffMsg, reporterMsg]), 'new');
    expect(r.messages.map((m) => m.id)).toEqual(['msg-init', 'm1', 'm2']);
    expect(r.messages[1].senderDisplayName).toBe(TEAM_DISPLAY_NAME);
  });
});
