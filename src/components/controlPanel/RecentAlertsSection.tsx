/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Tableau « Alertes récentes » (8 derniers dossiers).
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 * `recentAlertsColumns` déplacé ici (seul utilisateur).
 */
import React from 'react';
import { Inbox } from 'lucide-react';
import type { AlertRecord, Language } from '../../types';
import { formatCountryLabel } from '../../data/activaConfig';
import { storage } from '../../services/storage';
import { computeSlaStatus } from '../../services/statusMapping';
import { trData } from '../../i18n/dataLabels';
import { DataTable, StatusBadge } from '../ui';
import type { DataTableColumn } from '../ui';
import type { CasesFilter } from './dashboardHelpers';
// === AMÉLIORATION AJOUTÉE (revue PR #139) === détection des résumés du vrai backend.
import { isCaseSummary } from '../../domain/caseToAlertSummary';

interface RecentAlertsSectionProps {
  t: Record<string, string>;
  lang: Language;
  locale: string;
  onNavigateToCases: (filter?: CasesFilter) => void;
  recentAlerts: AlertRecord[];
}

export const RecentAlertsSection: React.FC<RecentAlertsSectionProps> = ({
  t,
  lang,
  locale,
  onNavigateToCases,
  recentAlerts,
}) => {
  const recentAlertsColumns: DataTableColumn<AlertRecord>[] = [
    { key: 'id', header: t.cp_col_case_id, render: (r) => <span className="font-bold text-blue-700">{r.trackingNumber}</span> },
    { key: 'date', header: t.cp_col_date, render: (r) => new Date(r.createdAt).toLocaleDateString(locale), hideOnMobile: true },
    { key: 'category', header: t.cp_col_category, render: (r) => trData(r.category, lang) },
    { key: 'country', header: t.cp_col_country, render: (r) => formatCountryLabel(storage.getCountries(), r.country), hideOnMobile: true },
    { key: 'entity', header: t.cp_col_entity, render: (r) => r.concernedEntity, hideOnMobile: true },
    {
      key: 'priority',
      header: t.cp_col_priority,
      render: (r) => {
        const p = r.overridePriority || r.riskEvaluation.priority;
        const color = p === 'critique' ? '#e11d48' : p === 'tres_elevee' ? '#ea580c' : p === 'elevee' ? '#d97706' : '#64748b';
        return <span className="text-[11px] font-bold" style={{ color }}>{t[`priority_${p}` as keyof typeof t]}</span>;
      },
    },
    { key: 'risk', header: t.cp_col_risk_score, render: (r) => `${r.riskEvaluation.totalScore}/16`, hideOnMobile: true },
    { key: 'status', header: t.cp_col_status, render: (r) => <StatusBadge status={r.status === 'corrective_action' ? 'closed' : (r.status as any)} label={t[`status_${r.status}` as keyof typeof t] ?? r.status} size="sm" /> },
    { key: 'assigned', header: t.cp_col_assigned, render: (r) => r.assignedInvestigatorNames.join(', ') || t.cp_unassigned_tag, hideOnMobile: true },
    {
      key: 'sla',
      header: t.cp_col_sla,
      render: (r) => {
        const s = computeSlaStatus(r);
        const cls = s === 'overdue' ? 'text-rose-700 font-bold' : s === 'at_risk' ? 'text-amber-700 font-semibold' : 'text-slate-500';
        return <span className={cls}>{r.targetCompletionDate ? new Date(r.targetCompletionDate).toLocaleDateString(locale) : '—'}</span>;
      },
    },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Inbox className="w-4 h-4 text-blue-700" />
          {t.cp_section_recent_alerts}
        </h3>
        <button onClick={() => onNavigateToCases()} className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1">
          {t.cp_view_all}
        </button>
      </div>
      <DataTable
        columns={recentAlertsColumns}
        rows={recentAlerts}
        getRowKey={(r) => r.id}
        // === AMÉLIORATION AJOUTÉE (revue PR #139) === un résumé du vrai backend
        // n'a pas encore de fiche locale : pas de navigation vers une fiche vide.
        onRowClick={(r) => { if (!isCaseSummary(r)) onNavigateToCases({ trackingNumber: r.trackingNumber }); }}
        emptyTitle={t.cp_empty_recent_alerts}
      />
    </section>
  );
};
