/** === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 3) === */
import { describe, expect, it } from 'vitest';
import { parsePortalConfigSection, serializePortalConfigSection } from './portalConfig';

describe('portalConfig', () => {
  it('accepte une liste ou un objet selon la section', () => {
    expect(serializePortalConfigSection('entities', [{ id: 'e1', name: 'ACTIVA' }]).json).toBe('[{"id":"e1","name":"ACTIVA"}]');
    expect(parsePortalConfigSection(serializePortalConfigSection('slaConfig', { triage: 2 }).json)).toEqual({ triage: 2 });
  });
  it.each([
    ['inconnue', []],
    ['entities', { id: 1 }],
    ['entities', [1, 2]],
    ['slaConfig', [1]],
    ['rolePermissions', null],
    ['categories', [{ x: 'y'.repeat(400 * 1024) }]],
  ])('refuse %s', (section, value) => {
    expect(() => serializePortalConfigSection(section, value)).toThrow();
  });
  it('une valeur illisible est ignorée', () => {
    expect(parsePortalConfigSection('{oops')).toBeNull();
    expect(parsePortalConfigSection(undefined)).toBeNull();
  });
});
