/**
 * === AMÉLIORATION AJOUTÉE (Phase 7 — frontend completion plan) ===
 *
 * Executive / Audit Committee view (brief §38): a curated, aggregate-only
 * scope over the same real `storage.getAlerts()` data every other staff
 * screen reads — never a separate or fabricated dataset. Deliberately reads
 * only `createdAt` / `category` / `riskEvaluation.nocaThreshold` / `status`
 * / `closedAt` from each AlertRecord: no `whistleblower`, `internalNotes`,
 * `evidences`, or `messages` field is ever touched here, enforcing the
 * brief's confidentiality requirement in code, not just in copy.
 */
import React from 'react';
import { Landmark, TrendingUp, Activity, ShieldCheck, Flame, Clock3 } from 'lucide-react';
import { AlertRecord, Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { KpiCard, MiniLineChart, MiniDonutChart } from './ui';
import type { TrendPoint, DonutSlice } from './ui';
// === AMÉLIORATION AJOUTÉE : données par défaut (catégories, pays…) traduites à l'affichage ===
import { trData } from '../i18n/dataLabels';

interface ExecutiveDashboardProps {
  lang: Language;
  activeUser: UserProfile;
}

const CATEGORY_PALETTE = ['#2563eb', '#6366f1', '#f97316', '#9333ea', '#0891b2', '#f43f5e', '#10b981', '#64748b'];

function localeOf(lang: Language): string {
  return lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ lang, activeUser }) => {
  const t = TRANSLATIONS[lang];
  const locale = localeOf(lang);
  const alerts: AlertRecord[] = storage.getAlerts();

  const totalCount = alerts.length;
  const significantCount = alerts.filter((a) => a.riskEvaluation.nocaThreshold === 'NOCA 3' || a.riskEvaluation.nocaThreshold === 'NOCA 4').length;
  const criticalCount = alerts.filter((a) => a.riskEvaluation.nocaThreshold === 'NOCA 4').length;
  const significantPct = totalCount > 0 ? Math.round((significantCount / totalCount) * 100) : 0;

  const closedWithDates = alerts.filter((a) => a.status === 'closed' && a.closedAt);
  const avgResolutionDays =
    closedWithDates.length > 0
      ? Math.round(
          closedWithDates.reduce((sum, a) => sum + (new Date(a.closedAt as string).getTime() - new Date(a.createdAt).getTime()) / (24 * 3600 * 1000), 0) /
            closedWithDates.length
        )
      : 0;

  // Monthly trend over the last 6 months — real bucketing of createdAt, no interpolation.
  const now = new Date();
  const trendData: TrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = alerts.filter((a) => {
      const ad = new Date(a.createdAt);
      return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
    }).length;
    trendData.push({ label: d.toLocaleDateString(locale, { month: 'short' }), value: count });
  }

  const categoryCounts = new Map<string, number>();
  alerts.forEach((a) => categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1));
  const categoryData: DonutSlice[] = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({ label: trData(label, lang), value, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t.exec_title}</h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">{t.exec_subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard value={totalCount} label={t.exec_kpi_total} tone="neutral" icon={<Activity className="w-3.5 h-3.5" />} />
        <KpiCard
          value={`${significantPct}%`}
          label={t.exec_kpi_significant}
          tone="amber"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          sub={<span className="text-slate-500">{significantCount} / {totalCount}</span>}
        />
        <KpiCard value={criticalCount} label={t.exec_kpi_critical} tone="rose" icon={<Flame className="w-3.5 h-3.5" />} />
        <KpiCard value={`${avgResolutionDays} j`} label={t.exec_kpi_avg_days} tone="blue" icon={<Clock3 className="w-3.5 h-3.5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            {t.exec_section_trend}
          </h3>
          <MiniLineChart data={trendData} height={160} />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Activity className="w-4 h-4 text-blue-700" />
            {t.exec_section_category}
          </h3>
          {categoryData.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">—</p>
          ) : (
            <div className="flex items-center gap-4">
              <MiniDonutChart data={categoryData} centerValue={totalCount} centerLabel={t.exec_kpi_total} size={140} />
              <ul className="space-y-1.5 min-w-0 flex-1">
                {categoryData.map((d, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="truncate flex-1">{d.label}</span>
                    <span className="font-bold text-slate-800 shrink-0">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
        <span>{t.exec_confidentiality_note}</span>
      </div>
    </div>
  );
};
