/**
 * === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
 *
 * Fonctions pures de rattrapage des données chargées au démarrage
 * (entités sans `code`, catégories sans `code`/`active`, compteurs de
 * numérotation officielle alignés sur les dossiers existants), déplacées
 * telles quelles depuis les méthodes privées de StorageService — qui
 * existent toujours sous le même nom et délèguent ici. Chacune renvoie
 * l'objet d'entrée INCHANGÉ (même référence) quand il n'y a rien à
 * rattraper, contrat sur lequel storage.ts s'appuie pour ne repersister
 * que si nécessaire. Testées dans storageBackfill.test.ts.
 */
import type { AlertRecord } from '../types';
import type { EntityDef, CategoryDef } from '../data/activaConfig';

export function backfillEntityDefaults(defs: EntityDef[]): EntityDef[] {
  let changed = false;
  const next = defs.map((e) => {
    if (e.code) return e;
    changed = true;
    return { ...e, code: e.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'GRP' };
  });
  return changed ? next : defs;
}

export function seedCaseNumberCountersFromAlerts(counters: Record<string, number>, alerts: AlertRecord[]): Record<string, number> {
  let changed = false;
  const next = { ...counters };
  const pattern = /^([A-Z]+)-(\d{2})-(\d{2})-(\d{4})$/;
  for (const alert of alerts) {
    const match = pattern.exec(alert.trackingNumber ?? '');
    if (!match) continue;
    const [, entityCode, yy, mm, seqStr] = match;
    const key = `${entityCode}-${yy}${mm}`;
    const seq = parseInt(seqStr, 10);
    if (!next[key] || next[key] < seq) {
      next[key] = seq;
      changed = true;
    }
  }
  return changed ? next : counters;
}

export function backfillCategoryDefaults(cats: CategoryDef[]): CategoryDef[] {
  let changed = false;
  const next = cats.map((c, idx) => {
    if (c.code && c.active !== undefined) return c;
    changed = true;
    return {
      ...c,
      code: c.code ?? `CAT-${String(idx + 1).padStart(3, '0')}`,
      active: c.active ?? true,
    };
  });
  return changed ? next : cats;
}
