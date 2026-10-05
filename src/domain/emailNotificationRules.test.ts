/** === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) === */
import { describe, expect, it } from 'vitest';
import {
  buildNotificationEmail,
  DEFAULT_EMAIL_NOTIFICATION_SETTINGS as DEF,
  resolveNotificationRecipients,
  sanitizeEmailNotificationSettings,
  type CaseNotificationFacts,
  type EmailNotificationSettings,
  type StaffRecipientCandidate,
} from './emailNotificationRules';

const settings: EmailNotificationSettings = {
  ...DEF,
  groups: DEF.groups.map((g) =>
    g.id === 'dga' ? { ...g, extraEmails: ['dga@group-activa.com'] } : g.id === 'drh' ? { ...g, extraEmails: ['drh@group-activa.com'] } : g
  ),
};
const staff: StaffRecipientCandidate[] = [
  { uid: 'op', email: 'op@group-activa.com', role: 'functional_admin', active: true, countries: [], entities: [] },
  { uid: 'sup-cm', email: 'sup.cm@group-activa.com', role: 'senior_investigator', active: true, countries: ['Cameroun'], entities: [] },
  { uid: 'sup-gh', email: 'sup.gh@group-activa.com', role: 'senior_investigator', active: true, countries: ['Ghana'], entities: [] },
  { uid: 'darc', email: 'darc@group-activa.com', role: 'darc_compliance', active: true, countries: [], entities: [] },
  { uid: 'old', email: 'old@group-activa.com', role: 'functional_admin', active: false, countries: [], entities: [] },
  { uid: 'inv', email: 'inv@group-activa.com', role: 'investigator', active: true, countries: [], entities: [] },
];
const facts = (over: Partial<CaseNotificationFacts> = {}): CaseNotificationFacts => ({
  reference: 'AACMR-26-10-0002', category: 'Fraude, Corruption et pots-de-vin', entity: 'ACTIVA Assurances', country: 'Cameroun', priority: 'high', implicatedLevels: [], ...over,
});
const emails = (r: { email: string }[]) => r.map((x) => x.email).sort();

describe('resolveNotificationRecipients', () => {
  it('nouveau signalement ordinaire : superviseurs (dans leur périmètre) et DARC, pas le DGA ni le DRH', () => {
    const r = resolveNotificationRecipients({ event: 'new_report', facts: facts(), settings, staff });
    expect(emails(r)).toEqual(['darc@group-activa.com', 'op@group-activa.com', 'sup.cm@group-activa.com']);
  });
  it('dossier critique : le DGA est prévenu, avec le motif', () => {
    const r = resolveNotificationRecipients({ event: 'new_report', facts: facts({ priority: 'critical' }), settings, staff });
    expect(r.find((x) => x.group === 'dga')).toEqual({ email: 'dga@group-activa.com', group: 'dga', reason: 'critical' });
  });
  it('personne de rang Direction mise en cause : le DGA est prévenu', () => {
    const r = resolveNotificationRecipients({ event: 'new_report', facts: facts({ implicatedLevels: ['director_plus'] }), settings, staff });
    expect(r.some((x) => x.group === 'dga' && x.reason === 'senior_implicated')).toBe(true);
  });
  it('dossier RH (catégorie ou mot-clé) : le DRH est prévenu', () => {
    expect(resolveNotificationRecipients({ event: 'new_report', facts: facts({ category: 'Ressources Humaines et diversité' }), settings, staff }).some((x) => x.group === 'drh')).toBe(true);
    expect(resolveNotificationRecipients({ event: 'closed', facts: facts({ category: 'Autre', subcategory: 'Harcèlement moral ou sexuel' }), settings, staff }).some((x) => x.group === 'drh')).toBe(true);
    expect(resolveNotificationRecipients({ event: 'new_report', facts: facts(), settings, staff }).some((x) => x.group === 'drh')).toBe(false);
  });
  it('jamais l’auteur de l’action ni une personne mise en cause', () => {
    const r = resolveNotificationRecipients({ event: 'assigned', facts: facts(), settings, staff, excludedUids: ['op', 'sup-cm'] });
    expect(emails(r)).toEqual([]);
  });
  it('groupe désactivé : aucun envoi', () => {
    const off = { ...settings, groups: settings.groups.map((g) => ({ ...g, enabled: false })) };
    expect(resolveNotificationRecipients({ event: 'new_report', facts: facts({ priority: 'critical' }), settings: off, staff })).toEqual([]);
  });
});

describe('buildNotificationEmail', () => {
  it('référence, entité, catégorie, priorité, motif et lien — sans détail sensible', () => {
    const { subject, body } = buildNotificationEmail({ event: 'new_report', facts: facts({ priority: 'critical' }), group: 'dga', reason: 'critical', appUrl: 'https://activa.web.app/' });
    expect(subject).toBe('[activa-whistleblowing] Nouveau signalement — AACMR-26-10-0002');
    expect(body).toContain('https://activa.web.app/cases/AACMR-26-10-0002');
    expect(body).toContain('Directeur Général Adjoint — motif : dossier de priorité très élevée ou critique');
    expect(body).toContain('aucun détail du signalement');
  });
});

describe('sanitizeEmailNotificationSettings', () => {
  it('normalise et valide', () => {
    const s = sanitizeEmailNotificationSettings({ groups: [{ id: 'dga', enabled: true, roles: ['executive', 'pirate'], extraEmails: [' DGA@Group-Activa.com '], events: { new_report: ['critical', 'x'] } }], hrCategories: ['RH'] });
    const dga = s.groups.find((g) => g.id === 'dga')!;
    expect(dga.roles).toEqual(['executive']);
    expect(dga.extraEmails).toEqual(['dga@group-activa.com']);
    expect(dga.events).toEqual({ new_report: ['critical'] });
    expect(s.groups).toHaveLength(4);
  });
  it('refuse une adresse invalide', () => {
    expect(() => sanitizeEmailNotificationSettings({ groups: [{ id: 'drh', extraEmails: ['pas-une-adresse'] }] })).toThrow();
  });
});
