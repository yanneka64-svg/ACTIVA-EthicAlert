import { Language } from '../types';
// === AMÉLIORATION AJOUTÉE (Refactor translations.ts — un fichier par langue) ===
// Les ~1 450 à 1 640 lignes de libellés de chaque langue vivent désormais
// dans ./locales/fr.ts, ./locales/en.ts et ./locales/pt.ts (déplacées
// telles quelles). `TRANSLATIONS` garde exactement le même nom, le même
// type et la même forme { fr, en, pt } : aucun des fichiers qui l'importent
// n'est modifié. Pour ajouter une clé : l'ajouter dans les 3 fichiers de
// langue (translations.test.ts vérifie la parité et les placeholders).
import { fr } from './locales/fr';
import { en } from './locales/en';
import { pt } from './locales/pt';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  fr,
  en,
  pt,
};
