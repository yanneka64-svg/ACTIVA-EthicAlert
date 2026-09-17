/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Quatorzième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110 pour les
 * étapes précédentes (voir aussi AddPersonModal.tsx, extrait dans la même
 * série). Extraction de la modale "Lier à un compte" pour une personne/
 * témoin déjà enregistré·e, hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleLinkPerson` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/le routage indépendant) : passé en prop tel
 * quel.
 */
import React from 'react';
import { UserProfile } from '../../types';
import { LinkedAccountSelect } from './LinkedAccountSelect';

interface LinkPersonModalProps {
  allUsers: UserProfile[];
  linkingPerson: { kind: 'subject' | 'witness'; id: string; currentName: string };
  setLinkingPerson: (v: { kind: 'subject' | 'witness'; id: string; currentName: string } | null) => void;
  handleLinkPerson: (e: React.FormEvent) => void;
  linkingUserId: string;
  setLinkingUserId: (v: string) => void;
}

export const LinkPersonModal: React.FC<LinkPersonModalProps> = ({
  allUsers,
  linkingPerson,
  setLinkingPerson,
  handleLinkPerson,
  linkingUserId,
  setLinkingUserId,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleLinkPerson} className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-slate-900">
          Lier « {linkingPerson.currentName || 'Confidentiel'} » à un compte
        </h3>
        <p className="text-slate-500">
          Si vous reconnaissez cette personne comme un collaborateur de la plateforme, rattachez-la à son compte réel. Le routage indépendant l'exclura alors automatiquement de l'accès à ce dossier.
        </p>
        <LinkedAccountSelect users={allUsers} value={linkingUserId} onChange={setLinkingUserId} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => setLinkingPerson(null)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">Enregistrer</button>
        </div>
      </form>
    </div>
  );
};
