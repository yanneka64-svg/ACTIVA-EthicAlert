# Notifications e-mail — mise en route

Demande métier (session en cours) :

> Lorsque le public soumet une alerte, celle-ci tombe dans la Boîte de
> réception de l'Opérateur, qui reçoit une notification par e-mail portant
> la référence de l'alerte. Lorsque l'Opérateur attribue un dossier à un
> Enquêteur, celui-ci tombe dans sa boîte de réception et reçoit lui aussi
> une notification par e-mail avec la référence du dossier. Un Enquêteur ne
> peut accéder qu'aux dossiers qui lui sont attribués.

## Ce qui est déjà réel dans ce dépôt (sans rien à configurer)

- **Boîte de réception / attribution** : un signalement public (`status:
  'new'`) apparaît déjà dans la Boîte de réception Opérateur
  (`OperatorCaseDesk.tsx`, mode `inbox`) ; l'attribuer fait apparaître le
  dossier dans « Dossiers attribués » / « Mes dossiers » côté Enquêteur.
  Rien de nouveau ici — ces écrans existaient déjà avant cette phase.
- **Périmètre d'accès de l'Enquêteur** : `useVisibleAlerts()`
  (`src/hooks/useVisibleAlerts.ts`) est le point de passage unique déjà
  appliqué par tous les écrans internes — un compte sans vision globale du
  rôle (ex. `investigator`) ne voit QUE les dossiers où il figure dans
  `assignedInvestigators`. Déjà vrai, vérifié, testé
  (`useVisibleAlerts.test.ts`) — rien à ajouter.
- **Déclenchement des notifications** : câblé dans le code (voir
  `src/services/emailNotify.ts`) — à la soumission publique
  (`AlertSubmissionFlow.tsx`) et à l'attribution
  (`InvestigationDesk.tsx`/`OperatorCaseDesk.tsx`), chaque nouveau
  signalement/attribution déclenche une tentative d'envoi réelle vers,
  respectivement, tous les comptes Opérateur (vision globale) et le ou les
  Enquêteur(s) nouvellement attribué(s), avec la référence du dossier.
  Chaque tentative est journalisée dans l'Audit Trail (`EMAIL_NOTIFICATION_
  SENT`/`EMAIL_NOTIFICATION_FAILED`) — jamais un succès silencieux supposé.

## Ce qui manque pour que l'e-mail parte réellement

Cette application est un SPA (stockage local dans le navigateur, sans
backend) — elle n'a aucune capacité d'envoi d'e-mail native. `api/notify-
email.ts` est une fonction serveur (déployable sur Vercel) qui fait
réellement l'envoi via l'API de [Resend](https://resend.com) ; le client
(`src/services/emailNotify.ts`) l'appelle par `fetch('/api/notify-email', …)`.
Tant que cette fonction n'est pas déployée avec une vraie clé API, chaque
tentative échoue proprement (journalisée `EMAIL_NOTIFICATION_FAILED`,
jamais un faux succès) — c'est le comportement honnête attendu en local.

### Étape 1 — Créer un compte Resend et une clé API (gratuit)

1. Aller sur https://resend.com et créer un compte (gratuit jusqu'à
   3 000 e-mails/mois).
2. Dans le tableau de bord : **API Keys** → **Create API Key** → copier la
   clé (commence par `re_...`).
3. Optionnel mais recommandé pour éviter la limite du domaine de test
   partagé (`onboarding@resend.dev`, quelques e-mails seulement, réservés à
   votre propre adresse de test) : **Domains** → ajouter et vérifier un
   domaine à vous (ex. `notifications.activa-group.com`), via les
   enregistrements DNS indiqués par Resend.

### Étape 2 — Déployer ce dépôt sur Vercel

1. Créer un compte sur https://vercel.com (gratuit), connecté à votre
   compte GitHub.
2. **Add New… → Project** → sélectionner ce dépôt
   (`yanneka64-svg/ACTIVA-EthicAlert`). Vercel détecte automatiquement
   Vite (build : `vite build`, dossier de sortie : `dist`) et le dossier
   `api/` comme fonctions serverless — aucune configuration
   supplémentaire nécessaire au-delà de `vercel.json`, déjà présent dans
   ce dépôt.
3. Avant le premier déploiement (ou après, dans **Settings → Environment
   Variables**), ajouter :
   - `RESEND_API_KEY` = la clé copiée à l'étape 1.
   - `NOTIFY_FROM_EMAIL` (optionnel) = `"ACTIVA EthicAlert <notifications@votre-domaine.com>"`
     si un domaine vérifié a été configuré ; sinon la fonction utilise par
     défaut `onboarding@resend.dev` (fonctionne seulement pour envoyer à
     l'adresse e-mail du compte Resend lui-même — suffisant pour tester,
     pas pour la production).
4. Déployer. L'URL Vercel obtenue (ou un domaine personnalisé pointé
   dessus) devient l'adresse réelle de l'application — c'est elle qu'il
   faut utiliser en production, pas un aperçu local sans le dossier `api/`
   déployé à côté.

### Étape 3 — Vérifier

Une fois déployé : soumettre un signalement test depuis le formulaire
public, puis consulter l'Audit Trail (`/audit-log`, filtre "Toutes les
actions") — une entrée `EMAIL_NOTIFICATION_SENT` par compte Opérateur
notifié doit apparaître (ou `EMAIL_NOTIFICATION_FAILED` avec le détail de
l'erreur Resend si quelque chose ne va pas — jamais un silence).

## Décision explicite à signaler

L'utilisateur n'avait pas de préférence tranchée entre fournisseur d'e-mail
(SendGrid/Resend/autre) ni entre plateforme d'hébergement (le projet
Firebase déjà présent dans ce dépôt, nécessitant un passage au plan payant
Blaze — voir `docs/FIREBASE-SETUP.md` — ou une autre plateforme). Choix
retenu par défaut, à documenter clairement plutôt qu'à cacher : **Resend +
Vercel**, la combinaison la plus simple à mettre en route (un seul en-tête
HTTP, pas de SDK, pas de facturation à activer), sans toucher à la décision
« rester sur Firebase Spark » déjà prise et documentée ailleurs dans ce
dépôt. Si un fournisseur ou un hébergeur différent est préféré, seul
`api/notify-email.ts` a besoin d'être adapté (le format d'appel HTTP
change selon le fournisseur) — `src/services/emailNotify.ts` et son
câblage dans l'application restent inchangés, l'un et l'autre ne
connaissant jamais Resend directement.
