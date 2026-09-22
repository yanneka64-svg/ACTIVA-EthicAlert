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
  TrendingUp,
  Clock3,
  Search,
  BarChart3,
  Activity,
  LayoutDashboard,
  AlertOctagon,
  ShieldAlert,
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) ===
  CheckCircle2,
  // === AMÉLIORATION AJOUTÉE (Correction demandée — bouton Exporter) ===
  FileSpreadsheet,
} from 'lucide-react';
import { AlertRecord, Language, PriorityLevel, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { computeSlaStatus } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { formatCountryLabel } from '../data/activaConfig';
// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
import { ACTIVE_STATUSES, computeWorkload, WorkloadRow } from '../domain/workloadCalc';
// === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) === regroupement
// en 5 paniers de statut, partagé avec l'écran Dossiers (voir le fichier).
import { AlertStatusBucket, getAlertStatusBucket } from '../domain/alertStatusBuckets';
import { KpiCard, DataTable, EmptyState, StatusBadge, MiniLineChart, MiniDonutChart, MiniBarChart, MiniHBarList } from './ui';
import type { DataTableColumn, TrendPoint, DonutSlice, BarDatum, HBarDatum } from './ui';
// === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre de Pilotage) ===
import { ControlPanelPrintView } from './ControlPanelPrintView';

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


const PRIORITY_RANK: Record<PriorityLevel, number> = { critique: 4, tres_elevee: 3, elevee: 2, faible: 1 };
const CATEGORY_PALETTE = ['#2563eb', '#6366f1', '#f97316', '#9333ea', '#0891b2', '#f43f5e', '#10b981', '#64748b', '#eab308', '#14b8a6'];

type PeriodKey = 'today' | '7d' | '30d' | 'custom' | 'year' | 'all_time';
type TrendRange = '7d' | '30d' | '12m';

function localeOf(lang: Language): string {
  return lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
}

// === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi annuel) ===
// `year` (nouveau) : filtre le Centre de Pilotage (KPIs, graphiques,
// tableau) sur une année civile complète, en alternative au sélecteur de
// plage personnalisée — jamais les deux en même temps (voir le handler
// du <select> Année ci-dessous). `all_time` (nouveau, valeur par défaut) :
// aucun filtre, tout l'historique — remplace l'ancien défaut '30d' qui ne
// filtrait en réalité jamais l'affichage (seul le delta d'une carte KPI
// l'utilisait), d'où le libellé "30 jours" trompeur retiré du bouton.
function getPeriodWindow(period: PeriodKey, customStart: string, customEnd: string, selectedYear: number | null) {
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
    case 'custom':
      start = customStart ? new Date(customStart) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      end = customEnd ? new Date(customEnd) : now;
      break;
    case 'year': {
      const y = selectedYear ?? now.getFullYear();
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      break;
    }
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      break;
    case 'all_time':
    default:
      // Pas de borne réelle : couvre toute donnée existante sans exclure
      // les dossiers les plus anciens (voir `isScoped` plus bas, qui
      // n'applique ce filtre à l'affichage que pour 'custom'/'year').
      start = new Date(0);
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
  const [period, setPeriod] = useState<PeriodKey>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi annuel) ===
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>('7d');
  // === AMÉLIORATION AJOUTÉE (Correction demandée — bouton Exporter) ===
  // Remplace l'ancien bouton "Télécharger (CSV)" (mono-format) par un
  // bouton "Exporter" ouvrant le choix CSV/PDF — même modale/logique que
  // ReportingDashboard.tsx (mêmes clés i18n `export_modal_*`, jamais
  // dupliquées), adaptée aux données réellement affichées sur CET écran.
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  // === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre
  // de Pilotage) ===
  const [showPrintReport, setShowPrintReport] = useState(false);

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setAlerts(storage.getAlerts());
    });
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre
  // de Pilotage) === Laisse React monter ControlPanelPrintView (rendu
  // conditionnellement sur `showPrintReport`, plus bas) avant d'appeler
  // `window.print()`, qui n'imprime alors QUE ce contenu grâce aux règles
  // `.print-only`/`@media print` (index.css) — même mécanisme que
  // ReportingPrintView.tsx/CaseReportPrintView.tsx. Remplace l'appel direct
  // à `window.print()` de `handlePrint` (BUG PRÉEXISTANT CORRIGÉ :
  // imprimait toute la page — barre latérale, filtres compris).
  useEffect(() => {
    if (!showPrintReport) return;
    const timer = window.setTimeout(() => {
      window.print();
      setShowPrintReport(false);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [showPrintReport]);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // `visible` vient désormais du hook partagé, qui applique en plus le
  // périmètre pays/entité et la confidentialité — voir
  // src/hooks/useVisibleAlerts.ts. `isGlobalViewer` reste calculé
  // séparément : encore utilisé plus bas pour le filtre du fil d'activité
  // (ligne ~250).
  const isGlobalViewer = isGlobalCaseViewer(activeUser);
  const visible = useVisibleAlerts(alerts, activeUser);

  // === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi annuel) ===
  // `period`/`getPeriodWindow` calculé ici (déplacé plus haut qu'avant,
  // où il ne servait qu'au delta d'une seule carte KPI) pour pouvoir
  // dériver `scopedVisible` avant tous les calculs ci-dessous. `isScoped`
  // n'est vrai que pour 'custom'/'year' — 'all_time' (valeur par défaut)
  // et les branches historiques 'today'/'7d'/'30d' (jamais réellement
  // atteignables depuis l'interface aujourd'hui, boutons retirés — voir
  // getPeriodWindow) laissent `scopedVisible` égal à `visible`, comportement
  // par défaut inchangé (tout l'historique visible, comme avant ce filtre).
  const { start: periodStart, end: periodEnd, prevStart, prevEnd } = getPeriodWindow(period, customStart, customEnd, selectedYear);
  const isScoped = period === 'custom' || period === 'year';
  const scopedVisible = isScoped ? visible.filter((a) => inWindow(a.createdAt, periodStart, periodEnd)) : visible;

  // --- KPIs ---
  const totalCount = scopedVisible.length;
  const criticalCount = scopedVisible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'critique').length;
  const veryHighCount = scopedVisible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'tres_elevee').length;
  const lowCount = scopedVisible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'faible').length;
  const highCount = scopedVisible.filter((a) => (a.overridePriority || a.riskEvaluation.priority) === 'elevee').length;

  // --- Alert management breakdown ---
  const STATUS_ORDER: AlertRecord['status'][] = ['new', 'under_review', 'investigation', 'corrective_action', 'closed', 'reopened', 'archived'];
  const statusBreakdown = STATUS_ORDER.map((status) => ({
    status,
    count: scopedVisible.filter((a) => a.status === status).length,
  }));

  // --- SLA monitoring ---
  const slaOnTrack = scopedVisible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'on_track').length;
  const slaAtRisk = scopedVisible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'at_risk').length;
  const slaOverdue = scopedVisible.filter((a) => ACTIVE_STATUSES.includes(a.status) && computeSlaStatus(a) === 'overdue').length;
  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  // Remplace l'approximation précédente (dossiers en retard non réassignés,
  // documentée comme telle) par un vrai comptage : `workflowStatus` passe
  // désormais réellement à `'escalated'` via `storage.escalateAlert()`
  // (Phase 3/5), ce qui n'existait pas avant cette phase.
  const slaEscalated = scopedVisible.filter((a) => a.workflowStatus === 'escalated').length;

  // --- Investigation monitoring ---
  const activeInvestigations = scopedVisible.filter((a) => a.status === 'investigation').length;
  const pendingInfo = scopedVisible.filter((a) => a.status === 'under_review').length;
  const investigationOverdue = scopedVisible.filter((a) => a.status === 'investigation' && computeSlaStatus(a) === 'overdue').length;
  const investigationApproachingSla = scopedVisible.filter((a) => a.status === 'investigation' && computeSlaStatus(a) === 'at_risk').length;

  // --- Investigator workload ---
  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === permission `cases.edit`
  // plutôt que 2 rôles codés en dur — voir InvestigationDesk.tsx pour le
  // même remplacement.
  const investigatorUsers = storage.getUsers().filter((u) => userCan(u, 'cases.edit'));
  // === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
  // Calcul déplacé dans domain/workloadCalc.ts (réutilisé par le moteur
  // d'attribution) — comportement inchangé, y compris le filtre "au moins
  // 1 dossier actif" et le tri, propres à cet écran. Reste volontairement
  // sur `alerts` (jamais `scopedVisible`) : la charge de travail d'un
  // enquêteur est un instantané de MAINTENANT (dossiers actifs en ce
  // moment), pas une donnée historique qu'un filtre de période/année
  // devrait limiter — filtrer par année de création n'aurait aucun sens
  // pour "combien de dossiers cet enquêteur a-t-il actuellement en cours".
  const workload: WorkloadRow[] = computeWorkload(investigatorUsers, alerts)
    .filter((row) => row.active > 0)
    .sort((a, b) => b.active - a.active);

  // --- Corrective actions ---
  const allMeasures = scopedVisible.flatMap((a) => a.correctiveMeasures);
  const correctiveCompleted = allMeasures.filter((m) => m.status === 'implemented' || m.status === 'verified').length;

  // === AMÉLIORATION AJOUTÉE (Phase 6) === period-scoped delta for the Total
  // Alerts KPI ("+X% vs previous period") — a real comparison of alerts
  // created in the selected window vs. the immediately preceding window of
  // equal length, never a fabricated percentage. Reste sur `visible` (pas
  // `scopedVisible`) : la fenêtre "précédente" doit pouvoir remonter avant
  // le début de la période sélectionnée pour exister (ex. l'année N-1
  // entière pour un delta année sur année).
  const currentPeriodCount = visible.filter((a) => inWindow(a.createdAt, periodStart, periodEnd)).length;
  const previousPeriodCount = visible.filter((a) => inWindow(a.createdAt, prevStart, prevEnd)).length;
  const totalDeltaPct = previousPeriodCount === 0 ? (currentPeriodCount > 0 ? 100 : 0) : Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);

  // === AMÉLIORATION AJOUTÉE (Phase 6) === chart data, all derived live.
  const trendData = buildTrend(scopedVisible, trendRange, lang);

  const categoryCounts = new Map<string, number>();
  scopedVisible.forEach((a) => categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1));
  const categoryData: DonutSlice[] = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) ===
  // Regroupement des dossiers visibles en 5 paniers façon maquette (voir
  // domain/alertStatusBuckets.ts, réutilisé identiquement par l'écran
  // Dossiers). "rejetes" reste à 0 par construction — aucune valeur réelle
  // d'AlertStatus n'y correspond aujourd'hui (voir le commentaire du
  // fichier partagé, brief §32 — jamais de compteur fabriqué).
  const bucketCounts: Record<AlertStatusBucket, number> = { a_traiter: 0, en_cours: 0, en_attente: 0, clotures: 0, rejetes: 0 };
  scopedVisible.forEach((a) => {
    bucketCounts[getAlertStatusBucket(a.status)] += 1;
  });
  // Delta période précédente par panier — même fenêtre glissante que
  // `totalDeltaPct` ci-dessus, généralisée plutôt que dupliquée 4 fois.
  const countInBucketWindow = (bucket: AlertStatusBucket, start: Date, end: Date) =>
    visible.filter((a) => getAlertStatusBucket(a.status) === bucket && inWindow(a.createdAt, start, end)).length;
  const bucketDeltaPct = (bucket: AlertStatusBucket): number => {
    const curr = countInBucketWindow(bucket, periodStart, periodEnd);
    const prev = countInBucketWindow(bucket, prevStart, prevEnd);
    return prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
  };

  // "Évolution des signalements" — vue fixe façon maquette (pas de
  // sélecteur de période), volontairement distincte de la "Tendance des
  // alertes" interactive (7j/30j/12m) de la section existante plus bas —
  // évite un doublon strictement identique sur le même écran.
  const mockupTrendData = buildTrend(scopedVisible, '7d', lang);

  // "Répartition par statut" — mêmes 5 paniers que les cartes KPI ci-dessus.
  const BUCKET_COLORS: Record<AlertStatusBucket, string> = {
    a_traiter: '#2563eb',
    en_cours: '#0ea5e9',
    en_attente: '#f59e0b',
    clotures: '#10b981',
    rejetes: '#94a3b8',
  };
  const BUCKET_ORDER: AlertStatusBucket[] = ['en_cours', 'en_attente', 'clotures', 'rejetes', 'a_traiter'];
  const statusBucketData: DonutSlice[] = BUCKET_ORDER.map((b) => ({
    label: t[`db_bucket_${b}` as keyof typeof t] as string,
    value: bucketCounts[b],
    color: BUCKET_COLORS[b],
  }));

  // "Top 5 pays" / "Top 5 catégories" — le second réutilise directement
  // `categoryData` (déjà calculé ci-dessus pour le donut "Alertes par
  // catégorie" existant plus bas), simplement tronqué à 5 plutôt que
  // recalculé une seconde fois.
  const countryCounts = new Map<string, number>();
  scopedVisible.forEach((a) => countryCounts.set(a.country, (countryCounts.get(a.country) || 0) + 1));
  const topCountries: HBarDatum[] = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label: formatCountryLabel(storage.getCountries(), label), value, color: '#2563eb' }));
  const topCategories: HBarDatum[] = categoryData.slice(0, 5).map((d) => ({ label: d.label, value: d.value, color: d.color }));

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
  const urgentCases = scopedVisible
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

  const attentionCases = scopedVisible
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

  const recentAlerts = scopedVisible
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

  // === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi annuel) ===
  // Années réellement présentes dans les dossiers visibles (jamais une
  // plage fabriquée) — plus l'année civile en cours, toujours proposée
  // même sans dossier encore créé cette année-là.
  const availableYears = Array.from(
    new Set([new Date().getFullYear(), ...visible.map((a) => new Date(a.createdAt).getFullYear())])
  ).sort((a, b) => b - a);

  // === AMÉLIORATION AJOUTÉE (Correction demandée — bouton Exporter, fusion
  // avec `main`) === Export CSV des dossiers actuellement affichés
  // (`scopedVisible` — tout l'historique par défaut, ou la plage/année
  // sélectionnée), mêmes colonnes que le tableau "Dossiers récents"
  // ci-dessus, jamais limité aux 8 lignes affichées à l'écran
  // (`recentAlerts`). Proposé désormais au sein de la modale "Exporter"
  // (CSV/PDF, voir plus bas) plutôt que comme bouton dédié mono-format
  // "Télécharger (CSV)", sur demande explicite de l'utilisateur — voir
  // `handlePrint` ci-dessous pour l'option PDF.
  const handleExportCSV = () => {
    const headers = ['Dossier', 'Date', 'Catégorie', 'Pays', 'Entité', 'Priorité', 'Score de risque', 'Statut', 'Investigateur(s)', 'Échéance SLA'];
    const rows = scopedVisible
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => {
        const p = a.overridePriority || a.riskEvaluation.priority;
        return [
          a.trackingNumber,
          new Date(a.createdAt).toLocaleDateString(locale),
          `"${a.category}"`,
          `"${formatCountryLabel(storage.getCountries(), a.country)}"`,
          `"${a.concernedEntity}"`,
          t[`priority_${p}` as keyof typeof t],
          `${a.riskEvaluation.totalScore}/16`,
          t[`status_${a.status}` as keyof typeof t] ?? a.status,
          `"${a.assignedInvestigatorNames.join(', ') || t.cp_unassigned_tag}"`,
          a.targetCompletionDate ? new Date(a.targetCompletionDate).toLocaleDateString(locale) : '',
        ];
      });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const periodLabel = period === 'year' ? String(selectedYear ?? new Date().getFullYear())
      : period === 'custom' ? `${customStart || 'debut'}_${customEnd || 'fin'}`
      : 'toute-periode';
    link.setAttribute('download', `activa-whistleblowing_CentreDePilotage_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    storage.logAudit(
      'REPORT_GENERATED',
      `Génération d'un export CSV du Centre de Pilotage (${rows.length} dossier(s), période : ${periodLabel}) par ${activeUser.name}.`,
      undefined,
      activeUser
    );
  };

  // === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre
  // de Pilotage) === Même libellé de période et mêmes lignes que
  // `handleExportCSV` ci-dessus (dossiers réellement affichés, colonnes
  // identiques), reconstruits ici pour alimenter ControlPanelPrintView —
  // jamais une donnée fabriquée ou divergente entre les deux formats.
  const printPeriodLabel = period === 'year' ? String(selectedYear ?? new Date().getFullYear())
    : period === 'custom' ? `${customStart || 'debut'}_${customEnd || 'fin'}`
    : 'toute-periode';
  const statusLabel = (status: AlertRecord['status']) => t[`status_${status}` as keyof typeof t] ?? status;
  const buildPrintRows = () =>
    scopedVisible
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => {
        const p = a.overridePriority || a.riskEvaluation.priority;
        return {
          trackingNumber: a.trackingNumber,
          date: new Date(a.createdAt).toLocaleDateString(locale),
          category: a.category,
          country: formatCountryLabel(storage.getCountries(), a.country),
          entity: a.concernedEntity,
          priority: t[`priority_${p}` as keyof typeof t],
          riskScore: `${a.riskEvaluation.totalScore}/16`,
          status: statusLabel(a.status),
          assigned: a.assignedInvestigatorNames.join(', ') || t.cp_unassigned_tag,
          sla: a.targetCompletionDate ? new Date(a.targetCompletionDate).toLocaleDateString(locale) : '',
        };
      });

  const handlePrint = () => {
    storage.logAudit('REPORT_GENERATED', `Impression / Export PDF du Centre de Pilotage par ${activeUser.name}.`, undefined, activeUser);
    setShowPrintReport(true);
  };

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
          {/* === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi
              annuel) === Sur demande explicite : le bouton "30 jours" (qui
              ne filtrait en réalité jamais l'affichage — seul le delta
              d'une carte KPI l'utilisait, voir getPeriodWindow) est
              retiré, ainsi que le bouton "calendrier" + popover qui l'a
              remplacé un temps (libellé "Toute la période" retiré à son
              tour, sur demande explicite) : les deux champs de date Du/Au
              sont désormais affichés directement, sans étape de clic
              intermédiaire. Filtrent réellement tout l'écran (KPIs,
              graphiques, tableau — voir `scopedVisible`), avec un
              sélecteur d'Année en alternative (jamais les deux en même
              temps) pour le suivi année par année, et un bouton de
              téléchargement CSV des dossiers de la période affichée. */}
          <select
            value={period === 'year' && selectedYear ? String(selectedYear) : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                setPeriod('all_time');
                setSelectedYear(null);
              } else {
                setSelectedYear(Number(v));
                setPeriod('year');
                setCustomStart('');
                setCustomEnd('');
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <option value="">{t.cp_year_all}</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-[11px]">
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setPeriod('custom'); setSelectedYear(null); }}
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 shadow-2xs"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setPeriod('custom'); setSelectedYear(null); }}
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 shadow-2xs"
            />
          </div>
          {/* === AMÉLIORATION AJOUTÉE (Correction demandée — bouton
              Exporter, fusion avec `main`) === Remplace l'ancien bouton
              "Télécharger (CSV)" mono-format par un bouton "Exporter"
              ouvrant le choix CSV/PDF (modale ci-dessous), sur demande
              explicite de l'utilisateur. Le bouton "Actualiser"
              (lastRefreshed/handleRefresh) qui vivait ici a été retiré
              indépendamment par `main` lors de son propre refactor du
              filtre de période (remplacé par la mise à jour déjà continue
              via storage.subscribe) — aligné avec cet état actuel plutôt
              que réintroduit lors de cette fusion. */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" /> {t.cp_btn_export}
            </button>
          </div>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Correction demandée — bouton Exporter) ===
          Modale de choix de format, même structure/clés i18n que celle de
          ReportingDashboard.tsx (`export_modal_*`) — jamais dupliquée sous
          un autre nom, seul le contenu exporté diffère (les dossiers
          visibles sur CET écran plutôt que le registre complet des
          rapports). */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">{t.export_modal_title}</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">{t.export_modal_format}</label>
              <div className="flex gap-1.5">
                {(['csv', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`flex-1 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition ${
                      exportFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {fmt === 'csv' ? t.export_modal_format_csv : t.export_modal_format_pdf}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
                {t.btn_cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  // === AMÉLIORATION AJOUTÉE (fusion avec `main`) === Ferme
                  // cette modale AVANT d'exporter/imprimer (plutôt qu'après),
                  // même correction que ReportingDashboard.tsx : sinon elle
                  // restait visible derrière la boîte de dialogue
                  // d'impression du navigateur.
                  setShowExportModal(false);
                  if (exportFormat === 'csv') handleExportCSV();
                  else handlePrint();
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {t.export_modal_export}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) ===
          Reproduction fidèle de la maquette de référence : 4 cartes KPI
          simples, tendance fixe, répartition par statut en 5 paniers,
          Top 5 pays et Top 5 catégories. Tout le contenu existant plus bas
          (barre d'actions, 6 cartes KPI détaillées, SLA, charge de travail,
          activité récente, alertes récentes, actions rapides...) reste
          affiché tel quel sous le séparateur "Indicateurs avancés DARC" —
          rien n'est supprimé (choix confirmé par l'utilisateur avant cette
          phase). */}
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

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-200" />
        {/* === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, contraste) ===
            text-slate-400 à cette taille ne passe pas le seuil WCAG AA
            (mesuré via axe-core) ; text-slate-500 restait tout juste
            insuffisant (4.46:1, minimum 4.5:1) — text-slate-600 y remédie. */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{t.db_advanced_section_title}</span>
        <span className="h-px flex-1 bg-slate-200" />
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

      {/* === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du
          Centre de Pilotage) === Rendu inconditionnellement caché à
          l'écran (`.print-only`, voir index.css) — ne devient visible que
          dans la boîte de dialogue d'impression du navigateur, une fois
          `showPrintReport` à true (voir le useEffect plus haut, qui
          appelle window.print() puis le réinitialise). */}
      {showPrintReport && (
        <ControlPanelPrintView
          generatedByName={activeUser.name}
          locale={locale}
          periodLabel={printPeriodLabel}
          totalCount={totalCount}
          statusBreakdown={statusBreakdown}
          statusLabel={statusLabel}
          priorityBarData={priorityBarData}
          rows={buildPrintRows()}
        />
      )}

    </div>
  );
};
