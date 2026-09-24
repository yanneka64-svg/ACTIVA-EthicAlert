/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Treizième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110 pour les
 * étapes précédentes. Extraction de la modale partagée "+ Ajouter"
 * (Personnes impliquées / Témoins), ouverte depuis OverviewSection.tsx et
 * PersonsSection.tsx, hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `LinkedAccountSelect` (déjà partagé avec cette modale et
 * LinkPersonModal.tsx) est désormais importé depuis son propre fichier
 * plutôt que défini localement dans InvestigationDesk.tsx.
 *
 * `handleAddPerson` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/le routage indépendant) : passé en prop tel
 * quel.
 */
import React from 'react';
import { UserProfile, InvolvedPerson } from '../../types';
import { LinkedAccountSelect } from './LinkedAccountSelect';

interface AddPersonModalProps {
  t: Record<string, string>;
  allUsers: UserProfile[];
  addPersonKind: 'subject' | 'witness';
  setAddPersonKind: (kind: 'subject' | 'witness' | null) => void;
  handleAddPerson: (e: React.FormEvent) => void;
  personNameInput: string;
  setPersonNameInput: (v: string) => void;
  personPositionInput: string;
  setPersonPositionInput: (v: string) => void;
  personHierarchyInput: InvolvedPerson['hierarchyRole'];
  setPersonHierarchyInput: (v: InvolvedPerson['hierarchyRole']) => void;
  personLinkedUserId: string;
  setPersonLinkedUserId: (v: string) => void;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  t,
  allUsers,
  addPersonKind,
  setAddPersonKind,
  handleAddPerson,
  personNameInput,
  setPersonNameInput,
  personPositionInput,
  setPersonPositionInput,
  personHierarchyInput,
  setPersonHierarchyInput,
  personLinkedUserId,
  setPersonLinkedUserId,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleAddPerson} className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-slate-900">{t.person_modal_title}</h3>
        {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Ajouter une
            personne) === pills "Type de personne" façon maquette —
            permet de choisir/changer la liste cible (Personnes
            impliquées ou Témoins) directement dans la modale,
            plutôt que par deux boutons "+ Ajouter" distincts
            seulement. Pas de pill "Autre" : aucune 3e liste
            n'existe sur AlertRecord (seuls `involvedPersons` et
            `witnesses`) — l'ajouter aurait été une catégorie sans
            donnée réelle derrière (brief §32). */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.person_modal_type}</label>
          <div className="flex gap-1.5">
            {(['subject', 'witness'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAddPersonKind(k)}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  addPersonKind === k ? 'bg-[#0B2545] text-white border-[#0B2545]' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {k === 'subject' ? t.person_modal_kind_subject : t.person_modal_kind_witness}
              </button>
            ))}
          </div>
        </div>
        <input
          autoFocus
          value={personNameInput}
          onChange={(e) => setPersonNameInput(e.target.value)}
          placeholder={t.inv_person_name_ph}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <input
          value={personPositionInput}
          onChange={(e) => setPersonPositionInput(e.target.value)}
          placeholder={t.inv_person_position_ph}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <select
          value={personHierarchyInput}
          onChange={(e) => setPersonHierarchyInput(e.target.value as InvolvedPerson['hierarchyRole'])}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
        >
          <option value={t.sub_hier_employee}>{t.sub_hier_employee}</option>
          <option value={t.sub_hier_manager}>{t.sub_hier_manager}</option>
          <option value={t.sub_hier_deputy_director}>{t.sub_hier_deputy_director}</option>
          <option value={t.sub_hier_director}>{t.sub_hier_director}</option>
        </select>
        {/* === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) === */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.inv_person_link_optional}</label>
          <LinkedAccountSelect users={allUsers} value={personLinkedUserId} onChange={setPersonLinkedUserId} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => setAddPersonKind(null)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
          <button type="submit" disabled={!personNameInput.trim()} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold">{t.case_btn_add}</button>
        </div>
      </form>
    </div>
  );
};
