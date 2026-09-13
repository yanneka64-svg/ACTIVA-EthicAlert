/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 *
 * Shared KPI stat card — extracted from `InvestigationDesk`'s existing
 * "quick summary stats" grid pattern (`p-3 bg-{color}-50 rounded-xl
 * border border-{color}-200`, big bold number + small label), generalized
 * with an optional click handler so the Control Panel (Phase 5) can make
 * every KPI card navigate to a filtered case list, per the brief's
 * requirement that KPI cards be clickable.
 */
import React from 'react';

export type KpiTone = 'neutral' | 'blue' | 'amber' | 'rose' | 'orange' | 'emerald' | 'purple' | 'indigo';

const TONE_STYLES: Record<KpiTone, { bg: string; border: string; text: string }> = {
  neutral: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-[#0B2545]' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
};

interface KpiCardProps {
  value: string | number;
  label: string;
  tone?: KpiTone;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({ value, label, tone = 'neutral', onClick }) => {
  const style = TONE_STYLES[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-xl border text-center w-full ${style.bg} ${style.border} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:brightness-95 transition' : ''
      }`}
    >
      <div className={`text-xl sm:text-2xl font-extrabold ${style.text}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </Tag>
  );
};
