/**
 * === AMÉLIORATION AJOUTÉE (Phase 5 — frontend completion plan) ===
 *
 * Central Control Panel — the operational command center for the
 * Functional Administrator / Hotline Manager (brief §14-20). Every number
 * here is genuinely computed at render time from `storage.getAlerts()` /
 * `storage.getAuditLogs()` (the same real, live-synced data every other
 * staff screen already uses) — nothing is hardcoded or fabricated, unlike
 * the mock "enterprise architecture" backend removed from `main` earlier
 * this session. See docs/PHASES.md and the frontend-completion plan for
 * the full rationale (this screen deliberately stays on the existing
 * local AlertRecord model — the new Firestore Case model cannot power any
 * list view until Cloud Functions are deployed, a separate, already-made
 * decision).
 */
import React, { useEffect, useState } from 'react';
import {
  Inbox,
  UserX,
  Flame,
  TrendingUp,
  Clock3,
  Search,
  UserPlus,
  Eye,
  FileCheck2,
  BarChart3,
  Activity,
} from 'lucide-react';
import { AlertRecord, Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { computeSlaStatus } from '../services/statusMapping';
import { KpiCard, DataTable, EmptyState, StatusBadge } from './ui';
import type { DataTableColumn } from './ui';

interface ControlPanelProps {
  lang: Language;
  activeUser: UserProfile;
  onNavigateToCases: (filter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean }) => void;
  onNavigateToReports: () => void;
}

interface WorkloadRow {
  investigator: UserProfile;
  active: number;
  overdue: number;
  critical: number;
}

const ACTIVE_STATUSES: AlertRecord['status'][] = ['new', 'under_review', 'investigation', 'corrective_action', 'reopened'];

export const ControlPanel: React.FC<ControlPanelProps> = ({ lang, activeUser, onNavigateToCases, onNavigateToReports }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const isGlobalViewer = activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';
  const visible = alerts.filter((a) => isGlobalViewer || a.assignedInvestigators.includes(activeUser.id));

  // --- KPIs ---
  const totalCount = visible.length;
  const newCount = visible.filter((a) => a.status === 'new').length;
  const unassignedCount = visible.filter((a) => a.assignedInvestigators.length === 0 && ACTIVE_STATUSES.includes(a.status)).length;
  const criticalCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'critique').length;
  const veryHighCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'tres_elevee').length;
  const overdueCount = visible.filter((a) => computeSlaStatus(a) === 'overdue').length;

  // --- Alert management breakdown ---
  const STATUS_ORDER: AlertRecord['status'][] = ['new', 'under_review', 'investigation', 'corrective_action', 'closed', 'reopened', 'archived'];
  const statusBreakdown = STATUS_ORDER.map((status) => ({
    status,
    count: visible.filter((a) => a.status === status).length,
  }));

  // --- SLA monitoring ---
  const slaOnTrack = visible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'on_track').length;
  const slaAtRisk = visible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'at_risk').length;
  const slaOverdue = visible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'overdue').length;
  // "Escalated" has no dedicated legacy AlertStatus — approximated here as
  // overdue cases still not reassigned/closed, i.e. the ones a real
  // escalation policy would trigger on. Flagged rather than left unstated.
  const slaEscalated = visible.filter((a) => computeSlaStatus(a) === 'overdue' && a.status !== 'closed' && a.status !== 'archived' && a.assignedInvestigators.length === 0).length;

  // --- Investigation monitoring ---
  const activeInvestigations = visible.filter((a) => a.status === 'investigation').length;
  const pendingInfo = visible.filter((a) => a.status === 'under_review').length;
  const investigationOverdue = visible.filter((a) => a.status === 'investigation' && computeSlaStatus(a) === 'overdue').length;
  const investigationApproachingSla = visible.filter((a) => a.status === 'investigation' && computeSlaStatus(a) === 'at_risk').length;

  // --- Investigator workload ---
  const investigatorUsers = storage.getUsers().filter((u) => u.role === 'investigator' || u.role === 'functional_admin');
  const workload: WorkloadRow[] = investigatorUsers
    .map((inv) => {
      const assigned = alerts.filter((a) => a.assignedInvestigators.includes(inv.id) && ACTIVE_STATUSES.includes(a.status));
      return {
        investigator: inv,
        active: assigned.length,
        overdue: assigned.filter((a) => computeSlaStatus(a) === 'overdue').length,
        critical: assigned.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'critique').length,
      };
    })
    .filter((row) => row.active > 0)
    .sort((a, b) => b.active - a.active);

  // --- Corrective actions ---
  const allMeasures = visible.flatMap((a) => a.correctiveMeasures);
  const correctiveOpen = allMeasures.filter((m) => m.status === 'planned').length;
  const correctiveInProgress = allMeasures.filter((m) => m.status === 'in_progress').length;
  const correctiveCompleted = allMeasures.filter((m) => m.status === 'implemented' || m.status === 'verified').length;
  const correctiveOverdue = allMeasures.filter((m) => (m.status === 'planned' || m.status === 'in_progress') && new Date(m.dueDate).getTime() < Date.now()).length;

  // --- Recent activity (real audit_logs, scoped to what this user can see) ---
  const visibleTrackingNumbers = new Set(visible.map((a) => a.trackingNumber));
  const recentActivity = storage
    .getAuditLogs()
    .filter((log) => isGlobalViewer || (log.trackingNumber && visibleTrackingNumbers.has(log.trackingNumber)))
    .slice(0, 8);

  const workloadColumns: DataTableColumn<WorkloadRow>[] = [
    { key: 'investigator', header: t.cp_workload_investigator, render: (r) => <span className="font-semibold">{r.investigator.name}</span> },
    { key: 'active', header: t.cp_workload_active, render: (r) => r.active },
    { key: 'overdue', header: t.cp_workload_overdue, render: (r) => <span className={r.overdue > 0 ? 'text-rose-700 font-bold' : ''}>{r.overdue}</span> },
    { key: 'critical', header: t.cp_workload_critical, render: (r) => <span className={r.critical > 0 ? 'text-rose-700 font-bold' : ''}>{r.critical}</span>, hideOnMobile: true },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-700" />
          {t.cp_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.cp_subtitle}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard value={totalCount} label={t.cp_kpi_total} tone="neutral" onClick={() => onNavigateToCases()} />
        <KpiCard value={newCount} label={t.cp_kpi_new} tone="blue" onClick={() => onNavigateToCases({ status: 'new' })} />
        <KpiCard value={unassignedCount} label={t.cp_kpi_unassigned} tone="amber" onClick={() => onNavigateToCases({ unassignedOnly: true })} />
        <KpiCard value={criticalCount} label={t.cp_kpi_critical} tone="rose" />
        <KpiCard value={veryHighCount} label={t.cp_kpi_very_high} tone="orange" />
        <KpiCard value={overdueCount} label={t.cp_kpi_overdue} tone="rose" onClick={() => onNavigateToCases({ overdueOnly: true })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert management */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <Inbox className="w-4 h-4 text-blue-700" />
            {t.cp_section_alert_management}
          </h3>
          <div className="space-y-2">
            {statusBreakdown.map(({ status, count }) => (
              <button
                key={status}
                onClick={() => onNavigateToCases({ status })}
                disabled={count === 0}
                className="w-full flex items-center justify-between gap-2 py-1.5 disabled:cursor-default text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition"
              >
                <StatusBadge status={status === 'corrective_action' ? 'closed' : (status as any)} label={t[`status_${status}` as keyof typeof t] ?? status} size="sm" />
                <span className="text-sm font-bold text-slate-800">{count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* SLA monitoring */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <Clock3 className="w-4 h-4 text-blue-700" />
            {t.cp_section_sla}
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <KpiCard value={slaOnTrack} label={t.cp_sla_on_track} tone="emerald" />
            <KpiCard value={slaAtRisk} label={t.cp_sla_at_risk} tone="amber" />
            <KpiCard value={slaOverdue} label={t.cp_sla_overdue} tone="rose" />
            <KpiCard value={slaEscalated} label={t.cp_sla_escalated} tone="purple" />
          </div>
          <button
            onClick={() => onNavigateToCases({ overdueOnly: true })}
            className="w-full text-center py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs hover:bg-rose-100 transition"
          >
            {t.cp_view_overdue_cases}
          </button>
        </section>

        {/* Investigation monitoring */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <Search className="w-4 h-4 text-blue-700" />
            {t.cp_section_investigation}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard value={activeInvestigations} label={t.cp_stat_active} tone="purple" onClick={() => onNavigateToCases({ status: 'investigation' })} />
            <KpiCard value={pendingInfo} label={t.cp_stat_pending_info} tone="amber" onClick={() => onNavigateToCases({ status: 'under_review' })} />
            <KpiCard value={investigationOverdue} label={t.cp_stat_investigation_overdue} tone="rose" />
            <KpiCard value={investigationApproachingSla} label={t.cp_stat_approaching_sla} tone="amber" />
          </div>
        </section>

        {/* Corrective actions */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <FileCheck2 className="w-4 h-4 text-blue-700" />
            {t.cp_section_corrective}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard value={correctiveOpen} label={t.cp_corrective_open} tone="neutral" />
            <KpiCard value={correctiveOverdue} label={t.cp_corrective_overdue} tone="rose" />
            <KpiCard value={correctiveInProgress} label={t.cp_corrective_in_progress} tone="blue" />
            <KpiCard value={correctiveCompleted} label={t.cp_corrective_completed} tone="emerald" />
          </div>
        </section>
      </div>

      {/* Investigator workload */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-700" />
          {t.cp_section_workload}
        </h3>
        <DataTable
          columns={workloadColumns}
          rows={workload}
          getRowKey={(r) => r.investigator.id}
          onRowClick={(r) => onNavigateToCases()}
          emptyTitle={t.cp_empty_workload}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <Activity className="w-4 h-4 text-blue-700" />
            {t.cp_section_activity}
          </h3>
          {recentActivity.length === 0 ? (
            <EmptyState title={t.cp_empty_activity} />
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex gap-3 text-xs">
                  <span className="text-slate-400 font-mono shrink-0 w-12">
                    {new Date(log.timestamp).toLocaleTimeString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-slate-700">{log.details}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick actions */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-700" />
            {t.cp_section_quick_actions}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={() => onNavigateToCases({ status: 'new' })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <Inbox className="w-4 h-4 text-blue-600" /> {t.cp_qa_review_new}
            </button>
            <button onClick={() => onNavigateToCases({ unassignedOnly: true })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <UserX className="w-4 h-4 text-amber-600" /> {t.cp_qa_triage_unassigned}
            </button>
            <button onClick={() => onNavigateToCases()} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <UserPlus className="w-4 h-4 text-indigo-600" /> {t.cp_qa_assign_case}
            </button>
            <button onClick={() => onNavigateToCases({ overdueOnly: true })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <Flame className="w-4 h-4 text-rose-600" /> {t.cp_qa_view_overdue}
            </button>
            <button onClick={() => onNavigateToCases({ status: 'corrective_action' })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <Eye className="w-4 h-4 text-purple-600" /> {t.cp_qa_review_closure}
            </button>
            <button onClick={onNavigateToReports} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left">
              <BarChart3 className="w-4 h-4 text-emerald-600" /> {t.cp_qa_view_reports}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
