/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-sixième étape du refactor par section d'InvestigationDesk.tsx —
 * voir CaseDetailHeader.tsx (étape précédente) pour le reste de
 * l'historique. Extraction de la barre d'onglets de la fiche dossier (les
 * 9 boutons — Vue d'ensemble, Allégations, Personnes, Preuves, Tâches,
 * Entretiens, Communications, Mesures correctives, Rapport, Journal
 * d'audit) hors du composant monolithique, sans aucun changement de
 * comportement. Code strictement déplacé, pas réécrit.
 *
 * Reste imbriquée telle quelle dans la colonne gauche
 * d'InvestigationDesk.tsx, juste avant le switch de contenu par onglet
 * (qui reste en place, non extrait) — `setActiveCaseTab` reste possédé par
 * InvestigationDesk.tsx puisqu'il pilote aussi ce switch.
 */
import React from 'react';
import { AlertRecord } from '../../types';

type CaseTab = 'overview' | 'messages' | 'corrective' | 'tasks' | 'interviews' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report';

interface CaseTabBarProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  activeCaseTab: CaseTab;
  setActiveCaseTab: (v: CaseTab) => void;
}

export const CaseTabBar: React.FC<CaseTabBarProps> = ({ t, selectedAlert, activeCaseTab, setActiveCaseTab }) => {
  return (
    <div className="flex overflow-x-auto border-b border-slate-200 px-6 text-xs font-semibold">
      <button
        onClick={() => setActiveCaseTab('overview')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
          activeCaseTab === 'overview'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        {t.tab_overview_exact}
      </button>
      <button
        onClick={() => setActiveCaseTab('triage')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'triage'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.tab_allegations}</span>
        {selectedAlert.overridePriority && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={t.desk_priority_adjusted} />
        )}
      </button>
      <button
        onClick={() => setActiveCaseTab('persons')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'persons'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.tab_persons}</span>
        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
          {selectedAlert.involvedPersons.length}
        </span>
      </button>
      <button
        onClick={() => setActiveCaseTab('evidence_tab')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'evidence_tab'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.nav_evidence}</span>
        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
          {selectedAlert.evidences.length}
        </span>
      </button>
      <button
        onClick={() => setActiveCaseTab('tasks')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'tasks'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.nav_tasks}</span>
        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
          {(selectedAlert.tasks ?? []).length}
        </span>
      </button>
      {/* === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === */}
      <button
        onClick={() => setActiveCaseTab('interviews')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'interviews'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.nav_interviews}</span>
        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
          {(selectedAlert.interviews ?? []).length}
        </span>
      </button>
      <button
        onClick={() => setActiveCaseTab('messages')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'messages'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.nav_communications}</span>
        <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
          {selectedAlert.messages.length}
        </span>
      </button>
      <button
        onClick={() => setActiveCaseTab('corrective')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
          activeCaseTab === 'corrective'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{t.sidebar_corrective_measures}</span>
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
          selectedAlert.correctiveMeasures.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {selectedAlert.correctiveMeasures.length}
        </span>
      </button>
      <button
        onClick={() => setActiveCaseTab('report')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
          activeCaseTab === 'report'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        {t.tab_report}
      </button>
      <button
        onClick={() => setActiveCaseTab('timeline')}
        className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
          activeCaseTab === 'timeline'
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        {t.tab_audit_journal}
      </button>
    </div>
  );
};
