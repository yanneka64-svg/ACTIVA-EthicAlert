/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Rangée opérationnelle : statut des dossiers, suivi SLA + dossiers les
 * plus urgents, charge de travail des enquêteurs, dossiers nécessitant
 * une attention immédiate.
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 * `workloadColumns` déplacé ici (seul utilisateur).
 */
import React from 'react';
import { Clock3, Search, AlertOctagon, ShieldAlert } from 'lucide-react';
import type { AlertRecord, AlertStatus } from '../../types';
import type { WorkloadRow } from '../../domain/workloadCalc';
import { KpiCard, DataTable, EmptyState, StatusBadge } from '../ui';
import type { DataTableColumn } from '../ui';
import type { CasesFilter } from './dashboardHelpers';

interface OperationalPanelsProps {
  t: Record<string, string>;
  locale: string;
  onNavigateToCases: (filter?: CasesFilter) => void;
  statusBreakdown: { status: AlertStatus; count: number }[];
  slaOnTrack: number;
  slaAtRisk: number;
  slaOverdue: number;
  slaEscalated: number;
  urgentCases: AlertRecord[];
  workload: WorkloadRow[];
  attentionCases: AlertRecord[];
  receivedAgoLabel: (iso: string) => string;
}

export const OperationalPanels: React.FC<OperationalPanelsProps> = ({
  t,
  locale,
  onNavigateToCases,
  statusBreakdown,
  slaOnTrack,
  slaAtRisk,
  slaOverdue,
  slaEscalated,
  urgentCases,
  workload,
  attentionCases,
  receivedAgoLabel,
}) => {
  const workloadColumns: DataTableColumn<WorkloadRow>[] = [
    { key: 'investigator', header: t.cp_workload_investigator, render: (r) => <span className="font-semibold">{r.investigator.name}</span> },
    { key: 'active', header: t.cp_workload_active, render: (r) => r.active },
    { key: 'overdue', header: t.cp_workload_overdue, render: (r) => <span className={r.overdue > 0 ? 'text-rose-700 font-bold' : ''}>{r.overdue}</span> },
    { key: 'critical', header: t.cp_workload_critical, render: (r) => <span className={r.critical > 0 ? 'text-rose-700 font-bold' : ''}>{r.critical}</span>, hideOnMobile: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Case Status */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
          <ShieldAlert className="w-4 h-4 text-blue-700" />
          {t.cp_section_case_status}
        </h3>
        <div className="space-y-1">
          {statusBreakdown.map(({ status, count }) => (
            <button
              key={status}
              onClick={() => onNavigateToCases({ status })}
              disabled={count === 0}
              className="w-full flex items-center justify-between gap-2 py-1.5 disabled:cursor-default text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition"
            >
              <span className="flex items-center gap-2 text-[11px] text-slate-600 truncate">
                <StatusBadge status={status === 'corrective_action' ? 'closed' : (status as any)} label={t[`status_${status}` as keyof typeof t] ?? status} size="sm" />
              </span>
              <span className="text-xs font-extrabold text-slate-800">{count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* SLA monitoring + most urgent cases */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
          <Clock3 className="w-4 h-4 text-blue-700" />
          {t.cp_section_sla}
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <KpiCard value={slaOnTrack} label={t.cp_sla_on_track} tone="emerald" />
          <KpiCard value={slaAtRisk} label={t.cp_sla_at_risk} tone="amber" />
          <KpiCard value={slaOverdue} label={t.cp_sla_overdue} tone="rose" />
          <KpiCard value={slaEscalated} label={t.cp_sla_escalated} tone="purple" />
        </div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t.cp_section_urgent}</p>
        {urgentCases.length === 0 ? (
          <EmptyState title={t.cp_empty_urgent} />
        ) : (
          <ul className="space-y-1.5">
            {urgentCases.slice(0, 3).map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onNavigateToCases({ trackingNumber: a.trackingNumber })}
                  className="w-full flex items-center justify-between gap-2 text-[11px] hover:bg-slate-50 rounded-lg px-1.5 py-1 -mx-1.5 transition text-left"
                >
                  <span className="font-bold text-blue-700 truncate">{a.trackingNumber}</span>
                  <span className="text-slate-500 shrink-0">
                    {a.targetCompletionDate ? new Date(a.targetCompletionDate).toLocaleDateString(locale) : '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Investigator workload */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
          <Search className="w-4 h-4 text-blue-700" />
          {t.cp_section_workload}
        </h3>
        <DataTable
          columns={workloadColumns}
          rows={workload}
          getRowKey={(r) => r.investigator.id}
          onRowClick={() => onNavigateToCases()}
          emptyTitle={t.cp_empty_workload}
        />
      </section>

      {/* Requires immediate attention */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            {t.cp_section_attention}
          </h3>
          <button onClick={() => onNavigateToCases({ overdueOnly: true })} className="text-[10px] font-bold text-blue-700 hover:underline">
            {t.cp_view_all}
          </button>
        </div>
        {attentionCases.length === 0 ? (
          <EmptyState title={t.cp_empty_attention} />
        ) : (
          <ul className="space-y-2">
            {attentionCases.map((a) => {
              const p = a.overridePriority || a.riskEvaluation.priority;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onNavigateToCases({ trackingNumber: a.trackingNumber })}
                    className="w-full text-left hover:bg-slate-50 rounded-lg px-1.5 py-1 -mx-1.5 transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-blue-700 text-[11px]">{a.trackingNumber}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: p === 'critique' ? '#e11d48' : '#ea580c', backgroundColor: p === 'critique' ? '#ffe4e6' : '#ffedd5' }}>
                        {t[`priority_${p}` as keyof typeof t]}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{receivedAgoLabel(a.createdAt)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
