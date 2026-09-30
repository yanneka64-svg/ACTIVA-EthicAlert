/**
 * === AMÉLIORATION AJOUTÉE (correctif — synchronisation Firestore) ===
 */
import { describe, expect, it } from 'vitest';
import { toFirestoreData } from './firestoreSanitize';

describe('toFirestoreData', () => {
  it('drops undefined properties at every depth and never mutates the input', () => {
    const input = { id: 'a', alertId: undefined, nested: { keep: 1, drop: undefined, deeper: [{ x: undefined, y: 'y' }] } };
    const out = toFirestoreData(input);
    expect(out).toEqual({ id: 'a', nested: { keep: 1, deeper: [{ y: 'y' }] } });
    expect('alertId' in out).toBe(false);
    expect('alertId' in input).toBe(true);
    expect(input.nested.deeper[0]).toHaveProperty('x');
  });

  it('keeps array positions (undefined → null), primitives, null and Dates', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(toFirestoreData({ a: [1, undefined, 'z'], n: null, z: 0, f: false, s: '', d })).toEqual({ a: [1, null, 'z'], n: null, z: 0, f: false, s: '', d });
  });

  it('ignores functions', () => {
    expect(toFirestoreData({ ok: 1, fn: () => 1 } as Record<string, unknown>)).toEqual({ ok: 1 });
  });
});
