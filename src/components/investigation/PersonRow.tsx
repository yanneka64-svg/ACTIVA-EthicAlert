/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Troisième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99 pour les étapes précédentes. `PersonRow` était un petit helper
 * module-privé partagé entre le résumé de l'onglet "Vue d'ensemble" et
 * l'onglet "Personnes" dédié, tous deux dans InvestigationDesk.tsx. Extrait
 * ici tel quel (même props, même rendu) pour que le nouvel onglet
 * "Personnes" extrait (voir PersonsSection.tsx) puisse l'importer sans
 * dépendance circulaire vers InvestigationDesk.tsx, qui l'importe
 * désormais lui aussi pour son propre résumé "Vue d'ensemble" (pas encore
 * extrait).
 *
 * === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
 * Ligne Personne impliquée/Témoin, partagée entre le résumé de l'onglet
 * Vue d'ensemble et l'onglet Personnes dédié — ces deux rendus affichaient
 * jusqu'ici un balisage identique dupliqué. Ajoute l'indicateur "Compte
 * lié" et l'affordance "Lier à un compte" sans changer le rendu existant
 * (avatar/nom/fonction/niveau hiérarchique) ; `dense` reproduit fidèlement
 * les deux légères différences de taille qui existaient déjà entre les
 * deux contextes (résumé compact vs. onglet dédié).
 */
import React from 'react';
import { Link2, ChevronRight } from 'lucide-react';
import { InvolvedPerson, Witness, UserProfile } from '../../types';
import { currentT } from '../../i18n/currentLang';

export function PersonRow({
  person,
  users,
  dense,
  onLinkClick,
}: {
  person: InvolvedPerson | Witness;
  users: UserProfile[];
  dense: boolean;
  onLinkClick: () => void;
}) {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  const linkedUser = person.linkedUserId ? users.find((u) => u.id === person.linkedUserId) : undefined;
  return (
    <div className={`flex items-center gap-2.5 ${dense ? 'p-2' : 'p-2.5'} bg-slate-50 rounded-lg border border-slate-100`}>
      <span className={`${dense ? 'w-8 h-8 text-[11px]' : 'w-9 h-9 text-xs'} rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0`}>
        {(person.name || '??').slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-bold text-slate-900 block truncate">{person.name || t.desk_confidential}</span>
        <div className="text-[11px] text-slate-500 truncate">{person.position} • {person.hierarchyRole}</div>
        {linkedUser && (
          <div className="text-[10px] text-emerald-700 font-semibold truncate flex items-center gap-1 mt-0.5">
            <Link2 className="w-3 h-3" />
            {t.inv_linked_account.replace('{name}', linkedUser.name)}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onLinkClick}
        title={t.inv_link_account}
        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
    </div>
  );
}
