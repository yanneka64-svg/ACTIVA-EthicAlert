/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Extrait tel quel depuis InvestigationDesk.tsx — petit composant partagé
 * entre la modale "+ Ajouter" (AddPersonModal.tsx) et la modale "Lier à un
 * compte" (LinkPersonModal.tsx), déplacé dans son propre fichier pour être
 * importé par les deux plutôt que dupliqué.
 *
 * === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
 * Évite de dupliquer deux fois le même <select> de rattachement d'une
 * personne impliquée/témoin à un compte réel de la plateforme
 * (InvolvedPerson.linkedUserId / Witness.linkedUserId, types.ts Phase 1).
 * Dès qu'un rattachement est défini, le routage indépendant
 * (domain/independentRouting.ts, Phase 3-4) exclura automatiquement ce
 * compte de l'accès au dossier.
 */
import React from 'react';
import { UserProfile } from '../../types';
import { currentT } from '../../i18n/currentLang';

export function LinkedAccountSelect({
  users,
  value,
  onChange,
}: {
  users: UserProfile[];
  value: string;
  onChange: (userId: string) => void;
}) {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
    >
      <option value="">{t.inv_no_account}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.name} — {u.roleTitle}</option>
      ))}
    </select>
  );
}
