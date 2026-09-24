# Déploiement sur Firebase Hosting

> === AMÉLIORATION AJOUTÉE : Firebase Hosting remplace Netlify comme
> hébergement de l'application web. ===

L'application (SPA Vite/React) est publiée sur Firebase Hosting, dans le même
projet Firebase que Firestore/Auth/Storage : `activa-ethicalert-47246`.

- URL : https://activa-ethicalert-47246.web.app
  (et https://activa-ethicalert-47246.firebaseapp.com)
- Config : bloc `hosting` de `firebase.json` (dossier publié `dist/`, toutes
  les routes réécrites vers `/index.html` pour React Router, cache long sur
  `/assets/**` dont les noms sont hachés par Vite, `no-cache` sur `index.html`).
- Firebase Hosting est disponible sur le plan gratuit **Spark** : aucun
  passage à Blaze n'est nécessaire pour héberger l'application.

## 1. Désactiver Netlify

Sur https://app.netlify.com/projects/activa-whistleblowing :
*Project configuration → Build & deploy → Continuous deployment →
Stop builds* (ou *Manage repository → Unlink*). Pour supprimer le site :
*General → Danger zone → Delete project*.

## 2. Premier déploiement (manuel, depuis un poste)

```bash
npm install -g firebase-tools
firebase login
cp .env.example .env.local   # renseigner les VITE_FIREBASE_* (Console Firebase →
                             # Paramètres du projet → Vos applications → Web)
bun install                  # ou npm install
npm run deploy:hosting       # = vite build + firebase deploy --only hosting
```

`.firebaserc` sélectionne déjà `activa-ethicalert-47246` par défaut.

## 3. Déploiement automatique (GitHub Actions)

`.github/workflows/firebase-hosting.yml` construit et publie à chaque push sur
`main` (et à la demande via *Actions → Deploy to Firebase Hosting → Run
workflow*). Tant que le secret ci-dessous n'existe pas, le workflow s'arrête
sans erreur.

1. Google Cloud Console → IAM → *Comptes de service* → créer un compte (ex.
   `github-hosting-deploy`) avec les rôles **Administrateur Firebase Hosting**
   et **Lecteur des clés API**. Créer une clé JSON.
2. GitHub → dépôt → *Settings → Secrets and variables → Actions* → ajouter :
   - `FIREBASE_SERVICE_ACCOUNT_ACTIVA` : le contenu complet du JSON ;
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
     `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. Supprimer ensuite la clé JSON de votre poste (elle n'est jamais commitée).

Alternative : `firebase init hosting:github` crée le compte de service et le
secret automatiquement (refuser l'écrasement de `firebase.json` et du
workflow existant, et reporter le nom du secret créé dans le workflow).

## 4. Limite connue : notifications e-mail

`api/notify-email.ts` est une fonction serverless **Vercel** ; Firebase
Hosting ne l'exécute pas. Sur Firebase Hosting, `POST /api/notify-email`
échoue donc, et `src/services/emailNotify.ts` journalise honnêtement cet
échec dans l'Audit Trail (jamais un faux succès). Le reste de l'application
n'est pas affecté.

Pour réactiver les e-mails sur Firebase, il faut une Cloud Function
(plan **Blaze** obligatoire, voir `docs/FIREBASE-SETUP.md`) portant la même
logique, puis une réécriture `{"source": "/api/notify-email", "function":
"notifyEmail"}` placée **avant** la réécriture `**` dans `firebase.json`.
Ne pas ajouter cette réécriture tant que la fonction n'est pas déployée :
`firebase deploy --only hosting` échouerait.

## 5. Firebase Auth

Les domaines `*.web.app` / `*.firebaseapp.com` du projet sont autorisés
d'office. Pour un domaine personnalisé (Hosting → *Ajouter un domaine
personnalisé*), l'ajouter aussi dans Authentication → Paramètres →
*Domaines autorisés*.
