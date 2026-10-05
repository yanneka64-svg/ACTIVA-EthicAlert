# Revue du design — octobre 2026

Revue de l'ensemble des écrans (public, opérateur, enquêteur, administration),
en version bureau et téléphone, avec des données de test réalistes.

## Constats

| # | Constat | Gravité | Traitement |
|---|---|---|---|
| 1 | Police système par défaut (Segoe UI / Arial selon le poste) : rendu générique, différent d'un poste à l'autre | Moyen | **Corrigé** — Plus Jakarta Sans, hébergée avec l'application |
| 2 | Changement d'écran instantané, sans transition | Moyen | **Corrigé** — fondu enchaîné doux (le menu latéral, l'en-tête et le pied de page restent fixes) |
| 3 | Badge de statut de la fiche dossier en anglais (« CLOSED ») | Élevé | **Corrigé** — libellé traduit (« CLÔTURÉ ») |
| 4 | Taille des petits fichiers affichée « 0 Ko » | Faible | **Corrigé** — « 84 o », « 37 Ko », « 2,4 Mo » |
| 5 | Chargement d'un écran : simple sablier | Faible | **Corrigé** — squelette de page animé |
| 6 | Pied de page épinglé très haut sur téléphone | Moyen | **Corrigé** — un tiers plus compact |
| 7 | Focus clavier peu visible sur de nombreux boutons | Moyen (accessibilité) | **Corrigé** — contour bleu net partout |
| 8 | Barres de défilement épaisses | Faible | **Corrigé** — barres fines et discrètes |
| 9 | Aucune indication que le contenu défile sous l'en-tête | Faible | **Corrigé** — ombre douce de l'en-tête au défilement |

## Mouvements ajoutés

- Transitions entre écrans : sortie en fondu (0,2 s), entrée en fondu avec légère montée et mise au point (0,6 s, ralenti en fin de course).
- Chiffres clés : défilement jusqu'à leur valeur (0,9 s).
- Lignes de tableau : apparition en cascade.
- Cartes cliquables : légère élévation au survol.
- Boutons, liens et champs : transitions de couleur et d'ombre fluides.

Tous les mouvements sont désactivés pour les personnes qui ont demandé à leur
système de limiter les animations.

## Où se trouve le code

- `src/index.css` — section « revue design — finitions et mouvements » ;
- `src/app/viewTransition.ts` — transitions entre écrans ;
- `src/components/ui/CountUp.tsx` — chiffres animés ;
- `src/components/ui/fileSize.ts` — tailles de fichier.
