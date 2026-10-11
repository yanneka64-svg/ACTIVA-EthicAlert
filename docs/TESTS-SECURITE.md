# Tests hors « happy path » et sécurité

> === AMÉLIORATION AJOUTÉE (tests hors « happy path » et sécurité) ===

Ce document décrit la batterie de tests d'attaque et de cas limites de la
plateforme, ce qu'elle a trouvé, et comment la lancer.

## Ce qui est testé à chaque modification (CI)

Le job **`emulator-tests`** de `.github/workflows/ci.yml` démarre les
émulateurs Firebase (Auth, Firestore, Functions, Hosting) sur un **projet
fictif `demo-activa`**. Il n'utilise aucune donnée, aucun compte ni aucun
e-mail réels, et n'a accès à aucun identifiant Google Cloud. Il enchaîne
ensuite tous les scénarios, en effaçant les émulateurs entre chacun
(`scripts/devops/runEmulatorTests.sh`).

| Scénario | Contenu |
|---|---|
| `e2eSecurity.emulator.mts` | **77 contrôles d'attaque** (détail ci-dessous) |
| `e2ePortalUpdate.emulator.mts` | Travail du personnel enregistré sur le serveur |
| `e2eDocuments.emulator.mts` | Pièces jointes du déclarant et du personnel |
| `e2eConfigAudit.emulator.mts` | Configuration partagée et piste d'audit |
| `e2eReporterReference.emulator.mts` | Numéros de suivi : unicité, alias, passage par le site |
| `e2eEmailNotifications.emulator.mts` | Destinataires des e-mails et règles d'escalade |
| `e2eReporterMessageNotifications.emulator.mts` | E-mails « nouveau message du déclarant » |

## Les 77 contrôles d'attaque (`scripts/e2eSecurity.emulator.mts`)

1. **Formulaire public** : données absentes, tableau, valeurs hors liste,
   textes démesurés (200 000 caractères), objets à la place de textes,
   empreintes de code mal formées, « / » dans les identifiants. Les champs
   imposés par l'attaquant (statut « clôturé », attribution, personne mise en
   cause, priorité) sont ignorés. Le HTML est conservé comme du texte.
2. **Limitation des dépôts** : au plus 10 par heure et par réseau, avec un
   plafond global même si l'en-tête `X-Forwarded-For` est falsifié.
3. **Suivi par le déclarant** : entrées piégées. Un dossier inexistant et un
   mauvais code renvoient exactement la même réponse, sans fuite
   d'existence. Le verrouillage s'active après 5 essais faux, même avec le
   bon code. La vue du déclarant ne contient aucune donnée interne.
4. **Session du déclarant** : jeton vide, aléatoire, réutilisé pour un autre
   dossier, à l'expiration prolongée, démesuré ou de mauvais type.
5. **Messages et documents** : taille maximale, type, fichier vide ou de
   12 Mo, nom de fichier piégé (`../../etc/passwd`), fichier HTML.
6. **Relais e-mail** : méthode GET, appel anonyme, destinataire hors domaine.
7. **Fonctions du personnel** (36 fonctions) : sans compte, avec un compte
   sans rôle, avec un mot de passe temporaire non changé.
8. **Cloisonnement** :
   - un enquêteur non attribué ne voit, ne modifie, ne lit et n'écrit rien sur
     le dossier ;
   - un enquêteur attribué n'accède pas à l'identité du déclarant, ne
     réattribue pas, ne crée pas de compte et ne se promeut pas
     administrateur ;
   - un responsable limité à un pays ne voit pas les dossiers des autres pays ;
   - un compte Consultation ne modifie rien ;
   - la Direction n'a aucun contenu de dossier ;
   - l'administrateur système n'a aucun accès aux dossiers ;
   - un dossier ne peut pas être attribué à un administrateur.
9. **Double authentification des administrateurs**, exigée par le serveur.
10. **Accès direct à la base** (sans passer par le serveur), en anonyme,
    enquêteur, administrateur et opérateur. Lecture et écriture sont
    refusées pour : secrets d'accès des déclarants, identités, compteurs,
    comptes du personnel, piste d'audit, et toute écriture de dossier ou liste
    complète.
11. **Robustesse** : 9 entrées absurdes envoyées à chacune des fonctions
    (environ 900 appels). Aucune ne doit provoquer d'erreur interne.

## Failles et bogues trouvés, puis corrigés

| Gravité | Constat (avant correction) | Correction |
|---|---|---|
| **Élevée** | La double authentification des administrateurs n'était imposée que par la page de connexion. Avec le seul mot de passe d'un administrateur qui ne l'avait pas encore activée, un appel direct aux fonctions donnait tous ses droits (création de comptes, configuration). | Le serveur l'exige désormais. Il faut soit une session ouverte avec le second facteur, soit un facteur enregistré sur le compte (`assertAdminMfa`, `functions/src/staffAccounts.ts`). Interrupteur d'urgence : variable `ADMIN_MFA_ENFORCEMENT=off`. |
| Moyenne | Le plafond de 10 dépôts publics par heure et par réseau se contournait en inventant l'en-tête `X-Forwarded-For` (15 dépôts sur 15 acceptés). Chaque dépôt envoie des e-mails au personnel. | Plafond **global** en plus, toutes adresses confondues : 60 par heure par défaut (`REPORTER_CREATE_GLOBAL_MAX_PER_HOUR`). La protection complète reste App Check (voir ci-dessous). |
| Faible | Un identifiant de dossier contenant « / » désignait un autre document (par exemple un message lu comme s'il était un dossier). | Identifiants validés (`isSafeDocId`). |
| Faible | Environ 30 fonctions plantaient (erreur 500) sur des données absentes ou d'un type inattendu, dont le suivi par le déclarant. | Une enveloppe commune normalise les données, et les entrées du déclarant sont validées. |
| Faible | Un fichier déposé gardait le type fourni par le client (par exemple `text/html`). | Les types interprétables par un navigateur (HTML, SVG, XML, JavaScript…) sont enregistrés en `application/octet-stream`. Le téléchargement par le personnel était déjà sûr : le fichier est enregistré, jamais ouvert dans le portail. |
| Faible | Le bucket de stockage du projet de production était écrit en dur dans les fonctions. | Il est déduit du projet où tourne la fonction (prérequis de l'environnement de test). |

## Points restant à traiter (hors code)

- **App Check**. Passer `ENFORCE_APP_CHECK=true` (variable GitHub des
  Functions) dès que la clé reCAPTCHA Enterprise est en place côté Web.
  Seuls les appels venant réellement du site sont alors acceptés : c'est la
  vraie protection contre les dépôts automatisés.
- **Approbation des mises en production**. Dans Settings → Environments →
  `production`, ajouter des approbateurs obligatoires (voir
  `docs/ENVIRONNEMENTS.md`).
- **Comptes DARC, DGA et DRH**. Ces comptes sont à créer : sans compte DARC,
  un dossier visant la DARC n'est lisible par personne sur le portail.
- **Règles Firestore**. Elles ne sont pas déployées par la CI de production.
  L'environnement de test les déploie. En production :
  `firebase deploy --only firestore:rules --project production`.

## Lancer les tests sur son poste

```bash
bun run build                                  # site servi par l'émulateur Hosting
(cd functions && npm ci && npm run build)
printf 'NOTIFY_RESEND_ENDPOINT=http://127.0.0.1:5555/emails\nNOTIFY_APP_URL=https://portail-test.example\nNOTIFY_ALLOWED_RECIPIENT_DOMAINS=group-activa.com\n' > functions/.env.local
printf 'RESEND_API_KEY=test-key\n' > functions/.secret.local
npx firebase-tools@15.31.0 emulators:exec --config firebase.e2e.json --project demo-activa \
  --only auth,firestore,functions,hosting "bash scripts/devops/runEmulatorTests.sh"
```

Java 21 est nécessaire pour l'émulateur Firestore.
