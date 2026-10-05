/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Formulaires « + Ajouter » (personne impliquée / témoin) et « Lier à un
 * compte ».
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 * `mirrorAddedPerson` (helper de module, seul appelant : handleAddPerson) est
 * déplacé ici tel quel ; son import dynamique pointe vers le même module.
 */
import React, { useState } from 'react';
import { notifyEscalationRecipient } from '../../../services/emailNotify';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile, InvolvedPerson, Witness } from '../../../types';

// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14 : miroir des
// mutations secondaires) === Petit helper module-level (pas de hook, aucun
// état de composant) partagé par les deux branches (subject/witness) de
// handleAddPerson ci-dessous — best-effort, jamais attendu, jamais
// bloquant, uniquement si ce dossier porte un lien réel actif. Import
// dynamique : InvestigationDesk.tsx est déjà un gros chunk chargé à la
// demande — jamais d'import statique d'un module touchant
// firebase/functions ici.
function mirrorAddedPerson(
  alert: AlertRecord,
  kind: 'subject' | 'witness',
  name: string,
  position: string,
  hierarchyRole: string,
  linkedUserId: string | undefined,
  // === AMÉLIORATION AJOUTÉE === même identifiant côté serveur (rattachement ultérieur).
  clientId?: string
): void {
  if (!alert.mirroredCaseId) return;
  const mirroredCaseId = alert.mirroredCaseId;
  import('../../../services/caseMirrorSync')
    .then(({ mirrorAddPerson, HIERARCHY_ROLE_TO_LEVEL }) =>
      mirrorAddPerson({
        caseId: mirroredCaseId,
        kind,
        name,
        position: position || undefined,
        hierarchyLevel: HIERARCHY_ROLE_TO_LEVEL[hierarchyRole],
        linkedUserId,
        clientId,
      })
    )
    .catch(() => {});
}

export function usePersonForms(selectedAlert: AlertRecord | null, activeUser: UserProfile) {
  const [addPersonKind, setAddPersonKind] = useState<'subject' | 'witness' | null>(null);
  const [personNameInput, setPersonNameInput] = useState('');
  const [personPositionInput, setPersonPositionInput] = useState('');
  const [personHierarchyInput, setPersonHierarchyInput] = useState<InvolvedPerson['hierarchyRole']>('Employé');
  // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
  // Rattachement (facultatif) de la personne en cours de création à un
  // compte réel de la plateforme.
  const [personLinkedUserId, setPersonLinkedUserId] = useState('');
  // Édition du rattachement d'une personne/témoin déjà enregistré·e — aucun
  // handleEditPerson générique n'existait avant cette phase (seul
  // handleAddPerson, pour la création), d'où un état dédié plutôt que de
  // réutiliser addPersonKind (formulaire de création différent : nom/
  // fonction/niveau hiérarchique).
  const [linkingPerson, setLinkingPerson] = useState<{ kind: 'subject' | 'witness'; id: string; currentName: string } | null>(null);
  const [linkingUserId, setLinkingUserId] = useState('');

  // === AMÉLIORATION AJOUTÉE (Phase 11) === "+ Ajouter" sur Personnes impliquées / Témoins.
  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !addPersonKind || !personNameInput.trim()) return;
    if (addPersonKind === 'subject') {
      const entry: InvolvedPerson = {
        id: 'per-' + Date.now(),
        name: personNameInput.trim(),
        position: personPositionInput.trim(),
        hierarchyRole: personHierarchyInput,
        // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
        linkedUserId: personLinkedUserId || undefined,
      };
      storage.saveAlert({ ...selectedAlert, involvedPersons: [...selectedAlert.involvedPersons, entry], updatedAt: new Date().toISOString() });
      mirrorAddedPerson(selectedAlert, 'subject', entry.name, entry.position, entry.hierarchyRole, entry.linkedUserId, entry.id);
    } else {
      const entry: Witness = {
        id: 'wit-' + Date.now(),
        name: personNameInput.trim(),
        position: personPositionInput.trim(),
        hierarchyRole: personHierarchyInput,
        // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
        linkedUserId: personLinkedUserId || undefined,
      };
      storage.saveAlert({ ...selectedAlert, witnesses: [...selectedAlert.witnesses, entry], updatedAt: new Date().toISOString() });
      mirrorAddedPerson(selectedAlert, 'witness', entry.name, entry.position, entry.hierarchyRole, entry.linkedUserId, entry.id);
    }
    // === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
    // Un rattachement défini dès la création déclenche immédiatement le
    // routage indépendant (storage.triggerIndependentRouting, Phase 4).
    if (personLinkedUserId) {
      const fallbackRecipient = storage.triggerIndependentRouting(selectedAlert.id, activeUser);
      // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et
      // de routage) === Aucune autorité interne trouvée → notifie le
      // destinataire de dernier recours identifié par storage.ts.
      if (fallbackRecipient) {
        notifyEscalationRecipient(fallbackRecipient, selectedAlert, activeUser, 'Routage indépendant non résolu — intervention manuelle requise');
      }
    }
    setAddPersonKind(null);
    setPersonNameInput('');
    setPersonPositionInput('');
    setPersonHierarchyInput('Employé');
    // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
    setPersonLinkedUserId('');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
  // Rattache (ou modifie le rattachement) d'une personne/témoin déjà
  // enregistré·e à un compte réel de la plateforme. Dès que le
  // rattachement résultant est défini (nouveau lien ou changement de
  // compte lié), déclenche le routage indépendant (Phase 4) — voir
  // storage.triggerIndependentRouting ci-dessous.
  const handleLinkPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !linkingPerson) return;
    const resolvedUserId = linkingUserId || undefined;
    if (linkingPerson.kind === 'subject') {
      const involvedPersons = selectedAlert.involvedPersons.map((p) =>
        p.id === linkingPerson.id ? { ...p, linkedUserId: resolvedUserId } : p
      );
      storage.saveAlert({ ...selectedAlert, involvedPersons, updatedAt: new Date().toISOString() });
    } else {
      const witnesses = selectedAlert.witnesses.map((w) =>
        w.id === linkingPerson.id ? { ...w, linkedUserId: resolvedUserId } : w
      );
      storage.saveAlert({ ...selectedAlert, witnesses, updatedAt: new Date().toISOString() });
    }
    // === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
    if (resolvedUserId) {
      const fallbackRecipient = storage.triggerIndependentRouting(selectedAlert.id, activeUser);
      if (fallbackRecipient) {
        notifyEscalationRecipient(fallbackRecipient, selectedAlert, activeUser, 'Routage indépendant non résolu — intervention manuelle requise');
      }
    }
    setLinkingPerson(null);
    setLinkingUserId('');
  };

  return {
    addPersonKind,
    setAddPersonKind,
    personNameInput,
    setPersonNameInput,
    personPositionInput,
    setPersonPositionInput,
    personHierarchyInput,
    setPersonHierarchyInput,
    personLinkedUserId,
    setPersonLinkedUserId,
    linkingPerson,
    setLinkingPerson,
    linkingUserId,
    setLinkingUserId,
    handleAddPerson,
    handleLinkPerson,
  };
}
