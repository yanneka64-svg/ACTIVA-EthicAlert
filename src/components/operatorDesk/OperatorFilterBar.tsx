/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Barre de filtres (recherche, pays, entité, réinitialiser).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 * `selectClass` déplacé ici (seul utilisateur).
 */
import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { EntityDef } from '../../data/activaConfig';

interface OperatorFilterBarProps {
  t: Record<string, string>;
  search: string;
  setSearch: (v: string) => void;
  countryFilter: string;
  setCountryFilter: (v: string) => void;
  countries: string[];
  entityFilter: string;
  setEntityFilter: (v: string) => void;
  entities: EntityDef[];
  hasActiveFilters: boolean;
  resetFilters: () => void;
}

export const OperatorFilterBar: React.FC<OperatorFilterBarProps> = ({
  t,
  search,
  setSearch,
  countryFilter,
  setCountryFilter,
  countries,
  entityFilter,
  setEntityFilter,
  entities,
  hasActiveFilters,
  resetFilters,
}) => {
  const selectClass = 'px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 text-xs';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.op_search_ph}
          className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
        />
      </div>
      <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={selectClass}>
        <option value="all">{t.op_all_countries}</option>
        {countries.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className={selectClass}>
        <option value="all">{t.report_filter_entity_all}</option>
        {entities.map((e) => (
          <option key={e.id} value={e.name}>{e.flag} {e.name}</option>
        ))}
      </select>
      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — filtres allégés) ===
          Nature/Criticité/Sévérité/Urgence/Canal/Sensibilité retirés sur
          demande explicite de TOUS les écrans, y compris la Boîte de
          réception (précisé sur retour utilisateur suivant — un premier
          passage l'en avait exclue) : ne reste que Recherche + Pays +
          Entité, partout. Ces filtres restent des critères réels
          (`AdvancedSearchCriteria`, domain/advancedSearch.ts) : rien n'est
          supprimé côté logique, seuls ces contrôles disparaissent de
          l'écran. */}
      {hasActiveFilters && (
        <button onClick={resetFilters} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold">
          <RotateCcw className="w-3.5 h-3.5" />
          {t.op_reset}
        </button>
      )}
    </div>
  );
};
