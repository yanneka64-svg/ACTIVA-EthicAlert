/**
 * === AMÉLIORATION AJOUTÉE (Incohérence i18n — audit et garde-fou) ===
 *
 * Aucun test ne verrouillait jusqu'ici la parité stricte FR/EN/PT déjà
 * respectée dans ce fichier (818 clés, toutes présentes dans les 3 langues
 * avec les mêmes placeholders `{xxx}`) — un futur ajout aurait pu la casser
 * silencieusement (clé oubliée dans une langue, `{tracking}` devenu
 * `{track}` dans une seule langue...). Ces tests la rendent permanente.
 *
 * Ne couvre PAS le texte codé en dur directement dans le JSX (jamais passé
 * par `t.xxx` du tout) — ce n'est pas une propriété de ce fichier de
 * traductions, mais des composants qui l'utilisent ou non.
 */
import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from './translations';

const LANGS = ['fr', 'en', 'pt'] as const;
const PLACEHOLDER_RE = /\{[a-zA-Z]+\}/g;

describe('TRANSLATIONS — strict FR/EN/PT parity', () => {
  it('every key present in one language is present in all three', () => {
    const keySets = LANGS.map((l) => new Set(Object.keys(TRANSLATIONS[l])));
    const allKeys = new Set<string>();
    keySets.forEach((s) => s.forEach((k) => allKeys.add(k)));

    const missing: string[] = [];
    for (const key of allKeys) {
      LANGS.forEach((l, i) => {
        if (!keySets[i].has(key)) missing.push(`${key} (missing in ${l})`);
      });
    }
    expect(missing).toEqual([]);
  });

  it('no value is empty or whitespace-only', () => {
    const empties: string[] = [];
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(TRANSLATIONS[l])) {
        if (typeof v !== 'string' || v.trim() === '') empties.push(`${l}.${k}`);
      }
    }
    expect(empties).toEqual([]);
  });

  it('every key uses the exact same set of {placeholder} tokens across all three languages', () => {
    const keys = Object.keys(TRANSLATIONS.fr);
    const mismatches: string[] = [];
    for (const key of keys) {
      const placeholderSets = LANGS.map((l) => new Set(TRANSLATIONS[l][key]?.match(PLACEHOLDER_RE) ?? []));
      const [fr, en, pt] = placeholderSets;
      const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
      if (!same(fr, en) || !same(fr, pt)) {
        mismatches.push(`${key} fr=${[...fr]} en=${[...en]} pt=${[...pt]}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
