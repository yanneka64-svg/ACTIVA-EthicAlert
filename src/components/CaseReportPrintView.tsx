import React from 'react';
import { AlertRecord } from '../types';
import { ActivaLogo } from './ui/ActivaLogo';
import { currentT } from '../i18n/currentLang';

/**
 * === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
 *
 * BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur (captures d'écran) :
 * les boutons "Générer le rapport" (Synthèse du dossier / Liens rapides,
 * InvestigationDesk.tsx) appelaient `window.print()` directement sur toute
 * la page affichée (barre latérale, navigation, onglets compris) — jamais
 * un document propre avec en-tête ACTIVA. Ce composant est le contenu
 * RÉEL imprimé : rendu caché (`.print-only`, voir index.css) en dehors de
 * l'impression, seul visible dans la boîte de dialogue d'impression du
 * navigateur (qui permet nativement d'enregistrer en PDF) grâce aux
 * règles `@media print` qui masquent tout le reste de l'application.
 * Aucune nouvelle dépendance (pas de générateur PDF) : le navigateur fait
 * la conversion en PDF lui-même via "Imprimer → Enregistrer au format PDF".
 *
 * === AMÉLIORATION AJOUTÉE (un seul modèle conservé — Synthèse) ===
 * Sur demande explicite : parmi les 3 modèles initialement proposés
 * (synthèse/dossier complet/audit anonymisé), seule la synthèse 1 page est
 * conservée — les 2 autres (notes internes, mesures correctives
 * détaillées, pièces jointes, journal d'audit, variante anonymisée) sont
 * retirés plutôt que laissés en code mort inaccessible depuis l'UI.
 */
interface CaseReportPrintViewProps {
  alert: AlertRecord;
  generatedByName: string;
  locale: string;
}

const formatDate = (iso: string | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale) : '—';

export const CaseReportPrintView: React.FC<CaseReportPrintViewProps> = ({ alert, generatedByName, locale }) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  const now = new Date();

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">{t.print_summary_report}</p>
          <p className="text-slate-500">
            {t.print_generated_on.replace('{date}', now.toLocaleDateString(locale)).replace('{time}', now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">{t.print_reference.replace('{tracking}', alert.trackingNumber)}</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-44 align-top">{t.desk_col_category}</td>
              <td>{alert.category}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.op_col_entity}</td>
              <td>{alert.concernedEntity}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.desk_col_status}</td>
              <td>{alert.status.toUpperCase()}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.print_investigators}</td>
              <td>{alert.assignedInvestigatorNames.join(', ') || 'Non attribué'}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.desk_status_corrective}</td>
              <td>{alert.correctiveMeasures.length}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">{t.op_col_closed}</td>
              <td>{formatDate(alert.closedAt, locale)}</td>
            </tr>
          </tbody>
        </table>
        {alert.closureSummary && (
          <p className="mt-3 pt-3 border-t border-slate-200">{alert.closureSummary}</p>
        )}
      </section>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-slate-400 flex justify-between text-[10px]">
        <span>{t.print_footer.replace('{name}', generatedByName)}</span>
        <span>{t.users_group_activa}</span>
      </footer>
    </div>
  );
};
