import { describe, expect, it } from 'vitest';
import { PRODUCTION_PROJECT_ID, assertNotProductionProject, environmentInfo, parseAppEnvironment } from './environment';

describe('environment', () => {
  it('parseAppEnvironment : valeur explicite, sinon production (build) ou développement (serveur local)', () => {
    expect(parseAppEnvironment('staging', false)).toBe('staging');
    expect(parseAppEnvironment(' PRODUCTION ', true)).toBe('production');
    expect(parseAppEnvironment(undefined, false)).toBe('production');
    expect(parseAppEnvironment('', true)).toBe('development');
    expect(parseAppEnvironment('nimporte', false)).toBe('production');
  });

  it('production : aucun bandeau', () => {
    expect(environmentInfo({ appEnv: 'production', projectId: PRODUCTION_PROJECT_ID, isDevServer: false }).banner).toBeNull();
  });

  it('test sur un projet distinct : bandeau « environnement de test »', () => {
    const info = environmentInfo({ appEnv: 'staging', projectId: 'activa-ethicalert-staging', isDevServer: false });
    expect(info.env).toBe('staging');
    expect(info.banner?.kind).toBe('staging');
  });

  it('version de test reliée à la production : avertissement bloquant', () => {
    expect(environmentInfo({ appEnv: 'staging', projectId: PRODUCTION_PROJECT_ID, isDevServer: false }).banner?.kind).toBe('misconfigured');
    expect(environmentInfo({ appEnv: undefined, projectId: PRODUCTION_PROJECT_ID, isDevServer: true }).banner?.kind).toBe('misconfigured');
  });

  it('assertNotProductionProject : refuse la production sans confirmation', () => {
    expect(() => assertNotProductionProject(PRODUCTION_PROJECT_ID, undefined, 'seed')).toThrow(/PRODUCTION/);
    expect(() => assertNotProductionProject(PRODUCTION_PROJECT_ID, 'oui-production', 'seed')).not.toThrow();
    expect(() => assertNotProductionProject('activa-ethicalert-staging', undefined, 'seed')).not.toThrow();
    expect(() => assertNotProductionProject(undefined, undefined, 'seed')).not.toThrow();
  });
});
