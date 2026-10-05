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
  /** Adresses supplémentaires (ex. DGA, DRH sans compte sur le portail). */
  extraEmails: string[];
  /** Événement → conditions (une seule suffit). Absent ou vide = jamais. */
  events: Partial<Record<NotificationEvent, NotificationCondition[]>>;
}

export interface EmailNotificationSettings {
  groups: RecipientGroup[];
  /** Catégories de signalement qui relèvent des Ressources Humaines. */
  hrCategories: string[];
}

export const DEFAULT_EMAIL_NOTIFICATION_SETTINGS: EmailNotificationSettings = {
  groups: [
    {
      id: 'supervisors',
      enabled: true,
      roles: ['functional_admin', 'senior_investigator'],
      extraEmails: [],
      events: { new_report: ['always'], assigned: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] },
    },
    {
      id: 'darc',
      enabled: true,
      roles: ['darc_compliance'],
      extraEmails: [],
      events: { new_report: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] },
    },
    {
      id: 'dga',
      enabled: true,
      roles: [],
      extraEmails: [],
      events: { new_report: ['critical', 'senior_implicated'], escalated: ['always'], closed: ['critical', 'senior_implicated'] },
    },
    {
      id: 'drh',
      enabled: true,
      roles: [],
      extraEmails: [],
      events: { new_report: ['hr'], closed: ['hr'] },
    },
  ],
  hrCategories: ['Ressources Humaines et diversité'],
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
  reason: NotificationCondition;
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
  const add = (email: string, group: RecipientGroupId, reason: NotificationCondition) => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e) || seen.has(e) || excludedEmails.has(e)) return;
    seen.add(e);
    out.push({ email: e, group, reason });
  };
  for (const group of settings.groups) {
    if (!group.enabled) continue;
    const conditions = group.events[event] ?? [];
    const reason = conditions.find((c) => matchesCondition(c, facts, settings));
    if (!reason) continue;
    for (const s of staff) {
      if (!s.active || !group.roles.includes(s.role) || excludedUids.has(s.uid) || !inScope(s, facts)) continue;
      add(s.email, group.id, reason);
    }
    for (const e of group.extraEmails) add(e, group.id, reason);
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
const REASON_LABEL: Record<NotificationCondition, string> = {
  always: '',
  critical: 'dossier de priorité très élevée ou critique',
  hr: 'dossier relevant des Ressources Humaines',
  senior_implicated: 'personne de rang Direction mise en cause',
};
const PRIORITY_LABEL: Record<CasePriority, string> = { low: 'Faible', high: 'Élevée', very_high: 'Très élevée', critical: 'Critique' };

/** Sujet et corps de l'e-mail (texte brut, sans aucun détail sensible). */
export function buildNotificationEmail(input: {
  event: NotificationEvent;
  facts: CaseNotificationFacts;
  group: RecipientGroupId;
  reason: NotificationCondition;
  appUrl: string;
}): { subject: string; body: string } {
  const { event, facts, group, reason, appUrl } = input;
  const link = `${appUrl.replace(/\/+$/, '')}/cases/${encodeURIComponent(facts.reference)}`;
  const why = REASON_LABEL[reason] ? ` — motif : ${REASON_LABEL[reason]}` : '';
  const subject = `[activa-whistleblowing] ${EVENT_TITLE[event]} — ${facts.reference}`;
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
  return { subject, body };
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
    const extraEmails = [...new Set(extra.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
    const bad = extraEmails.find((e) => !isValidEmail(e));
    if (bad) throw new Error(`Invalid address: ${bad}`);
    const events: RecipientGroup['events'] = {};
    const rawEvents = g.events && typeof g.events === 'object' ? (g.events as Record<string, unknown>) : {};
    for (const ev of NOTIFICATION_EVENTS) {
      const conds = Array.isArray(rawEvents[ev]) ? (rawEvents[ev] as unknown[]).filter((c): c is NotificationCondition => NOTIFICATION_CONDITIONS.includes(c as NotificationCondition)) : [];
      if (conds.length) events[ev] = [...new Set(conds)];
    }
    return { id, enabled: g.enabled !== false, roles: [...new Set(roles)], extraEmails, events };
  });
  const hrCategories = Array.isArray(r.hrCategories)
    ? [...new Set((r.hrCategories as unknown[]).map((c) => String(c).trim()).filter((c) => c && c.length <= 200))].slice(0, 50)
    : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.hrCategories;
  return { groups, hrCategories };
}
