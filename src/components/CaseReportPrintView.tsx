import React from 'react';
import { AlertRecord, AuditLogEntry } from '../types';
import { ActivaLogo } from './ui/ActivaLogo';

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
 * === AMÉLIORATION AJOUTÉE (2 modèles — le 3e, anonymisé, jamais demandé) ===
 * Sur demande explicite : "Synthèse" seule d'abord, puis "Dossier complet"
 * redemandé juste après — les 2 restent proposés au choix (bouton
 * "Générer le rapport" → petit menu). Le 3e modèle initialement proposé
 * (audit/conformité anonymisé) n'a jamais été redemandé, retiré.
 */
export type ReportModel = 'summary' | 'full';

interface CaseReportPrintViewProps {
  alert: AlertRecord;
  model: ReportModel;
  /** Entrées du journal d'audit déjà filtrées sur ce dossier (storage.getAuditLogs().filter(...)) — jamais recalculé ici, seulement utilisé par le modèle 'full'. */
  caseAuditLogs: AuditLogEntry[];
  generatedByName: string;
  locale: string;
}

const formatDate = (iso: string | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale) : '—';
const formatDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

const CORRECTIVE_STATUS_LABEL: Record<string, string> = {
  planned: 'Planifiée',
  in_progress: 'En cours',
  implemented: 'Mise en œuvre',
  verified: 'Vérifiée',
};

export const CaseReportPrintView: React.FC<CaseReportPrintViewProps> = ({ alert, model, caseAuditLogs, generatedByName, locale }) => {
  const now = new Date();
  const title = model === 'summary' ? 'Rapport de synthèse' : 'Dossier complet d’investigation';

  return (
    <div className="print-only bg-white text-slate-900 text-[11px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        <ActivaLogo className="h-12" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#0B2545]">{title}</p>
          <p className="text-slate-500">
            Généré le {now.toLocaleDateString(locale)} à {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-2">Référence : {alert.trackingNumber}</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="font-semibold py-1 pr-4 w-44 align-top">Catégorie</td>
              <td>{alert.category}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Entité</td>
              <td>{alert.concernedEntity}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Statut</td>
              <td>{alert.status.toUpperCase()}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Investigateur(s)</td>
              <td>{alert.assignedInvestigatorNames.join(', ') || 'Non attribué'}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Mesures correctives</td>
              <td>{alert.correctiveMeasures.length}</td>
            </tr>
            <tr>
              <td className="font-semibold py-1 pr-4 align-top">Clôturé le</td>
              <td>{formatDate(alert.closedAt, locale)}</td>
            </tr>
          </tbody>
        </table>
        {alert.closureSummary && (
          <p className="mt-3 pt-3 border-t border-slate-200">{alert.closureSummary}</p>
        )}
      </section>

      {model === 'full' && (
        <>
          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold mb-2">Notes d’investigation internes ({alert.internalNotes.length})</h2>
            {alert.internalNotes.length === 0 ? (
              <p className="italic text-slate-400">Aucune note enregistrée.</p>
            ) : (
              <ul className="space-y-2">
                {alert.internalNotes.map((n) => (
                  <li key={n.id} className="border-b border-slate-100 pb-2 break-inside-avoid">
                    <p className="text-slate-500">
                      {formatDateTime(n.createdAt, locale)} — {n.authorName} ({n.authorRole})
                    </p>
                    <p>{n.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold mb-2">Mesures correctives ({alert.correctiveMeasures.length})</h2>
            {alert.correctiveMeasures.length === 0 ? (
              <p className="italic text-slate-400">Aucune mesure corrective.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th className="py-1 pr-3">Titre</th>
                    <th className="py-1 pr-3">Responsable</th>
                    <th className="py-1 pr-3">Échéance</th>
                    <th className="py-1">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {alert.correctiveMeasures.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="py-1 pr-3">{m.title}</td>
                      <td className="py-1 pr-3">{m.responsiblePerson}</td>
                      <td className="py-1 pr-3">{formatDate(m.dueDate, locale)}</td>
                      <td className="py-1">{CORRECTIVE_STATUS_LABEL[m.status] ?? m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold mb-2">Pièces jointes ({alert.evidences.length})</h2>
            {alert.evidences.length === 0 ? (
              <p className="italic text-slate-400">Aucune pièce jointe.</p>
            ) : (
              <ul className="list-disc list-inside space-y-0.5">
                {alert.evidences.map((e) => (
                  <li key={e.id}>{e.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold mb-2">Journal d’audit du dossier ({caseAuditLogs.length})</h2>
            {caseAuditLogs.length === 0 ? (
              <p className="italic text-slate-400">Aucune entrée.</p>
            ) : (
              <ul className="space-y-1">
                {caseAuditLogs.map((l) => (
                  <li key={l.id} className="border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-mono">{formatDateTime(l.timestamp, locale)}</span> — {l.details}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <footer className="mt-10 pt-4 border-t border-slate-200 text-slate-400 flex justify-between text-[10px]">
        <span>Document confidentiel — activa-whistleblowing — Généré par {generatedByName}</span>
        <span>Groupe ACTIVA</span>
      </footer>
    </div>
  );
};
