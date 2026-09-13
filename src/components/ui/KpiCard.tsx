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
  // === AMÉLIORATION AJOUTÉE (Phase 6 — Control Panel redesign) ===
  // Both optional and additive: existing callers that pass neither keep the
  // original centered compact card unchanged (still used by the SLA /
  // investigation / corrective-action mini stat grids). When either is
  // provided, the card switches to the mockup's left-aligned "header
  // icon + big number + delta line" layout — used only by the top-row
  // Control Panel KPI cards.
  icon?: React.ReactNode;
  sub?: React.ReactNode;
}

export const KpiCard: React.FC<KpiCardProps> = ({ value, label, tone = 'neutral', onClick, icon, sub }) => {
  const style = TONE_STYLES[tone];
  const Tag = onClick ? 'button' : 'div';
  const interactive = onClick ? 'cursor-pointer hover:shadow-md hover:brightness-95 transition' : '';

  if (icon || sub) {
    return (
      <Tag
        onClick={onClick}
        className={`p-4 rounded-2xl border text-left w-full bg-white border-slate-200 shadow-sm ${interactive}`}
      >
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`text-2xl sm:text-[28px] font-extrabold mt-2 ${style.text}`}>{value}</div>
        {sub && <div className="text-[11px] font-semibold mt-1 flex items-center gap-1 text-slate-500">{sub}</div>}
      </Tag>
    );
  }

  return (
    <Tag
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-xl border text-center w-full ${style.bg} ${style.border} ${interactive}`}
    >
      <div className={`text-xl sm:text-2xl font-extrabold ${style.text}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </Tag>
  );
};
