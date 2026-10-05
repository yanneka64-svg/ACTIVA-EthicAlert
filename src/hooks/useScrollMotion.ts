/**
 * === AMÉLIORATION AJOUTÉE (accueil public — effet « ralenti » au défilement) ===
 *
 * Demande de l'utilisateur : sur la page d'accueil, un effet de ralenti doit
 * accompagner le défilement, vers le bas comme vers le haut.
 *
 * 1. Apparition au défilement, dans les deux sens : chaque élément
 *    `[data-reveal]` apparaît lentement quand il entre dans la zone visible et
 *    s'efface quand il en sort. Il réapparaît depuis le bas en descendant et
 *    depuis le haut en remontant (`data-reveal-from`).
 * 2. Parallaxe douce : la position de défilement est exposée en variable CSS
 *    `--sy` sur la racine ; la photo du hero glisse plus lentement que la page
 *    et le texte du hero s'éloigne en douceur (index.css, `activa-parallax-*`).
 *
 * Le défilement de l'application se fait dans `.activa-vt-main` (App.tsx), pas
 * dans la fenêtre. Sans IntersectionObserver, ou si l'utilisateur limite les
 * animations, tout reste simplement visible.
 */
import { useEffect, type RefObject } from 'react';

export function useScrollMotion(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => (el.dataset.revealState = 'in'));
      return;
    }
    // Les éléments ne sont masqués (index.css) qu'une fois ce script actif :
    // sans lui, rien ne reste invisible.
    root.classList.add('activa-motion-ready');

    // 1. Apparition / disparition au défilement.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            el.dataset.revealState = 'in';
          } else {
            // Sorti par le haut (on descend) ou par le bas (on remonte) :
            // il reviendra du même côté.
            const top = e.rootBounds?.top ?? 0;
            el.dataset.revealFrom = e.boundingClientRect.top < top ? 'above' : 'below';
            el.dataset.revealState = 'out';
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    items.forEach((el) => {
      el.dataset.revealFrom = 'below';
      io.observe(el);
    });

    // 2. Parallaxe : position de défilement en variable CSS (une fois par image).
    const scroller: HTMLElement | Window = (root.closest('.activa-vt-main') as HTMLElement | null) ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;
      root.style.setProperty('--sy', String(Math.max(0, Math.round(y))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      root.classList.remove('activa-motion-ready');
      io.disconnect();
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef]);
}
