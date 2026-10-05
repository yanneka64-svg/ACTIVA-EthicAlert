/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) ===
 * Une modification faite en administration est envoyée au serveur ; la
 * configuration reçue du serveur est appliquée sans être renvoyée ; une
 * remise à zéro locale n'écrase jamais la configuration partagée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushSharedConfigSection = vi.fn();
vi.mock('./configSync', () => ({ pushSharedConfigSection }));

import { storage } from './storage';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('storage — configuration partagée', () => {
  beforeEach(() => pushSharedConfigSection.mockClear());

  it('une modification en administration est envoyée au serveur', async () => {
    const actor = storage.getActiveUser();
    const sla = storage.getSlaConfig();
    const key = Object.keys(sla).find((k) => typeof (sla as unknown as Record<string, unknown>)[k] === 'number')!;
    storage.updateSlaConfig({ [key]: 99 } as never, actor);
    await flush();
    await flush();
    expect(pushSharedConfigSection).toHaveBeenCalledWith('slaConfig', expect.objectContaining({ [key]: 99 }));
  });

  it('la configuration du serveur est appliquée sans être renvoyée', async () => {
    const entities = storage.getSharedConfigSection('entities') as unknown[];
    const changed = storage.applySharedConfigSection('entities', [...entities, { id: 'ent-srv', name: 'Entité serveur' }]);
    await flush();
    expect(changed).toBe(true);
    expect((storage.getSharedConfigSection('entities') as { id: string }[]).some((e) => e.id === 'ent-srv')).toBe(true);
    expect(pushSharedConfigSection).not.toHaveBeenCalled();
    expect(storage.applySharedConfigSection('entities', storage.getSharedConfigSection('entities'))).toBe(false);
  });

  it('une remise à zéro locale n’écrase pas la configuration partagée', async () => {
    storage.resetToFactory();
    await flush();
    expect(pushSharedConfigSection).not.toHaveBeenCalled();
  });
});
