/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 *
 * Shared confirmation-dialog primitive, extracted verbatim from the modal
 * pattern already used throughout `InvestigationDesk` (reopen/close/assign
 * modals): `fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs` overlay,
 * `bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md` panel.
 * Existing modals are NOT rewritten to use this (out of scope, working
 * code) — this is for every *new* confirmation this plan adds (brief §53:
 * close/reassign/reopen/delete-evidence confirmations), so they're
 * consistent with each other from the start instead of each reinventing
 * the wrapper.
 *
 * === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 2, accessibilité) ===
 * BUG PRÉEXISTANT CORRIGÉ : aucune des fenêtres modales de l'application
 * (celle-ci comprise) ne gérait la touche Échap, ne piégeait le focus
 * clavier à l'intérieur, ni n'annonçait son rôle aux lecteurs d'écran.
 * Ce composant n'ayant encore aucun appelant réel (vérifié — jamais
 * importé ailleurs que dans ce fichier), il est renforcé ici sans risque
 * de régression visuelle sur un écran existant : `role="dialog"` +
 * `aria-modal` + `aria-labelledby`, fermeture au clavier (Échap), focus
 * posé sur le bouton par défaut à l'ouverture et restitué au déclencheur
 * à la fermeture. Utilise aussi le nouveau composant `<Button>` et les
 * tokens de couleur de `index.css` plutôt que des classes ad hoc.
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  requireReason?: boolean;
  reasonLabel?: string;
  reason?: string;
  onReasonChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

let dialogIdCounter = 0;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  requireReason = false,
  reasonLabel,
  reason = '',
  onReasonChange,
  onConfirm,
  onCancel,
}) => {
  const titleId = useRef(`confirm-dialog-title-${++dialogIdCounter}`).current;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Mémorise l'élément qui avait le focus avant l'ouverture, pour le lui
    // restituer à la fermeture (comportement standard des modales
    // accessibles — sans quoi le focus clavier "disparaît" dans la page).
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      triggerElementRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const confirmDisabled = requireReason && reason.trim().length === 0;
  const reasonId = `${titleId}-reason`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs"
      >
        <div className="border-b border-slate-100 pb-3">
          <h3 id={titleId} className={`text-sm font-bold flex items-center gap-1.5 ${tone === 'danger' ? 'text-critical' : 'text-slate-900'}`}>
            {tone === 'danger' && <AlertTriangle className="w-4 h-4" />}
            {title}
          </h3>
          {description && <p className="text-slate-500 text-[11px] mt-0.5">{description}</p>}
        </div>

        {requireReason && (
          <div>
            {reasonLabel && (
              <label htmlFor={reasonId} className="block font-semibold text-slate-700 mb-1">
                {reasonLabel}
              </label>
            )}
            <textarea
              id={reasonId}
              rows={4}
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button ref={cancelRef} type="button" variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
