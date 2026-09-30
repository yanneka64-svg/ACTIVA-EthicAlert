/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : coût et latence de listCases) ===
 *
 * La Cloud Function `listCases` lisait TOUTE la collection `cases` (+ toutes
 * les personnes de chaque dossier, une requête après l'autre) à chaque
 * appel, puis filtrait en mémoire : coût Firestore et latence croissant
 * linéairement avec le nombre total de dossiers, quel que soit le filtre.
 *
 * Ces helpers purs permettent de pousser les filtres d'ÉGALITÉ déjà
 * présents dans `CaseListFilter` jusqu'à la requête Firestore. Le résultat
 * est identique : `filterVisibleCases` (caseVisibility.ts) réapplique
 * ensuite exactement les mêmes filtres + l'autorisation `can()` — la
 * requête ne fait que réduire ce qui est lu, elle ne décide jamais seule de
 * ce qui est visible.
 *
 * Des égalités seules (sans tri ni inégalité) sont servies par les index
 * mono-champ automatiques de Firestore (fusion d'index) : aucun index
 * composite n'est requis.
 */
import type { CaseListFilter } from './caseVisibility';

/** Champs de `CaseListFilter` comparés par stricte égalité dans filterVisibleCases. */
export const CASE_QUERY_EQUALITY_FIELDS = ['status', 'country', 'entity', 'category', 'priority', 'assignee'] as const;
export type CaseQueryField = (typeof CASE_QUERY_EQUALITY_FIELDS)[number];

/**
 * Paires (champ, valeur) à appliquer en `where(champ, '==', valeur)`.
 * Seules les valeurs chaîne non vides sont poussées (même condition de
 * « filtre actif » que filterVisibleCases, qui teste la véracité) ; toute
 * autre valeur reste filtrée en mémoire, comme avant.
 */
export function caseQueryEqualities(filter: CaseListFilter | undefined | null): Array<[CaseQueryField, string]> {
  if (!filter || typeof filter !== 'object') return [];
  const out: Array<[CaseQueryField, string]> = [];
  for (const field of CASE_QUERY_EQUALITY_FIELDS) {
    const value = (filter as Record<string, unknown>)[field];
    if (typeof value === 'string' && value !== '') out.push([field, value]);
  }
  return out;
}

export const CASE_LIST_DEFAULT_LIMIT = 25;
export const CASE_LIST_MAX_LIMIT = 500;

/**
 * Validation stricte de la pagination reçue du client : entiers finis,
 * `limit` borné à [1, 500] (défaut 25), `offset` ≥ 0 (défaut 0). Évite
 * qu'une valeur NaN, négative ou démesurée n'arrive jusqu'au découpage.
 */
export function normalizePagination(limit: unknown, offset: unknown): { limit: number; offset: number } {
  const l = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : CASE_LIST_DEFAULT_LIMIT;
  const o = typeof offset === 'number' && Number.isFinite(offset) ? Math.floor(offset) : 0;
  return { limit: Math.min(Math.max(l, 1), CASE_LIST_MAX_LIMIT), offset: Math.max(o, 0) };
}
