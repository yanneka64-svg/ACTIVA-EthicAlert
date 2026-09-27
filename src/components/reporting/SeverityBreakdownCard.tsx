/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Répartition par criticité NOCA 1 à 4.
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';

interface SeverityBreakdownCardProps {
  t: Record<string, string>;
  totalAlerts: number;
  noca4Count: number;
  noca3Count: number;
  noca2Count: number;
  noca1Count: number;
}

export const SeverityBreakdownCard: React.FC<SeverityBreakdownCardProps> = ({
  t,
  totalAlerts,
  noca4Count,
  noca3Count,
  noca2Count,
  noca1Count,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {t.rep_severity_breakdown}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">{t.rep_score_range}</span>
      </div>

      <div className="space-y-3 text-xs">
        {/* NOCA 4 */}
        <div>
          <div className="flex justify-between font-semibold mb-1">
            <span className="text-rose-800">{t.rep_noca4}</span>
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
            <span className="text-orange-800">{t.rep_noca3}</span>
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
            <span className="text-amber-800">{t.rep_noca2}</span>
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
            <span className="text-emerald-800">{t.rep_noca1}</span>
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
  );
};
