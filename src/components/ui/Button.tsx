/**
 * === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 2, design system) ===
 *
 * Premier composant `<Button>` partagé de l'application. Jusqu'ici, chaque
 * écran recopiait sa propre chaîne de classes pour un bouton "primaire" —
 * l'audit a relevé au moins 4 nuances de survol différentes
 * (`hover:bg-[#134074]`, `hover:bg-[#123a63]`, `hover:bg-[#12294f]`, et une
 * variante en opacité `/90`) pour un rôle visuel identique, ainsi que des
 * rayons (`rounded-lg`/`rounded-xl`) et poids de police
 * (`font-bold`/`font-semibold`) incohérents d'un fichier à l'autre.
 *
 * Consomme les tokens de couleur ajoutés dans `index.css` (`@theme`,
 * `--color-brand`/`--color-critical`...) plutôt que des hex en dur.
 * `focus-visible:ring-2` est ajouté par défaut : avant ce composant, un
 * seul bouton dans toute l'application (StaffLoginView.tsx) définissait un
 * style de focus clavier explicite (relevé par l'audit accessibilité).
 *
 * N'IMPOSE RIEN de rétroactif : les écrans existants qui recopient encore
 * leur propre style de bouton ne sont pas modifiés par l'ajout de ce
 * composant — seuls les écrans explicitement migrés (voir l'audit, "Quick
 * wins") l'utilisent pour l'instant, sur les rôles de bouton les plus
 * visibles et les plus divergents (CTA principal du dépôt de signalement,
 * boutons de la Boîte de réception Opérateur).
 */
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône affichée avant le libellé (ex. `<Send className="w-3.5 h-3.5" />`). */
  icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand hover:bg-brand-hover text-white focus-visible:ring-brand',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus-visible:ring-slate-400',
  danger: 'bg-critical hover:bg-critical-hover text-white focus-visible:ring-critical',
  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — migration ConfirmDialog) ===
  // Reprend exactement la couleur du bouton "Demander des informations"
  // existant (bg-purple-600 hover:bg-purple-700), pour permettre à ce
  // modal de migrer vers ConfirmDialog sans changement visuel.
  accent: 'bg-purple-600 hover:bg-purple-700 text-white focus-visible:ring-purple-500',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-xs gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-xl font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
