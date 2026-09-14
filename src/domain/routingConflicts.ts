// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
//
// Extrait de domain/independentRouting.ts (Phase 3) dans son propre petit
// module : `domain/assignmentEngine.ts` a besoin de `getConflictedUserIds`
// (pour exclure les personnes mises en cause/témoins liés des candidats à
// une réattribution manuelle), mais `independentRouting.ts` importe déjà
// `scopeMatchFor` DEPUIS `assignmentEngine.ts` (Phase 3) — les deux
// fonctions ci-dessous n'ayant elles-mêmes aucune dépendance sur
// `assignmentEngine.ts`, les isoler ici évite un import circulaire entre
// les deux modules plutôt que de compter sur le fait que ça fonctionne
// quand même (cas d'usage purement fonctionnel, aucun état de module
// évalué au chargement). `independentRouting.ts` continue de les
// ré-exporter pour ne rien changer à l'API déjà utilisée (Phase 3, tests).

import { AlertRecord } from '../types';

/**
 * Comptes réels rattachés aux PERSONNES MISES EN CAUSE de ce dossier
 * (InvolvedPerson.linkedUserId). Ce sont ces comptes-là, et uniquement
 * ceux-là, qui perdent tout accès au dossier (§49).
 */
export function getImplicatedUserIds(alert: Pick<AlertRecord, 'involvedPersons'>): string[] {
  const ids = alert.involvedPersons
    .map((p) => p.linkedUserId)
    .filter((id): id is string => !!id);
  return Array.from(new Set(ids));
}

/**
 * Comptes qui ne peuvent pas devenir la nouvelle autorité de ce dossier ni
 * rester/devenir un enquêteur assigné : les personnes mises en cause
 * ci-dessus, PLUS les témoins liés — sans que cela exclue un témoin lié de
 * la simple VISIBILITÉ du dossier (voir authz.isImplicated, qui n'utilise
 * volontairement que getImplicatedUserIds).
 */
export function getConflictedUserIds(alert: Pick<AlertRecord, 'involvedPersons' | 'witnesses'>): string[] {
  const witnessIds = alert.witnesses
    .map((w) => w.linkedUserId)
    .filter((id): id is string => !!id);
  return Array.from(new Set([...getImplicatedUserIds(alert), ...witnessIds]));
}
