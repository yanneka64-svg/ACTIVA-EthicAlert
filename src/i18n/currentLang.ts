/**
 * === AMÉLIORATION AJOUTÉE : langue d'affichage courante (FR/EN/PT) ===
 *
 * Mémorise la langue choisie dans l'en-tête pour les petits composants
 * (modales, lignes de liste…) qui ne reçoivent pas `lang`/`t` en prop.
 * App.tsx appelle `setCurrentLang(lang)` à chaque rendu, avant ses enfants :
 * un changement de langue re-rend l'arbre, qui relit donc la bonne valeur.
 * Défaut : français (comportement historique inchangé).
 */
import { Language } from '../types';
import { TRANSLATIONS } from './translations';

let currentLang: Language = 'fr';

export function setCurrentLang(lang: Language): void {
  currentLang = lang;
}

export function getCurrentLang(): Language {
  return currentLang;
}

/** Table de traduction de la langue courante. */
export function currentT(): Record<string, string> {
  return TRANSLATIONS[currentLang];
}
