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
import React, { useEffect, useMemo, useState } from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par section) ===
// Les icônes lucide-react et les composants UI (KpiCard, DataTable, graphiques…)
// ne sont plus utilisés qu'à l'intérieur des sous-composants de ./controlPanel/,
// qui les importent eux-mêmes.
import { AlertRecord, Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) ===
import { fetchMirroredCasesForControlPanel, mergeMirroredCases } from '../services/controlPanelCloudSync';
import { computeSlaStatus } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { formatCountryLabel } from '../data/activaConfig';
// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
import { ACTIVE_STATUSES, computeWorkload, WorkloadRow } from '../domain/workloadCalc';
// === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) === regroupement
// en 5 paniers de statut, partagé avec l'écran Dossiers (voir le fichier).
import { AlertStatusBucket, getAlertStatusBucket } from '../domain/alertStatusBuckets';
import type { DonutSlice, BarDatum, HBarDatum } from './ui';
// === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre de Pilotage) ===
import { ControlPanelPrintView } from './ControlPanelPrintView';
// === AMÉLIORATION AJOUTÉE : données par défaut (catégories, pays…) traduites à l'affichage ===
import { trData } from '../i18n/dataLabels';
// === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par section) ===
// Constantes/fonctions pures et sous-composants de rendu déplacés dans
// ./controlPanel/ — voir l'en-tête de chaque fichier.
import { PRIORITY_RANK, CATEGORY_PALETTE, localeOf, getPeriodWindow, inWindow, buildTrend } from './controlPanel/dashboardHelpers';
import type { CasesFilter, PeriodKey, TrendRange } from './controlPanel/dashboardHelpers';
import { ControlPanelHeader } from './controlPanel/ControlPanelHeader';
import { ControlPanelExportModal } from './controlPanel/ControlPanelExportModal';
import { OverviewKpiGrid } from './controlPanel/OverviewKpiGrid';
import { OverviewChartsSection } from './controlPanel/OverviewChartsSection';
import { AdvancedChartsRow } from './controlPanel/AdvancedChartsRow';
import { OperationalPanels } from './controlPanel/OperationalPanels';
import { RecentAlertsSection } from './controlPanel/RecentAlertsSection';

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

  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5 : fusion
  // Centre de Pilotage) === Dossiers qui n'existent QUE dans le vrai
  // backend (soumis depuis un autre navigateur, jamais reçus localement —
  // voir services/controlPanelCloudSync.ts pour le mécanisme complet et
  // ses limites documentées). Toujours vide et sans effet visible tant que
  // les Cloud Functions ne sont pas déployées ET que le personnel n'est
  // pas réellement connecté à Firebase Auth (voir le commentaire de ce
  // service) — `fetchMirroredCasesForControlPanel` ne rejette jamais,
  // cet état reste `[]` en cas d'échec, jamais une erreur visible ici.
  const [mirroredCases, setMirroredCases] = useState<AlertRecord[]>([]);
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === lié au compte local actif :
  // vidé dès que l'utilisateur change, et une réponse arrivée après ce
  // changement est ignorée (voir fetchMirroredCasesForControlPanel).
  useEffect(() => {
    let cancelled = false;
    setMirroredCases([]);
    fetchMirroredCasesForControlPanel(activeUser.email).then((cases) => {
      if (!cancelled) setMirroredCases(cases);
    });
    return () => {
      cancelled = true;
    };
  }, [activeUser.id, activeUser.email]);

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
  // src/hooks/useVisibleAlerts.ts.
  // === AMÉLIORATION AJOUTÉE (nettoyage du code mort) === `isGlobalViewer`
  // retiré : il ne servait qu'au fil d'activité, qui n'existe plus sur cet
  // écran.
  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) === fusion
  // avec les dossiers miroir du vrai backend, jamais un remplacement — voir
  // `mirroredCases` ci-dessus. `useMemo` évite de reconstruire ce tableau
  // fusionné à chaque rendu alors que `mirroredCases` ne change presque
  // jamais (un seul fetch au montage).
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === sans doublon local/backend.
  const alertsWithMirrored = useMemo(() => mergeMirroredCases(alerts, mirroredCases), [alerts, mirroredCases]);
  const visible = useVisibleAlerts(alertsWithMirrored, activeUser);

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

  // === AMÉLIORATION AJOUTÉE (nettoyage du code mort) === les 4 compteurs
  // « Investigation monitoring » (activeInvestigations, pendingInfo,
  // investigationOverdue, investigationApproachingSla) sont retirés : ils
  // étaient calculés à chaque rendu mais affichés nulle part depuis la
  // refonte visuelle du tableau de bord.

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

  // === AMÉLIORATION AJOUTÉE (nettoyage du code mort) === `correctiveCompleted`
  // (et `allMeasures`, qui ne servait qu'à lui) retirés : jamais affichés.

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
    .map(([label, value], i) => ({ label: trData(label, lang), value, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

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
      <ControlPanelHeader
        t={t}
        period={period}
        setPeriod={setPeriod}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        setShowExportModal={setShowExportModal}
      />

      {/* === AMÉLIORATION AJOUTÉE (Correction demandée — bouton Exporter) ===
          Modale de choix de format, même structure/clés i18n que celle de
          ReportingDashboard.tsx (`export_modal_*`) — jamais dupliquée sous
          un autre nom, seul le contenu exporté diffère (les dossiers
          visibles sur CET écran plutôt que le registre complet des
          rapports). */}
      {showExportModal && (
        <ControlPanelExportModal
          t={t}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          setShowExportModal={setShowExportModal}
          handleExportCSV={handleExportCSV}
          handlePrint={handlePrint}
        />
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
      <OverviewKpiGrid
        t={t}
        onNavigateToCases={onNavigateToCases}
        totalCount={totalCount}
        totalDeltaPct={totalDeltaPct}
        bucketCounts={bucketCounts}
        bucketDeltaPct={bucketDeltaPct}
      />

      <OverviewChartsSection
        t={t}
        totalCount={totalCount}
        mockupTrendData={mockupTrendData}
        statusBucketData={statusBucketData}
        topCountries={topCountries}
        topCategories={topCategories}
      />

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
      <AdvancedChartsRow
        t={t}
        totalCount={totalCount}
        trendRange={trendRange}
        setTrendRange={setTrendRange}
        trendData={trendData}
        categoryData={categoryData}
        priorityBarData={priorityBarData}
      />

      <OperationalPanels
        t={t}
        locale={locale}
        onNavigateToCases={onNavigateToCases}
        statusBreakdown={statusBreakdown}
        slaOnTrack={slaOnTrack}
        slaAtRisk={slaAtRisk}
        slaOverdue={slaOverdue}
        slaEscalated={slaEscalated}
        urgentCases={urgentCases}
        workload={workload}
        attentionCases={attentionCases}
        receivedAgoLabel={receivedAgoLabel}
      />

      {/* Recent alerts table */}
      <RecentAlertsSection
        t={t}
        lang={lang}
        locale={locale}
        onNavigateToCases={onNavigateToCases}
        recentAlerts={recentAlerts}
      />

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
