/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
 *
 * Configuration partagée par tous les postes : entités, pays, catégories,
 * délais (SLA), niveaux hiérarchiques, rôles et permissions, transitions de
 * statut, destinataires d'escalade. Jusqu'ici chaque navigateur avait sa
 * propre copie. Règles pures partagées par le navigateur et les Cloud
 * Functions (getPortalConfig / savePortalConfig).
 */
import { sanitizeEmailNotificationSettings } from './emailNotificationRules';

export const PORTAL_CONFIG_SECTIONS = [
  'entities',
  'countries',
  'categories',
  'slaConfig',
  'hierarchyLevels',
  'rolePermissions',
  'workflowTransitions',
  'escalationRecipients',
  // === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
  'emailNotifications',
] as const;
export type PortalConfigSection = (typeof PORTAL_CONFIG_SECTIONS)[number];

/** Une section de configuration ne dépasse jamais 300 Ko une fois sérialisée. */
export const PORTAL_CONFIG_MAX_BYTES = 300 * 1024;

const LIST_SECTIONS: PortalConfigSection[] = ['entities', 'countries', 'categories', 'escalationRecipients'];

export function isPortalConfigSection(value: unknown): value is PortalConfigSection {
  return typeof value === 'string' && (PORTAL_CONFIG_SECTIONS as readonly string[]).includes(value);
}

/**
 * Valide une section reçue par le serveur et renvoie sa forme sérialisée
 * (stockée telle quelle). Lève une Error explicite sinon.
 */
export function serializePortalConfigSection(section: unknown, value: unknown): { section: PortalConfigSection; json: string } {
  if (!isPortalConfigSection(section)) throw new Error('Unknown configuration section.');
  // === AMÉLIORATION AJOUTÉE (notifications e-mail) === validation stricte des adresses et règles.
  if (section === 'emailNotifications') value = sanitizeEmailNotificationSettings(value);
  const isList = LIST_SECTIONS.includes(section);
  if (isList ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Section ${section} must be ${isList ? 'a list' : 'an object'}.`);
  }
  if (isList && (value as unknown[]).some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Section ${section} must list objects.`);
  }
  const json = JSON.stringify(value);
  if (json.length > PORTAL_CONFIG_MAX_BYTES) throw new Error(`Section ${section} is too large.`);
  return { section, json };
}

/** Lecture d'une section sérialisée (null si absente ou illisible). */
export function parsePortalConfigSection(json: unknown): unknown {
  if (typeof json !== 'string') return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
