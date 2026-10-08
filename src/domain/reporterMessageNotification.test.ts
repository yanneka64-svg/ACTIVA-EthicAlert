// === AMÉLIORATION AJOUTÉE (message du déclarant) ===
import { describe, expect, it } from 'vitest';
import {
  OPERATOR_ROLES,
  buildReporterMessageEmail,
  resolveReporterMessageRecipients,
  shouldNotifyReporterMessage,
} from './emailNotificationRules';
import type { StaffRecipientCandidate } from './emailNotificationRules';

const s = (uid: string, role: StaffRecipientCandidate['role'], extra: Partial<StaffRecipientCandidate> = {}): StaffRecipientCandidate => ({
  uid, email: `${uid}@group-activa.com`, name: uid, role, active: true, countries: [], entities: [], ...extra,
});
const staff = [
  s('op', 'functional_admin'),
  s('darc', 'darc_compliance'),
  s('resp', 'senior_investigator'),
  s('respgh', 'senior_investigator', { countries: ['Ghana'] }),
  s('inv1', 'investigator'),
  s('inv2', 'investigator'),
  s('conso', 'consultation'),
  s('admin', 'system_admin'),
  s('off', 'functional_admin', { active: false }),
];
const facts = { country: 'Cameroun', entity: 'ACTIVA Assurances' };

describe('message du déclarant — destinataires', () => {
  it('les opérateurs sont les rôles qui attribuent et voient tous les dossiers', () => {
    expect([...OPERATOR_ROLES].sort()).toEqual(['darc_compliance', 'functional_admin', 'senior_investigator']);
  });

  it('dossier attribué : seul l’enquêteur attribué est prévenu', () => {
    const r = resolveReporterMessageRecipients({ assigneeUids: ['inv1'], staff, facts });
    expect(r).toEqual([{ uid: 'inv1', email: 'inv1@group-activa.com', name: 'inv1', as: 'investigator' }]);
  });

  it('plusieurs enquêteurs attribués : chacun, une seule fois', () => {
    const r = resolveReporterMessageRecipients({ assigneeUids: ['inv1', 'inv2', 'inv1', null], staff, facts });
    expect(r.map((x) => x.uid)).toEqual(['inv1', 'inv2']);
  });

  it('dossier non attribué : les opérateurs de son périmètre, jamais un enquêteur ni un autre profil', () => {
    const r = resolveReporterMessageRecipients({ assigneeUids: [], staff, facts });
    expect(r.map((x) => x.uid).sort()).toEqual(['darc', 'op', 'resp']);
    expect(r.every((x) => x.as === 'operator')).toBe(true);
  });

  it('jamais une personne mise en cause', () => {
    expect(resolveReporterMessageRecipients({ assigneeUids: ['inv1'], implicatedUids: ['inv1'], staff, facts })).toEqual([]);
    const r = resolveReporterMessageRecipients({ assigneeUids: [], implicatedUids: ['op'], staff, facts });
    expect(r.map((x) => x.uid)).not.toContain('op');
  });

  it('un e-mail au plus toutes les 10 minutes pour des messages successifs', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(shouldNotifyReporterMessage(undefined, now)).toBe(true);
    expect(shouldNotifyReporterMessage('2026-10-08T11:55:00Z', now)).toBe(false);
    expect(shouldNotifyReporterMessage('2026-10-08T11:50:00Z', now)).toBe(true);
  });

  it('l’e-mail ne contient jamais le contenu du message', () => {
    const mail = buildReporterMessageEmail({
      facts: { reference: 'AACMR-26-10-0002', entity: 'ACTIVA Assurances', country: 'Cameroun', category: 'Fraude', priority: 'high' },
      recipientName: 'Jean Mbarga',
      as: 'investigator',
      appUrl: 'https://activa-alertes.com',
    });
    expect(mail.subject).toBe('Nouveau message du déclarant — AACMR-26-10-0002');
    expect(mail.body).toContain('Bonjour Jean,');
    expect(mail.body).toContain('https://activa-alertes.com/cases/AACMR-26-10-0002');
    expect(mail.html).toContain('Lire et répondre');
  });
});
