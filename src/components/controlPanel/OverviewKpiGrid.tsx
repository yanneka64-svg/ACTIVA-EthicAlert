/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Les 4 cartes KPI façon maquette (total + 3 paniers de statut).
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 */
import React from 'react';
import { Inbox, Clock3, Search, CheckCircle2 } from 'lucide-react';
import type { AlertStatusBucket } from '../../domain/alertStatusBuckets';
import { KpiCard } from '../ui';
import type { CasesFilter } from './dashboardHelpers';

interface OverviewKpiGridProps {
  t: Record<string, string>;
  onNavigateToCases: (filter?: CasesFilter) => void;
  totalCount: number;
  totalDeltaPct: number;
  bucketCounts: Record<AlertStatusBucket, number>;
  bucketDeltaPct: (bucket: AlertStatusBucket) => number;
}

export const OverviewKpiGrid: React.FC<OverviewKpiGridProps> = ({
  t,
  onNavigateToCases,
  totalCount,
  totalDeltaPct,
  bucketCounts,
  bucketDeltaPct,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        value={totalCount}
        label={t.db_kpi_total_label}
        tone="neutral"
        icon={<Inbox className="w-3.5 h-3.5" />}
        onClick={() => onNavigateToCases()}
        sub={
          <span className={totalDeltaPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
            {totalDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(totalDeltaPct)}%
          </span>
        }
      />
      <KpiCard
        value={bucketCounts.en_cours}
        label={t.db_bucket_en_cours}
        tone="blue"
        icon={<Search className="w-3.5 h-3.5" />}
        onClick={() => onNavigateToCases({ status: 'investigation' })}
        sub={
          <span className={bucketDeltaPct('en_cours') >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
            {bucketDeltaPct('en_cours') >= 0 ? '↑' : '↓'} {Math.abs(bucketDeltaPct('en_cours'))}%
          </span>
        }
      />
      <KpiCard
        value={bucketCounts.en_attente}
        label={t.db_bucket_en_attente}
        tone="amber"
        icon={<Clock3 className="w-3.5 h-3.5" />}
        onClick={() => onNavigateToCases({ status: 'corrective_action' })}
        sub={
          <span className={bucketDeltaPct('en_attente') >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
            {bucketDeltaPct('en_attente') >= 0 ? '↑' : '↓'} {Math.abs(bucketDeltaPct('en_attente'))}%
          </span>
        }
      />
      <KpiCard
        value={bucketCounts.clotures}
        label={t.db_bucket_clotures}
        tone="emerald"
        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        onClick={() => onNavigateToCases({ status: 'closed' })}
        sub={
          <span className={bucketDeltaPct('clotures') >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
            {bucketDeltaPct('clotures') >= 0 ? '↑' : '↓'} {Math.abs(bucketDeltaPct('clotures'))}%
          </span>
        }
      />
    </div>
  );
};
