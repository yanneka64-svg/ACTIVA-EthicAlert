/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Canaux de réception et note de conformité.
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ChannelsCardProps {
  t: Record<string, string>;
  webChannelCount: number;
  qrChannelCount: number;
}

export const ChannelsCard: React.FC<ChannelsCardProps> = ({
  t,
  webChannelCount,
  qrChannelCount,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {t.rep_channels}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">{t.rep_audited}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">{t.rep_web_portal}</span>
          <div className="text-2xl font-extrabold text-[#0B2545]">{webChannelCount}</div>
          <p className="text-[10px] text-slate-500 mt-1">{t.rep_browser}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">{t.rep_qr_posters}</span>
          <div className="text-2xl font-extrabold text-amber-700">{qrChannelCount}</div>
          <p className="text-[10px] text-slate-500 mt-1">{t.rep_direct_mobile}</p>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>{t.rep_compliance_note}</span>
      </div>
    </div>
  );
};
