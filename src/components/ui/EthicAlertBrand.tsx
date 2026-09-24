import React from 'react';

/**
 * === AMÉLIORATION AJOUTÉE : marque de la plateforme dans l'en-tête ===
 *
 * Icône ACTIVA EthicAlert (« A » bleu/vert + sifflet d'alerte) utilisée comme
 * première lettre du nom « activa.whistleblowing ». Remplace le logo corporate ACTIVA dans la barre
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
  // === AMÉLIORATION AJOUTÉE === l'icône tient lieu de « A » initial :
  // lu « A » + « ctiva.whistleblowing ». Le nom complet reste exposé aux
  // lecteurs d'écran via aria-label (l'icône seule n'est pas une lettre).
  <span className="flex items-end shrink-0" role="img" aria-label="activa.whistleblowing">
    <img
      src="/brand/activa-ethicalert-mark.png"
      alt=""
      aria-hidden="true"
      className={`w-auto object-contain ${className}`}
    />
    <span
      aria-hidden="true"
      className="-ml-0.5 mb-[1px] text-[20px] sm:text-[26px] font-extrabold tracking-tight leading-none whitespace-nowrap"
    >
      <span className="text-[#0F3291]">ctiva</span>
      <span className="text-[#7DB724]">.whistleblowing</span>
    </span>
  </span>
);
