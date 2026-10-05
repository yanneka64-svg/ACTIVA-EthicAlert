# Runbook DevOps — correctifs P0 / P1 (audit sécurité, coût, fiabilité)

=== AMÉLIORATION AJOUTÉE (Audit DevOps) ===

Ce document accompagne les correctifs P0/P1 appliqués dans le code. Il liste
**ce qui est déjà en place** et **ce qui reste à faire dans les consoles**
(GCP, Firebase, GitHub, Vercel, Resend) — ces actions ne peuvent pas être
faites depuis le dépôt.

## 1. Ce qui est en place dans le code

| # | Correctif | Où |
|---|---|---|
| P0-1 | Relais e-mail fermé : appelant vérifié pour `notifyEmail` (jeton d'identité d'un compte du personnel ou jeton App Check), `Origin` = l'app, destinataires limités à `NOTIFY_ALLOWED_RECIPIENT_DOMAINS`, destinataire unique valide, sujet `[activa-whistleblowing] …`, liens du corps vers l'app uniquement, limite de débit par IP | `src/domain/notifyEmailGuard.ts` (+ tests), `api/notify-email.ts`, `notifyEmail` dans `functions/src/index.ts` |
| P0-2 | En-têtes de sécurité HTTP (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CSP complète appliquée) | `firebase.json`, `vercel.json` |
| P0-3 | Barrière qualité : typecheck + tests avant tout déploiement ; CI sur chaque push/PR (web + Functions + audit npm) | `.github/workflows/firebase-hosting.yml`, `.github/workflows/ci.yml` |
| P0-4 | Plus de perte de données silencieuse : bannière visible si le navigateur refuse un enregistrement (quota plein) | `src/services/persistFailure.ts`, `src/app/PersistFailureBanner.tsx`, `storage.ts` |
| P1-5 | Actions GitHub épinglées par SHA, Dependabot, déploiement sans clé JSON (WIF) prêt à l'emploi | workflows, `.github/dependabot.yml` |
| P1-6 | Functions : Node 22, `uuid` ≥ 11.1.1 (0 vulnérabilité), `setGlobalOptions({ region, maxInstances: 10, minInstances: 0 })`, `notifyEmail` plafonnée à 2 instances | `functions/package.json`, `functions/src/index.ts` |
| P1-7 | Firebase App Check prêt (dormant tant que la clé de site n'est pas fournie) | `src/services/appCheck.ts` |

Vérifications faites : `tsc`, 325 tests Vitest, build Vite, build Functions,
`npm audit` Functions (0 vulnérabilité), parcours navigateur réel avec la CSP
**appliquée** (0 violation : soumission publique avec pièce jointe, écrans
staff, attribution), bannière de quota déclenchée, requêtes e-mail réelles
rejouées dans le garde-fou (acceptées), requêtes forgées (refusées).

## 2. À faire dans les consoles — P0 (cette semaine)

### 2.1 Relais e-mail (Vercel)
- **Si Vercel n'est plus utilisé en production** : Vercel → projet →
  *Settings → Environment Variables* → supprimer `RESEND_API_KEY`
  (le point `/api/notify-email` répondra 503) puis désactiver le projet.
- **Sinon**, ajouter les variables :
  - `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` = `group-activa.com` —
    **OBLIGATOIRE** depuis la revue de la PR #139 : sans elle, aucun e-mail
    ne part (503, journalisé dans l'Audit Trail). Ajoutez les
    autres domaines légitimes des destinataires d'escalade, séparés par des
    virgules — un destinataire hors liste sera refusé et journalisé
    `EMAIL_NOTIFICATION_FAILED` dans l'Audit Trail) ;
  - `NOTIFY_ALLOWED_ORIGINS` = `https://activa-ethicalert.group-activa.com`
    si un domaine personnalisé pointe vers Vercel ;
  - `NOTIFY_RATE_LIMIT` (facultatif, défaut 60 envois / 10 min / IP).
- Les mêmes variables s'appliquent à la Cloud Function `notifyEmail` une
  fois déployée (fichier `functions/.env`).

### 2.2 CSP en mode bloquant — FAIT dans le dépôt
=== AMÉLIORATION AJOUTÉE (revue PR #139) === cette étape n'est plus à
faire : `firebase.json` et `vercel.json` ne portent plus qu'UNE seule en-tête
`Content-Security-Policy`, la politique complète, appliquée (la CSP minimale
et la variante `Report-Only` ont été remplacées par elle — voir §5.1).
Après chaque déploiement, garder la console du navigateur ouverte sur le
site de production (soumission, suivi, espace staff, exports) : une ligne
`Refused to …` signale une origine légitime à ajouter à la directive citée,
dans les DEUX fichiers.

### 2.3 Rendre la CI obligatoire
GitHub → *Settings → Branches → Add rule* sur `main` :
« Require a pull request before merging » + « Require status checks to pass »
→ cocher **web** et **functions** (visibles après la première exécution de
`ci.yml`).

## 3. À faire dans les consoles — P1 (ce mois-ci)

### 3.1 Déploiement sans clé JSON (Workload Identity Federation)
```bash
PROJECT_ID=activa-ethicalert-47246
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA=github-deployer@$PROJECT_ID.iam.gserviceaccount.com

gcloud iam service-accounts create github-deployer --project $PROJECT_ID \
  --display-name "GitHub Actions — Firebase Hosting deploy"
for ROLE in roles/firebasehosting.admin roles/serviceusage.apiKeysViewer roles/run.viewer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$SA" --role $ROLE
done

gcloud iam workload-identity-pools create github --project $PROJECT_ID \
  --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-provider --project $PROJECT_ID \
  --location global --workload-identity-pool github \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository=='yanneka64-svg/ACTIVA-EthicAlert' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT_ID \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/yanneka64-svg/ACTIVA-EthicAlert"
```
Puis GitHub → *Settings → Secrets and variables → Actions → **Variables*** :
- `GCP_WORKLOAD_IDENTITY_PROVIDER` =
  `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github-provider`
- `GCP_DEPLOY_SERVICE_ACCOUNT` = `github-deployer@activa-ethicalert-47246.iam.gserviceaccount.com`

Le workflow bascule automatiquement sur WIF. Après un déploiement réussi :
supprimer le secret `FIREBASE_SERVICE_ACCOUNT_ACTIVA` et **révoquer la clé**
dans IAM → Comptes de service → Clés.

=== AMÉLIORATION AJOUTÉE (premier déploiement des Cloud Functions) ===
**Fait le 2026-10-04**, avec le compte existant
`github-hosting-deploy@activa-ethicalert-47246.iam.gserviceaccount.com`
(au lieu de `github-deployer` ci-dessus) : pool `github`, fournisseur
`github-provider`, variables GitHub `GCP_WORKLOAD_IDENTITY_PROVIDER` et
`GCP_DEPLOY_SERVICE_ACCOUNT` créées. Le secret
`FIREBASE_SERVICE_ACCOUNT_ACTIVA` contenait en fait une clé du compte
**Admin SDK** (`firebase-adminsdk-fbsvc@…`), pas celle d'un compte de
déploiement : la supprimer de GitHub et révoquer cette clé une fois un
déploiement Hosting réussi via WIF, après avoir vérifié qu'aucune des clés
de ce compte ne sert ailleurs.

### 3.2 Restreindre la clé API Web Firebase
GCP → *APIs & Services → Credentials* → clé « Browser key » :
- **Restrictions d'application** : sites Web —
  `https://activa-ethicalert-47246.web.app/*`,
  `https://activa-ethicalert-47246.firebaseapp.com/*`,
  `https://activa-ethicalert.group-activa.com/*`, `http://localhost:3000/*`.
- **Restrictions d'API** : Identity Toolkit API, Token Service API, Cloud
  Firestore API, Firebase Installations API, Firebase App Check API.

`Referrer-Policy: strict-origin` (P0-2) envoie l'origine sans le chemin :
compatible avec cette restriction, sans jamais divulguer les numéros de
dossier présents dans les URL.

### 3.3 App Check
1. GCP → *Security → reCAPTCHA* → créer une clé **Website** pour les 3
   domaines ci-dessus.
2. Firebase → *App Check* → application Web → reCAPTCHA Enterprise → coller
   la clé.
3. GitHub → secret `VITE_FIREBASE_APPCHECK_SITE_KEY` = la clé de site →
   redéployer.
4. Laisser en **surveillance** quelques jours (Firebase → App Check →
   métriques), puis **Enforce** sur Firestore, Authentication, puis
   Functions.

### 3.4 Supervision et budget (plan Blaze)
- **Budget** : GCP → *Billing → Budgets & alerts* → 20 €/mois, alertes à
  50 / 90 / 100 %. Un budget **alerte mais ne coupe pas** la dépense : le
  plafond réel est `maxInstances` (déjà dans le code).
- **Disponibilité** : *Monitoring → Uptime checks* → HTTPS
  `activa-ethicalert-47246.web.app`, chemin `/`, toutes les 5 min, alerte
  e-mail à l'équipe DARC.
- **Erreurs** : *Monitoring → Alerting* → condition « Cloud Function —
  executions with status != ok > 5 / 5 min » ; activer *Error Reporting*.
- **Images des Functions** : au premier déploiement, accepter la politique
  de nettoyage proposée (`firebase functions:artifacts:setpolicy`) pour
  éviter l'accumulation d'images facturées dans Artifact Registry.

### 3.5 Région des Cloud Functions
Les fonctions sont désormais **explicitement** en `us-central1` (valeur par
défaut déjà utilisée implicitement — aucun changement). Pour les rapprocher
de la base Firestore (latence, RGPD), lire sa localisation dans Firebase →
Firestore → *Settings*, puis changer **ensemble** :
1. `setGlobalOptions({ region })` dans `functions/src/index.ts` ;
2. `getFunctions(phase4App, '<région>')` dans `src/services/firebaseClient.ts` ;
3. la réécriture Hosting `/api/notify-email` (docs/FIREBASE-HOSTING.md §4).

### 3.6 Consolider l'hébergement sur Firebase
Le plan Vercel *Hobby* interdit l'usage commercial. Une fois le plan Blaze
activé et `notifyEmail` déployée (`cd functions && npm run deploy`) :
1. ajouter dans `firebase.json` → `hosting.rewrites`, **avant** la règle
   `**` : `{ "source": "/api/notify-email", "function": { "functionId": "notifyEmail", "region": "us-central1" } }`
   (à ne pas ajouter avant le déploiement de la fonction : le déploiement
   Hosting échouerait) ;
2. vérifier l'envoi d'une notification depuis `web.app` ;
3. désactiver le projet Vercel.

=== AMÉLIORATION AJOUTÉE (premier déploiement des Cloud Functions) ===
`notifyEmail` est déployée depuis le 2026-10-04 et l'étape 1 est faite dans
`firebase.json`. Elle prend effet au prochain déploiement Hosting. Pour
l'étape 2 : `notifyEmail` reconnaît le site grâce à l'en-tête
`X-Forwarded-Host` que pose la réécriture Hosting. Si l'envoi échoue avec
« Origin not allowed » (403) dans l'Audit Trail, définir la variable GitHub
`NOTIFY_ALLOWED_ORIGINS` =
`https://activa-ethicalert-47246.web.app,https://activa-ethicalert-47246.firebaseapp.com`
puis redéployer `notifyEmail` (§3.8, `functions = notifyEmail`).

### 3.7 Domaine d'envoi Resend
Resend → *Domains* → ajouter `group-activa.com` (ou un sous-domaine
`notifications.group-activa.com`), publier SPF / DKIM / DMARC, puis
définir `NOTIFY_FROM_EMAIL`. Sans cela, l'expéditeur de test
`onboarding@resend.dev` n'envoie qu'à l'adresse du titulaire du compte.

### 3.8 Déployer les Cloud Functions depuis GitHub
=== AMÉLIORATION AJOUTÉE (déploiement Cloud Functions) ===

Workflow `.github/workflows/firebase-functions.yml` (« Deploy Cloud
Functions »), **manuel uniquement**, depuis `main` : GitHub → *Actions* →
*Deploy Cloud Functions* → *Run workflow*.

- `mode = dry-run` (par défaut) : compile, audite et fait valider le
  déploiement par la CLI Firebase (droits, API, paramètres) sans rien
  modifier. Toujours commencer par là.
- `mode = deploy` : déploie réellement. Le déploiement n'utilise jamais
  `--force` : une fonction absente du code n'est jamais supprimée sans
  confirmation.
- `functions` (facultatif) : `listCases,createCase`… ; vide = toutes.

**Prérequis, à faire une fois :**

1. **Rôles du compte de service de déploiement** (celui de la clé
   `FIREBASE_SERVICE_ACCOUNT_ACTIVA`, ou `GCP_DEPLOY_SERVICE_ACCOUNT` avec
   WIF). Google Cloud → *IAM* → modifier le compte → ajouter :
   - Cloud Functions Admin (`roles/cloudfunctions.admin`) ;
   - Cloud Run Admin (`roles/run.admin`) : les fonctions v2 tournent sur
     Cloud Run ;
   - Service Account User (`roles/iam.serviceAccountUser`), sur le compte
     d'exécution des fonctions (par défaut
     `<numéro>-compute@developer.gserviceaccount.com`) ;
   - Cloud Build Editor (`roles/cloudbuild.builds.editor`) ;
   - Artifact Registry Administrator (`roles/artifactregistry.admin`) :
     dépôt d'images et politique de nettoyage ;
   - Secret Manager Admin (`roles/secretmanager.admin`) : lire et créer
     `RESEND_API_KEY`, et l'attacher à `notifyEmail` ;
   - Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`) ;
   - Firebase Viewer (`roles/firebase.viewer`).
   Le rôle *Firebase Hosting Admin* déjà présent reste nécessaire au site.
2. **Clé Resend** : soit secret GitHub `RESEND_API_KEY` (le workflow le
   copie dans Secret Manager au premier déploiement, sans jamais
   l'afficher), soit une fois en local :
   `firebase functions:secrets:set RESEND_API_KEY --project activa-ethicalert-47246`.
   La CLI exige ce secret pour **tout** déploiement des fonctions, même
   partiel.
3. **Variables de dépôt facultatives** (GitHub → *Settings* → *Secrets and
   variables* → *Actions* → *Variables*) : `NOTIFY_ALLOWED_RECIPIENT_DOMAINS`
   (défaut `group-activa.com`), `NOTIFY_ALLOWED_ORIGINS`,
   `NOTIFY_FROM_EMAIL`, `NOTIFY_RATE_LIMIT`, `REPORTER_CREATE_MAX_PER_HOUR`,
   `ENFORCE_APP_CHECK` (défaut `false` ; passer à `true` après l'activation
   d'App Check, §3.3).
4. **Comptes du personnel** : les fonctions refusent tout compte sans claim
   `role`. Créer les comptes dans Firebase Auth avec leur rôle avant
   d'ouvrir l'usage réel.

Après le premier déploiement réussi de `notifyEmail` : §3.6 (réécriture
Hosting `/api/notify-email`).

=== AMÉLIORATION AJOUTÉE (premier déploiement des Cloud Functions) ===
**Retour d'expérience du premier déploiement (2026-10-04, 23 fonctions).**
Ce qu'il a fallu en plus des prérequis ci-dessus :

- **Fédération d'identité obligatoire.** La clé JSON
  `FIREBASE_SERVICE_ACCOUNT_ACTIVA` est celle du compte Admin SDK. Ce compte
  n'a pas `cloudfunctions.functions.setIamPolicy`, nécessaire pour rendre
  `notifyEmail` appelable. Le déploiement passe donc par WIF avec
  `github-hosting-deploy` (§3.1).
- **Service Account User sur le compte App Engine.** La CLI vérifie
  toujours ce droit sur `activa-ethicalert-47246@appspot.gserviceaccount.com`,
  en plus du compte d'exécution `<numéro>-compute@…` :
  ```bash
  gcloud iam service-accounts add-iam-policy-binding \
    activa-ethicalert-47246@appspot.gserviceaccount.com \
    --member "serviceAccount:github-hosting-deploy@activa-ethicalert-47246.iam.gserviceaccount.com" \
    --role roles/iam.serviceAccountUser --project activa-ethicalert-47246
  ```
- **Droit de build pour le compte d'exécution.** Les projets récents
  compilent les fonctions avec `<numéro>-compute@…` : lui donner
  `roles/cloudbuild.builds.builder`.
- **API à activer par un propriétaire.** `serviceUsageConsumer` ne permet
  pas d'activer une API. Activer une fois :
  `cloudfunctions run cloudbuild artifactregistry secretmanager compute
  cloudbilling eventarc pubsub firebaseextensions iam iamcredentials sts`
  (`.googleapis.com`).
- **Clé Resend.** Elle a été enregistrée directement dans Secret Manager.
  Elle ne passe donc jamais par GitHub :
  ```bash
  read -rs -p "Clé Resend : " KEY; echo
  printf '%s' "$KEY" | gcloud secrets create RESEND_API_KEY \
    --replication-policy=automatic --labels=firebase-managed=true --data-file=-
  unset KEY
  ```
  Après un changement de clé (`gcloud secrets versions add …`), redéployer
  `notifyEmail` : une fonction ne lit la nouvelle version qu'à son prochain
  déploiement.
- **Politique de nettoyage.** Au tout premier déploiement, le dépôt
  `gcf-artifacts` n'existe pas encore. La CLI déploie, puis échoue sur la
  politique. Le workflow la pose aussitôt après : 1 jour, comportement
  attendu.

### 3.9 Comptes du personnel dans Firebase
=== AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et enregistrés dans Firebase) ===

Les comptes du personnel se créent depuis le portail (Administration →
Utilisateurs) et sont enregistrés dans Firebase :
- dans **Firebase Auth**, avec leur rôle, leurs pays et leurs entités en
  custom claims ;
- dans **Firestore** (`staff_users/{uid}`), pour leur profil : nom, e-mail
  de contact, identifiant, poste.

Ils se connectent donc **depuis n'importe quel poste**, toujours avec leur
identifiant. Le compte Auth porte une adresse technique dérivée de
l'identifiant (`<identifiant>@staff.activa-ethicalert-47246.firebaseapp.com`,
qui ne reçoit aucun courrier). L'e-mail réel reste dans le profil pour les
notifications.

Fonctionnement (code : `src/domain/staffAccounts.ts`,
`functions/src/staffAccounts.ts`, `src/services/staffAccountsClient.ts`) :
- **Création et réinitialisation.** Un mot de passe temporaire de 12
  caractères est généré côté serveur et affiché une seule fois à
  l'administrateur. Il doit être changé à la première connexion, sous 4 h.
  Tant qu'il ne l'est pas, le claim `pwdTemp` interdit toute fonction métier.
- **Changement de rôle ou de portée.** Les sessions de la personne sont
  révoquées : ses nouveaux droits s'appliquent à sa reconnexion.
- **Garde-fous.** Il reste toujours au moins un administrateur système actif,
  et personne ne peut supprimer son propre compte. Chaque action est
  journalisée dans `audit_logs`.
- **Connexion.** Elle passe d'abord par Firebase. La vérification locale
  reste en repli, pour les comptes locaux existants et le compte de secours.
  Un compte Firebase ne peut jamais se connecter par la vérification locale.
- **Annuaire.** Après connexion, et à l'ouverture de l'onglet Utilisateurs,
  l'annuaire est recopié dans le portail. Il alimente l'attribution et les
  destinataires des notifications.

**Mise en route (une fois) :**

1. **Droits du compte de déploiement**, dans Cloud Shell :
   ```bash
   SA=serviceAccount:github-hosting-deploy@activa-ethicalert-47246.iam.gserviceaccount.com
   for ROLE in roles/firebaseauth.admin roles/datastore.user; do
     gcloud projects add-iam-policy-binding activa-ethicalert-47246 --member "$SA" \
       --role "$ROLE" --condition=None --quiet > /dev/null && echo "OK  $ROLE"
   done
   ```
2. **Déployer les fonctions** (§3.8, `mode = deploy`, toutes les fonctions).
   Le site se déploie seul après fusion dans `main`.
3. **Secret GitHub `STAFF_BOOTSTRAP_PASSWORD`**, de 8 caractères minimum.
   C'est le mot de passe initial du premier administrateur, à changer à sa
   première connexion.
4. **Workflow *Bootstrap staff admin*** (Actions → Run workflow) : saisir le
   nom, l'e-mail et l'identifiant du premier administrateur système.
5. **Première connexion au portail** avec cet identifiant et ce mot de passe,
   sous 4 h. Choisir le nouveau mot de passe.
6. **Recréer les comptes** dans Administration → Utilisateurs. L'écran
   indique « Les comptes sont enregistrés dans Firebase » et chaque compte
   porte le badge *Firebase*.

Mot de passe administrateur perdu ou expiré : relancer *Bootstrap staff
admin* avec le **même identifiant**. Son mot de passe est remplacé par
`STAFF_BOOTSTRAP_PASSWORD`, à changer à la connexion.

Limite connue : l'outil interne *Suivre un dossier* (`CaseLookup.tsx`) se
connecte par adresse Auth. Pour un compte créé depuis le portail, c'est
l'adresse technique ci-dessus.

## 4. Correctifs P2

=== AMÉLIORATION AJOUTÉE (Audit DevOps — P2) ===

### 4.1 Déjà en place dans le code

| Correctif | Où | Vérification |
|---|---|---|
| **Mots de passe et codes d'accès en PBKDF2-HMAC-SHA256, 600 000 itérations** (format `pbkdf2_sha256$600000$…`). Les empreintes existantes (SHA-256 itéré) restent vérifiables ; comparaison à temps constant. | `src/services/crypto.ts` (utilisé à l'identique par le navigateur et les Cloud Functions) | vecteur de test RFC 7914, compatibilité héritée, 6 tests |
| **Mise à niveau transparente** : à chaque connexion réussie d'un compte staff dont l'empreinte est héritée, elle est recalculée en PBKDF2 (nouveau sel), sans audit ni changement de date. Jamais pour un mot de passe temporaire (dont le compte de secours). | `storage.ts` → `upgradePasswordHashIfNeeded` | 2 tests d'intégration |
| **`listCases` : filtres poussés dans Firestore** (égalités seules, sans index composite), lecture des seules personnes `subject`, en parallèle ; pagination validée (limit 1–500). Résultat identique. | `src/domain/caseQuery.ts`, `functions/src/index.ts` | 4 tests + **112 comparaisons ancien/nouveau sur l'émulateur Firestore : 0 différence** |
| Reliquats AI Studio (`GEMINI_API_KEY`, `APP_URL`) désactivés dans `.env.example` (jamais lus par l'application). | `.env.example` | — |

Limites connues — **corrigées** (=== AMÉLIORATION AJOUTÉE (Audit DevOps — P2, suite) ===) :
- **Codes d'accès des lanceurs d'alerte déjà émis** : à la première
  consultation réussie du dossier, l'empreinte héritée (ou un code de
  démonstration stocké sans sel) est recalculée en PBKDF2 — sans modifier
  `updatedAt`, sans audit, sans synchronisation cloud
  (`storage.upgradeAccessCodeHashIfNeeded`, appelée par AlertTrackingView).
- **Compte de secours** : nouveau mot de passe temporaire de 16 caractères,
  empreinte PBKDF2 (plus attaquable par force brute), transmis hors du
  dépôt à l'administrateur. Un compte de secours jamais utilisé est aligné
  automatiquement ; changement toujours obligatoire à la première connexion.
  À terme, retirer ce compte dès que l'authentification Firebase du
  personnel est active.

### 4.2 Sauvegardes Firestore (à faire, plan Blaze requis)
La base du projet est la base **nommée** `default` (voir `firebase.json`).
```bash
# Restauration à la seconde près sur 7 jours
gcloud firestore databases update --database=default --enable-pitr --project activa-ethicalert-47246
# Sauvegardes gérées : quotidienne (conservée 14 jours) + hebdomadaire (14 semaines)
gcloud firestore backups schedules create --database=default --recurrence=daily --retention=14d --project activa-ethicalert-47246
gcloud firestore backups schedules create --database=default --recurrence=weekly --day-of-week=SUN --retention=14w --project activa-ethicalert-47246
```
Tester une restauration une fois par trimestre (`gcloud firestore databases
restore --source-backup=… --destination-database=restore-test`), puis
supprimer la base de test.

### 4.3 Bloqué tant que le plan Blaze n'est pas activé
- Firestore comme source de vérité + authentification Firebase du personnel
  (phases 2 à 5 du backend) : corrige à la racine le stockage navigateur,
  l'autorisation côté client et le compte de secours embarqué.
- Pièces jointes dans Cloud Storage (règles déjà prêtes dans
  `storage.rules`) au lieu du base64 dans le navigateur (limité à ~5 Mo ;
  un dépassement est désormais signalé par la bannière P0).
- Double authentification (MFA) du personnel : nécessite Identity Platform.

## 5. Exécution des actions console

=== AMÉLIORATION AJOUTÉE (Audit DevOps — exécution) ===

### 5.1 Déjà fait dans le dépôt
- **CSP complète en mode bloquant** (`firebase.json`, `vercel.json`) après
  vérification dans un navigateur réel, avec une configuration Firebase
  active (Firestore et Cloud Functions réellement sollicités) sur 21 écrans
  publics, portail interne et administration, dont soumission avec pièce
  jointe, suivi et export : **0 violation**. La vérification a révélé que
  Firestore charge une image de test réseau
  (`https://www.google.com/images/cleardot.gif`) : `img-src` l'autorise
  désormais (elle aurait été bloquée en production).
- **Vercel désactivé par le code** : `api/notify-email.ts` répond 410 sans
  rien envoyer, sauf réactivation explicite `NOTIFY_VERCEL_ENABLED=true`.

### 5.2 À lancer (identifiants requis, impossibles depuis la session Claude)
| Action | Commande | Où |
|---|---|---|
| Vérifications `web` + `functions` obligatoires sur `main` | `./scripts/devops/github-protect-main.sh` | poste avec `gh` admin |
| Fédération d'identité (WIF) | `./scripts/devops/gcp-hardening.sh wif` | Cloud Shell |
| Révocation de la clé JSON (après un déploiement WIF réussi) | `./scripts/devops/gcp-hardening.sh revoke-json-key` | Cloud Shell |
| Restriction de la clé API Web | `./scripts/devops/gcp-hardening.sh restrict-api-key` | Cloud Shell |
| App Check (surveillance, puis strict) | `… app-check` puis, quelques jours après, `… app-check-enforce` | Cloud Shell |
| Budget (plan Blaze) | `BUDGET_AMOUNT=20EUR … budget` | Cloud Shell |
| Supervision (disponibilité + erreurs 5xx) | `ALERT_EMAIL=… … monitoring` | Cloud Shell |
| Vercel | supprimer `RESEND_API_KEY` puis le projet (Settings → General → Delete Project) | vercel.com |

Chaque étape du script demande confirmation et peut être relancée. Ordre
recommandé : protection de `main` → WIF → déploiement manuel de contrôle →
révocation de la clé JSON → clé API → App Check → budget → supervision.
