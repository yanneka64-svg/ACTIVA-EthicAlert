// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
//
// Jusqu'ici, la question "quels dossiers ce profil peut-il voir ?" était
// répondue par la même logique à 2 branches (vision globale du rôle OU
// assignation directe), copiée indépendamment dans 6 écrans
// (InvestigationDesk, EvidenceRegistry, CommunicationsRegistry,
// CorrectiveActionsRegistry, TasksRegistry, ControlPanel). Ce hook devient
// la SEULE implémentation, appelée par chacun de ces écrans, et ajoute
// deux dimensions qu'aucun d'eux n'appliquait encore :
//   - le périmètre pays/entité du compte (UserProfile.countries/entities,
//     Phase 1) contre le rattachement du dossier (AlertRecord.countryId/
//     entityId, Phase 1) — voir authz.isInScope() ;
//   - le plafond de confidentialité propre au compte, s'il en a un
//     (UserProfile.sensitivityClearance) — voir
//     authz.canSeeAlertConfidentiality().
//
// Formule : VISIBLE = (assigné OU vision globale du rôle)
//                      ET dans le périmètre pays/entité
//                      ET sous le plafond de confidentialité.
// Reflète exactement `can()` dans domain/permissions.ts, appliqué ici au
// modèle réellement utilisé par l'application (UserProfile/AlertRecord).
//
// Comportement inchangé pour l'existant : aucun compte ni dossier
// aujourd'hui n'utilise encore countries/entities/sensitivityClearance de
// façon restrictive (Phase 1 les a tous laissés à "illimité" ou absents),
// donc ce hook filtre, pour le moment, exactement comme l'ancien code
// dupliqué qu'il remplace.

import { useMemo } from 'react';
import { AlertRecord, UserProfile } from '../types';
import { isGlobalCaseViewer, isInScope, canSeeAlertConfidentiality } from '../services/authz';

// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
// Logique pure séparée du hook React lui-même, pour être testable
// directement (voir useVisibleAlerts.test.ts) sans dépendance de rendu
// React (aucune bibliothèque de test de hooks n'est installée dans ce
// projet). `useVisibleAlerts` ci-dessous n'est qu'un `useMemo` autour de
// cette fonction.
export function computeVisibleAlerts(alerts: AlertRecord[], activeUser: UserProfile): AlertRecord[] {
  const isGlobalViewer = isGlobalCaseViewer(activeUser);
  return alerts.filter((alert) => {
    if (!isGlobalViewer && !alert.assignedInvestigators.includes(activeUser.id)) return false;
    if (!isInScope(activeUser, alert)) return false;
    if (!canSeeAlertConfidentiality(activeUser, alert)) return false;
    return true;
  });
}

export function useVisibleAlerts(alerts: AlertRecord[], activeUser: UserProfile): AlertRecord[] {
  return useMemo(() => computeVisibleAlerts(alerts, activeUser), [alerts, activeUser]);
}
