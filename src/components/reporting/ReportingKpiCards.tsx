/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Les 4 cartes d'indicateurs clés (CDC 3.1.4).
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';

interface ReportingKpiCardsProps {
  t: Record<string, string>;
  totalAlerts: number;
  activeAlerts: number;
  closedAlerts: number;
  resolutionRate: number;
  avgResolutionDays: number;
  anonymousPct: number;
  anonymousCount: number;
  identifiedCount: number;
}

export const ReportingKpiCards: React.FC<ReportingKpiCardsProps> = ({
  t,
  totalAlerts,
  activeAlerts,
  closedAlerts,
  resolutionRate,
  avgResolutionDays,
  anonymousPct,
  anonymousCount,
  identifiedCount,
}) => {
  return (
    <div id="report-anchor-activity" className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
          {t.rep_total_received}
        </div>
        <div className="text-3xl font-extrabold text-[#0B2545] mt-1">{totalAlerts}</div>
        <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <span className="font-semibold text-blue-700">{t.rep_active_n.replace('{n}', String(activeAlerts))}</span>
          <span>•</span>
          <span className="font-semibold text-emerald-700">{t.rep_resolved_n.replace('{n}', String(closedAlerts))}</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
          {t.rep_resolution_rate}
        </div>
        <div className="text-3xl font-extrabold text-emerald-700 mt-1">{resolutionRate}%</div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
          <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${resolutionRate}%` }} />
        </div>
      </div>

      <div id="report-anchor-sla" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
          {t.rep_avg_processing}
        </div>
        <div className="text-3xl font-extrabold text-blue-800 mt-1">{t.rep_avg_days.replace('{n}', String(avgResolutionDays))}</div>
        <div className="text-[11px] text-slate-500 mt-2">
          {t.rep_sla_goal}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
          {t.rep_anonymous}
        </div>
        <div className="text-3xl font-extrabold text-amber-700 mt-1">{anonymousPct}%</div>
        <div className="text-[11px] text-slate-500 mt-2">
          {t.rep_anon_vs_identified.replace('{a}', String(anonymousCount)).replace('{b}', String(identifiedCount))}
        </div>
      </div>
    </div>
  );
};
