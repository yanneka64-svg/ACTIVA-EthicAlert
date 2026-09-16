import React from 'react';
import { ActivaLogo } from './ui/ActivaLogo';

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
  const now = new Date();

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">Statistiques &amp; Tableaux de bord DARC</p>
          <p className="text-slate-500">
            Généré le {now.toLocaleDateString(locale)} à {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            {filtersActive ? ' — filtres actifs appliqués' : ''}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">Indicateurs clés</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-56 align-top">Total des alertes reçues</td>
              <td>{totalAlerts} ({activeAlerts} actives, {closedAlerts} résolues)</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Taux de résolution</td>
              <td>{resolutionRate}%</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Délai moyen de traitement</td>
              <td>{avgResolutionDays} j (objectif SLA moyen Groupe : &le; 20 jours)</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Signalements anonymes</td>
              <td>{anonymousPct}% ({anonymousCount} anonymes vs {identifiedCount} identifiés)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">Répartition selon la gravité (Matrice NOCA)</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-1 pr-3">Niveau</th>
              <th className="py-1 pr-3">Dossiers</th>
              <th className="py-1">Part</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">NOCA 4 - Critique (Action immédiate 48h)</td>
              <td className="py-1 pr-3">{noca4Count}</td>
              <td className="py-1">{pct(noca4Count, totalAlerts)}%</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">NOCA 3 - Très élevé (Enquête urgente 7j)</td>
              <td className="py-1 pr-3">{noca3Count}</td>
              <td className="py-1">{pct(noca3Count, totalAlerts)}%</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1 pr-3">NOCA 2 - Élevée (Suivi renforcé 15j)</td>
              <td className="py-1 pr-3">{noca2Count}</td>
              <td className="py-1">{pct(noca2Count, totalAlerts)}%</td>
            </tr>
            <tr>
              <td className="py-1 pr-3">NOCA 1 - Faible (Traitement standard 30j)</td>
              <td className="py-1 pr-3">{noca1Count}</td>
              <td className="py-1">{pct(noca1Count, totalAlerts)}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">Répartition par catégorie de manquement</h2>
        {Object.keys(categoryCounts).length === 0 ? (
          <p className="italic text-slate-400">Aucune donnée.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <tr key={cat} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{cat}</td>
                  <td className="py-1 pr-3">{count}</td>
                  <td className="py-1">{pct(count, totalAlerts)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-sm font-bold mb-2">Répartition géographique ({visibleCountries.length} pays d'implantation)</h2>
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
        <h2 className="text-sm font-bold mb-2">Canaux de signalement</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="font-semibold py-1 pr-4 w-56">Portail Web Sécurisé</td>
              <td>{webChannelCount}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4">QR Code Affiches Filiales</td>
              <td>{qrChannelCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-slate-400 flex justify-between text-[10px]">
        <span>Document confidentiel — activa-whistleblowing — Généré par {generatedByName}</span>
        <span>Groupe ACTIVA</span>
      </footer>
    </div>
  );
};
