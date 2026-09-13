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
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
  if (!open) return null;
  const confirmDisabled = requireReason && reason.trim().length === 0;
  const confirmColor = tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className={`text-sm font-bold flex items-center gap-1.5 ${tone === 'danger' ? 'text-rose-700' : 'text-slate-900'}`}>
            {tone === 'danger' && <AlertTriangle className="w-4 h-4" />}
            {title}
          </h3>
          {description && <p className="text-slate-500 text-[11px] mt-0.5">{description}</p>}
        </div>

        {requireReason && (
          <div>
            {reasonLabel && <label className="block font-semibold text-slate-700 mb-1">{reasonLabel}</label>}
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
