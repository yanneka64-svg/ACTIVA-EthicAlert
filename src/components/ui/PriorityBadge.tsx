/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 *
 * Shared priority/NOCA badge primitive, extracted from
 * `InvestigationDesk.getPriorityBadge`'s exact existing pattern (rounded
 * rectangle, bold uppercase, color per NOCA level) — same consolidation
 * rationale as StatusBadge.
 */
import React from 'react';
import { PriorityLevel } from '../../types';

const PRIORITY_STYLES: Record<PriorityLevel, { bg: string; text: string; border: string }> = {
  critique: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  tres_elevee: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  elevee: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  faible: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

interface PriorityBadgeProps {
  priority: PriorityLevel;
  label: string;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, label, size = 'sm' }) => {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.faible;
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`rounded font-bold border ${style.bg} ${style.text} ${style.border} ${sizing}`}>
      {label}
    </span>
  );
};

// Reusable numeric NOCA-band color, for places that need only the color
// (e.g. a risk-score chip) without the full badge component — mirrors
// InvestigationDesk's inline NOCA-threshold color logic (rose/orange/amber/slate).
export function nocaColor(totalScore: number): { bg: string; text: string; border: string } {
  if (totalScore >= 14) return PRIORITY_STYLES.critique;
  if (totalScore >= 11) return PRIORITY_STYLES.tres_elevee;
  if (totalScore >= 7) return PRIORITY_STYLES.elevee;
  return PRIORITY_STYLES.faible;
}
