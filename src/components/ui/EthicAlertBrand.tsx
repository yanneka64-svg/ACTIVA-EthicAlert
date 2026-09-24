import React from 'react';

/**
 * === AMÉLIORATION AJOUTÉE : marque de la plateforme dans l'en-tête ===
 *
 * Icône ACTIVA EthicAlert (« A » bleu/vert + sifflet d'alerte) suivie du nom
 * « activa.whistleblowing ». Remplace le logo corporate ACTIVA dans la barre
 * de navigation uniquement ; `ActivaLogo` reste inchangé et toujours utilisé
 * par les vues d'impression (rapports PDF).
 *
 * Fichier : `public/brand/activa-ethicalert-mark.png` (fond transparent,
 * extrait de `activa-ethicalert-icon.png`). Couleurs du texte prélevées sur
 * l'icône : bleu #0F3291, vert #7DB724.
 */
interface EthicAlertBrandProps {
  /** Hauteur de l'icône (classe Tailwind). */
  className?: string;
}

export const EthicAlertBrand: React.FC<EthicAlertBrandProps> = ({ className = 'h-10' }) => (
  <span className="flex items-center gap-2 shrink-0">
    <img
      src="/brand/activa-ethicalert-mark.png"
      alt=""
      aria-hidden="true"
      className={`w-auto object-contain ${className}`}
    />
    <span className="text-[17px] sm:text-xl font-extrabold tracking-tight leading-none whitespace-nowrap">
      <span className="text-[#0F3291]">activa</span>
      <span className="text-[#7DB724]">.whistleblowing</span>
    </span>
  </span>
);
