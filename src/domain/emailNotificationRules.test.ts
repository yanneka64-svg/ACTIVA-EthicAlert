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
    // === AMÉLIORATION AJOUTÉE (message simplifié) === sujet sans préfixe technique.
    expect(subject).toBe('Nouveau signalement — AACMR-26-10-0002');
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

// === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
import { namesMatch, parseContact, routingPlan } from './emailNotificationRules';
describe('acheminement selon la personne mise en cause', () => {
  const s2: EmailNotificationSettings = {
    ...settings,
    groups: settings.groups.map((g) => (g.id === 'darc' ? { ...g, extraEmails: ['Awa Ndiaye <awa.ndiaye@group-activa.com>'] } : g)),
  };
  const staffNamed = staff.map((x) => ({
    ...x,
    name: x.uid === 'sup-cm' ? 'Paul Mbarga' : x.uid === 'darc' ? 'Marie Ekane' : x.uid === 'inv' ? 'Luc Fotso' : x.uid,
  }));
  const groups = (f: CaseNotificationFacts) =>
    [...new Set(resolveNotificationRecipients({ event: 'new_report', facts: f, settings: s2, staff: staffNamed }).map((x) => x.group))].sort();

  it('personne du dispositif mise en cause : Superviseur et DARC', () => {
    expect(groups(facts())).toEqual(['darc', 'supervisors']);
  });
  it('enquêteur mis en cause (par son nom) : directement la DARC', () => {
    expect(groups(facts({ implicatedPersons: [{ name: 'FOTSO Luc' }] }))).toEqual(['darc']);
  });
  it('enquêteur mis en cause (par sa fonction) : directement la DARC', () => {
    expect(groups(facts({ implicatedPersons: [{ name: 'X Y', position: 'Enquêteur interne' }] }))).toEqual(['darc']);
  });
  it('superviseur mis en cause : la DARC', () => {
    expect(groups(facts({ implicatedPersons: [{ name: 'Paul Mbarga' }] }))).toEqual(['darc']);
  });
  it('DARC mise en cause : DGA et DRH, avec le motif « escalade »', () => {
    const f = facts({ implicatedPersons: [{ name: 'Inconnu', position: 'Responsable DARC Cameroun' }] });
    expect(groups(f)).toEqual(['dga', 'drh']);
    const r = resolveNotificationRecipients({ event: 'new_report', facts: f, settings: s2, staff: staffNamed });
    expect(r.every((x) => x.reason === 'escalation')).toBe(true);
  });
  it('enquêteur et DARC mis en cause : la règle du niveau le plus élevé (DGA et DRH)', () => {
    const f = facts({ implicatedPersons: [{ name: 'Luc Fotso' }, { name: 'Awa NDIAYE' }] });
    expect(routingPlan(s2, f, staffNamed).routingCase).toBe('darc');
    expect(groups(f)).toEqual(['dga', 'drh']);
  });
  it('la clôture suit le même acheminement (DARC mise en cause → DGA et DRH, pas la DARC)', () => {
    const f = facts({ implicatedPersons: [{ name: 'Marie Ekane' }] });
    const r = resolveNotificationRecipients({ event: 'closed', facts: f, settings: s2, staff: staffNamed });
    expect([...new Set(r.map((x) => x.group))].sort()).toEqual(['dga', 'drh']);
  });
  it('la personne mise en cause n’est jamais prévenue', () => {
    const r = resolveNotificationRecipients({ event: 'new_report', facts: facts({ implicatedPersons: [{ name: 'Paul Mbarga' }] }), settings: s2, staff: staffNamed });
    expect(r.some((x) => x.email === 'sup.cm@group-activa.com')).toBe(false);
  });
  it('rapprochement des noms', () => {
    expect(namesMatch('Jean Dupont', 'DUPONT Jean')).toBe(true);
    expect(namesMatch('Jean-Marc Dupont', 'Dupont Jean')).toBe(true);
    expect(namesMatch('Dupont', 'Jean Dupont')).toBe(false);
    expect(namesMatch('Jean Dupont', 'Jean Durand')).toBe(false);
    expect(parseContact('Awa Ndiaye <AWA@x.com>')).toEqual({ name: 'Awa Ndiaye', email: 'awa@x.com' });
  });
});

// === AMÉLIORATION AJOUTÉE (escalade respectée sur le portail) ===
import { levelExcludedStaffUids } from './emailNotificationRules';
describe('levelExcludedStaffUids — accès au portail retiré au niveau mis en cause', () => {
  const people: StaffRecipientCandidate[] = [
    { uid: 'fa', email: 'fa@group-activa.com', name: 'Awa Fonction', role: 'functional_admin', active: true, countries: [], entities: [] },
    { uid: 'si', email: 'si@group-activa.com', name: 'Eric Mebada', role: 'senior_investigator', active: true, countries: [], entities: [] },
    { uid: 'darc', email: 'darc@group-activa.com', name: 'Diane Arc', role: 'darc_compliance', active: true, countries: [], entities: [] },
    { uid: 'inv1', email: 'i1@group-activa.com', name: 'Jean Paul Mbarga', role: 'investigator', active: true, countries: [], entities: [] },
    { uid: 'inv2', email: 'i2@group-activa.com', name: 'Paul Ndi', role: 'investigator', active: true, countries: [], entities: [] },
    { uid: 'old', email: 'old@group-activa.com', name: 'Ancien Sup', role: 'senior_investigator', active: false, countries: [], entities: [] },
  ];
  const f = (persons: { name?: string; position?: string }[]): CaseNotificationFacts => ({
    reference: 'R', category: 'Fraude', entity: 'E', country: 'Cameroun', priority: 'high', implicatedLevels: [], implicatedPersons: persons,
  });
  it('personne du dispositif mise en cause : personne n’est écarté', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'Tiers Externe', position: 'Comptable' }]), people)).toEqual([]);
  });
  it('superviseur cité par sa fonction : tous les comptes superviseurs actifs écartés', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'X', position: 'Superviseur régional' }]), people).sort()).toEqual(['fa', 'si']);
  });
  it('superviseur nommé : tout le niveau superviseurs écarté', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'MEBADA Eric', position: 'Chef' }]), people).sort()).toEqual(['fa', 'si']);
  });
  it('DARC citée par sa fonction : comptes DARC ET superviseurs écartés (seuls DGA et DRH)', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'Inconnu', position: 'DARC' }]), people).sort()).toEqual(['darc', 'fa', 'si']);
  });
  it('DGA cité : superviseurs écartés, la DARC conserve l’accès', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'Inconnu', position: 'Directeur Général Adjoint' }]), people).sort()).toEqual(['fa', 'si']);
  });
  it('enquêteur nommé : lui et les superviseurs sont écartés (DARC seule)', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'jean paul MBARGA', position: 'Agent' }]), people).sort()).toEqual(['fa', 'inv1', 'si']);
  });
  it('enquêteur cité sans nom reconnu : tous les enquêteurs et les superviseurs écartés', () => {
    expect(levelExcludedStaffUids(settings, f([{ name: 'Inconnu', position: 'Enquêteur' }]), people).sort()).toEqual(['fa', 'inv1', 'inv2', 'si']);
  });
  it('rôle partagé avec le niveau destinataire : conservé', () => {
    const shared = { ...settings, groups: settings.groups.map((g) => (g.id === 'darc' ? { ...g, roles: ['darc_compliance', 'senior_investigator'] as typeof g.roles } : g)) };
    expect(levelExcludedStaffUids(shared, f([{ name: 'X', position: 'Agent', }, { name: 'Inconnu', position: 'Enquêteur' }]), people).sort()).toEqual(['fa', 'inv1', 'inv2']);
  });
});
