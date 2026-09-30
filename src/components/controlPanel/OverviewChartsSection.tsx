/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Évolution des signalements, répartition par statut, Top 5 pays et
 * Top 5 catégories (les deux rangées sous les cartes KPI).
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 * Rendu dans un fragment : les deux rangées restent des enfants directs
 * du conteneur `space-y-5` de ControlPanel.tsx, espacement identique.
 */
import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';
import { EmptyState, MiniLineChart, MiniDonutChart, MiniHBarList } from '../ui';
import type { TrendPoint, DonutSlice, HBarDatum } from '../ui';

interface OverviewChartsSectionProps {
  t: Record<string, string>;
  totalCount: number;
  mockupTrendData: TrendPoint[];
  statusBucketData: DonutSlice[];
  topCountries: HBarDatum[];
  topCategories: HBarDatum[];
}

export const OverviewChartsSection: React.FC<OverviewChartsSectionProps> = ({
  t,
  totalCount,
  mockupTrendData,
  statusBucketData,
  topCountries,
  topCategories,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            {t.db_section_evolution}
          </h3>
          <MiniLineChart data={mockupTrendData} color="#f97316" />
        </section>
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Activity className="w-4 h-4 text-blue-700" />
            {t.db_section_repartition_statut}
          </h3>
          {totalCount === 0 ? (
            <EmptyState title={t.cp_empty_recent_alerts} />
          ) : (
            <div className="flex items-center gap-4">
              <MiniDonutChart data={statusBucketData} centerValue={totalCount} centerLabel={t.db_kpi_total_label} />
              <ul className="space-y-1.5 min-w-0 flex-1">
                {statusBucketData.map((d, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="truncate flex-1">{d.label}</span>
                    <span className="font-bold text-slate-800 shrink-0">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-900 mb-3">{t.db_section_top_pays}</h3>
          {topCountries.length === 0 ? <EmptyState title={t.cp_empty_recent_alerts} /> : <MiniHBarList data={topCountries} />}
        </section>
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-900 mb-3">{t.db_section_top_categories}</h3>
          {topCategories.length === 0 ? <EmptyState title={t.cp_empty_recent_alerts} /> : <MiniHBarList data={topCategories} />}
        </section>
      </div>
    </>
  );
};
