/**
 * === AMÉLIORATION AJOUTÉE (nouvelle version disponible) ===
 * Identifiant de la version chargée dans le navigateur (injecté au build par
 * vite.config.ts) et comparaison avec /version.json, publié à chaque
 * déploiement. Permet de prévenir le personnel qu'une mise à jour existe
 * (sinon un onglet resté ouvert garde l'ancienne version du portail).
 */
declare const __APP_BUILD_ID__: string | undefined;

export const CURRENT_BUILD_ID: string = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev';

/** Vrai si le serveur annonce une version différente de celle chargée. */
export function isNewerBuild(remote: unknown, current: string = CURRENT_BUILD_ID): boolean {
  if (current === 'dev') return false;
  const id = remote && typeof remote === 'object' ? (remote as { buildId?: unknown }).buildId : undefined;
  return typeof id === 'string' && id.length > 0 && id !== current;
}

export async function fetchRemoteBuild(): Promise<unknown> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
