/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Quatrième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99 pour les étapes précédentes. Extraction du contenu de l'onglet
 * "Personnes" (personnes impliquées + témoins) hors du composant
 * monolithique, sans aucun changement de comportement. Code strictement
 * déplacé, pas réécrit. Réutilise le `PersonRow` déjà extrait (voir
 * PersonRow.tsx), qu'InvestigationDesk.tsx importe désormais lui aussi
 * pour son propre résumé "Vue d'ensemble" (pas encore extrait).
 *
 * `setAddPersonKind`/`setLinkingPerson`/`setLinkingUserId` restent des
 * setters d'état possédés par InvestigationDesk.tsx (les modales
 * correspondantes — ajout de personne, liaison de compte — n'ont pas
 * encore été extraites) : passés en props tels quels.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { AlertRecord, UserProfile } from '../../types';
import { PersonRow } from './PersonRow';

interface PersonsSectionProps {
  selectedAlert: AlertRecord;
  allUsers: UserProfile[];
  t: Record<string, string>;
  setAddPersonKind: (kind: 'subject' | 'witness') => void;
  setLinkingPerson: (v: { kind: 'subject' | 'witness'; id: string; currentName: string }) => void;
  setLinkingUserId: (v: string) => void;
}

export const PersonsSection: React.FC<PersonsSectionProps> = ({
  selectedAlert,
  allUsers,
  t,
  setAddPersonKind,
  setLinkingPerson,
  setLinkingUserId,
}) => {
  return (
    <div className="p-6 space-y-4 max-h-[640px] overflow-y-auto text-xs">
      {(['subject', 'witness'] as const).map((kind) => {
        const list = kind === 'subject' ? selectedAlert.involvedPersons : selectedAlert.witnesses;
        return (
          <div key={kind} className="p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-slate-900">
                {(kind === 'subject' ? t.inv_persons_involved_n : t.inv_witnesses_n).replace('{n}', String(list.length))}
              </h5>
              <button
                onClick={() => setAddPersonKind(kind)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.case_btn_add}
              </button>
            </div>
            {list.length === 0 ? (
              <p className="text-slate-400 italic">{t.inv_not_specified}</p>
            ) : (
              <div className="space-y-1.5">
                {list.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    users={allUsers}
                    dense={false}
                    onLinkClick={() => { setLinkingPerson({ kind, id: p.id, currentName: p.name }); setLinkingUserId(p.linkedUserId ?? ''); }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
