/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Barre de filtres réels (période, pays, entité, catégorie, statut,
 * réinitialisation, compteur de résultats).
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import { Filter, X } from 'lucide-react';
import type { AlertRecord, Language } from '../../types';
import type { CountryDef, EntityDef, CategoryDef } from '../../data/activaConfig';
import { trData } from '../../i18n/dataLabels';

interface ReportingFilterBarProps {
  t: Record<string, string>;
  lang: Language;
  periodFilter: 'all' | '30d' | '90d' | '365d';
  setPeriodFilter: React.Dispatch<React.SetStateAction<'all' | '30d' | '90d' | '365d'>>;
  countryFilter: string;
  setCountryFilter: React.Dispatch<React.SetStateAction<string>>;
  entityFilter: string;
  setEntityFilter: React.Dispatch<React.SetStateAction<string>>;
  categoryFilter: string;
  setCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  visibleCountries: CountryDef[];
  visibleEntities: EntityDef[];
  categoriesConfig: CategoryDef[];
  filtersActive: boolean;
  resetFilters: () => void;
  alerts: AlertRecord[];
  allAlerts: AlertRecord[];
}

export const ReportingFilterBar: React.FC<ReportingFilterBarProps> = ({
  t,
  lang,
  periodFilter,
  setPeriodFilter,
  countryFilter,
  setCountryFilter,
  entityFilter,
  setEntityFilter,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  visibleCountries,
  visibleEntities,
  categoriesConfig,
  filtersActive,
  resetFilters,
  alerts,
  allAlerts,
}) => {
  return (
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
          <option key={c.code} value={c.name}>{c.flag} {trData(c.name, lang)}</option>
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
          <option key={c.id} value={c.name}>{trData(c.name, lang)}</option>
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
  );
};
