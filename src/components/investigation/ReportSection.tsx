/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dixième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107 pour les étapes précédentes.
 * Extraction du contenu de l'onglet "Rapport" hors du composant
 * monolithique, sans aucun changement de comportement.
 *
 * Particularité de cet onglet dans l'original : son contenu était réparti
 * en DEUX blocs JSX non adjacents dans le fichier
 * (`{activeCaseTab === 'report' && (...)}` apparaissait deux fois), avec
 * le contenu d'autres onglets (Communications/Mesures correctives/Tâches/
 * Entretiens/Chronologie/Allégations) intercalé entre les deux dans le
 * code source — un artefact de mise en page, puisque tous ces blocs sont
 * mutuellement exclusifs (un seul `activeCaseTab` actif à la fois) : le
 * rendu final produisait déjà les deux parties immédiatement l'une après
 * l'autre. Regroupées ici dans un seul composant, dans le même ordre
 * visuel (synthèse + notes internes, puis déclarations de conflit
 * d'intérêt) — code strictement déplacé, pas réécrit.
 *
 * `setShowPrintReport`/`internalNoteText`/`setInternalNoteText`/
 * `handleAddInternalNote`/`setConflictOutcome`/`setConflictDetails`/
 * `setShowConflictModal` restent possédés par InvestigationDesk.tsx (les
 * modales/écrans associés — impression, déclaration de conflit — ne sont
 * pas encore extraits) : passés en props tels quels.
 */
import React from 'react';
import { ClipboardList, Printer, Lock, UserCog } from 'lucide-react';
import { AlertRecord, Language } from '../../types';

interface ReportSectionProps {
  selectedAlert: AlertRecord;
  lang: Language;
  t: Record<string, string>;
  setShowPrintReport: (v: boolean) => void;
  internalNoteText: string;
  setInternalNoteText: (v: string) => void;
  handleAddInternalNote: (e: React.FormEvent) => void;
  setConflictOutcome: (v: 'no_conflict' | 'conflict_identified') => void;
  setConflictDetails: (v: string) => void;
  setShowConflictModal: (v: boolean) => void;
}

export const ReportSection: React.FC<ReportSectionProps> = ({
  selectedAlert,
  lang,
  t,
  setShowPrintReport,
  internalNoteText,
  setInternalNoteText,
  handleAddInternalNote,
  setConflictOutcome,
  setConflictDetails,
  setShowConflictModal,
}) => {
  return (
    <>
    <div className="p-6 space-y-6 max-h-[640px] overflow-y-auto text-xs">
      {/* Synthèse du dossier */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-600" />
          Synthèse du dossier
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700">
          <div><span className="text-slate-500">Catégorie :</span> {selectedAlert.category}</div>
          <div><span className="text-slate-500">Entité :</span> {selectedAlert.concernedEntity}</div>
          <div><span className="text-slate-500">Statut :</span> {selectedAlert.status.toUpperCase()}</div>
          <div><span className="text-slate-500">Investigateur(s) :</span> {selectedAlert.assignedInvestigatorNames.join(', ') || t.case_info_unassigned}</div>
          <div><span className="text-slate-500">Mesures correctives :</span> {selectedAlert.correctiveMeasures.length}</div>
          <div><span className="text-slate-500">Clôturé le :</span> {selectedAlert.closedAt ? new Date(selectedAlert.closedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '—'}</div>
        </div>
        {selectedAlert.closureSummary && (
          <p className="pt-2 border-t border-slate-200 text-slate-700 leading-relaxed">{selectedAlert.closureSummary}</p>
        )}
        {/* === AMÉLIORATION AJOUTÉE (rapports PDF réels avec
            en-tête ACTIVA) === Remplace l'appel direct à
            `window.print()` (imprimait toute la page — barre
            latérale, navigation comprises) par le contenu réel
            de CaseReportPrintView.tsx. */}
        <button
          onClick={() => setShowPrintReport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
        >
          <Printer className="w-3.5 h-3.5" />
          {t.case_btn_generate_report}
        </button>
      </div>

      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-700 shrink-0" />
        <span>Ces notes sont strictement confidentielles et ne sont JAMAIS visibles par le lanceur d'alerte.</span>
      </div>

      {/* Add internal note form */}
      <form onSubmit={handleAddInternalNote} className="space-y-3">
        <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
          Ajouter une note d'investigation interne
        </label>
        <textarea
          rows={3}
          value={internalNoteText}
          onChange={(e) => setInternalNoteText(e.target.value)}
          placeholder="Consignez les résultats d'entretiens, vérifications comptables, constats informatiques..."
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!internalNoteText.trim()}
            className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white font-bold transition"
          >
            Enregistrer la note
          </button>
        </div>
      </form>

      {/* Internal notes list */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          Historique des notes internes ({selectedAlert.internalNotes.length})
        </h5>
        {selectedAlert.internalNotes.length === 0 ? (
          <p className="text-slate-400 italic">Aucune note enregistrée.</p>
        ) : (
          selectedAlert.internalNotes.map((note) => (
            <div key={note.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#0B2545]">{note.authorName} ({note.authorRole})</span>
                <span className="text-slate-400">{new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
              </div>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>

    {/* === AMÉLIORATION AJOUTÉE (Phase 6 — Conflit d'intérêt ; Phase 11
        — déplacé sous l'onglet "Rapport") === real, persisted
        declarations (Phase 1's ConflictDeclaration type +
        storage.declareConflict, built but unused until now) — never
        a fabricated/derived list. */}
    <div className="p-6 pt-0 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{t.conflict_section_title}</div>
          <p className="text-slate-500 text-[11px] mt-0.5">{t.conflict_section_desc}</p>
        </div>
        <button
          onClick={() => { setConflictOutcome('no_conflict'); setConflictDetails(''); setShowConflictModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition shrink-0"
        >
          <UserCog className="w-3.5 h-3.5" />
          {t.conflict_btn_declare}
        </button>
      </div>

      {(selectedAlert.conflictDeclarations ?? []).length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
          {t.conflict_empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {(selectedAlert.conflictDeclarations ?? []).map((d) => (
            <li key={d.id} className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900">{d.userName}</span>
                <span className="text-[10px] text-slate-400">
                  {new Date(d.declaredAt).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                </span>
              </div>
              <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                d.outcome === 'no_conflict'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                  : 'bg-rose-100 text-rose-900 border-rose-200'
              }`}>
                {d.outcome === 'no_conflict' ? t.conflict_outcome_none : t.conflict_outcome_identified}
              </span>
              {d.details && <p className="text-slate-600 mt-1.5 leading-relaxed">{d.details}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
};
