# Inventaire avant mise en production

_Établi le 5 octobre 2026. Les constats de production viennent du diagnostic en
lecture seule (workflow « Firebase diagnostics », exécution du 5 octobre à 17 h 58 UTC)._

## Verdict

L'application est **fonctionnellement prête**. Le parcours complet a été vérifié
sur l'environnement de test, du dépôt public à la clôture, et toutes les
fonctions serveur répondent en production.

La mise en production réelle est **bloquée par de la configuration, pas par du
code** :
- les e-mails ne peuvent pas partir ;
- les destinataires et les comptes réels manquent ;
- les sauvegardes ne sont pas activées ;
- les dossiers de test sont à purger ;
- les mentions légales sont à compléter.

## 1. Ce qui fonctionne

| Domaine | Fonctionnalité | Vérifié par |
|---|---|---|
| Public | Accueil, FAQ, contact, mentions légales, politique de confidentialité (FR / EN / PT) | Captures bureau et téléphone |
| Public | Dépôt d'un signalement : anonyme ou identifié, pièces jointes jusqu'à 7 Mo, brouillon local, file d'attente hors ligne | Parcours réel sur émulateurs ; 3 dépôts reçus en production |
| Public | Numéro de suivi et mot de passe : PBKDF2, blocage de 5 min après plusieurs échecs | Tests unitaires + parcours |
| Public | Suivi depuis n'importe quel appareil : statut, messages, documents dans les deux sens | Parcours réel ; 10 messages et 2 documents échangés en production sur un dossier de test, empreintes vérifiées |
| Personnel | Connexion Firebase, changement de mot de passe à la 1re connexion, déconnexion après 5 min d'inactivité | Parcours réel ; 2 comptes actifs en production |
| Personnel | Rôles et permissions appliqués **par le serveur** ; un compte sans rôle n'accède à rien | Règles Firestore + contrôle dans chaque fonction |
| Dossiers | Boîte de réception, tri, attribution, investigation, tâches, entretiens, notes, personnes, évaluation du risque, mesures correctives, rapport, revue, clôture, réouverture, escalade | `e2ePortalUpdate`, parcours réel |
| Dossiers | Personne mise en cause écartée automatiquement du dossier, côté serveur | `e2eEmailNotifications` (17/17) |
| Documents | Pièces du déclarant et du personnel stockées sur le serveur et téléchargeables partout | `e2eDocuments` |
| Administration | Configuration partagée entre tous les postes (9 sections présentes en production) | Diagnostic de production |
| Administration | Piste d'audit commune (serveur) | `e2eConfigAudit` |
| Notifications | Règles d'acheminement : superviseurs + DARC ; montée si un niveau est mis en cause ; simulation | `e2eEmailNotifications` (17/17), 18 tests unitaires |
| Sécurité | CSP stricte, en-têtes HTTP, règles Firestore fermées (écritures par le serveur uniquement), limite de 10 dépôts par heure, App Check configuré (reCAPTCHA Enterprise) | Diagnostic + revue des règles |
| Exploitation | CI (531 tests, typecheck, build), déploiement sans clé (WIF), toutes les fonctions joignables | Diagnostic + workflows |

## 2. Ce qui ne fonctionne pas aujourd'hui en production

| # | Constat (diagnostic du 5 octobre) | Conséquence |
|---|---|---|
| 1 | **Adresse d'expédition non définie** (`NOTIFY_FROM_EMAIL`), donc l'expéditeur de test `onboarding@resend.dev` est utilisé. **0 e-mail envoyé** en 30 jours, aucun essai réalisé. | Aucun e-mail n'arrive au personnel : Resend n'envoie qu'au propriétaire de son compte. |
| 2 | **Destinataires absents.** Aucun compte DARC (rôle « DARC / Conformité »), aucune adresse DARC, DGA ou DRH saisie. Seulement 2 comptes : un administrateur système et un responsable des investigations. | Même avec l'envoi réparé, la DARC, le DGA et le DRH ne seraient jamais prévenus. Aucun opérateur pour trier. |
| 3 | **Sauvegardes inactives.** Restauration à la seconde (PITR) désactivée, protection contre la suppression désactivée, sauvegardes programmées non vérifiables (droit manquant au diagnostic). | Une erreur ou une suppression serait irréversible. |
| 4 | **3 dossiers de test** en base (`AACMR-26-09-0002`, `AACMR-26-10-0004`, `AIIG-26-10-0001`), non attribués. | Ils fausseraient les statistiques et la numérotation. **Corrigé le 5 octobre (18 h 09 UTC)** : les 3 dossiers ont été supprimés, et chaque suppression est inscrite dans la piste d'audit. |
| 5 | **Deux mécanismes d'e-mail pour l'escalade.** L'ancien envoi depuis le navigateur (registre « Gouvernance ») coexiste avec le nouvel envoi par le serveur. | Risque d'e-mails en double au DGA une fois l'envoi réparé. **Corrigé** : l'escalade n'est plus notifiée que par le serveur. |

## 3. Reste à faire avant la mise en production

### Bloquant

| # | Action | Qui | Comment |
|---|---|---|---|
| B1 | Rendre l'envoi d'e-mails réel — **domaine `activa-alertes.com` vérifié dans Resend le 5 octobre** ; reste le déploiement des fonctions avec `NOTIFY_FROM_EMAIL` = `ACTIVA EthicAlert <alertes@activa-alertes.com>`, puis l'e-mail d'essai | Informatique (DNS) + administrateur GitHub | 1) Vérifier le domaine `group-activa.com` dans Resend (enregistrements DNS SPF / DKIM). 2) Variable de dépôt `NOTIFY_FROM_EMAIL` = `ACTIVA EthicAlert <notifications@group-activa.com>`. 3) Relancer « Deploy Cloud Functions ». 4) Bouton « Envoyer un e-mail d'essai » pour chaque groupe. |
| B2 | Créer les comptes réels et saisir les destinataires | Administrateur du portail | Utilisateurs : opérateurs, compte(s) DARC / Conformité, enquêteurs. Notifications e-mail : adresses DGA, DRH et boîte DARC. Vérifier avec la Simulation. |
| B3 | Activer les sauvegardes | Propriétaire du projet Google Cloud | Commandes prêtes (`docs/DEVOPS-RUNBOOK.md` §4.2) : PITR, sauvegarde quotidienne (14 j) et hebdomadaire (14 semaines), protection contre la suppression. |
| B4 | ~~Purger les dossiers de test~~ — **fait le 5 octobre** (essai à blanc, puis suppression confirmée). À refaire après la recette métier (B6) avec le même workflow. | Administrateur GitHub | Workflow « Firebase delete test cases ». |
| B5 | Compléter les mentions légales | Service juridique | Numéro RCCM, représentant légal, hébergeur (Google Cloud / Firebase, base en Europe `eur3`), durée de conservation précise, contact du DPO. Vérifier que l'« accusé de réception automatique » annoncé sur la page Contact existe bien sur la boîte e-mail. |
| B6 | Recette métier sur la plateforme réelle | DARC + 1 opérateur + 1 enquêteur | Un dossier fictif de bout en bout (dépôt, attribution, échanges, clôture, réception des e-mails), puis purge (B4). |

### Fortement recommandé (sécurité et exploitation)

| # | Action | Qui |
|---|---|---|
| R1 | Rendre la CI obligatoire sur `main` (branche aujourd'hui **non protégée**) | Administrateur GitHub (`scripts/devops/github-protect-main.sh`) |
| R2 | App Check en mode imposé (configuré mais `ENFORCE_APP_CHECK=false`) après quelques jours de surveillance | Administrateur GitHub (variable) |
| R3 | Firebase Auth : désactiver la création libre de comptes, imposer la politique de mots de passe (« non configurée » aujourd'hui) | Console Firebase |
| R4 | Double authentification pour les administrateurs : MFA désactivée, nécessite Identity Platform (payant à l'usage) | Décision + console |
| R5 | Supervision : alertes d'erreurs, test de disponibilité, budget (script prêt, `gcp-hardening.sh monitoring` / `budget`) | Cloud Shell |
| R6 | Révoquer l'ancienne clé JSON de déploiement (le déploiement par WIF fonctionne) — rappel prévu le 11 octobre | Cloud Shell |
| R7 | ~~Domaine personnalisé au lieu de `*.web.app`, puis `NOTIFY_APP_URL`~~ — **fait le 5 octobre** : https://activa-alertes.com ; liens des e-mails au prochain déploiement des fonctions | — |
| R8 | ~~Un seul mécanisme d'e-mail pour l'escalade~~ — **fait** | — |

### Après l'ouverture (améliorations)

- Rappels automatiques des délais (SLA) dépassés : non prévus aujourd'hui.
- Conservation et suppression automatiques des données (RGPD) : le champ existe (`retentionUntil`), il n'est pas calculé.
- Pièces jointes au-delà de 7 Mo (Cloud Storage).
- Traduction EN / PT des nouveaux écrans d'administration (Notifications e-mail, Rôles).
- Synchronisation incrémentale au-delà de quelques centaines de dossiers (aujourd'hui : relecture toutes les 20 s par poste).
- Scénarios de bout en bout sur émulateurs exécutés automatiquement en CI.
- Diagnostic : le test « par compte » nécessite le droit `iam.serviceAccounts.signBlob`.

## Mise à jour du 7 octobre 2026

_Diagnostic de production du 7 octobre, 8 h 08 UTC (lecture seule)._

| Point | État |
|---|---|
| E-mails | Expéditeur `ACTIVA Whistleblowing <no-reply@activa-alertes.com>` déployé ; 2 notifications envoyées, 0 échec en 30 jours ; 1 e-mail d'essai réussi sur 4 (à refaire depuis l'administration). Seul domaine de destinataires autorisé : `group-activa.com`. Nouvel e-mail « Dossier attribué » à l'enquêteur désigné. |
| Comptes | Toujours 2 comptes (administrateur système, responsable des investigations) : B2 reste à faire. |
| Dossiers | 0 dossier en base. |
| Sauvegardes (B3) | PITR et protection contre la suppression toujours désactivées → `./scripts/devops/gcp-hardening.sh backups`. |
| Comptes Firebase (R3) | Inscription libre ouverte, politique de mots de passe non configurée → `./scripts/devops/gcp-hardening.sh auth`. |
| MFA (R4) | Désactivée ; nécessite Identity Platform puis l'écran d'enrôlement dans le portail → `./scripts/devops/gcp-hardening.sh mfa`. |
| Branche `main` (R1) | Toujours non protégée (le dépôt étant public, la protection est gratuite). |
| Recette (B6) | Plan détaillé : `docs/RECETTE-METIER.md`. |
| État de tous ces réglages | `./scripts/devops/gcp-hardening.sh status` (lecture seule). |

## Mise à jour du 8 octobre 2026 — reste à faire pour la mise en exploitation

_Diagnostic de production du 8 octobre, 12 h 24 UTC (lecture seule)._

### Fait depuis le 7 octobre

| Point | État |
|---|---|
| Sauvegardes (B3) | Restauration à la seconde (PITR) et protection contre la suppression **activées**. |
| Comptes Firebase (R3) | Politique de mots de passe **imposée** ; inscription libre fermée. |
| Branche `main` (R1) | **Protégée** : contrôles `web` et `functions` obligatoires. |
| Double authentification (R4) | Identity Platform activé, **MFA activée** (Google Authenticator) ; obligatoire pour les administrateurs système et sécurité ; réinitialisation depuis l'écran Utilisateurs. |
| Dépôt public | Envoi par l'adresse du site (même origine), numéro provisoire unique hors ligne, alias en cas de numéro déjà pris, bandeau « Transmission en cours », cause des échecs dans la piste d'audit, autotest `/diagnostic-envoi.html`. |
| Formulaire | Champs obligatoires manquants signalés en rouge. |
| E-mails | Expéditeur `no-reply@activa-alertes.com`, e-mail à l'enquêteur désigné ; 4 notifications envoyées, 0 échec en 30 jours. |

### Reste à faire

**Bloquant**

| # | Action | Qui |
|---|---|---|
| E1 | Créer les comptes réels (opérateurs, DARC / Conformité, enquêteurs) — aujourd'hui 2 comptes seulement | Administrateur du portail |
| E2 | Vérifier les destinataires des e-mails (superviseurs, DARC, DGA, DRH : 1 adresse chacun aujourd'hui) puis refaire l'e-mail d'essai de chaque groupe (1 essai réussi sur 4 à ce jour) | Administrateur du portail |
| E3 | Recette métier complète (`docs/RECETTE-METIER.md`), y compris un dépôt depuis 2 ou 3 téléphones | DARC + opérateur + enquêteur |
| E4 | Purger les dossiers de test après la recette (dont `AACMR-26-10-0001`) | Administrateur GitHub (workflow « Firebase delete test cases ») |
| E5 | Mentions légales : RCCM, représentant légal, hébergeur (Google Cloud, base en Europe `eur3`), durée de conservation, contact du DPO | Service juridique |
| E6 | Signalement du 8 octobre resté sur le téléphone : ouvrir activa-alertes.com sur ce téléphone pour qu'il parte | Déclarant (test) |

**Fortement recommandé**

| # | Action | Qui |
|---|---|---|
| E7 | Second compte administrateur système (sinon personne ne peut réinitialiser la double authentification de l'unique administrateur) et clé Google Authenticator conservée en lieu sûr | Direction + administrateur |
| E8 | App Check imposé pour la base et la connexion du personnel (`gcp-hardening.sh app-check-enforce`) ; garder le formulaire public non imposé | Cloud Shell |
| E9 | Budget et alertes de dépense (`gcp-hardening.sh budget`, en indiquant la devise du compte de facturation) | Cloud Shell |
| E10 | Révoquer l'ancienne clé JSON de déploiement et supprimer le secret GitHub `FIREBASE_SERVICE_ACCOUNT_ACTIVA` | Cloud Shell + GitHub |
| E11 | Vérifier que les sauvegardes programmées et les alertes de supervision existent (`gcp-hardening.sh status` ; le diagnostic n'a pas le droit de les lire) | Cloud Shell |

**Avant l'ouverture au public (organisation)**

- Désigner qui surveille la boîte de réception, et à quelle fréquence.
- Communiquer le lien et la procédure aux collaborateurs (note interne, affichage).
- Former les opérateurs et enquêteurs (le guide fonctionnel est prêt).

**Après l'ouverture (améliorations)**

- Rappels automatiques des délais dépassés.
- Conservation et suppression automatiques des données (champ `retentionUntil` non calculé).
- Pièces jointes au-delà de 7 Mo.
- Traduction EN / PT des écrans d'administration récents.
