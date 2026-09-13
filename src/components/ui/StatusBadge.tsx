/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 *
 * Shared status-badge primitive, extracted from the exact pattern already
 * used ad hoc in `AlertTrackingView.renderStatusBadge` (rounded-full pill,
 * icon + label, color-coded per status) — not a new visual language, a
 * consolidation of the one that already exists so every future screen uses
 * the same component instead of re-copying the switch statement.
 *
 * Accepts an already-translated `label` (this app's i18n convention is
 * `TRANSLATIONS[lang].key` resolved by the caller, not looked up inside
 * shared components) and a `status` key used only to pick the color/icon.
 */
import React from 'react';
import { CheckCircle2, Clock, Search, FileCheck2, RotateCcw, Archive, AlertTriangle, HelpCircle } from 'lucide-react';

// Union of every status this app's two models can produce: the legacy
// AlertStatus values, plus the richer enterprise lifecycle statuses the
// frontend-completion brief asks for (mapped onto the legacy ones — see
// src/services/statusMapping.ts). Kept as plain strings (not imported types)
// so this component has zero dependency on either model — callers pass
// whichever status string they have.
export type BadgeStatus =
  | 'new'
  | 'triage'
  | 'under_review'
  | 'assigned'
  | 'investigation'
  | 'pending_information'
  | 'escalated'
  | 'conclusion_pending'
  | 'corrective_action'
  | 'functional_review'
  | 'closed'
  | 'reopened'
  | 'archived';

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
}

// One definition, reused everywhere — matches the brief's §46 status system
// and extends AlertTrackingView's original 6-color set to the fuller
// 12-status lifecycle without changing any of the original colors.
const STATUS_STYLES: Record<BadgeStatus, StatusStyle> = {
  new: { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-200', icon: Clock },
  triage: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200', icon: Search },
  under_review: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200', icon: Search },
  assigned: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200', icon: FileCheck2 },
  investigation: { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200', icon: Search },
  pending_information: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200', icon: HelpCircle },
  escalated: { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-200', icon: AlertTriangle },
  conclusion_pending: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200', icon: FileCheck2 },
  corrective_action: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200', icon: FileCheck2 },
  functional_review: { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200', icon: Search },
  closed: { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200', icon: CheckCircle2 },
  reopened: { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-200', icon: RotateCcw },
  archived: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: Archive },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'md' }) => {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.new;
  const Icon = style.icon;
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-3 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-bold border ${style.bg} ${style.text} ${style.border} ${sizing}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </span>
  );
};
