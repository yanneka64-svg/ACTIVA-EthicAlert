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
 *
 * === AMÉLIORATION AJOUTÉE : nouvelle version du logo (image fournie) ===
 * Le fichier a été remplacé par le nouveau logo fourni (même nom, mêmes
 * proportions ~6,6:1, fond transparent, rogné au contenu). L'ancienne
 * version est conservée dans `activa-whistleblowing-logo-v1.png`.
 *
 * === AMÉLIORATION AJOUTÉE : logo « bulle + coche » (image fournie) ===
 * Nouveau remplacement du fichier (même nom). La version précédente est
 * conservée dans `activa-whistleblowing-logo-v2.png`. L'icône de l'onglet
 * (favicon) et l'image d'aperçu de partage (og-image.png) sont générées à
 * partir de ce même logo.
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
  // === AMÉLIORATION AJOUTÉE (alignement optique) === dans l'image, le « A »
  // occupe toute la hauteur mais le texte « ctiva.whistleblowing » est
  // dessiné dans la partie basse (centre à ~60 % de la hauteur) : centré
  // géométriquement, le texte paraissait ~4px plus bas que les liens et
  // boutons voisins. `-translate-y-[10%]` remonte le logo proportionnellement
  // à sa hauteur (mobile comme desktop), sans changer la mise en page.
  <img
    src="/brand/activa-whistleblowing-logo.png"
    alt="activa.whistleblowing"
    className={`w-auto max-w-[40vw] sm:max-w-none object-contain -translate-y-[10%] ${className.replace(/\bh-10\b/, 'h-6 sm:h-10')}`}
  />
);
