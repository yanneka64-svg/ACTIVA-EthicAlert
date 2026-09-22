import React from 'react';
import { ActivaLogo } from './ui/ActivaLogo';
import { AlertRecord } from '../types';

/**
 * === AMÉLIORATION AJOUTÉE (Exporter — CSV/PDF encapsulés) ===
 *
 * Sur demande explicite : le bouton "Télécharger (CSV)" du Centre de
 * Pilotage devient "Exporter", avec le choix CSV/PDF encapsulé dans ce
 * même bouton (menu déroulant), même principe que le bouton "Exporter
 * (PDF / Excel)" déjà existant sur l'écran Statistiques & Tableaux de bord
 * DARC. L'export PDF réutilise exactement le même mécanisme que
 * ReportingPrintView.tsx/CaseReportPrintView.tsx : ce composant est le
 * contenu RÉEL imprimé (`.print-only`, voir index.css), rendu caché en
 * dehors de l'impression, visible uniquement dans la boîte de dialogue
 * d'impression du navigateur (qui permet nativement d'enregistrer en
 * PDF) grâce aux règles `@media print` — jamais un `window.print()` sur
 * toute la page (barre latérale, filtres compris).
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
  const now = new Date();

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">Centre de Pilotage</p>
          <p className="text-slate-500">
            Généré le {now.toLocaleDateString(locale)} à {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} — période : {periodLabel}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">Indicateurs clés</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-56 align-top">Total signalements</td>
              <td>{totalCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">Répartition par statut</h2>
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
        <h2 className="text-sm font-bold mb-2">Répartition par priorité</h2>
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
        <h2 className="text-sm font-bold mb-2">Dossiers ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="italic text-slate-400">Aucun dossier pour cette période.</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1 pr-2">Dossier</th>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Catégorie</th>
                <th className="py-1 pr-2">Pays</th>
                <th className="py-1 pr-2">Entité</th>
                <th className="py-1 pr-2">Priorité</th>
                <th className="py-1 pr-2">Risque</th>
                <th className="py-1 pr-2">Statut</th>
                <th className="py-1 pr-2">Investigateur(s)</th>
                <th className="py-1">Échéance SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.trackingNumber} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{r.trackingNumber}</td>
                  <td className="py-1 pr-2">{r.date}</td>
                  <td className="py-1 pr-2">{r.category}</td>
                  <td className="py-1 pr-2">{r.country}</td>
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
        <span>Document confidentiel — activa-whistleblowing — Généré par {generatedByName}</span>
        <span>Groupe ACTIVA</span>
      </footer>
    </div>
  );
};
