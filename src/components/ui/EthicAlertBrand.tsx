import React from 'react';

/**
 * === AMÉLIORATION AJOUTÉE : marque de la plateforme dans l'en-tête ===
 *
 * Logo officiel « Activa.whistleblowing » (image fournie : « A » bleu/vert
 * avec sifflet d'alerte + nom). Remplace le logo corporate ACTIVA dans la
 * barre de navigation uniquement ; `ActivaLogo` reste inchangé et toujours
 * utilisé par les vues d'impression (rapports PDF).
 *
 * Fichier : `public/brand/activa-whistleblowing-logo.png` (fond transparent).
 * L'icône seule (onglet du navigateur) est `activa-ethicalert-icon.png`.
 */
interface EthicAlertBrandProps {
  /** Hauteur du logo (classe Tailwind). */
  className?: string;
}

export const EthicAlertBrand: React.FC<EthicAlertBrandProps> = ({ className = 'h-10' }) => (
  // === AMÉLIORATION AJOUTÉE : logo officiel complet (image fournie) ===
  // `activa-whistleblowing-logo.png` contient déjà le « A » + le nom : plus
  // de texte recomposé en CSS. Hauteur réduite sous `sm` (et largeur ≤ 40vw) pour que
  // l'en-tête mobile garde la place du sélecteur de langue et du profil.
  <img
    src="/brand/activa-whistleblowing-logo.png"
    alt="activa.whistleblowing"
    className={`w-auto max-w-[40vw] sm:max-w-none object-contain ${className.replace(/\bh-10\b/, 'h-6 sm:h-10')}`}
  />
);
