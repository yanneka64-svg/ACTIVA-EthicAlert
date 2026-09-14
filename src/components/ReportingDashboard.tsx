import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  PieChart,
  TrendingUp,
  ShieldCheck,
  Building2,
  EyeOff,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Calendar,
  Filter,
  X,
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Rapports) ===
  Briefcase,
  Settings2,
} from 'lucide-react';
import { Language, AlertRecord, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';

interface ReportingDashboardProps {
  lang: Language;
  activeUser: UserProfile;
}

export const ReportingDashboard: React.FC<ReportingDashboardProps> = ({
  lang,
  activeUser,
}) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
  // Applique désormais le même périmètre (pays/entité/confidentialité/
  // assignation) que tous les autres écrans internes migrés en Phase 2 —
  // cet écran lisait jusqu'ici storage.getAlerts() SANS aucun filtre de
  // visibilité : n'importe quel rôle interne (y compris un investigateur
  // scopé sur un seul pays) voyait les statistiques agrégées de
  // l'ensemble du Groupe. Corrige une vraie lacune par rapport au brief
  // §35 ("l'utilisateur ne doit voir que les niveaux correspondant à son
  // périmètre") — voir aussi reportLevelLabel plus bas, qui n'annonce
  // jamais "Groupe" à un compte dont le périmètre ne couvre pas
  // réellement tout le Groupe.
  const allAlerts: AlertRecord[] = useVisibleAlerts(storage.getAlerts(), activeUser);
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === real,
  // editable entity/category lists instead of the static activaConfig
  // imports, so admin changes are reflected in these filter dropdowns too.
  const entities = storage.getEntities();
  const categoriesConfig = storage.getCategories();
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // Remplace l'import statique ACTIVA_COUNTRIES par la copie réelle,
  // éditable (même motif que entities/categoriesConfig ci-dessus).
  const allCountries = storage.getCountries();

  // === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
  // Pays/entités que CE compte peut choisir dans les filtres ci-dessous —
  // périmètre vide (rôles à vision Groupe) = tous, sinon uniquement son
  // propre périmètre. Ne masque rien qui ne soit déjà filtré côté données
  // (allAlerts ci-dessus) : évite simplement de proposer un niveau que le
  // compte ne pourrait de toute façon pas voir.
  const isCountryScoped = (activeUser.countries?.length ?? 0) > 0;
  const isEntityScoped = (activeUser.entities?.length ?? 0) > 0;
  const visibleCountries = isCountryScoped
    ? allCountries.filter((c) => activeUser.countries!.includes(c.code))
    : allCountries;
  const visibleEntities = isEntityScoped
    ? entities.filter((e) => activeUser.entities!.includes(e.id))
    : entities;

  // Mode: 'realtime' | 'monthly_darc' | 'quarterly_board'
  const [reportView, setReportView] = useState<'realtime' | 'monthly_darc' | 'quarterly_board'>('realtime');
  const [anonymizeExport, setAnonymizeExport] = useState<boolean>(true);

  // === AMÉLIORATION AJOUTÉE (Phase 7 — filtres réels période/pays/entité/catégorie/statut) ===
  // Real filters applied to the same live storage.getAlerts() data — every
  // stat below is recomputed from the filtered subset, nothing here is a
  // separate/fabricated dataset.
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d' | '90d' | '365d'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const alerts: AlertRecord[] = allAlerts.filter((a) => {
    if (periodFilter !== 'all') {
      const days = periodFilter === '30d' ? 30 : periodFilter === '90d' ? 90 : 365;
      if (new Date(a.createdAt).getTime() < Date.now() - days * 24 * 3600 * 1000) return false;
    }
    if (countryFilter !== 'all' && a.country !== countryFilter) return false;
    if (entityFilter !== 'all' && a.concernedEntity !== entityFilter) return false;
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });
  const filtersActive =
    periodFilter !== 'all' || countryFilter !== 'all' || entityFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => {
    setPeriodFilter('all');
    setCountryFilter('all');
    setEntityFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
  // Libellé du niveau d'agrégation actuel (brief §35 : Vue Groupe / Vue
  // Pays / Vue Entité). N'annonce jamais "Groupe ACTIVA" à un compte dont
  // le périmètre pays est restreint — même sans filtre pays/entité
  // sélectionné, ses chiffres ne portent déjà que sur son propre
  // périmètre (allAlerts, filtré via useVisibleAlerts ci-dessus).
  const reportLevelLabel =
    entityFilter !== 'all'
      ? `Entité — ${entityFilter}`
      : countryFilter !== 'all'
      ? `Pays — ${countryFilter}`
      : isCountryScoped
      ? `Pays (périmètre) — ${visibleCountries.map((c) => c.name).join(', ')}`
      : 'Groupe ACTIVA';

  // Core Statistics Calculations (CDC 3.1.4)
  const totalAlerts = alerts.length;
  const closedAlerts = alerts.filter(a => a.status === 'closed').length;
  const activeAlerts = alerts.filter(a => a.status !== 'closed' && a.status !== 'archived').length;
  const resolutionRate = totalAlerts > 0 ? Math.round((closedAlerts / totalAlerts) * 100) : 0;
  
  const anonymousCount = alerts.filter(a => a.whistleblower.isAnonymous).length;
  const identifiedCount = totalAlerts - anonymousCount;
  const anonymousPct = totalAlerts > 0 ? Math.round((anonymousCount / totalAlerts) * 100) : 0;

  // Breakdown by NOCA criticality
  const noca4Count = alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 4').length;
  const noca3Count = alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 3').length;
  const noca2Count = alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 2').length;
  const noca1Count = alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 1').length;

  // Breakdown by Category
  const categoryCounts: Record<string, number> = {};
  alerts.forEach(a => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  });

  // Breakdown by Country / Entity
  const countryCounts: Record<string, number> = {};
  alerts.forEach(a => {
    countryCounts[a.country] = (countryCounts[a.country] || 0) + 1;
  });

  // Breakdown by Channel
  const webChannelCount = alerts.filter(a => a.channel === 'web').length;
  const qrChannelCount = alerts.filter(a => a.channel === 'qr_code').length;

  // === AMÉLIORATION AJOUTÉE (Phase 7 — correction : délai moyen réellement calculé) ===
  // Was previously a hardcoded `14` — now a genuine average of (closedAt -
  // createdAt) across cases that actually have both timestamps, over the
  // current filtered set. Falls back to 0 rather than a fabricated number
  // when no case has been closed yet.
  const closedWithDates = alerts.filter((a) => a.status === 'closed' && a.closedAt);
  const avgResolutionDays =
    closedWithDates.length > 0
      ? Math.round(
          closedWithDates.reduce((sum, a) => sum + (new Date(a.closedAt as string).getTime() - new Date(a.createdAt).getTime()) / (24 * 3600 * 1000), 0) /
            closedWithDates.length
        )
      : 0;

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Reference',
      'Date_Depot',
      'Pays',
      'Entite',
      'Categorie',
      'Sous_Categorie',
      'Criticite_NOCA',
      'Priorite',
      'Statut',
      'Declarant_Mode',
      'Declarant_Identite',
      'Mesures_Correctives_Nb'
    ];

    const rows = alerts.map(a => [
      a.trackingNumber,
      a.createdAt.split('T')[0],
      `"${a.country}"`,
      `"${a.concernedEntity}"`,
      `"${a.category}"`,
      `"${a.subCategory}"`,
      a.riskEvaluation.nocaThreshold,
      a.riskEvaluation.priority,
      a.status,
      a.whistleblower.isAnonymous ? 'Anonyme' : 'Identifie',
      anonymizeExport 
        ? '[CAVIARDE / ANONYMISE]' 
        : (a.whistleblower.isAnonymous ? 'Anonyme' : `"${a.whistleblower.fullName || ''}"`),
      a.correctiveMeasures.length
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ACTIVA_EthicAlert_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    storage.logAudit(
      'REPORT_GENERATED',
      `Génération d'un export CSV des données d'alertes (${anonymizeExport ? 'Anonymisé' : 'Complet'}) par ${activeUser.name}.`,
      undefined,
      activeUser
    );
  };

  // Export Formatted Print/PDF
  const handlePrint = () => {
    storage.logAudit(
      'REPORT_GENERATED',
      `Impression / Export PDF du rapport ${reportView} par ${activeUser.name}.`,
      undefined,
      activeUser
    );
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-blue-700" />
              <h2 className="text-xl font-bold text-slate-900">
                {t.reporting_title}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Indicateurs de performance, de conformité et de cartographie des risques éthiques du Groupe ACTIVA.
            </p>
          </div>

          {/* Action buttons: Export CSV, Print PDF, Anonymize switch */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer">
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="checkbox"
                checked={anonymizeExport}
                onChange={(e) => setAnonymizeExport(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-[11px]">{t.toggle_anonymize}</span>
            </label>

            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{t.btn_export_csv}</span>
            </button>

            <button
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold shadow-xs transition"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>{t.btn_print_report}</span>
            </button>
          </div>
        </div>

        {/* Report Profile Selector: Realtime, Monthly DARC, Quarterly Board (CDC 3.1.4) */}
        <div className="flex items-center gap-2 mt-4 pt-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Format :</span>
          <button
            onClick={() => setReportView('realtime')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              reportView === 'realtime'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tableau de bord temps réel
          </button>
          <button
            onClick={() => setReportView('monthly_darc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              reportView === 'monthly_darc'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.report_monthly_darc}
          </button>
          <button
            onClick={() => setReportView('quarterly_board')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              reportView === 'quarterly_board'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.report_quarterly_board}
          </button>
        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Rapports) ===
          Grille de cartes façon maquette (Activité globale/Par pays/Par
          entité/Par catégorie/SLA et délais/Rapport personnalisé). Choix
          délibéré à signaler : cet écran n'a pas de moteur de génération de
          rapport distinct par type — chaque carte réutilise donc les
          capacités réelles déjà existantes plus bas sur ce même écran
          (jamais un bouton fantôme, brief §32) : "Générer" fait défiler en
          douceur jusqu'à la section détaillée correspondante déjà réelle
          (répartition NOCA/catégorie/géographique, délai moyen), et
          "Par entité"/"Rapport personnalisé" pointent vers la barre de
          filtres existante (pays/entité/catégorie/statut/période) — la plus
          proche équivalence réelle d'un rapport "à la carte", faute de
          rupture par entité dédiée sur cet écran. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(
          [
            { id: 'report-anchor-activity', icon: <TrendingUp className="w-4 h-4" />, title: t.report_card_activity, action: t.report_card_generate },
            { id: 'report-anchor-geo', icon: <Building2 className="w-4 h-4" />, title: t.report_card_by_country, action: t.report_card_generate },
            { id: 'report-anchor-custom', icon: <Briefcase className="w-4 h-4" />, title: t.report_card_by_entity, action: t.report_card_generate },
            { id: 'report-anchor-category', icon: <PieChart className="w-4 h-4" />, title: t.report_card_by_category, action: t.report_card_generate },
            { id: 'report-anchor-sla', icon: <Clock className="w-4 h-4" />, title: t.report_card_sla, action: t.report_card_generate },
            { id: 'report-anchor-custom', icon: <Settings2 className="w-4 h-4" />, title: t.report_card_custom, action: t.report_card_configure },
          ] as { id: string; icon: React.ReactNode; title: string; action: string }[]
        ).map((card, i) => (
          <button
            key={`${card.id}-${i}`}
            onClick={() => document.getElementById(card.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition text-left"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{card.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">{card.title}</div>
              <span className="text-[11px] font-semibold text-blue-700">{card.action} →</span>
            </div>
          </button>
        ))}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
          Indicateur de niveau d'agrégation (brief §35 : Vue Groupe/Pays/Entité) —
          purement informatif, dérivé des filtres pays/entité déjà existants
          ci-dessous, qui restent le mécanisme réel de "descente" d'un
          niveau à l'autre. */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
          Vue : {reportLevelLabel}
        </span>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — barre de filtres réels) === */}
      <div id="report-anchor-custom" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide mr-1">
          <Filter className="w-3.5 h-3.5" /> {t.report_filters_label}
        </span>
        <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="all">{t.report_filter_period_all}</option>
          <option value="30d">{t.report_filter_period_30d}</option>
          <option value="90d">{t.report_filter_period_90d}</option>
          <option value="365d">{t.report_filter_period_365d}</option>
        </select>
        {/* === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
            Ne propose que les pays/entités du périmètre de ce compte
            (visibleCountries/visibleEntities) — un compte à vision Groupe
            continue de voir la liste complète, inchangée. */}
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="all">{t.report_filter_country_all}</option>
          {visibleCountries.map((c) => (
            <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
          ))}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="all">{t.report_filter_entity_all}</option>
          {visibleEntities.map((e) => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="all">{t.report_filter_category_all}</option>
          {categoriesConfig.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="all">{t.report_filter_status_all}</option>
          <option value="new">{t.status_new}</option>
          <option value="under_review">{t.status_under_review}</option>
          <option value="investigation">{t.status_investigation}</option>
          <option value="corrective_action">{t.status_corrective_action}</option>
          <option value="closed">{t.status_closed}</option>
          <option value="reopened">{t.status_reopened}</option>
          <option value="archived">{t.status_archived}</option>
        </select>
        {filtersActive && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline ml-1">
            <X className="w-3 h-3" /> {t.report_filters_reset}
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 font-medium">
          {alerts.length} / {allAlerts.length} {t.report_filters_results_suffix}
        </span>
      </div>

      {/* KPI Highlight Cards (CDC 3.1.4 Required Metrics) */}
      <div id="report-anchor-activity" className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            Total des alertes reçues
          </div>
          <div className="text-3xl font-extrabold text-[#0B2545] mt-1">{totalAlerts}</div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="font-semibold text-blue-700">{activeAlerts} actives</span>
            <span>•</span>
            <span className="font-semibold text-emerald-700">{closedAlerts} résolues</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            Taux de résolution
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">{resolutionRate}%</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${resolutionRate}%` }} />
          </div>
        </div>

        <div id="report-anchor-sla" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            Délai moyen de traitement
          </div>
          <div className="text-3xl font-extrabold text-blue-800 mt-1">{avgResolutionDays} j</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Objectif SLA moyen Groupe : &le; 20 jours
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            Signalements anonymes
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-1">{anonymousPct}%</div>
          <div className="text-[11px] text-slate-500 mt-2">
            {anonymousCount} anonymes vs {identifiedCount} identifiés
          </div>
        </div>
      </div>

      {/* Grid: Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Distribution by Risk Matrix Gravity (NOCA 1 to 4) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Répartition selon la gravité (Matrice NOCA - Annexe 9)
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Score 4 à 16</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* NOCA 4 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-rose-800">NOCA 4 - Critique (Action immédiate 48h)</span>
                <span className="text-slate-700">{noca4Count} ({totalAlerts > 0 ? Math.round((noca4Count / totalAlerts) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-rose-600 h-2 rounded-full transition-all" 
                  style={{ width: `${totalAlerts > 0 ? (noca4Count / totalAlerts) * 100 : 0}%` }} 
                />
              </div>
            </div>

            {/* NOCA 3 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-orange-800">NOCA 3 - Très élevé (Enquête urgente 7j)</span>
                <span className="text-slate-700">{noca3Count} ({totalAlerts > 0 ? Math.round((noca3Count / totalAlerts) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-orange-500 h-2 rounded-full transition-all" 
                  style={{ width: `${totalAlerts > 0 ? (noca3Count / totalAlerts) * 100 : 0}%` }} 
                />
              </div>
            </div>

            {/* NOCA 2 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-amber-800">NOCA 2 - Élevée (Suivi renforcé 15j)</span>
                <span className="text-slate-700">{noca2Count} ({totalAlerts > 0 ? Math.round((noca2Count / totalAlerts) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all" 
                  style={{ width: `${totalAlerts > 0 ? (noca2Count / totalAlerts) * 100 : 0}%` }} 
                />
              </div>
            </div>

            {/* NOCA 1 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-emerald-800">NOCA 1 - Faible (Traitement standard 30j)</span>
                <span className="text-slate-700">{noca1Count} ({totalAlerts > 0 ? Math.round((noca1Count / totalAlerts) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all" 
                  style={{ width: `${totalAlerts > 0 ? (noca1Count / totalAlerts) * 100 : 0}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Breakdown by Category (CDC 2.0 Périmètre) */}
        <div id="report-anchor-category" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Répartition par catégorie de manquement (CDC 2.0)
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">{Object.keys(categoryCounts).length} catégories</span>
          </div>

          <div className="space-y-3 text-xs">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800 truncate max-w-[280px]">{cat}</span>
                    <span className="text-slate-600">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Geographic Breakdown across 10 Countries (CDC 1.0) */}
        <div id="report-anchor-geo" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-700" />
              {/* === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
                  Libellés dynamiques (visibleCountries/visibleEntities), plus
                  de "10 pays"/"16 entités" en dur — s'ajuste au périmètre du
                  compte ET aux pays/entités réellement configurés (Phase 8). */}
              Répartition géographique ({visibleCountries.length} pays d'implantation)
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">{visibleEntities.length} entités</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {visibleCountries.map((cty) => {
              const count = countryCounts[cty.name] || 0;
              return (
                <div key={cty.code} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{cty.flag}</span>
                    <span className="font-medium text-slate-800 truncate">{cty.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    count > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Intake Channels & Protection stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Canaux de signalement & Conformité
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Audité DARC</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Portail Web Sécurisé</span>
              <div className="text-2xl font-extrabold text-[#0B2545]">{webChannelCount}</div>
              <p className="text-[10px] text-slate-500 mt-1">Navigateur desktop / mobile</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">QR Code Affiches Filiales</span>
              <div className="text-2xl font-extrabold text-amber-700">{qrChannelCount}</div>
              <p className="text-[10px] text-slate-500 mt-1">Accès direct smartphone</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Toutes les mesures conservatoires et les délais de prescription de 10 ans sont respectés.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
