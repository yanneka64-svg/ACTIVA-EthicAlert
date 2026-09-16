/**
 * === AMÉLIORATION AJOUTÉE (couverture de tests pour la couche backend cible) ===
 *
 * `LocalCaseRepository` (caseRepository.ts) lit/écrit `localStorage` — présent
 * dans un vrai navigateur, mais absent de l'environnement Vitest par défaut de
 * ce projet (aucun `jsdom`/`happy-dom` installé ; vérifié : `localStorage` y
 * lève `ReferenceError`). `loadArray`/`saveArray` avalent silencieusement
 * cette erreur (comportement voulu en production : ne jamais planter l'UI si
 * le stockage est indisponible), ce qui masquerait tout bug réel dans les
 * tests eux-mêmes — d'où ce petit polyfill en mémoire, utilisé uniquement par
 * les tests de ce dossier, jamais importé par le code applicatif.
 */
export function installTestLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
