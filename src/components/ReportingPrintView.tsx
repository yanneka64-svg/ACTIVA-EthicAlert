import React from 'react';
import { ActivaLogo } from './ui/ActivaLogo';
import { currentT } from '../i18n/currentLang';
// === AMÉLIORATION AJOUTÉE : données par défaut (catégories, pays…) traduites à l'affichage ===
import { trData } from '../i18n/dataLabels';

/**
 * === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de bord Statistiques) ===
 *
 * BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur (captures d'écran) :
 * le bouton "Exporter (PDF / Excel)" du Tableau de bord DARC appelait
 * `window.print()` directement sur toute la page (barre latérale,
 * filtres, boutons compris), ce qui produisait un aperçu d'impression
 * vide/incohérent plutôt qu'un vrai rapport. Ce composant est le contenu
 * RÉEL imprimé, même mécanisme que CaseReportPrintView.tsx : rendu caché
 * (`.print-only`, voir index.css) en dehors de l'impression, seul visible
 * dans la boîte de dialogue d'impression du navigateur (qui permet
 * nativement d'enregistrer en PDF) grâce aux règles `@media print`.
 */
interface ReportingPrintViewProps {
  generatedByName: string;
  locale: string;
  totalAlerts: number;
  activeAlerts: number;
  closedAlerts: number;
  resolutionRate: number;
  avgResolutionDays: number;
  anonymousCount: number;
  identifiedCount: number;
  anonymousPct: number;
  noca4Count: number;
  noca3Count: number;
  noca2Count: number;
  noca1Count: number;
  categoryCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  visibleCountries: { code: string; name: string; flag: string }[];
  webChannelCount: number;
  qrChannelCount: number;
  filtersActive: boolean;
}

const pct = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

export const ReportingPrintView: React.FC<ReportingPrintViewProps> = ({
  generatedByName,
  locale,
  totalAlerts,
  activeAlerts,
  closedAlerts,
  resolutionRate,
  avgResolutionDays,
  anonymousCount,
  identifiedCount,
  anonymousPct,
  noca4Count,
  noca3Count,
  noca2Count,
  noca1Count,
  categoryCounts,
  countryCounts,
  visibleCountries,
  webChannelCount,
  qrChannelCount,
  filtersActive,
}) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  const now = new Date();

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">{t.print_rep_title}</p>
          <p className="text-slate-500">
            {t.print_generated_on.replace('{date}', now.toLocaleDateString(locale)).replace('{time}', now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))}
            {filtersActive ? t.print_filters_active : ''}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">{t.print_kpis}</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-56 align-top">{t.rep_total_received}</td>
              <td>{t.print_total_line.replace('{total}', String(totalAlerts)).replace('{active}', String(activeAlerts)).replace('{closed}', String(closedAlerts))}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.rep_resolution_rate}</td>
              <td>{resolutionRate}%</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.rep_avg_processing}</td>
              <td>{t.print_avg_line.replace('{n}', String(avgResolutionDays))}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.rep_anonymous}</td>
              <td>{t.print_anon_line.replace('{pct}', String(anonymousPct)).replace('{a}', String(anonymousCount)).replace('{b}', String(identifiedCount))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.print_severity}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-1 pr-3">{t.print_level}</th>
              <th className="py-1 pr-3">{t.breadcrumb_cases}</th>
              <th className="py-1">{t.print_share}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">{t.rep_noca4}</td>
              <td className="py-1 pr-3">{noca4Count}</td>
              <td className="py-1">{pct(noca4Count, totalAlerts)}%</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">{t.rep_noca3}</td>
              <td className="py-1 pr-3">{noca3Count}</td>
              <td className="py-1">{pct(noca3Count, totalAlerts)}%</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">{t.rep_noca2}</td>
              <td className="py-1 pr-3">{noca2Count}</td>
              <td className="py-1">{pct(noca2Count, totalAlerts)}%</td>
            </tr>
            <tr>
              <td className="py-1 pr-3">{t.rep_noca1}</td>
              <td className="py-1 pr-3">{noca1Count}</td>
              <td className="py-1">{pct(noca1Count, totalAlerts)}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.rep_by_category}</h2>
        {Object.keys(categoryCounts).length === 0 ? (
          <p className="italic text-slate-400">{t.print_no_data}</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <tr key={cat} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{trData(cat)}</td>
                  <td className="py-1 pr-3">{count}</td>
                  <td className="py-1">{pct(count, totalAlerts)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.rep_geo_title.replace('{n}', String(visibleCountries.length))}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {visibleCountries.map((cty) => (
              <tr key={cty.code} className="border-b border-slate-100">
                <td className="py-1 pr-3">{cty.flag} {cty.name}</td>
                <td className="py-1">{countryCounts[cty.name] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.print_channels}</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="font-semibold py-1 pr-4 w-56">{t.rep_web_portal}</td>
              <td>{webChannelCount}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4">{t.rep_qr_posters}</td>
              <td>{qrChannelCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-slate-400 flex justify-between text-[10px]">
        <span>{t.print_footer.replace('{name}', generatedByName)}</span>
        <span>{t.users_group_activa}</span>
      </footer>
    </div>
  );
};
