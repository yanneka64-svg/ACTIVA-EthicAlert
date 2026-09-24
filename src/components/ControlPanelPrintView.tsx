import React from 'react';
import { ActivaLogo } from './ui/ActivaLogo';
import { AlertRecord } from '../types';
import { currentT } from '../i18n/currentLang';
// === AMÉLIORATION AJOUTÉE : données par défaut (catégories, pays…) traduites à l'affichage ===
import { trData } from '../i18n/dataLabels';

/**
 * === AMÉLIORATION AJOUTÉE (correctif — isolation d'impression du Centre
 * de Pilotage) ===
 *
 * BUG PRÉEXISTANT CORRIGÉ : l'option "PDF" de la modale "Exporter" du
 * Centre de Pilotage (ControlPanel.tsx, `handlePrint`) appelait
 * `window.print()` directement sur toute la page affichée (barre
 * latérale, filtres, boutons compris) — exactement le même défaut déjà
 * identifié et corrigé ailleurs dans ce dépôt pour Rapports & Reporting
 * (ReportingPrintView.tsx) et le rapport de dossier (CaseReportPrintView.tsx),
 * mais réintroduit ici lors de l'ajout du bouton "Exporter" du Centre de
 * Pilotage. Ce composant est le contenu RÉEL imprimé, même mécanisme que
 * les deux autres : rendu caché (`.print-only`, voir index.css) en dehors
 * de l'impression, seul visible dans la boîte de dialogue d'impression du
 * navigateur (qui permet nativement d'enregistrer en PDF) grâce aux
 * règles `@media print`.
 */
interface ControlPanelPrintViewProps {
  generatedByName: string;
  locale: string;
  periodLabel: string;
  totalCount: number;
  statusBreakdown: { status: AlertRecord['status']; count: number }[];
  statusLabel: (status: AlertRecord['status']) => string;
  priorityBarData: { label: string; value: number }[];
  rows: {
    trackingNumber: string;
    date: string;
    category: string;
    country: string;
    entity: string;
    priority: string;
    riskScore: string;
    status: string;
    assigned: string;
    sla: string;
  }[];
}

export const ControlPanelPrintView: React.FC<ControlPanelPrintViewProps> = ({
  generatedByName,
  locale,
  periodLabel,
  totalCount,
  statusBreakdown,
  statusLabel,
  priorityBarData,
  rows,
}) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  const now = new Date();

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">{t.cp_title}</p>
          <p className="text-slate-500">
            {t.print_generated_on.replace('{date}', now.toLocaleDateString(locale)).replace('{time}', now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))}{t.print_period.replace('{period}', periodLabel)}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">{t.print_kpis}</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-56 align-top">{t.print_total_reports}</td>
              <td>{totalCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.print_by_status}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {statusBreakdown.map((s) => (
              <tr key={s.status} className="border-b border-slate-100">
                <td className="py-1 pr-3">{statusLabel(s.status)}</td>
                <td className="py-1">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.print_by_priority}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {priorityBarData.map((p) => (
              <tr key={p.label} className="border-b border-slate-100">
                <td className="py-1 pr-3">{p.label}</td>
                <td className="py-1">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">{t.desk_cases_count.replace('{n}', String(rows.length))}</h2>
        {rows.length === 0 ? (
          <p className="italic text-slate-400">{t.print_no_cases_period}</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1 pr-2">{t.srch_col_case}</th>
                <th className="py-1 pr-2">{t.print_date}</th>
                <th className="py-1 pr-2">{t.desk_col_category}</th>
                <th className="py-1 pr-2">{t.op_col_country}</th>
                <th className="py-1 pr-2">{t.op_col_entity}</th>
                <th className="py-1 pr-2">{t.desk_col_priority}</th>
                <th className="py-1 pr-2">{t.print_risk}</th>
                <th className="py-1 pr-2">{t.desk_col_status}</th>
                <th className="py-1 pr-2">{t.print_investigators}</th>
                <th className="py-1">{t.print_sla_due}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.trackingNumber} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{r.trackingNumber}</td>
                  <td className="py-1 pr-2">{r.date}</td>
                  <td className="py-1 pr-2">{trData(r.category)}</td>
                  <td className="py-1 pr-2">{trData(r.country)}</td>
                  <td className="py-1 pr-2">{r.entity}</td>
                  <td className="py-1 pr-2">{r.priority}</td>
                  <td className="py-1 pr-2">{r.riskScore}</td>
                  <td className="py-1 pr-2">{r.status}</td>
                  <td className="py-1 pr-2">{r.assigned}</td>
                  <td className="py-1">{r.sla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-slate-400 flex justify-between text-[10px]">
        <span>{t.print_footer.replace('{name}', generatedByName)}</span>
        <span>{t.users_group_activa}</span>
      </footer>
    </div>
  );
};
