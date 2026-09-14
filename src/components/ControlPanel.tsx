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
 *
 * === AMÉLIORATION AJOUTÉE (Phase 6 — visual redesign to match the
 * supplied mockup) ===
 * Restyled to match the reference "Control Panel" screenshot: a period
 * selector + refresh affordance, a top action bar, richer KPI cards with
 * icons/subtext, a trend/category/priority/status chart row, an
 * SLA-monitoring + workload + attention + activity row, and a full
 * "Recent Alerts" table at the bottom. Every widget still reads only from
 * `storage.getAlerts()`/`storage.getAuditLogs()` computed live — nothing
 * below is a separate, hand-authored data source. No existing prop,
 * export, or navigation callback was removed; `onNavigateToNewCase` is a
 * new, additive prop.
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
  LayoutDashboard,
  RefreshCw,
  Plus,
  ListChecks,
  AlertOctagon,
  Bell,
  CalendarRange,
  ShieldAlert,
} from 'lucide-react';
import { AlertRecord, Language, PriorityLevel, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { computeSlaStatus } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { KpiCard, DataTable, EmptyState, StatusBadge, MiniLineChart, MiniDonutChart, MiniBarChart } from './ui';
import type { DataTableColumn, TrendPoint, DonutSlice, BarDatum } from './ui';

interface CasesFilter {
  status?: string;
  unassignedOnly?: boolean;
  overdueOnly?: boolean;
  trackingNumber?: string;
}

interface ControlPanelProps {
  lang: Language;
  activeUser: UserProfile;
  onNavigateToCases: (filter?: CasesFilter) => void;
  onNavigateToReports: () => void;
  // === AMÉLIORATION AJOUTÉE (Phase 6) === powers the "+ New Case" action
  // button — routes to the existing, real submission flow (`new_alert` tab)
  // rather than a fabricated staff-only creation screen.
  onNavigateToNewCase: () => void;
}

interface WorkloadRow {
  investigator: UserProfile;
  active: number;
  overdue: number;
  critical: number;
}

const ACTIVE_STATUSES: AlertRecord['status'][] = ['new', 'under_review', 'investigation', 'corrective_action', 'reopened'];
const PRIORITY_RANK: Record<PriorityLevel, number> = { critique: 4, tres_elevee: 3, elevee: 2, faible: 1 };
const CATEGORY_PALETTE = ['#2563eb', '#6366f1', '#f97316', '#9333ea', '#0891b2', '#f43f5e', '#10b981', '#64748b', '#eab308', '#14b8a6'];

type PeriodKey = 'today' | '7d' | '30d' | 'quarter' | 'custom';
type TrendRange = '7d' | '30d' | '12m';

function localeOf(lang: Language): string {
  return lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
}

function getPeriodWindow(period: PeriodKey, customStart: string, customEnd: string) {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      break;
    case 'quarter':
      start = new Date(now.getTime() - 91 * 24 * 3600 * 1000);
      break;
    case 'custom':
      start = customStart ? new Date(customStart) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      end = customEnd ? new Date(customEnd) : now;
      break;
    case '30d':
    default:
      start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      break;
  }
  const spanMs = Math.max(1, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - spanMs);
  return { start, end, prevStart, prevEnd };
}

function inWindow(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// Real day/month bucketing of actual `createdAt` timestamps — no synthetic
// interpolation between buckets that have zero alerts.
function buildTrend(alerts: AlertRecord[], range: TrendRange, lang: Language): TrendPoint[] {
  const now = new Date();
  const locale = localeOf(lang);
  if (range === '12m') {
    const points: TrendPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = alerts.filter((a) => {
        const ad = new Date(a.createdAt);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      }).length;
      points.push({ label: d.toLocaleDateString(locale, { month: 'short' }), value: count });
    }
    return points;
  }
  const days = range === '7d' ? 7 : 30;
  const labelEvery = Math.ceil(days / 6);
  const points: TrendPoint[] = [];
  for (let idx = 0; idx < days; idx++) {
    const i = days - 1 - idx;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const count = alerts.filter((a) => {
      const ad = new Date(a.createdAt);
      return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth() && ad.getDate() === d.getDate();
    }).length;
    const showLabel = idx % labelEvery === 0 || idx === days - 1;
    points.push({ label: showLabel ? d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : '', value: count });
  }
  return points;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ lang, activeUser, onNavigateToCases, onNavigateToReports, onNavigateToNewCase }) => {
  const t = TRANSLATIONS[lang];
  const locale = localeOf(lang);
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [trendRange, setTrendRange] = useState<TrendRange>('7d');

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setAlerts(storage.getAlerts());
      setLastRefreshed(new Date());
    });
    return unsub;
  }, []);

  const handleRefresh = () => {
    setAlerts(storage.getAlerts());
    setLastRefreshed(new Date());
  };

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // `visible` vient désormais du hook partagé, qui applique en plus le
  // périmètre pays/entité et la confidentialité — voir
  // src/hooks/useVisibleAlerts.ts. `isGlobalViewer` reste calculé
  // séparément : encore utilisé plus bas pour le filtre du fil d'activité
  // (ligne ~250).
  const isGlobalViewer = isGlobalCaseViewer(activeUser);
  const visible = useVisibleAlerts(alerts, activeUser);

  // --- KPIs ---
  const totalCount = visible.length;
  const newCount = visible.filter((a) => a.status === 'new').length;
  const unassignedCount = visible.filter((a) => a.assignedInvestigators.length === 0 && ACTIVE_STATUSES.includes(a.status)).length;
  const criticalCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'critique').length;
  const veryHighCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'tres_elevee').length;
  const lowCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'faible').length;
  const highCount = visible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'elevee').length;
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
  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === permission `cases.edit`
  // plutôt que 2 rôles codés en dur — voir InvestigationDesk.tsx pour le
  // même remplacement.
  const investigatorUsers = storage.getUsers().filter((u) => userCan(u, 'cases.edit'));
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

  // === AMÉLIORATION AJOUTÉE (Phase 6) === period-scoped delta for the Total
  // Alerts KPI ("+X% vs previous period") — a real comparison of alerts
  // created in the selected window vs. the immediately preceding window of
  // equal length, never a fabricated percentage.
  const { start: periodStart, end: periodEnd, prevStart, prevEnd } = getPeriodWindow(period, customStart, customEnd);
  const currentPeriodCount = visible.filter((a) => inWindow(a.createdAt, periodStart, periodEnd)).length;
  const previousPeriodCount = visible.filter((a) => inWindow(a.createdAt, prevStart, prevEnd)).length;
  const totalDeltaPct = previousPeriodCount === 0 ? (currentPeriodCount > 0 ? 100 : 0) : Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);

  // === AMÉLIORATION AJOUTÉE (Phase 6) === chart data, all derived live.
  const trendData = buildTrend(visible, trendRange, lang);

  const categoryCounts = new Map<string, number>();
  visible.forEach((a) => categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1));
  const categoryData: DonutSlice[] = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

  const priorityBarData: BarDatum[] = [
    { label: t.priority_faible, value: lowCount, color: '#94a3b8' },
    { label: t.priority_elevee, value: highCount, color: '#f59e0b' },
    { label: t.priority_tres_elevee, value: veryHighCount, color: '#f97316' },
    { label: t.priority_critique, value: criticalCount, color: '#f43f5e' },
  ];

  // === AMÉLIORATION AJOUTÉE (Phase 6) === "most urgent" / "requires
  // attention" lists — ranked by real priority + SLA state, each row deep
  // links straight to that case via the trackingNumber filter.
  const priorityRankOf = (a: AlertRecord) => PRIORITY_RANK[a.overridePriority || a.riskEvaluation.priority];
  const urgentCases = visible
    .filter((a) => ACTIVE_STATUSES.includes(a.status))
    .slice()
    .sort((a, b) => {
      const diff = priorityRankOf(b) - priorityRankOf(a);
      if (diff !== 0) return diff;
      const da = a.targetCompletionDate ? new Date(a.targetCompletionDate).getTime() : Infinity;
      const db = b.targetCompletionDate ? new Date(b.targetCompletionDate).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 5);

  const attentionCases = visible
    .filter(
      (a) =>
        ACTIVE_STATUSES.includes(a.status) &&
        (computeSlaStatus(a) === 'overdue' || (a.overridePriority || a.riskEvaluation.priority) === 'critique' || a.assignedInvestigators.length === 0)
    )
    .sort((a, b) => {
      const diff = priorityRankOf(b) - priorityRankOf(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  const recentAlerts = visible
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const hoursAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
  const receivedAgoLabel = (iso: string) => {
    const h = hoursAgo(iso);
    return h < 1 ? t.cp_received_recently : t.cp_received_hours_ago.replace('{h}', String(h));
  };

  const workloadColumns: DataTableColumn<WorkloadRow>[] = [
    { key: 'investigator', header: t.cp_workload_investigator, render: (r) => <span className="font-semibold">{r.investigator.name}</span> },
    { key: 'active', header: t.cp_workload_active, render: (r) => r.active },
    { key: 'overdue', header: t.cp_workload_overdue, render: (r) => <span className={r.overdue > 0 ? 'text-rose-700 font-bold' : ''}>{r.overdue}</span> },
    { key: 'critical', header: t.cp_workload_critical, render: (r) => <span className={r.critical > 0 ? 'text-rose-700 font-bold' : ''}>{r.critical}</span>, hideOnMobile: true },
  ];

  const recentAlertsColumns: DataTableColumn<AlertRecord>[] = [
    { key: 'id', header: t.cp_col_case_id, render: (r) => <span className="font-bold text-blue-700">{r.trackingNumber}</span> },
    { key: 'date', header: t.cp_col_date, render: (r) => new Date(r.createdAt).toLocaleDateString(locale), hideOnMobile: true },
    { key: 'category', header: t.cp_col_category, render: (r) => r.category },
    { key: 'country', header: t.cp_col_country, render: (r) => r.country, hideOnMobile: true },
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

  const periodOptions: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: t.cp_period_today },
    { key: '7d', label: t.cp_period_7d },
    { key: '30d', label: t.cp_period_30d },
    { key: 'quarter', label: t.cp_period_quarter },
    { key: 'custom', label: t.cp_period_custom },
  ];

  return (
    <div className="max-w-[1500px] mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0B2545] text-amber-400 flex items-center justify-center shrink-0 shadow-md ring-2 ring-blue-900/20">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{t.cp_title}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live DARC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t.cp_subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
                  period === opt.key
                    ? 'bg-[#0B2545] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {opt.key === 'custom' && <CalendarRange className="w-3 h-3" />}
                {opt.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-800"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-800"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline">
              {t.cp_last_updated}: {lastRefreshed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" /> {t.cp_refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={onNavigateToNewCase}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-extrabold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {t.cp_action_new_case}
        </button>
        <button
          onClick={() => onNavigateToCases({ status: 'new' })}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 transition shadow-2xs cursor-pointer"
        >
          <Inbox className="w-4 h-4 text-blue-600" /> {t.cp_qa_review_new}
          {newCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
              {newCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigateToCases({ unassignedOnly: true })}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-amber-300 hover:bg-amber-50/40 transition shadow-2xs cursor-pointer"
        >
          <ListChecks className="w-4 h-4 text-amber-600" /> {t.cp_action_triage}
          {unassignedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
              {unassignedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigateToCases({ overdueOnly: true })}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50/40 transition shadow-2xs cursor-pointer"
        >
          <Flame className="w-4 h-4 text-rose-600" /> {t.cp_qa_view_overdue}
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold">
              {overdueCount}
            </span>
          )}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          value={totalCount}
          label={t.cp_kpi_total}
          tone="neutral"
          onClick={() => onNavigateToCases()}
          icon={<Inbox className="w-3.5 h-3.5" />}
          sub={
            <span className={totalDeltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {totalDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(totalDeltaPct)}% {t.cp_kpi_delta_vs_previous}
            </span>
          }
        />
        <KpiCard
          value={newCount}
          label={t.cp_kpi_new}
          tone="blue"
          onClick={() => onNavigateToCases({ status: 'new' })}
          icon={<Bell className="w-3.5 h-3.5" />}
          sub={<span className="text-blue-600">↑ {t.cp_kpi_sub_new}</span>}
        />
        <KpiCard
          value={unassignedCount}
          label={t.cp_kpi_unassigned}
          tone="amber"
          onClick={() => onNavigateToCases({ unassignedOnly: true })}
          icon={<UserX className="w-3.5 h-3.5" />}
          sub={<span className="text-amber-600">↑ {t.cp_kpi_sub_unassigned}</span>}
        />
        <KpiCard
          value={criticalCount}
          label={t.cp_kpi_critical}
          tone="rose"
          icon={<AlertOctagon className="w-3.5 h-3.5" />}
          sub={<span className="text-rose-600">↑ {t.cp_kpi_sub_critical}</span>}
        />
        <KpiCard
          value={overdueCount}
          label={t.cp_kpi_overdue}
          tone="rose"
          onClick={() => onNavigateToCases({ overdueOnly: true })}
          icon={<Clock3 className="w-3.5 h-3.5" />}
          sub={<span className="text-rose-600">↑ {t.cp_kpi_sub_overdue}</span>}
        />
        <KpiCard
          value={correctiveOpen + correctiveInProgress}
          label={t.cp_kpi_open_corrective}
          tone="indigo"
          onClick={() => onNavigateToCases({ status: 'corrective_action' })}
          icon={<FileCheck2 className="w-3.5 h-3.5" />}
          sub={
            correctiveOverdue > 0 ? (
              <span className="text-rose-600">
                ↑ {correctiveOverdue} {t.cp_kpi_sub_corrective_overdue}
              </span>
            ) : (
              <span className="text-slate-400">{t.cp_kpi_sub_corrective_none}</span>
            )
          }
        />
      </div>

      {/* Charts row */}
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
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${trendRange === r ? 'bg-white shadow-sm text-blue-700' : 'text-slate-400'}`}
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
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{t.cp_section_urgent}</p>
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
                    <span className="text-slate-400 shrink-0">
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
                      <p className="text-[10px] text-slate-400 mt-0.5">{receivedAgoLabel(a.createdAt)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

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
                  {new Date(log.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-700">{log.details}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent alerts table */}
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
          onRowClick={(r) => onNavigateToCases({ trackingNumber: r.trackingNumber })}
          emptyTitle={t.cp_empty_recent_alerts}
        />
      </section>

      {/* Quick actions */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-700" />
          {t.cp_section_quick_actions}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
  );
};
