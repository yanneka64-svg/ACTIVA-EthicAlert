/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Répartition géographique par pays du périmètre.
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import { Building2 } from 'lucide-react';
import type { CountryDef, EntityDef } from '../../data/activaConfig';

interface GeoBreakdownCardProps {
  t: Record<string, string>;
  visibleCountries: CountryDef[];
  visibleEntities: EntityDef[];
  countryCounts: Record<string, number>;
}

export const GeoBreakdownCard: React.FC<GeoBreakdownCardProps> = ({
  t,
  visibleCountries,
  visibleEntities,
  countryCounts,
}) => {
  return (
    <div id="report-anchor-geo" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-blue-700" />
          {/* === AMÉLIORATION AJOUTÉE (Phase 10 — évolution multi-pays/multi-entité) ===
              Libellés dynamiques (visibleCountries/visibleEntities), plus
              de "10 pays"/"16 entités" en dur — s'ajuste au périmètre du
              compte ET aux pays/entités réellement configurés (Phase 8). */}
          {t.rep_geo_title.replace('{n}', String(visibleCountries.length))}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">{t.rep_entities_n.replace('{n}', String(visibleEntities.length))}</span>
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
  );
};
