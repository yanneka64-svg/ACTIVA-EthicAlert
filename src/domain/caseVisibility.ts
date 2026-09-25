/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 1 : listCases) ===
 *
 * Extrait la logique de filtrage/pagination jusqu'ici dupliquée à
 * l'identique à deux endroits (`data-access/caseRepository.ts`'s
 * `LocalCaseRepository.listCases`, et `scripts/firestoreAdminRepository.ts`'s
 * `listCases`) en une seule fonction pure, réutilisable aussi par la
 * nouvelle Cloud Function `listCases` (functions/src/index.ts) — aucune des
 * trois n'a plus besoin de réécrire cette boucle.
 *
 * Pur (aucun accès Firestore/localStorage) : importable aussi bien depuis le
 * navigateur que depuis le runtime Node des Cloud Functions, exactement
 * comme `domain/permissions.ts`/`domain/workflow.ts` le sont déjà pour
 * `functions/src/index.ts`.
 *
 * Réutilise `can()` (permissions.ts), déjà la source unique de vérité pour
 * "cet utilisateur peut-il lire ce dossier" — même précédence que
 * `useVisibleAlerts`/`firestore.rules` (implication d'abord, puis périmètre
 * pays/entité, puis confidentialité, puis assignation ou visibilité
 * globale) : rien n'est redéfini ici, seulement appliqué à une liste.
 */
import { AppUser, Case, Person } from './caseTypes';
import { can, implicatedUserIdsFromPersons } from './permissions';

export interface CaseListFilter {
  status?: Case['status'];
  country?: string;
  entity?: string;
  category?: string;
  priority?: string;
  assignee?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextOffset?: number;
}

/**
 * Filtre `cases` selon ce que `user` a le droit de lire (via `can()`) puis
 * selon les champs optionnels de `filter`, et applique la pagination
 * `limit`/`offset`. `personsByCase` doit contenir, pour chaque `caseId`, au
 * moins les `Person` de type `kind: 'subject'` (les seules qui comptent pour
 * `implicatedUserIdsFromPersons` — un appelant peut donc n'y mettre que
 * celles-ci s'il ne veut pas charger les témoins).
 */
export function filterVisibleCases(
  cases: Case[],
  personsByCase: Map<string, Person[]>,
  filter: CaseListFilter,
  user: AppUser,
  limit = 25,
  offset = 0
): Page<Case> {
  const all = cases.filter((kase) => {
    const implicated = implicatedUserIdsFromPersons(personsByCase.get(kase.caseId) ?? []);
    if (!can(user, 'cases.read', { case: kase, implicatedUserIds: implicated })) return false;
    if (filter.status && kase.status !== filter.status) return false;
    if (filter.country && kase.country !== filter.country) return false;
    if (filter.entity && kase.entity !== filter.entity) return false;
    if (filter.category && kase.category !== filter.category) return false;
    if (filter.priority && kase.priority !== filter.priority) return false;
    if (filter.assignee && kase.assignee !== filter.assignee) return false;
    return true;
  });

  const items = all.slice(offset, offset + limit);
  return { items, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : undefined };
}
