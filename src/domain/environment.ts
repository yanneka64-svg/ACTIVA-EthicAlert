/**
 * === AMÉLIORATION AJOUTÉE (séparation test / production) ===
 *
 * Environnement d'exécution de l'application, déterminé au build :
 * - `production` : le site réel (activa-alertes.com), projet Firebase de production ;
 * - `staging`    : l'environnement de recette, projet Firebase DISTINCT, données fictives ;
 * - `development`: poste du développeur (serveur Vite local, émulateurs).
 *
 * Règle de sécurité : une version de test ne doit JAMAIS pointer vers le
 * projet de production (les testeurs y écriraient de faux signalements).
 * `environmentInfo` le détecte et le signale ; les scripts d'administration
 * refusent d'écrire des données de démonstration en production
 * (`assertNotProductionProject`).
 */

/** Projet Firebase de production. */
export const PRODUCTION_PROJECT_ID = 'activa-ethicalert-47246';

export type AppEnvironment = 'production' | 'staging' | 'development';

export interface EnvironmentInfo {
  env: AppEnvironment;
  /** Bandeau à afficher (null en production). */
  banner: null | { kind: 'staging' | 'development' | 'misconfigured'; label: string };
}

export function parseAppEnvironment(raw: unknown, isDevServer: boolean): AppEnvironment {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'production' || value === 'staging' || value === 'development') return value;
  return isDevServer ? 'development' : 'production';
}

/**
 * Environnement et bandeau d'avertissement à partir des variables de build
 * (VITE_APP_ENV, VITE_FIREBASE_PROJECT_ID) et du mode Vite.
 */
export function environmentInfo(input: { appEnv: unknown; projectId: unknown; isDevServer: boolean }): EnvironmentInfo {
  const env = parseAppEnvironment(input.appEnv, input.isDevServer);
  const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : '';
  if (env !== 'production' && projectId === PRODUCTION_PROJECT_ID) {
    return {
      env,
      banner: {
        kind: 'misconfigured',
        label: 'ATTENTION : cette version de test est reliée à la base de PRODUCTION. N’effectuez aucun test ici.',
      },
    };
  }
  if (env === 'staging') {
    return { env, banner: { kind: 'staging', label: 'Environnement de TEST — données fictives, aucun signalement réel n’est traité ici.' } };
  }
  if (env === 'development') {
    return { env, banner: { kind: 'development', label: 'Développement local' } };
  }
  return { env, banner: null };
}

/** Pour les scripts d'administration : refuse d'agir sur la production sans confirmation explicite. */
export function assertNotProductionProject(projectId: string | undefined, confirmation: string | undefined, action: string): void {
  if (projectId === PRODUCTION_PROJECT_ID && confirmation !== 'oui-production') {
    throw new Error(
      `Refusé : « ${action} » viserait le projet de PRODUCTION (${PRODUCTION_PROJECT_ID}). ` +
        'Utilisez le projet de test, ou ajoutez CONFIRM_PRODUCTION=oui-production si c’est vraiment voulu.'
    );
  }
}
