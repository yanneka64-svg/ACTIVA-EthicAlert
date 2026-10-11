# Environnements : local, test (recette), production

> === AMÉLIORATION AJOUTÉE (séparation test / production) ===

| | Local | Test (recette) | Production |
|---|---|---|---|
| Où | Poste du développeur, émulateurs | Projet Firebase **distinct** (ex. `activa-ethicalert-staging`) | `activa-ethicalert-47246` (activa-alertes.com) |
| Données | Fictives, effacées à chaque test | Fictives, saisies par les testeurs | **Réelles** |
| Déploiement | — | Push sur la branche `staging` (`firebase-staging.yml`) | Fusion sur `main` (site) et lancement manuel (fonctions) |
| Bandeau | Étiquette « Développement local » | Bandeau orange « Environnement de TEST » | Aucun |
| Tests automatiques | Job `emulator-tests` de la CI, à chaque push | — | — |

## Garde-fous en place

- **Projets séparés** : le test a sa propre base, ses propres comptes et
  fonctions, et ses propres identifiants de déploiement. Une erreur de test
  ne peut pas toucher les vrais signalements.
- **Bandeau rouge** si une version de test est reliée par erreur à la base
  de production (`src/domain/environment.ts`).
- **Workflow de test qui refuse la production** : il s'arrête si son projet
  est celui de production, ou si la configuration Web ne correspond pas à
  son projet.
- **Scripts de démonstration bloqués en production** : `seedFirestore` et
  `setupAuthUsers` refusent le projet de production sauf
  `CONFIRM_PRODUCTION=oui-production`.
- **Pas de valeur de production figée dans le code serveur** : le bucket de
  stockage et le lien des e-mails dépendent du projet où tournent les
  fonctions.
- **Environnement GitHub `production`** sur les deux workflows de mise en
  production. On peut y exiger une approbation humaine.

## Mise en place de l'environnement de test (une fois, ~30 min)

1. **Créer le projet** dans la console Firebase, par exemple
   `activa-ethicalert-staging`, sur le plan Blaze (requis pour les
   fonctions). Ensuite :
   - activer **Authentication** (e-mail / mot de passe, et TOTP si l'on veut
     tester la double authentification) ;
   - créer la base **Firestore nommée `default`** (même nom qu'en
     production) ;
   - ajouter une **application Web** et noter sa configuration.
2. **Fédération d'identité GitHub** pour ce projet : mêmes commandes que
   `docs/DEVOPS-RUNBOOK.md` §WIF, avec ce projet et la condition
   `assertion.ref=='refs/heads/staging'`. Donner au compte de service les
   rôles de déploiement Hosting, Functions et Firestore.
3. **Créer l'environnement GitHub `staging`** dans Settings → Environments,
   avec :
   - variables : `STAGING_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
     `GCP_DEPLOY_SERVICE_ACCOUNT` (ceux du projet de test),
     `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` (facultatif) ;
   - secrets : `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
     `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, tous ceux
     du projet de **test**. `RESEND_API_KEY` est facultatif : sans lui,
     aucun e-mail ne part.
4. **Créer la branche `staging`** depuis `main`. Chaque push la déploie sur
   le projet de test.
5. **Créer l'administrateur de test** avec le workflow
   `staff-bootstrap-admin.yml` adapté, ou
   `GCLOUD_PROJECT=<projet-de-test> npx tsx scripts/bootstrapStaffAdmin.ts`.

## Protéger la production

Dans Settings → Environments → **production**, cocher **Required reviewers**
et choisir une ou deux personnes. Toute mise en ligne (site ou fonctions)
attendra alors leur validation. L'environnement est créé automatiquement au
premier déploiement s'il n'existe pas encore.

## Circuit recommandé d'une modification

1. Développement et tests automatiques (CI : TypeScript, tests unitaires,
   build, scénarios sur émulateurs).
2. Fusion dans `staging` : recette par les utilisateurs clés sur
   l'environnement de test.
3. Fusion dans `main`, approbation, mise en production.
