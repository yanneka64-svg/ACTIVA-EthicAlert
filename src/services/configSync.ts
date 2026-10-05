/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
 *
 * Configuration partagée entre tous les postes (entités, pays, catégories,
 * SLA, niveaux hiérarchiques, rôles et permissions, transitions de statut,
 * destinataires d'escalade).
 * - `pullSharedConfig` : charge la configuration du serveur (à la connexion
 *   puis toutes les 5 min) et l'applique dans ce navigateur ; une section que
 *   le serveur ne connaît pas encore est envoyée par un administrateur (le
 *   premier qui se connecte partage ainsi sa configuration actuelle).
 * - `pushSharedConfigSection` : appelé par storage.ts à chaque modification
 *   faite en administration ; en cas d'échec réseau, conservé et renvoyé.
 */
import { isPortalConfigSection, parsePortalConfigSection, PORTAL_CONFIG_SECTIONS, type PortalConfigSection } from '../domain/portalConfig';
import type { UserProfile } from '../types';
import { getPhase4Firebase, getPhase4Functions, isPhase4Configured } from './firebaseClient';

const OUTBOX_KEY = 'activa_config_outbox_v1';

function readOutbox(): Partial<Record<PortalConfigSection, unknown>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeOutbox(outbox: Partial<Record<PortalConfigSection, unknown>>) {
  try {
    if (Object.keys(outbox).length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    else localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* stockage indisponible */
  }
}

function signedIn(): boolean {
  try {
    return isPhase4Configured() && Boolean(getPhase4Firebase().auth.currentUser);
  } catch {
    return false;
  }
}

async function callable<Req, Res>(name: string) {
  const functions = await getPhase4Functions();
  const { httpsCallable } = await import('firebase/functions');
  return httpsCallable<Req, Res>(functions, name);
}

let flushing = false;

/** Renvoie les sections modifiées pas encore enregistrées sur le serveur. */
export async function flushConfigOutbox(): Promise<void> {
  if (flushing || !signedIn()) return;
  const outbox = readOutbox();
  const sections = Object.keys(outbox).filter(isPortalConfigSection);
  if (!sections.length) return;
  flushing = true;
  try {
    const fn = await callable<{ section: PortalConfigSection; value: unknown }, { ok: true }>('savePortalConfig');
    for (const section of sections) {
      const value = outbox[section];
      try {
        await fn({ section, value });
        const current = readOutbox();
        if (JSON.stringify(current[section]) === JSON.stringify(value)) {
          delete current[section];
          writeOutbox(current);
        }
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'functions/permission-denied' || code === 'functions/invalid-argument') {
          const current = readOutbox();
          delete current[section];
          writeOutbox(current);
          console.warn('[configSync] configuration refusée par le serveur', section, e);
        }
      }
    }
  } catch {
    /* Firebase indisponible : nouvel essai plus tard */
  } finally {
    flushing = false;
  }
}

/** Point d'entrée de storage.ts : une section vient d'être modifiée en administration. */
export function pushSharedConfigSection(section: PortalConfigSection, value: unknown): void {
  writeOutbox({ ...readOutbox(), [section]: value });
  void flushConfigOutbox();
}

/**
 * Charge la configuration partagée et l'applique. Renvoie le nombre de
 * sections mises à jour dans ce navigateur.
 */
export async function pullSharedConfig(user: UserProfile): Promise<number> {
  if (!signedIn()) return 0;
  await flushConfigOutbox();
  const [{ storage }, { canManageConfiguration }] = await Promise.all([import('./storage'), import('./authz')]);
  let res: { sections: Record<string, string> };
  try {
    const fn = await callable<Record<string, never>, { sections: Record<string, string> }>('getPortalConfig');
    res = (await fn({})).data;
  } catch {
    return 0;
  }
  const pending = readOutbox();
  let applied = 0;
  for (const section of PORTAL_CONFIG_SECTIONS) {
    if (section in pending) continue; // modification locale pas encore enregistrée : elle l'emporte
    const value = parsePortalConfigSection(res.sections?.[section]);
    if (value !== null) {
      if (storage.applySharedConfigSection(section, value)) applied++;
    } else if (canManageConfiguration(user)) {
      pushSharedConfigSection(section, storage.getSharedConfigSection(section));
    }
  }
  return applied;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushConfigOutbox());
  setInterval(() => {
    if (Object.keys(readOutbox()).length) void flushConfigOutbox();
  }, 60 * 1000);
}
