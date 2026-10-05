/** === AMÉLIORATION AJOUTÉE (nouvelle version disponible) === */
import { describe, expect, it } from 'vitest';
import { isNewerBuild } from './appVersion';

describe('isNewerBuild', () => {
  it('détecte une version différente', () => {
    expect(isNewerBuild({ buildId: 'b2' }, 'b1')).toBe(true);
  });
  it('ignore la même version, une réponse invalide ou le mode développement', () => {
    expect(isNewerBuild({ buildId: 'b1' }, 'b1')).toBe(false);
    expect(isNewerBuild(null, 'b1')).toBe(false);
    expect(isNewerBuild({ buildId: '' }, 'b1')).toBe(false);
    expect(isNewerBuild({ buildId: 'b2' }, 'dev')).toBe(false);
  });
});
