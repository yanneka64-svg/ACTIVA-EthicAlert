/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Répartition par catégorie.
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import type { Language } from '../../types';
import { trData } from '../../i18n/dataLabels';

interface CategoryBreakdownCardProps {
  t: Record<string, string>;
  lang: Language;
  totalAlerts: number;
  categoryCounts: Record<string, number>;
}

export const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  t,
  lang,
  totalAlerts,
  categoryCounts,
}) => {
  return (
    <div id="report-anchor-category" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {t.rep_by_category}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">{t.rep_categories_n.replace('{n}', String(Object.keys(categoryCounts).length))}</span>
      </div>

      <div className="space-y-3 text-xs">
        {Object.entries(categoryCounts).map(([cat, count]) => {
          const pct = totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0;
          return (
            <div key={cat}>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-800 truncate max-w-[280px]">{trData(cat, lang)}</span>
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
  );
};
