/**
 * === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
 *
 * Règles PURES (sans Firebase) partagées par l'écran d'administration et les
 * Cloud Functions qui envoient réellement les e-mails :
 * - quatre groupes de destinataires : Superviseurs, DARC, Directeur Général
 *   Adjoint (DGA), Directeur des Ressources Humaines (DRH) ;
 * - pour chaque événement (nouveau signalement, attribution, escalade,
 *   clôture, réouverture), les conditions dans lesquelles chaque groupe est
 *   prévenu : toujours, ou « le cas échéant » (dossier critique, dossier
 *   relevant des RH, personne de rang Direction mise en cause) ;
 * - le contenu de l'e-mail : numéro de dossier, entité, catégorie,
 *   priorité et lien vers le portail — JAMAIS la description des faits,
 *   l'identité du déclarant ni le nom des personnes mises en cause.
 */
import type { CasePriority, HierarchyLevel, RoleId } from './caseTypes';
// === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) ===
import { renderBrandedEmailHtml } from './emailTemplate';
// === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) ===
import type { EmailTone } from './emailTemplate';

export type NotificationEvent = 'new_report' | 'assigned' | 'escalated' | 'closed' | 'reopened';
export type NotificationCondition = 'always' | 'critical' | 'hr' | 'senior_implicated';
export type RecipientGroupId = 'supervisors' | 'darc' | 'dga' | 'drh';

export const NOTIFICATION_EVENTS: NotificationEvent[] = ['new_report', 'assigned', 'escalated', 'closed', 'reopened'];
export const NOTIFICATION_CONDITIONS: NotificationCondition[] = ['always', 'critical', 'hr', 'senior_implicated'];
export const RECIPIENT_GROUP_IDS: RecipientGroupId[] = ['supervisors', 'darc', 'dga', 'drh'];
/** Rôles dont les comptes peuvent être prévenus automatiquement. */
export const NOTIFIABLE_ROLES: RoleId[] = ['functional_admin', 'senior_investigator', 'darc_compliance', 'executive', 'audit_committee', 'consultation'];

export interface RecipientGroup {
  id: RecipientGroupId;
  enabled: boolean;
  /** Comptes du personnel ayant ces rôles (dans leur périmètre pays/entité). */
  roles: RoleId[];
  /**
   * Adresses supplémentaires (ex. DGA, DRH sans compte sur le portail),
   * éventuellement avec le nom de la personne : « Prénom Nom <adresse> » —
   * le nom permet de reconnaître cette personne si elle est mise en cause.
   */
  extraEmails: string[];
  /**
   * === AMÉLIORATION AJOUTÉE (escalade automatique) === fonctions qui
   * désignent ce niveau dans un signalement (ex. « superviseur », « DARC ») :
   * une personne mise en cause occupant cette fonction met le niveau en cause.
   */
  functionKeywords?: string[];
  /** Événement → conditions (une seule suffit). Absent ou vide = jamais. */
  events: Partial<Record<NotificationEvent, NotificationCondition[]>>;
}

export interface EmailNotificationSettings {
  groups: RecipientGroup[];
  /** Catégories de signalement qui relèvent des Ressources Humaines. */
  hrCategories: string[];
  /**
   * === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
   * À qui part chaque alerte selon le niveau mis en cause (le plus élevé
   * s'il y en a plusieurs). Un niveau mis en cause n'est jamais prévenu.
   */
  routing?: Partial<Record<RoutingCase, RecipientGroupId[]>>;
  /** Fonctions qui désignent un enquêteur dans un signalement. */
  investigatorKeywords?: string[];
}

/** Qui est mis en cause : personne du dispositif, ou un niveau (du plus bas au plus élevé). */
export type RoutingCase = 'none' | 'investigators' | RecipientGroupId;
export const ROUTING_CASES: RoutingCase[] = ['none', 'investigators', 'supervisors', 'darc', 'dga', 'drh'];
/** Ordre hiérarchique : la règle du niveau le plus élevé mis en cause s'applique. */
const ROUTING_RANK: Record<Exclude<RoutingCase, 'none'>, number> = { investigators: 1, supervisors: 2, darc: 3, dga: 4, drh: 4 };
export const DEFAULT_ROUTING: Record<RoutingCase, RecipientGroupId[]> = {
  none: ['supervisors', 'darc'],
  investigators: ['darc'],
  supervisors: ['darc'],
  darc: ['dga', 'drh'],
  dga: ['darc', 'drh'],
  drh: ['darc', 'dga'],
};
export const DEFAULT_INVESTIGATOR_KEYWORDS = ['enqueteur', 'enquetrice', 'investigateur', 'investigatrice', 'investigator'];
export const DEFAULT_FUNCTION_KEYWORDS: Record<RecipientGroupId, string[]> = {
  supervisors: ['superviseur', 'supervisor'],
  darc: ['darc', 'directeur audit risques et conformite', 'direction audit risques et conformite'],
  dga: ['directeur general adjoint', 'directrice generale adjointe', 'dga'],
  drh: ['drh', 'directeur des ressources humaines', 'directrice des ressources humaines'],
};

export const DEFAULT_EMAIL_NOTIFICATION_SETTINGS: EmailNotificationSettings = {
  groups: [
    {
      id: 'supervisors',
      enabled: true,
      roles: ['functional_admin', 'senior_investigator'],
      extraEmails: [],
      functionKeywords: DEFAULT_FUNCTION_KEYWORDS.supervisors,
      events: { new_report: ['always'], assigned: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] },
    },
    {
      id: 'darc',
      enabled: true,
      roles: ['darc_compliance'],
      extraEmails: [],
      functionKeywords: DEFAULT_FUNCTION_KEYWORDS.darc,
      events: { new_report: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] },
    },
    {
      id: 'dga',
      enabled: true,
      roles: [],
      extraEmails: [],
      functionKeywords: DEFAULT_FUNCTION_KEYWORDS.dga,
      events: { new_report: ['critical', 'senior_implicated'], escalated: ['always'], closed: ['critical', 'senior_implicated'] },
    },
    {
      id: 'drh',
      enabled: true,
      roles: [],
      extraEmails: [],
      functionKeywords: DEFAULT_FUNCTION_KEYWORDS.drh,
      events: { new_report: ['hr'], closed: ['hr'] },
    },
  ],
  hrCategories: ['Ressources Humaines et diversité'],
  routing: DEFAULT_ROUTING,
  investigatorKeywords: DEFAULT_INVESTIGATOR_KEYWORDS,
};

/** Ce qu'il faut savoir d'un dossier pour décider et rédiger (aucun contenu sensible). */
export interface CaseNotificationFacts {
  reference: string;
  category: string;
  subcategory?: string;
  entity: string;
  country: string;
  priority: CasePriority;
  /** Niveaux hiérarchiques des personnes mises en cause. */
  implicatedLevels: (HierarchyLevel | undefined)[];
  /**
   * === AMÉLIORATION AJOUTÉE (escalade automatique) === nom et fonction des
   * personnes mises en cause, pour écarter les niveaux concernés. Servent
   * UNIQUEMENT à décider des destinataires ; jamais écrits dans un e-mail.
   */
  implicatedPersons?: { name?: string; position?: string }[];
}

export interface StaffRecipientCandidate {
  uid: string;
  email: string;
  name?: string;
  role: RoleId;
  active: boolean;
  countries: string[];
  entities: string[];
}

export interface ResolvedRecipient {
  email: string;
  group: RecipientGroupId;
  /** Condition qui a déclenché l'envoi (pour le libellé du motif). */
  reason: NotificationCondition | 'escalation';
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function isValidEmail(value: string): boolean {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Mots-clés RH reconnus même si la catégorie n'est pas listée. */
const HR_KEYWORDS = ['ressources humaines', 'harcelement', 'discrimination', 'conditions de travail'];

export function matchesCondition(condition: NotificationCondition, facts: CaseNotificationFacts, settings: EmailNotificationSettings): boolean {
  switch (condition) {
    case 'always':
      return true;
    case 'critical':
      return facts.priority === 'very_high' || facts.priority === 'critical';
    case 'senior_implicated':
      return facts.implicatedLevels.some((l) => l === 'senior_manager' || l === 'director_plus');
    case 'hr': {
      const text = norm(`${facts.category} ${facts.subcategory ?? ''}`);
      return settings.hrCategories.some((c) => c && norm(c) === norm(facts.category)) || HR_KEYWORDS.some((k) => text.includes(k));
    }
  }
}

// === AMÉLIORATION AJOUTÉE (escalade automatique) ===
/** « Prénom Nom <adresse> » ou « adresse » → { name, email }. */
export function parseContact(entry: string): { name: string; email: string } {
  const m = /^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/.exec(entry);
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: entry.trim().toLowerCase() };
}

function nameTokens(name: string): string[] {
  return norm(name)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1);
}

/**
 * Même personne ? Tous les mots du nom le plus court se retrouvent dans
 * l'autre, avec au moins deux mots (prénom et nom) — « Jean Dupont » =
 * « DUPONT Jean » = « Jean-Marc Dupont » ≠ « Dupont ».
 */
export function namesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length < 2) return false;
  return short.every((t) => long.includes(t));
}

function positionMatches(position: string | undefined, keywords: string[] | undefined): boolean {
  if (!position || !keywords?.length) return false;
  const p = ` ${norm(position).replace(/[^a-z0-9]+/g, ' ')} `;
  return keywords.some((k) => {
    const kk = norm(k).replace(/[^a-z0-9]+/g, ' ').trim();
    return kk.length > 1 && p.includes(` ${kk} `);
  });
}

/** Comptes du personnel désignés par leur nom parmi les personnes mises en cause. */
export function implicatedStaffUids(staff: StaffRecipientCandidate[], persons: { name?: string }[] | undefined): string[] {
  if (!persons?.length) return [];
  return staff.filter((s) => s.name && persons.some((p) => namesMatch(p.name, s.name))).map((s) => s.uid);
}

/** Niveau (groupe) mis en cause : un de ses membres est nommé, ou sa fonction est citée. */
export function isGroupImplicated(group: RecipientGroup, facts: CaseNotificationFacts, staff: StaffRecipientCandidate[]): boolean {
  const persons = facts.implicatedPersons ?? [];
  if (!persons.length) return false;
  if (persons.some((p) => positionMatches(p.position, group.functionKeywords))) return true;
  const members = [
    ...staff.filter((s) => s.active && group.roles.includes(s.role)).map((s) => s.name ?? ''),
    ...group.extraEmails.map((e) => parseContact(e).name),
  ].filter(Boolean);
  return persons.some((p) => members.some((m) => namesMatch(p.name, m)));
}

/** Un enquêteur est mis en cause (nom d'un compte enquêteur ou fonction citée). */
export function areInvestigatorsImplicated(settings: EmailNotificationSettings, facts: CaseNotificationFacts, staff: StaffRecipientCandidate[]): boolean {
  const persons = facts.implicatedPersons ?? [];
  if (!persons.length) return false;
  if (persons.some((p) => positionMatches(p.position, settings.investigatorKeywords ?? DEFAULT_INVESTIGATOR_KEYWORDS))) return true;
  const names = staff.filter((s) => s.active && s.role === 'investigator' && s.name).map((s) => s.name as string);
  return persons.some((p) => names.some((n) => namesMatch(p.name, n)));
}

/**
 * Acheminement d'un dossier : niveaux mis en cause, règle appliquée (celle du
 * niveau le plus élevé mis en cause, sinon « personne »), et groupes
 * destinataires — jamais un groupe mis en cause. Si tous les destinataires
 * prévus sont mis en cause, les autres niveaux non mis en cause sont retenus.
 */
export function routingPlan(
  settings: EmailNotificationSettings,
  facts: CaseNotificationFacts,
  staff: StaffRecipientCandidate[]
): { routingCase: RoutingCase; implicated: Exclude<RoutingCase, 'none'>[]; recipients: RecipientGroupId[] } {
  const implicated: Exclude<RoutingCase, 'none'>[] = [];
  if (areInvestigatorsImplicated(settings, facts, staff)) implicated.push('investigators');
  for (const g of settings.groups) if (isGroupImplicated(g, facts, staff)) implicated.push(g.id);
  const routingCase: RoutingCase = implicated.length
    ? implicated.reduce((a, b) => (ROUTING_RANK[b] > ROUTING_RANK[a] ? b : a))
    : 'none';
  const routing = { ...DEFAULT_ROUTING, ...(settings.routing ?? {}) };
  let recipients = (routing[routingCase] ?? []).filter((g) => !implicated.includes(g));
  if (!recipients.length) {
    recipients = (['darc', 'dga', 'drh', 'supervisors'] as RecipientGroupId[]).filter((g) => !implicated.includes(g)).slice(0, 2);
  }
  return { routingCase, implicated, recipients };
}

function inScope(staff: StaffRecipientCandidate, facts: CaseNotificationFacts): boolean {
  if (staff.countries.length && !staff.countries.includes(facts.country)) return false;
  if (staff.entities.length && !staff.entities.includes(facts.entity)) return false;
  return true;
}

/**
 * Destinataires d'un événement pour un dossier. Ne prévient jamais : l'auteur
 * de l'action, une personne mise en cause dans le dossier (compte rattaché),
 * un compte désactivé ou hors de son périmètre. Une adresse n'apparaît
 * qu'une fois (premier groupe qui la retient).
 */
export function resolveNotificationRecipients(input: {
  event: NotificationEvent;
  facts: CaseNotificationFacts;
  settings: EmailNotificationSettings;
  staff: StaffRecipientCandidate[];
  excludedUids?: string[];
  excludedEmails?: string[];
}): ResolvedRecipient[] {
  const { event, facts, settings, staff } = input;
  const excludedUids = new Set(input.excludedUids ?? []);
  const excludedEmails = new Set((input.excludedEmails ?? []).map((e) => e.trim().toLowerCase()));
  for (const s of staff) if (excludedUids.has(s.uid) && s.email) excludedEmails.add(s.email.toLowerCase());
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];
  const add = (email: string, group: RecipientGroupId, reason: NotificationCondition | 'escalation') => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e) || seen.has(e) || excludedEmails.has(e)) return;
    seen.add(e);
    out.push({ email: e, group, reason });
  };
  // === AMÉLIORATION AJOUTÉE (escalade automatique) === personnes nommées
  // dans le signalement : jamais prévenues ; niveaux mis en cause écartés,
  // remplacés par le niveau supérieur de la chaîne.
  for (const uid of implicatedStaffUids(staff, facts.implicatedPersons)) excludedUids.add(uid);
  for (const s of staff) if (excludedUids.has(s.uid) && s.email) excludedEmails.add(s.email.toLowerCase());
  const plan = routingPlan(settings, facts, staff);
  const conditionFor = (group: RecipientGroup, allowAlways = true): NotificationCondition | undefined =>
    (group.events[event] ?? []).find((c) => (allowAlways || c !== 'always') && matchesCondition(c, facts, settings));
  const routedByDefault = new Set((settings.routing?.none ?? DEFAULT_ROUTING.none) as RecipientGroupId[]);
  // L'événement concerne-t-il les destinataires habituels ? (ex. clôture → oui)
  const baseWouldNotify = settings.groups.some((g) => g.enabled && routedByDefault.has(g.id) && conditionFor(g));

  for (const group of settings.groups) {
    if (!group.enabled) continue;
    if (plan.implicated.includes(group.id)) continue; // niveau mis en cause : jamais prévenu
    let reason: NotificationCondition | 'escalation' | undefined;
    if (plan.recipients.includes(group.id)) {
      // destinataire prévu pour ce dossier : ses propres règles, ou celles des
      // destinataires habituels qu'il remplace (escalade)
      reason = conditionFor(group) ?? (plan.routingCase !== 'none' && baseWouldNotify ? 'escalation' : undefined);
      if (plan.routingCase !== 'none' && !routedByDefault.has(group.id) && reason === 'always') reason = 'escalation';
    } else if (plan.routingCase !== 'none' && routedByDefault.has(group.id)) {
      // destinataire habituel écarté par l'acheminement (ex. superviseurs
      // quand un enquêteur est mis en cause) : seulement « le cas échéant »
      reason = conditionFor(group, false);
    } else {
      // autres niveaux (ex. DGA, DRH) : leurs propres règles (critique, RH…)
      reason = conditionFor(group);
    }
    if (!reason) continue;
    for (const s of staff) {
      if (!s.active || !group.roles.includes(s.role) || excludedUids.has(s.uid) || !inScope(s, facts)) continue;
      add(s.email, group.id, reason);
    }
    for (const e of group.extraEmails) {
      const contact = parseContact(e);
      if (contact.name && (facts.implicatedPersons ?? []).some((p) => namesMatch(p.name, contact.name))) continue;
      add(contact.email, group.id, reason);
    }
  }
  return out;
}

const EVENT_TITLE: Record<NotificationEvent, string> = {
  new_report: 'Nouveau signalement',
  assigned: 'Dossier attribué',
  escalated: 'Dossier escaladé',
  closed: 'Dossier clôturé',
  reopened: 'Dossier rouvert',
};
const EVENT_SENTENCE: Record<NotificationEvent, string> = {
  new_report: 'Un nouveau signalement a été reçu',
  assigned: 'Un dossier vient d’être attribué à un enquêteur',
  escalated: 'Un dossier vient d’être escaladé',
  closed: 'Un dossier vient d’être clôturé',
  reopened: 'Un dossier vient d’être rouvert',
};
export const GROUP_LABEL: Record<RecipientGroupId, string> = {
  supervisors: 'Superviseur',
  darc: 'DARC',
  dga: 'Directeur Général Adjoint',
  drh: 'Directeur des Ressources Humaines',
};
const REASON_LABEL: Record<NotificationCondition | 'escalation', string> = {
  always: '',
  escalation: 'escalade automatique, un niveau inférieur étant concerné par le signalement',
  critical: 'dossier de priorité très élevée ou critique',
  hr: 'dossier relevant des Ressources Humaines',
  senior_implicated: 'personne de rang Direction mise en cause',
};
const PRIORITY_LABEL: Record<CasePriority, string> = { low: 'Faible', high: 'Élevée', very_high: 'Très élevée', critical: 'Critique' };
// === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) === couleur de la pastille de priorité.
const PRIORITY_TONE: Record<CasePriority, EmailTone> = { low: 'neutral', high: 'warning', very_high: 'high', critical: 'danger' };

/** Sujet et corps de l'e-mail (texte brut, sans aucun détail sensible). */
export function buildNotificationEmail(input: {
  event: NotificationEvent;
  facts: CaseNotificationFacts;
  group: RecipientGroupId;
  reason: NotificationCondition | 'escalation';
  appUrl: string;
}): { subject: string; body: string; html: string } {
  const { event, facts, group, reason, appUrl } = input;
  const link = `${appUrl.replace(/\/+$/, '')}/cases/${encodeURIComponent(facts.reference)}`;
  const why = REASON_LABEL[reason] ? ` — motif : ${REASON_LABEL[reason]}` : '';
  // === AMÉLIORATION AJOUTÉE (message simplifié) === sujet court : le nom de
  // l'expéditeur (« ACTIVA Whistleblowing ») porte déjà la marque.
  const subject = `${EVENT_TITLE[event]} — ${facts.reference}`;
  const body = [
    'Bonjour,',
    '',
    `${EVENT_SENTENCE[event]} : dossier ${facts.reference}.`,
    '',
    `Entité : ${facts.entity} (${facts.country})`,
    `Catégorie : ${facts.category}`,
    `Priorité : ${PRIORITY_LABEL[facts.priority] ?? facts.priority}`,
    '',
    `Vous recevez ce message en tant que ${GROUP_LABEL[group]}${why}.`,
    '',
    `Consulter le dossier dans le portail sécurisé : ${link}`,
    '',
    'Pour des raisons de confidentialité, aucun détail du signalement n’est transmis par e-mail.',
    '— activa-whistleblowing (message automatique, ne pas répondre)',
  ].join('\n');
  // === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) === même contenu
  // en HTML : logo du site d'alerte, tableau du dossier, bouton vers la fiche.
  // === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) === bandeau
  // (événement, dossier, pastille de priorité), fiche en deux colonnes et
  // ligne discrète « pourquoi je reçois cet e-mail ».
  const priorityLabel = PRIORITY_LABEL[facts.priority] ?? facts.priority;
  const priorityTone = PRIORITY_TONE[facts.priority] ?? 'neutral';
  const html = renderBrandedEmailHtml({
    appUrl,
    title: `${EVENT_TITLE[event]} — ${facts.reference}`,
    preheader: `${EVENT_SENTENCE[event]} : dossier ${facts.reference}.`,
    eyebrow: EVENT_TITLE[event],
    // === AMÉLIORATION AJOUTÉE (message simplifié) === le numéro seul en titre,
    // la priorité dans le bandeau, deux informations dans la fiche.
    headline: facts.reference,
    badges: [{ label: `Priorité : ${priorityLabel}`, tone: priorityTone }],
    paragraphs: [`Bonjour, ${EVENT_SENTENCE[event].charAt(0).toLowerCase()}${EVENT_SENTENCE[event].slice(1)}.`],
    facts: [
      { label: 'Entité', value: `${facts.entity} (${facts.country})` },
      { label: 'Catégorie', value: facts.category },
    ],
    cta: { label: 'Consulter le dossier', url: link },
    note: 'Le détail du signalement n’est consultable que sur le portail sécurisé.',
    reason: `Vous recevez cet e-mail en tant que ${GROUP_LABEL[group]}${REASON_LABEL[reason] ? ` — motif : ${REASON_LABEL[reason]}` : ''}.`,
  });
  return { subject, body, html };
}

// === AMÉLIORATION AJOUTÉE (e-mail à l'enquêteur désigné) ===
/**
 * E-mail envoyé à chaque enquêteur nouvellement attribué à un dossier. Même
 * présentation que les autres notifications ; aucun détail sensible (ni faits,
 * ni identité du déclarant, ni personne mise en cause).
 */
export function buildInvestigatorAssignmentEmail(input: {
  facts: Pick<CaseNotificationFacts, 'reference' | 'entity' | 'country' | 'category' | 'priority'>;
  investigatorName?: string;
  appUrl: string;
}): { subject: string; body: string; html: string } {
  const { facts, appUrl } = input;
  const link = `${appUrl.replace(/\/+$/, '')}/cases/${encodeURIComponent(facts.reference)}`;
  const firstName = String(input.investigatorName ?? '').trim().split(/\s+/)[0] ?? '';
  const hello = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const priorityLabel = PRIORITY_LABEL[facts.priority] ?? facts.priority;
  const priorityTone = PRIORITY_TONE[facts.priority] ?? 'neutral';
  const subject = `Dossier attribué — ${facts.reference}`;
  const body = [
    hello,
    '',
    `Le dossier ${facts.reference} vient de vous être attribué : vous en êtes l’enquêteur désigné.`,
    '',
    `Entité : ${facts.entity} (${facts.country})`,
    `Catégorie : ${facts.category}`,
    `Priorité : ${priorityLabel}`,
    '',
    `Ouvrir le dossier dans le portail sécurisé : ${link}`,
    '',
    'Le détail du signalement n’est consultable que sur le portail sécurisé.',
    '— activa-whistleblowing (message automatique, ne pas répondre)',
  ].join('\n');
  const html = renderBrandedEmailHtml({
    appUrl,
    title: subject,
    preheader: `Le dossier ${facts.reference} vient de vous être attribué.`,
    eyebrow: 'Dossier attribué',
    headline: facts.reference,
    badges: [{ label: `Priorité : ${priorityLabel}`, tone: priorityTone }],
    paragraphs: [`${hello} ce dossier vient de vous être attribué : vous en êtes l’enquêteur désigné.`],
    facts: [
      { label: 'Entité', value: `${facts.entity} (${facts.country})` },
      { label: 'Catégorie', value: facts.category },
    ],
    cta: { label: 'Ouvrir le dossier', url: link },
    note: 'Le détail du signalement n’est consultable que sur le portail sécurisé.',
    reason: 'Vous recevez cet e-mail car ce dossier vous a été attribué.',
  });
  return { subject, body, html };
}

/** Validation stricte des réglages enregistrés par un administrateur. */
export function sanitizeEmailNotificationSettings(raw: unknown): EmailNotificationSettings {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid notification settings.');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.groups)) throw new Error('groups must be a list.');
  const groups: RecipientGroup[] = RECIPIENT_GROUP_IDS.map((id) => {
    const g = (r.groups as Record<string, unknown>[]).find((x) => x && x.id === id) ?? {};
    const def = DEFAULT_EMAIL_NOTIFICATION_SETTINGS.groups.find((d) => d.id === id)!;
    const roles = Array.isArray(g.roles) ? (g.roles as unknown[]).filter((x): x is RoleId => NOTIFIABLE_ROLES.includes(x as RoleId)) : def.roles;
    const extra = Array.isArray(g.extraEmails) ? (g.extraEmails as unknown[]) : [];
    if (extra.length > 30) throw new Error('Too many addresses.');
    const extraEmails = [
      ...new Set(
        extra
          .map((e) => parseContact(String(e)))
          .filter((c) => c.email)
          .map((c) => (c.name ? `${c.name.slice(0, 120)} <${c.email}>` : c.email))
      ),
    ];
    const bad = extraEmails.map((e) => parseContact(e).email).find((e) => !isValidEmail(e));
    if (bad) throw new Error(`Invalid address: ${bad}`);
    const functionKeywords = Array.isArray(g.functionKeywords)
      ? [...new Set((g.functionKeywords as unknown[]).map((k) => String(k).trim()).filter((k) => k && k.length <= 80))].slice(0, 20)
      : DEFAULT_FUNCTION_KEYWORDS[id];
    const events: RecipientGroup['events'] = {};
    const rawEvents = g.events && typeof g.events === 'object' ? (g.events as Record<string, unknown>) : {};
    for (const ev of NOTIFICATION_EVENTS) {
      const conds = Array.isArray(rawEvents[ev]) ? (rawEvents[ev] as unknown[]).filter((c): c is NotificationCondition => NOTIFICATION_CONDITIONS.includes(c as NotificationCondition)) : [];
      if (conds.length) events[ev] = [...new Set(conds)];
    }
    return { id, enabled: g.enabled !== false, roles: [...new Set(roles)], extraEmails, functionKeywords, events };
  });
  const hrCategories = Array.isArray(r.hrCategories)
    ? [...new Set((r.hrCategories as unknown[]).map((c) => String(c).trim()).filter((c) => c && c.length <= 200))].slice(0, 50)
    : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.hrCategories;
  const rawRouting = r.routing && typeof r.routing === 'object' ? (r.routing as Record<string, unknown>) : {};
  const routing = {} as Record<RoutingCase, RecipientGroupId[]>;
  for (const c of ROUTING_CASES) {
    const v = rawRouting[c];
    routing[c] = Array.isArray(v)
      ? [...new Set(v.filter((x): x is RecipientGroupId => RECIPIENT_GROUP_IDS.includes(x as RecipientGroupId)))]
      : DEFAULT_ROUTING[c];
  }
  const investigatorKeywords = Array.isArray(r.investigatorKeywords)
    ? [...new Set((r.investigatorKeywords as unknown[]).map((k) => String(k).trim()).filter((k) => k && k.length <= 80))].slice(0, 20)
    : DEFAULT_INVESTIGATOR_KEYWORDS;
  return { groups, hrCategories, routing, investigatorKeywords };
}
