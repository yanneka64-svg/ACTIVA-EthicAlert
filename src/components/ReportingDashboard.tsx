import React, { useState, useEffect } from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par section) ===
// Les icônes lucide-react et `trData` ne sont plus utilisés qu'à l'intérieur
// des sous-composants de ./reporting/, qui les importent eux-mêmes.
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
// === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de bord Statistiques) ===
import { ReportingPrintView } from './ReportingPrintView';
// === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par section) ===
// Groupes de champs d'export et sous-composants de rendu déplacés dans
// ./reporting/ — voir l'en-tête de chaque fichier.
import { EXPORT_FIELD_GROUPS } from './reporting/exportFieldGroups';
import type { ExportFieldGroupKey } from './reporting/exportFieldGroups';
import { ReportingHeader } from './reporting/ReportingHeader';
import { ReportingFilterBar } from './reporting/ReportingFilterBar';
import { ReportingKpiCards } from './reporting/ReportingKpiCards';
import { SeverityBreakdownCard } from './reporting/SeverityBreakdownCard';
import { CategoryBreakdownCard } from './reporting/CategoryBreakdownCard';
import { GeoBreakdownCard } from './reporting/GeoBreakdownCard';
import { ChannelsCard } from './reporting/ChannelsCard';
import { ReportingExportModal } from './reporting/ReportingExportModal';

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
  // === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de bord
  // Statistiques) === Dès que `showPrintReport` passe à true,
  // ReportingPrintView.tsx (rendu plus bas, cf. `.print-only` dans
  // index.css) devient le SEUL contenu visible dans la boîte de dialogue
  // d'impression du navigateur — jamais toute la page (barre latérale,
  // filtres, boutons) comme auparavant (BUG PRÉEXISTANT CORRIGÉ).
  const [showPrintReport, setShowPrintReport] = useState(false);

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
    link.setAttribute('download', `activa-whistleblowing_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
    workbook.creator = 'activa-whistleblowing';
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
    link.download = `activa-whistleblowing_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
    setShowPrintReport(true);
  };

  // === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de bord
  // Statistiques) === Laisse React monter ReportingPrintView (rendu
  // conditionnellement sur `showPrintReport`, plus bas) avant d'appeler
  // `window.print()`, qui n'imprime alors QUE ce contenu grâce aux règles
  // `.print-only`/`@media print` (index.css) — même mécanisme que
  // CaseReportPrintView.tsx (InvestigationDesk.tsx).
  useEffect(() => {
    if (!showPrintReport) return;
    const timer = window.setTimeout(() => {
      window.print();
      setShowPrintReport(false);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [showPrintReport]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <ReportingHeader
        t={t}
        setShowExportModal={setShowExportModal}
      />

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — barre de filtres réels) === */}
      <ReportingFilterBar
        t={t}
        lang={lang}
        periodFilter={periodFilter}
        setPeriodFilter={setPeriodFilter}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        entityFilter={entityFilter}
        setEntityFilter={setEntityFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        visibleCountries={visibleCountries}
        visibleEntities={visibleEntities}
        categoriesConfig={categoriesConfig}
        filtersActive={filtersActive}
        resetFilters={resetFilters}
        alerts={alerts}
        allAlerts={allAlerts}
      />

      {/* KPI Highlight Cards (CDC 3.1.4 Required Metrics) */}
      <ReportingKpiCards
        t={t}
        totalAlerts={totalAlerts}
        activeAlerts={activeAlerts}
        closedAlerts={closedAlerts}
        resolutionRate={resolutionRate}
        avgResolutionDays={avgResolutionDays}
        anonymousPct={anonymousPct}
        anonymousCount={anonymousCount}
        identifiedCount={identifiedCount}
      />

      {/* Grid: Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Distribution by Risk Matrix Gravity (NOCA 1 to 4) */}
        <SeverityBreakdownCard
          t={t}
          totalAlerts={totalAlerts}
          noca4Count={noca4Count}
          noca3Count={noca3Count}
          noca2Count={noca2Count}
          noca1Count={noca1Count}
        />

        {/* 2. Breakdown by Category (CDC 2.0 Périmètre) */}
        <CategoryBreakdownCard
          t={t}
          lang={lang}
          totalAlerts={totalAlerts}
          categoryCounts={categoryCounts}
        />

        {/* 3. Geographic Breakdown across 10 Countries (CDC 1.0) */}
        <GeoBreakdownCard
          t={t}
          visibleCountries={visibleCountries}
          visibleEntities={visibleEntities}
          countryCounts={countryCounts}
        />

        {/* 4. Intake Channels & Protection stats */}
        <ChannelsCard
          t={t}
          webChannelCount={webChannelCount}
          qrChannelCount={qrChannelCount}
        />
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
        <ReportingExportModal
          t={t}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportFields={exportFields}
          setExportFields={setExportFields}
          setShowExportModal={setShowExportModal}
          handleExportCSV={handleExportCSV}
          handlePrint={handlePrint}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de bord
          Statistiques) === Rendu inconditionnellement caché à l'écran
          (`.print-only`, voir index.css) — ne devient visible que dans la
          boîte de dialogue d'impression du navigateur, une fois
          `showPrintReport` à true (voir le useEffect plus haut, qui
          appelle window.print() puis le réinitialise). */}
      {showPrintReport && (
        <ReportingPrintView
          generatedByName={activeUser.name}
          locale={lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'}
          totalAlerts={totalAlerts}
          activeAlerts={activeAlerts}
          closedAlerts={closedAlerts}
          resolutionRate={resolutionRate}
          avgResolutionDays={avgResolutionDays}
          anonymousCount={anonymousCount}
          identifiedCount={identifiedCount}
          anonymousPct={anonymousPct}
          noca4Count={noca4Count}
          noca3Count={noca3Count}
          noca2Count={noca2Count}
          noca1Count={noca1Count}
          categoryCounts={categoryCounts}
          countryCounts={countryCounts}
          visibleCountries={visibleCountries}
          webChannelCount={webChannelCount}
          qrChannelCount={qrChannelCount}
          filtersActive={filtersActive}
        />
      )}
    </div>
  );
};
