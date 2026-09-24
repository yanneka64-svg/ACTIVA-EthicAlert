/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dix-huitième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/
 * #112/#113/#114 pour les étapes précédentes. `AssignCandidateRow` était
 * exporté depuis InvestigationDesk.tsx (auparavant privé à ce fichier,
 * puis exporté pour être réutilisé tel quel par OperatorCaseDesk.tsx, voir
 * commentaire d'origine ci-dessous) — déplacé ici dans son propre fichier
 * plutôt que de laisser OperatorCaseDesk.tsx importer un composant partagé
 * depuis un autre écran métier encore en cours de refactor.
 * InvestigationDesk.tsx et OperatorCaseDesk.tsx importent désormais tous
 * deux depuis ce fichier. Aucun changement de comportement.
 *
 * === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
 * Petit composant partagé entre les deux groupes (compatibles / autorisés
 * Groupe) de la modale d'attribution — évite de dupliquer deux fois le
 * même balisage checkbox + charge de travail.
 *
 * === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === Exportée (auparavant
 * privée à InvestigationDesk.tsx) pour qu'OperatorCaseDesk.tsx réutilise
 * exactement le même balisage checkbox + charge de travail pour son propre
 * panneau d'attribution, plutôt que de le dupliquer — aucun changement de
 * comportement ici.
 */
import React from 'react';
import { AssignmentCandidate } from '../../domain/assignmentEngine';
import { formatCountryLabel } from '../../data/activaConfig';
import { storage } from '../../services/storage';
import { currentT } from '../../i18n/currentLang';

export function AssignCandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: AssignmentCandidate;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  const { user: inv, workload } = candidate;
  return (
    <label
      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
        checked ? 'bg-blue-50 border-blue-400 font-semibold' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div>
        <div className="text-slate-900">{inv.name}</div>
        <div className="text-[11px] text-slate-500">{inv.roleTitle} • {formatCountryLabel(storage.getCountries(), inv.country)}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {t.inv_active_cases.replace('{n}', String(workload.active))}
          {workload.overdue > 0 && <span className="text-rose-600 font-semibold"> · {t.inv_overdue_n.replace('{n}', String(workload.overdue))}</span>}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="rounded text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}
