/**
 * === AMÉLIORATION AJOUTÉE (revue design — chiffres clés animés) ===
 *
 * Affiche une valeur numérique qui « défile » en douceur jusqu'à sa valeur
 * (≈ 0,9 s, ralenti en fin de course). Les valeurs non numériques
 * (« 12 h », « — ») et les nombres décimaux sont affichées telles quelles.
 * Aucune animation si l'utilisateur limite les animations ou si
 * l'environnement ne sait pas le dire (tests) : la valeur finale est alors
 * affichée immédiatement, exactement comme avant.
 */
import React, { useEffect, useRef, useState } from 'react';

const DURATION_MS = 900;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function canAnimate(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (typeof window.requestAnimationFrame !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const CountUp: React.FC<{ value: string | number }> = ({ value }) => {
  const target = typeof value === 'number' ? value : /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const animate = target !== null && Number.isInteger(target) && target > 0 && canAnimate();
  const [shown, setShown] = useState<number | null>(animate ? 0 : null);
  const from = useRef(0);

  useEffect(() => {
    if (!animate || target === null) {
      setShown(null);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = easeOutExpo(Math.min(1, (now - start) / DURATION_MS));
      const v = Math.round(origin + (target - origin) * p);
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [animate, target]);

  if (shown === null || target === null) return <>{value}</>;
  return <>{typeof value === 'number' ? shown : String(shown)}</>;
};
