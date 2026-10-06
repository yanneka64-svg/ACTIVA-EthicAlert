/**
 * === AMÉLIORATION AJOUTÉE (bleu ACTIVA sur toutes les fenêtres) ===
 *
 * Sur demande explicite : toutes les fenêtres publiques reprennent le fond
 * bleu de la page d'accueil (dégradé radial #2B63D6 → #1449B0 → #0D357F,
 * deux halos lumineux qui dérivent lentement, deux courbes fines), sans
 * pointillés.
 *
 * - `BrandBlueBackdrop` : calque décoratif à placer dans un parent
 *   `relative overflow-hidden`.
 * - `BrandPageHero` : bandeau bleu pleine largeur avec titre blanc, pour les
 *   pages de contenu (FAQ, Contact, Mentions légales, Confidentialité). Le
 *   contenu de la page vient ensuite chevaucher le bas du bandeau.
 */
import React from 'react';

export const BRAND_BLUE_GRADIENT =
  'bg-[radial-gradient(1200px_700px_at_85%_10%,#2B63D6_0%,#1449B0_45%,#0D357F_100%)]';

export const BrandBlueBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${BRAND_BLUE_GRADIENT} ${className}`}>
    <div className="activa-aurora absolute -right-40 -top-40 w-[720px] h-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(90_134_221/0.55),transparent)] blur-2xl" />
    <div className="activa-aurora-2 absolute right-[18%] bottom-[-260px] w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(127_188_10/0.14),transparent)] blur-2xl" />
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 640">
      <path d="M -40 560 C 380 470, 760 640, 1480 300" fill="none" stroke="rgb(255 255 255 / 0.10)" strokeWidth="1.5" />
      <path d="M -40 600 C 420 520, 820 680, 1480 360" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
    </svg>
  </div>
);

interface BrandPageHeroProps {
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Largeur max du contenu, alignée sur la page qui suit. */
  maxWidth?: string;
}

export const BrandPageHero: React.FC<BrandPageHeroProps> = ({ Icon, eyebrow, title, subtitle, maxWidth = 'max-w-7xl' }) => (
  <div className="relative overflow-hidden">
    <BrandBlueBackdrop />
    <div className={`relative ${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24 sm:pt-14 sm:pb-28`}>
      <div className="max-w-2xl">
        {Icon && (
          <span className="activa-enter inline-flex w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-inset ring-white/25 text-white items-center justify-center" style={{ '--d': '0ms' } as React.CSSProperties}>
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </span>
        )}
        {eyebrow && (
          <p className="activa-enter mt-4 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/80" style={{ '--d': '60ms' } as React.CSSProperties}>
            {eyebrow}
          </p>
        )}
        <h1 className="activa-enter mt-3 text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.1] text-white [text-wrap:balance]" style={{ '--d': '100ms' } as React.CSSProperties}>
          {title}
        </h1>
        {subtitle && (
          <p className="activa-enter mt-3 text-sm sm:text-base text-white/85 leading-relaxed" style={{ '--d': '200ms' } as React.CSSProperties}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  </div>
);
