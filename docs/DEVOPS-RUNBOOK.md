# Runbook DevOps — correctifs P0 / P1 (audit sécurité, coût, fiabilité)

=== AMÉLIORATION AJOUTÉE (Audit DevOps) ===

Ce document accompagne les correctifs P0/P1 appliqués dans le code. Il liste
**ce qui est déjà en place** et **ce qui reste à faire dans les consoles**
(GCP, Firebase, GitHub, Vercel, Resend) — ces actions ne peuvent pas être
faites depuis le dépôt.

## 1. Ce qui est en place dans le code

| # | Correctif | Où |
|---|---|---|
| P0-1 | Relais e-mail fermé : `Origin` = l'app, destinataire unique valide, sujet `[activa-whistleblowing] …`, liens du corps vers l'app uniquement, limite de débit par IP | `src/domain/notifyEmailGuard.ts` (+ tests), `api/notify-email.ts`, `notifyEmail` dans `functions/src/index.ts` |
| P0-2 | En-têtes de sécurité HTTP (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CSP minimale appliquée + CSP complète en *Report-Only*) | `firebase.json`, `vercel.json` |
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
  - `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` = `group-activa.com` (ajoutez les
    autres domaines légitimes des destinataires d'escalade, séparés par des
    virgules — un destinataire hors liste sera refusé et journalisé
    `EMAIL_NOTIFICATION_FAILED` dans l'Audit Trail) ;
  - `NOTIFY_ALLOWED_ORIGINS` = `https://activa-ethicalert.group-activa.com`
    si un domaine personnalisé pointe vers Vercel ;
  - `NOTIFY_RATE_LIMIT` (facultatif, défaut 60 envois / 10 min / IP).
- Les mêmes variables s'appliquent à la Cloud Function `notifyEmail` une
  fois déployée (fichier `functions/.env`).

### 2.2 CSP : passer du mode observation au mode bloquant
1. Après déploiement, ouvrir l'app en production, parcourir les écrans
   (soumission, suivi, espace staff, exports) avec la console du
   navigateur ouverte : aucune ligne `[Report Only] Refused to …` ne doit
   apparaître.
2. Si c'est le cas, dans `firebase.json` (et `vercel.json`), renommer la clé
   `Content-Security-Policy-Report-Only` en `Content-Security-Policy`
   (remplace la CSP minimale) et redéployer.
3. Si une ligne apparaît, ajouter l'origine légitime concernée à la
   directive citée avant de basculer.

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

### 3.7 Domaine d'envoi Resend
Resend → *Domains* → ajouter `group-activa.com` (ou un sous-domaine
`notifications.group-activa.com`), publier SPF / DKIM / DMARC, puis
définir `NOTIFY_FROM_EMAIL`. Sans cela, l'expéditeur de test
`onboarding@resend.dev` n'envoie qu'à l'adresse du titulaire du compte.
