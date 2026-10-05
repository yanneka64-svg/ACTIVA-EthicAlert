/**
 * === AMÉLIORATION AJOUTÉE (revue design — transitions entre écrans) ===
 *
 * Enveloppe une navigation dans une transition visuelle douce (API View
 * Transitions du navigateur) : l'écran quittant s'estompe, le nouvel écran
 * apparaît en fondu avec une légère montée (styles : `::view-transition-*`
 * dans index.css). L'en-tête et le pied de page ne bougent pas.
 *
 * Aucune incidence sur la logique : la fonction de navigation est appelée
 * exactement une fois, à l'identique. Si le navigateur ne connaît pas cette
 * API, ou si l'utilisateur a demandé moins d'animations, la navigation est
 * simplement immédiate, comme avant.
 */
import { flushSync } from 'react-dom';

type StartViewTransition = (cb: () => void) => unknown;

export function withViewTransition(navigate: () => void): void {
  const start = (typeof document !== 'undefined'
    ? (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition
    : undefined);
  const reduced =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!start || reduced) {
    navigate();
    return;
  }
  try {
    start.call(document, () => {
      flushSync(navigate);
    });
  } catch {
    navigate();
  }
}
