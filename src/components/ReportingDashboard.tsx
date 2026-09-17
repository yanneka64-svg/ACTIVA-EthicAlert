import React, { useState } from 'react';
import {
  BarChart3,
  ShieldCheck,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  X,
} from 'lucide-react';
import { Language, AlertRecord, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
// === AMÉLIORATION AJOUTÉE (Retours visuels — export Excel réel) === sur
// retour utilisateur explicite : un vrai fichier .xlsx (pas seulement un
// CSV "compatible Excel", choix précédent documenté plus bas) — `exceljs`,
// bibliothèque réelle et activement maintenue (préférée à `xlsx`/SheetJS,
// dont la version publiée sur le registre npm porte une vulnérabilité
// haute non corrigée). Chargée en dynamique (voir `handleExportExcel`
// ci-dessous), pas en import statique : elle alourdissait le paquet
// principal de ~950 Ko pour un bouton que la plupart des visites
// n'utilisent jamais — même motif que le chargement dynamique déjà réel de
// `services/firebase` ailleurs dans l'app.
import type ExcelJS from 'exceljs';

interface ReportingDashboardProps {
  lang: Language;
  activeUser: UserProfile;
}

// === AMÉLIORATION AJOUTÉE (Repère visuel — Modale Exporter des données) ===
// "Champs à inclure" façon maquette : chaque groupe correspond à une ou
// plusieurs colonnes réelles déjà présentes dans l'export CSV existant
// (jamais une donnée fabriquée) — voir `handleExportCSV`, qui ne construit
// désormais que les colonnes dont le groupe est coché. L'identité du
// déclarant reste régie par la case "Générer un rapport 100% anonymisé"
// déjà existante, séparée de cette liste (elle a déjà son propre
// contrôle).
type ExportFieldGroupKey = 'general' | 'status_dates' | 'geo' | 'persons' | 'corrective';
interface ExportFieldGroup {
  key: ExportFieldGroupKey;
  label: string;
  columns: { header: string; value: (a: AlertRecord) => string | number }[];
}
const EXPORT_FIELD_GROUPS: ExportFieldGroup[] = [
  {
    key: 'general',
    label: 'Informations générales',
    columns: [
      { header: 'Reference', value: (a) => a.trackingNumber },
      { header: 'Categorie', value: (a) => `"${a.category}"` },
      { header: 'Sous_Categorie', value: (a) => `"${a.subCategory}"` },
    ],
  },
  {
    key: 'status_dates',
    label: 'Statut et dates',
    columns: [
      { header: 'Date_Depot', value: (a) => a.createdAt.split('T')[0] },
      { header: 'Statut', value: (a) => a.status },
      { header: 'Criticite_NOCA', value: (a) => a.riskEvaluation.nocaThreshold },
      { header: 'Priorite', value: (a) => a.riskEvaluation.priority },
    ],
  },
  {
    key: 'geo',
    label: 'Pays / Entité',
    columns: [
      { header: 'Pays', value: (a) => `"${a.country}"` },
      { header: 'Entite', value: (a) => `"${a.concernedEntity}"` },
    ],
  },
  {
    key: 'persons',
    label: 'Personnes impliquées',
    columns: [{ header: 'Personnes_Impliquees_Nb', value: (a) => a.involvedPersons.length }],
  },
  {
    key: 'corrective',
    label: 'Mesures correctives',
    columns: [{ header: 'Mesures_Correctives_Nb', value: (a) => a.correctiveMeasures.length }],
  },
];

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

  // === AMÉLIORATION AJOUTÉE (Retours visuels — écran Rapports allégé) ===
  // Le sélecteur "Format" (temps réel/mensuel/trimestriel) et la case à
  // cocher "anonymiser" sont retirés de l'écran (voir plus bas) — l'export
  // reste TOUJOURS anonymisé par défaut (jamais un recul de confidentialité
  // silencieux) : `anonymizeExport` devient une constante, plus un état
  // modifiable par l'utilisateur.
  const anonymizeExport = true;
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Modale Exporter des données) ===
  const [showExportModal, setShowExportModal] = useState(false);
  // === AMÉLIORATION AJOUTÉE (Correction demandée — retour au CSV) ===
  // 'excel' redevient 'csv', sur demande explicite de l'utilisateur — voir
  // `handleExportCSV` ci-dessous (jamais supprimée, simplement re-branchée).
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportFields, setExportFields] = useState<Set<ExportFieldGroupKey>>(new Set(EXPORT_FIELD_GROUPS.map((g) => g.key)));

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

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Modale Exporter des données) ===
  // Colonnes construites dynamiquement à partir des groupes cochés dans la
  // modale (EXPORT_FIELD_GROUPS ci-dessus) — Declarant_Mode/Declarant_Identite
  // restent toujours inclus, régis par la case "anonymiser" déjà existante,
  // séparée de la liste "Champs à inclure".
  const handleExportCSV = (fields: Set<ExportFieldGroupKey> = exportFields) => {
    const activeGroups = EXPORT_FIELD_GROUPS.filter((g) => fields.has(g.key));
    const headers = [...activeGroups.flatMap((g) => g.columns.map((c) => c.header)), 'Declarant_Mode', 'Declarant_Identite'];

    const rows = alerts.map((a) => [
      ...activeGroups.flatMap((g) => g.columns.map((c) => c.value(a))),
      a.whistleblower.isAnonymous ? 'Anonyme' : 'Identifie',
      anonymizeExport
        ? '[CAVIARDE / ANONYMISE]'
        : (a.whistleblower.isAnonymous ? 'Anonyme' : `"${a.whistleblower.fullName || ''}"`),
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
      `Génération d'un export CSV des données d'alertes (${anonymizeExport ? 'Anonymisé' : 'Complet'}, champs : ${activeGroups.map((g) => g.label).join(', ') || 'aucun'}) par ${activeUser.name}.`,
      undefined,
      activeUser
    );
  };

  // === AMÉLIORATION AJOUTÉE (Retours visuels — export Excel réel) === même
  // logique de colonnes/champs que `handleExportCSV` ci-dessus (réutilise
  // exactement EXPORT_FIELD_GROUPS/anonymizeExport — jamais dupliquée), mais
  // écrit un vrai classeur .xlsx via `exceljs` au lieu d'un texte CSV. Les
  // valeurs des colonnes CSV s'entourent de guillemets pour l'échappement
  // CSV (ex. `"${a.category}"`) — inutile et trompeur dans une vraie
  // cellule d'un tableur, d'où `stripCsvQuotes`.
  const stripCsvQuotes = (v: string | number) => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v);

  const handleExportExcel = async (fields: Set<ExportFieldGroupKey> = exportFields) => {
    const activeGroups = EXPORT_FIELD_GROUPS.filter((g) => fields.has(g.key));
    const headers = [...activeGroups.flatMap((g) => g.columns.map((c) => c.header)), 'Declarant_Mode', 'Declarant_Identite'];

    // Chargement dynamique — voir le commentaire d'import en haut du fichier.
    const ExcelJSModule = await import('exceljs');
    const Excel = (ExcelJSModule.default ?? ExcelJSModule) as typeof ExcelJS;
    const workbook = new Excel.Workbook();
    workbook.creator = 'ACTIVA EthicAlert';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Rapport');
    sheet.addRow(headers).font = { bold: true };
    sheet.columns = headers.map(() => ({ width: 22 }));

    alerts.forEach((a) => {
      sheet.addRow([
        ...activeGroups.flatMap((g) => g.columns.map((c) => stripCsvQuotes(c.value(a)))),
        a.whistleblower.isAnonymous ? 'Anonyme' : 'Identifie',
        anonymizeExport
          ? '[CAVIARDE / ANONYMISE]'
          : (a.whistleblower.isAnonymous ? 'Anonyme' : (a.whistleblower.fullName || '')),
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ACTIVA_EthicAlert_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    storage.logAudit(
      'REPORT_GENERATED',
      `Génération d'un export Excel (.xlsx) des données d'alertes (${anonymizeExport ? 'Anonymisé' : 'Complet'}, champs : ${activeGroups.map((g) => g.label).join(', ') || 'aucun'}) par ${activeUser.name}.`,
      undefined,
      activeUser
    );
  };

  // Export Formatted Print/PDF
  const handlePrint = () => {
    storage.logAudit(
      'REPORT_GENERATED',
      `Impression / Export PDF du rapport Statistiques & Tableaux de bord DARC par ${activeUser.name}.`,
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

          {/* === AMÉLIORATION AJOUTÉE (Retours visuels — écran Rapports
              allégé) === bouton unique (PDF + CSV réunis, la case
              "anonymiser" et le bouton "Imprimer" séparé retirés) — ouvre
              toujours la même modale déjà réelle, qui propose le choix du
              format.
              === AMÉLIORATION AJOUTÉE (Retours visuels — bouton bleu, export
              Excel réel) === couleur passée en bleu (au lieu du bleu marine
              #0B2545) sur retour utilisateur explicite. */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              id="btn-export-report"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>{t.report_btn_export}</span>
            </button>
          </div>
        </div>
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

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Modale Exporter des
          données) === Choix délibéré à l'origine : seuls CSV et PDF étaient
          de vraies capacités d'export de cet écran — pas de format "Excel"
          natif distinct (aucun générateur .xlsx dans l'app à l'époque), le
          CSV étant alors labellisé "compatible Excel" plutôt que de
          fabriquer un format qui n'existait pas réellement (brief §32).
          === AMÉLIORATION AJOUTÉE (Retours visuels — export Excel réel,
          bouton bleu) === Sur retour utilisateur explicite ("PDF et Excel"),
          le CSV est devenu un vrai fichier .xlsx (`handleExportExcel`,
          `exceljs`). Couleurs passées en bleu (au lieu du bleu marine
          #0B2545), sur le même retour.
          === AMÉLIORATION AJOUTÉE (Correction demandée — retour au CSV) ===
          Sur nouvelle demande explicite de l'utilisateur, le format
          redevient CSV (`handleExportCSV`, re-branchée ici) ; `handleExportExcel`
          reste dans le code (jamais supprimée, même principe que
          `handleExportCSV` la fois précédente) mais n'est plus le format
          proposé par cette modale. */}
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

            {exportFormat === 'csv' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">{t.export_modal_fields}</label>
                <div className="space-y-1.5">
                  {EXPORT_FIELD_GROUPS.map((g) => (
                    <label key={g.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportFields.has(g.key)}
                        onChange={(e) => {
                          const next = new Set(exportFields);
                          if (e.target.checked) next.add(g.key);
                          else next.delete(g.key);
                          setExportFields(next);
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">{g.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
                {t.btn_cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (exportFormat === 'csv') handleExportCSV(exportFields);
                  else handlePrint();
                  setShowExportModal(false);
                }}
                disabled={exportFormat === 'csv' && exportFields.size === 0}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold"
              >
                {t.export_modal_export}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
