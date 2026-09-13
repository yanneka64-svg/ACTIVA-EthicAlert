import React from 'react';

/**
 * === AMÉLIORATION AJOUTÉE (Phase 15 — vrai fichier logo ACTIVA) ===
 *
 * Logo officiel du Groupe ACTIVA, récupéré directement depuis leur site
 * corporate (group-activa.com) — donc authentique, non redessiné. Fichiers
 * dans `public/brand/` :
 *  - `activa-logo.png` : version couleur, pour fonds clairs.
 *  - `activa-logo-white.png` : version blanche, pour fonds sombres (pied
 *    de page bleu marine).
 */
interface ActivaLogoProps {
  className?: string;
  /** Use the white variant for dark backgrounds (e.g. the navy footer). */
  variant?: 'color' | 'white';
}

export const ActivaLogo: React.FC<ActivaLogoProps> = ({ className = 'h-10', variant = 'color' }) => (
  <img
    src={variant === 'white' ? '/brand/activa-logo-white.png' : '/brand/activa-logo.png'}
    alt="ACTIVA — passionnément clients"
    className={`w-auto object-contain ${className}`}
  />
);
