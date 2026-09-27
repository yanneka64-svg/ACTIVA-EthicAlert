/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Rangée de graphiques « Indicateurs avancés » (tendance 7j/30j/12m,
 * catégories, priorités).
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 */
import React from 'react';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';
import { EmptyState, MiniLineChart, MiniDonutChart, MiniBarChart } from '../ui';
import type { TrendPoint, DonutSlice, BarDatum } from '../ui';
import type { TrendRange } from './dashboardHelpers';

interface AdvancedChartsRowProps {
  t: Record<string, string>;
  totalCount: number;
  trendRange: TrendRange;
  setTrendRange: React.Dispatch<React.SetStateAction<TrendRange>>;
  trendData: TrendPoint[];
  categoryData: DonutSlice[];
  priorityBarData: BarDatum[];
}

export const AdvancedChartsRow: React.FC<AdvancedChartsRowProps> = ({
  t,
  totalCount,
  trendRange,
  setTrendRange,
  trendData,
  categoryData,
  priorityBarData,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            {t.cp_section_trend}
          </h3>
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5">
            {(['7d', '30d', '12m'] as TrendRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTrendRange(r)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${trendRange === r ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
              >
                {r === '7d' ? t.cp_trend_7d : r === '30d' ? t.cp_trend_30d : t.cp_trend_12m}
              </button>
            ))}
          </div>
        </div>
        <MiniLineChart data={trendData} />
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
          <Activity className="w-4 h-4 text-blue-700" />
          {t.cp_section_category}
        </h3>
        {categoryData.length === 0 ? (
          <EmptyState title={t.cp_empty_recent_alerts} />
        ) : (
          <div className="flex items-center gap-3">
            <MiniDonutChart data={categoryData} centerValue={totalCount} centerLabel={t.cp_kpi_total} />
            <ul className="space-y-1 min-w-0 flex-1">
              {categoryData.map((d, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[10px] text-slate-600 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="truncate flex-1">{d.label}</span>
                  <span className="font-bold text-slate-800 shrink-0">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
          <BarChart3 className="w-4 h-4 text-blue-700" />
          {t.cp_section_priority}
        </h3>
        <MiniBarChart data={priorityBarData} />
      </section>
    </div>
  );
};
