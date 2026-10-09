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

> === AMÉLIORATION AJOUTÉE (revue PR #139) === **Vercel n'est plus utilisé
> et `api/notify-email.ts` est désactivé par défaut (réponse 410).** Les
> étapes ci-dessous ne suffisent à activer l'envoi Vercel qu'avec les deux
> variables obligatoires ajoutées au point 3 (`NOTIFY_VERCEL_ENABLED=true`
> et `NOTIFY_ALLOWED_RECIPIENT_DOMAINS`). La voie recommandée est la Cloud
> Function `notifyEmail` (voir la section « Garde-fou anti-relais » plus bas).

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
   - `NOTIFY_VERCEL_ENABLED` = `true` (=== AMÉLIORATION AJOUTÉE (revue PR
     #139) === obligatoire : sans elle, le point d'envoi répond 410).
   - `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` = `group-activa.com` (=== AMÉLIORATION
     AJOUTÉE (revue PR #139) === obligatoire : sans elle, aucun envoi, 503).
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

## === AMÉLIORATION AJOUTÉE (Audit DevOps — P0) === Garde-fou anti-relais

`api/notify-email.ts` et la Cloud Function `notifyEmail` n'acceptent plus
que ce que `src/services/emailNotify.ts` envoie réellement (même contrat
`POST {to, subject, body}`) : en-tête `Origin` égal à l'application, un seul
destinataire valide, sujet commençant par `[activa-whistleblowing] `, liens
du corps pointant vers l'application uniquement, débit limité par IP.
Variable **obligatoire** (=== AMÉLIORATION AJOUTÉE (revue PR #139) === échec
fermé : sans elle, aucun envoi) : `NOTIFY_ALLOWED_RECIPIENT_DOMAINS`.
Variables facultatives : `NOTIFY_ALLOWED_ORIGINS`, `NOTIFY_RATE_LIMIT` — voir
[DEVOPS-RUNBOOK.md](./DEVOPS-RUNBOOK.md) §2.1.

=== AMÉLIORATION AJOUTÉE (revue PR #139) ===

- **Cloud Function `notifyEmail` : appelant vérifié obligatoire.** L'en-tête
  `Origin` n'authentifie personne, donc aucun e-mail ne part sans l'un des
  deux jetons que `src/services/emailNotify.ts` joint automatiquement :
  - jeton d'identité Firebase d'un compte du personnel (claim `role`), pour
    l'attribution et l'escalade ;
  - jeton **App Check** de l'application, pour le dépôt public anonyme
    (notification des Opérateurs). Ces e-mails ne partent donc qu'une fois
    App Check configuré (DEVOPS-RUNBOOK.md §3.3). Sans jeton valide, la
    fonction répond 401 et l'échec est journalisé `EMAIL_NOTIFICATION_FAILED`.
    App Check prouve l'origine de la requête, pas l'identité de l'appelant :
    pour cette voie anonyme, seule la notification « nouveau signalement »
    est acceptée. Le serveur reconstruit lui-même le sujet et le corps à
    partir du numéro de suivi (modèle unique `newAlertNotification`,
    `src/domain/notifyEmailGuard.ts`), et le destinataire doit être un compte
    du personnel existant dans Firebase Auth (claim `role`). Tout autre
    contenu ou destinataire est refusé (403).
- **Vercel (`api/notify-email.ts`) : désactivé par défaut** (réponse 410).
  Vercel n'étant plus utilisé, ces réglages ne concernent que la Cloud
  Function. Pour le réactiver malgré tout, il faut en plus
  `NOTIFY_VERCEL_ENABLED=true`, en plus de `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` et
  `RESEND_API_KEY`. Ce point d'envoi ne vérifie pas l'appelant comme la Cloud
  Function : ne le réactiver qu'en connaissance de cause.

## === AMÉLIORATION AJOUTÉE === Notifications des superviseurs, de la DARC, du DGA et du DRH

Envoyées **par le serveur** (Cloud Functions `createCaseAsReporter` et
`applyPortalUpdate`), et non plus depuis le navigateur. Le navigateur d'un
déclarant externe ne connaît aucun compte du personnel : un nouveau
signalement ne prévenait donc en pratique personne.

Réglages : **Administration → Notifications e-mail** (`/admin/notifications`,
permission `configuration.manage`). Ils sont partagés par tous les postes
(configuration partagée, section `emailNotifications`).

| Groupe | Destinataires par défaut | Prévenu par défaut |
|---|---|---|
| Superviseurs | comptes Opérateur (`functional_admin`) et Responsable des investigations (`senior_investigator`), dans leur périmètre pays / entité | nouveau signalement, attribution, escalade, clôture, réouverture |
| DARC | comptes DARC (`darc_compliance`) + boîte e-mail de la DARC | nouveau signalement, escalade, clôture, réouverture |
| DGA | adresse(s) à saisir | **le cas échéant** : nouveau signalement et clôture si dossier critique ou personne de rang Direction mise en cause ; toujours en cas d'escalade |
| DRH | adresse(s) à saisir | **le cas échéant** : nouveau signalement et clôture d'un dossier relevant des Ressources Humaines |

Conditions « le cas échéant » :
- **Dossier critique** : priorité très élevée ou critique ;
- **Dossier RH** : catégorie cochée comme RH, ou mention du harcèlement, de la discrimination ou des conditions de travail ;
- **Direction mise en cause** : personne mise en cause de niveau sous-directeur, directeur ou plus.

Garde-fous :
- Contenu des e-mails : numéro du dossier, entité, catégorie, priorité, motif et lien vers le portail. Jamais la description des faits, l'identité du déclarant ni le nom des personnes mises en cause.
- Ne sont jamais prévenus : l'auteur de l'action, un compte rattaché à une personne mise en cause, un compte désactivé.
- Chaque envoi, réussi ou non, est inscrit dans la piste d'audit (`EMAIL_NOTIFICATION_SENT` / `EMAIL_NOTIFICATION_FAILED`).
- Domaines de destinataires autorisés : `NOTIFY_ALLOWED_RECIPIENT_DOMAINS` (`group-activa.com` par défaut).
- Bouton **« Envoyer un e-mail d'essai »** par groupe : vérifie le service d'envoi et les adresses.

**Prérequis d'envoi réel** : clé Resend (`RESEND_API_KEY`, déjà utilisée) et
adresse d'expédition sur un domaine vérifié dans Resend. Elle se règle par la
variable de dépôt `NOTIFY_FROM_EMAIL`, par exemple
`ACTIVA EthicAlert <notifications@group-activa.com>`. Avec l'expéditeur de test
par défaut (`onboarding@resend.dev`), Resend n'envoie qu'au propriétaire du
compte Resend : l'e-mail d'essai l'indique alors en erreur.

Vérification de bout en bout sur émulateurs, avec un faux service d'envoi :
`scripts/e2eEmailNotifications.emulator.mts`.

### === AMÉLIORATION AJOUTÉE === Acheminement automatique selon la personne mise en cause

Dès qu'une alerte est déposée, le serveur décide qui la reçoit en fonction des
personnes mises en cause. Il n'y a aucune action manuelle à faire.

| Situation | Reçoivent l'alerte (par défaut) |
|---|---|
| Personne du dispositif n'est mise en cause | Superviseurs + DARC |
| Un enquêteur est mis en cause | DARC uniquement |
| Un superviseur est mis en cause | DARC |
| La DARC est mise en cause | DGA + DRH |
| Le DGA est mis en cause | DARC + DRH |
| Le DRH est mis en cause | DARC + DGA |

- **Comment un niveau est reconnu comme mis en cause.** Il suffit que l'alerte remplisse l'une de ces deux conditions :
  - elle nomme l'un de ses membres : prénom et nom d'un compte du portail ou d'un contact saisi au format « Prénom Nom <adresse> ». La comparaison ignore les accents et l'ordre des mots ;
  - elle cite l'une de ses fonctions. Ces mots-clés sont réglables par groupe, par exemple « Superviseur », « DARC » ou « Directeur général adjoint ».
- **Plusieurs niveaux mis en cause.** C'est la règle du niveau le plus élevé qui s'applique.
- **Un niveau mis en cause ne reçoit jamais l'alerte.** Ses membres ne la reçoivent pas non plus.
- **Un compte du personnel nommé dans l'alerte est écarté automatiquement du dossier.** La personne est rattachée à son compte (`linkedUserId`, audit `PERSON_AUTO_LINKED_TO_USER`). Ce compte ne peut alors plus ouvrir le dossier, même si on le lui attribue. Le rattachement n'a lieu que si un seul compte correspond : en cas d'homonymes, rien n'est rattaché automatiquement.
- **=== AMÉLIORATION AJOUTÉE === Le niveau mis en cause perd aussi l'accès au dossier sur le portail.** Ses comptes ne voient plus le dossier dans les listes et ne peuvent ni l'ouvrir, ni le modifier, ni se le voir attribuer (`Case.escalationExcludedUserIds`, audit `ESCALATION_ACCESS_RESTRICTED`, sans aucun nom). C'est le cas même si la personne n'est désignée que par sa fonction. Pour un niveau Superviseurs, DARC, DGA ou DRH : tous les comptes ayant un rôle de ce niveau. Pour un enquêteur : l'enquêteur nommé ; si aucun nom ne correspond, tous les comptes enquêteur. Les autres niveaux gardent leur accès. Vérifié par `e2eEmailNotifications` (23/23).
- **Le tableau se règle dans Administration → Notifications e-mail.** Une case cochée signifie « ce groupe reçoit l'alerte dans cette situation ». Un encadré **Simulation** montre, sans rien envoyer, qui recevrait une alerte selon la personne ou la fonction saisie.
- **Le motif est indiqué dans l'e-mail.** Les destinataires prévenus par montée de niveau voient le motif « escalade automatique, un niveau inférieur étant concerné par le signalement ».
- **Les conditions du « cas échéant » restent valables en plus.** Un groupe hors tableau peut encore être prévenu à ce titre, par exemple le DRH pour un dossier RH ou le DGA pour un dossier critique, sauf s'il est lui-même mis en cause.

### === AMÉLIORATION AJOUTÉE === Sortir Resend du mode test (étapes)

Symptôme : l'e-mail d'essai répond « You can only send testing emails to your
own email address ». Resend n'écrit alors qu'au propriétaire du compte.

1. **Resend → Domains → Add Domain.** Saisir le domaine d'envoi. Un
   sous-domaine dédié est recommandé, par exemple `notifications.group-activa.com` :
   il ne touche pas à la messagerie du domaine principal.
2. **Ajouter dans le DNS** (service informatique) les enregistrements affichés
   par Resend :
   - **DKIM** : TXT `resend._domainkey…` ;
   - **SPF** : MX et TXT sur `send.…` ;
   - **DMARC** : facultatif mais recommandé.
3. **Resend → Verify.** L'état doit passer à *Verified*. La propagation DNS
   prend de quelques minutes à quelques heures.
4. **GitHub → Settings → Secrets and variables → Actions → Variables** :
   `NOTIFY_FROM_EMAIL` = `ACTIVA EthicAlert <alertes@notifications.group-activa.com>`.
   Le domaine de l'adresse doit être exactement celui vérifié à l'étape 3.
5. Lancer **Deploy Cloud Functions**.
6. **Administration → Notifications e-mail → Envoyer un e-mail d'essai** pour
   chaque groupe.
