import React from 'react';

/**
 * === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) ===
 *
 * Recréation vectorielle du logo Groupe ACTIVA fourni par l'utilisateur
 * (icône "montagne" à deux tons de vert, wordmark "Activa" en bleu,
 * accroche rouge "our clients our passion" et "passionnément clients" en
 * bleu). Aucun fichier image source n'étant disponible dans ce dépôt (le
 * logo a été partagé en pièce jointe de conversation, pas comme asset),
 * ce composant SVG en est une reproduction fidèle plutôt qu'un import
 * direct — à remplacer par le fichier réel si l'utilisateur le dépose
 * dans le projet (ex. `src/assets/activa-logo.svg`).
 */
interface ActivaLogoProps {
  className?: string;
  /** Hides the "our clients our passion" / "passionnément clients" tagline lines (compact contexts). */
  compact?: boolean;
}

export const ActivaLogo: React.FC<ActivaLogoProps> = ({ className = 'h-9', compact = false }) => (
  <svg
    viewBox={compact ? '0 0 150 34' : '0 0 150 46'}
    className={className}
    role="img"
    aria-label="ACTIVA — passionnément clients"
  >
    {/* Mountain / leaf mark */}
    <polygon points="6,26 16,6 23,18" fill="#F5A623" />
    <polygon points="14,26 26,4 38,26" fill="#1E7A34" />
    <polygon points="22,26 30,12 40,26" fill="#7AC142" />

    {/* "Activa" wordmark */}
    <text x="46" y="22" fontFamily="Arial, Helvetica, sans-serif" fontSize="21" fontWeight="800" fontStyle="italic" fill="#12429B">
      Activa
    </text>

    {!compact && (
      <>
        <text x="46" y="31" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.5" fontWeight="700" letterSpacing="0.5" fill="#E1261C">
          our clients our passion
        </text>
        <text x="6" y="42" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.5" fontWeight="700" fill="#12429B">
          passionnément clients
        </text>
      </>
    )}
  </svg>
);
