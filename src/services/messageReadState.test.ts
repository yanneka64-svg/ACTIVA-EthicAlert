/** === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) === */
import { beforeEach, describe, expect, it } from 'vitest';
import { markConversationRead, readMap, unreadCount } from './messageReadState';

const msg = (id: string, sender: string, createdAt: string) => ({ id, sender, createdAt, content: 'x' }) as never;

const alert = {
  id: 'a1',
  messages: [
    msg('msg-init', 'whistleblower', '2026-10-05T08:00:00.000Z'),
    msg('m1', 'investigator', '2026-10-05T09:00:00.000Z'),
    msg('m2', 'whistleblower', '2026-10-05T10:00:00.000Z'),
    msg('m3', 'whistleblower', '2026-10-05T10:05:00.000Z'),
  ],
};

describe('unreadCount', () => {
  it('sans lecture enregistrée : messages du déclarant après la dernière réponse de l’équipe', () => {
    expect(unreadCount(alert, undefined)).toBe(2);
  });
  it('après lecture : seuls les messages plus récents', () => {
    expect(unreadCount(alert, '2026-10-05T10:01:00.000Z')).toBe(1);
    expect(unreadCount(alert, '2026-10-05T11:00:00.000Z')).toBe(0);
  });
  it('ignore le message automatique du dépôt', () => {
    expect(unreadCount({ messages: [alert.messages[0]] }, undefined)).toBe(0);
  });
});

describe('markConversationRead', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  it('enregistre la lecture par compte : plus aucun message non lu', () => {
    markConversationRead('u1', alert);
    expect(unreadCount(alert, readMap('u1').a1)).toBe(0);
    expect(readMap('u2').a1).toBeUndefined();
  });
});
