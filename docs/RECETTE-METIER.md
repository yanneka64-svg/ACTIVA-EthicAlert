# Plan de recette métier — activa-alertes.com

_Version du 7 octobre 2026. Durée estimée : 1 h 30 à 2 h, à trois personnes._

Objectif : vérifier sur la plateforme réelle qu'un signalement fictif circule
correctement du dépôt à la clôture, que chaque personne ne voit que ce qu'elle
doit voir, et que les bons e-mails arrivent aux bonnes personnes.

**Participants**

| Rôle dans la recette | Compte | Qui |
| --- | --- | --- |
| Administrateur | Administrateur système (existant) | Administrateur du portail |
| Opérateur | Administrateur fonctionnel (à créer) | 1 personne de l'équipe de traitement |
| DARC | Conformité DARC (à créer) | 1 personne de la DARC |
| Enquêteur | Investigateur (à créer) | 1 personne |
| Déclarant | Aucun compte | L'une des personnes ci-dessus, depuis un téléphone en navigation privée |

**Règles**
- Utiliser uniquement des adresses `@group-activa.com` (seul domaine autorisé pour les e-mails).
- Le dossier de recette doit être clairement fictif : commencer la description par « RECETTE — dossier fictif ».
- Noter pour chaque étape : OK / KO, l'heure et une remarque en cas d'écart (capture d'écran si possible).
- À la fin, le dossier de recette est supprimé (étape F2).

## A. Préparation (administrateur, 15 min)

| N° | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- |
| A1 | Administration → Utilisateurs : créer les comptes Opérateur (Administrateur fonctionnel), DARC (Conformité DARC) et Enquêteur (Investigateur), périmètre « tous pays ». Noter les mots de passe provisoires. | Les 3 comptes apparaissent comme actifs. | |
| A2 | Chaque participant se connecte sur activa-alertes.com → Connexion avec son mot de passe provisoire. | Changement de mot de passe obligatoire, règles cochées en direct, puis accès à l'accueil des espaces avec les seules cartes autorisées. | |
| A3 | Administration → Notifications e-mail : vérifier les adresses des groupes Superviseurs, DARC, DGA, DRH. Bouton « Envoyer un e-mail d'essai » pour chaque groupe. | Chaque destinataire reçoit l'e-mail d'essai, expéditeur « ACTIVA Whistleblowing <no-reply@activa-alertes.com> », bandeau bleu, sans erreur dans la piste d'audit. | |

## B. Dépôt et suivi (déclarant + opérateur, 20 min)

| N° | Qui | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- | --- |
| B1 | Déclarant | Sur téléphone, navigation privée : activa-alertes.com → Signaler une préoccupation. Catégorie « Fraude, corruption et pots-de-vin », anonyme, joindre une photo. | Accusé de réception avec numéro de dossier et mot de passe. Les noter. | |
| B2 | Opérateur, DARC | Boîtes mail | E-mail « Nouveau signalement — <numéro> » reçu par les superviseurs et la DARC, sans aucun détail des faits. | |
| B3 | Opérateur | Espace Opérateur → Boîte de réception | Le dossier apparaît avec sa criticité ; la photo est consultable. | |
| B4 | Opérateur | Messagerie du dossier : poser une question au déclarant. | Message envoyé ; le dossier peut passer « En attente d'informations ». | |
| B5 | Déclarant | Sur un autre appareil : Suivre mon signalement, avec numéro + mot de passe. Lire la question, répondre et joindre un document. | Question visible ; réponse et document envoyés. | |
| B6 | Opérateur | Revenir sur le portail. | Pastille rouge « nouveau message » ; réponse et document visibles. | |
| B7 | Déclarant | Saisir 5 fois un mauvais mot de passe sur le suivi. | Accès bloqué 5 minutes. | |

## C. Attribution et investigation (opérateur + enquêteur, 30 min)

| N° | Qui | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- | --- |
| C1 | Opérateur | À attribuer → Attribuer le dossier à l'Enquêteur. | Statut « Affecté ». | |
| C2 | Enquêteur | Boîte mail | E-mail « Dossier attribué — <numéro> » avec bouton « Ouvrir le dossier ». | |
| C3 | Enquêteur | Espace Enquêteur → Mes dossiers | Seul ce dossier est visible (aucun autre dossier du Groupe). | |
| C4 | Enquêteur | Dans la fiche : ajouter une tâche, un entretien, une note interne, une preuve ; ajuster l'évaluation du risque. | Tout est enregistré ; la criticité NOCA est recalculée. | |
| C5 | Déclarant | Suivi du dossier | La note interne n'est **pas** visible ; le statut est compréhensible. | |
| C6 | Enquêteur | Escalader le dossier vers la DARC Groupe (motif fictif). | Statut « Escaladé » ; e-mail d'escalade reçu par superviseurs, DARC et DGA. | |
| C7 | Opérateur | Ajouter une personne mise en cause et la relier au compte de l'Enquêteur. | L'Enquêteur ne voit plus le dossier (vérifier sur son écran) ; le dossier est réacheminé ; la décision figure dans la piste d'audit. | |

## D. Conclusion et clôture (opérateur ou DARC, 15 min)

| N° | Qui | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- | --- |
| D1 | Opérateur | Rédiger la conclusion, passer en revue fonctionnelle puis clôturer. | Statut « Clôturé » ; e-mail de clôture reçu par superviseurs et DARC. | |
| D2 | Déclarant | Suivi du dossier | Statut « Clôturé » visible. | |
| D3 | Opérateur | Rouvrir le dossier (faits nouveaux fictifs). | Statut « Rouvert » ; e-mail de réouverture reçu. | |

## E. Pilotage et sécurité (DARC + administrateur, 15 min)

| N° | Qui | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- | --- |
| E1 | DARC | Tableau de bord et Rapports | Le dossier est compté ; export CSV ou PDF fonctionnel. | |
| E2 | DARC | Piste d'audit, filtrer sur le dossier | Toutes les actions des étapes B à D apparaissent, avec auteur et heure, y compris les e-mails envoyés. | |
| E3 | Tous | Laisser une session du personnel inactive 5 minutes. | Déconnexion automatique. | |
| E4 | Administrateur | Se connecter avec le compte administrateur système. | Accès à la configuration, **aucun** accès au contenu du dossier. | |

## F. Clôture de la recette

| N° | Action | Résultat attendu | OK / KO |
| --- | --- | --- | --- |
| F1 | Rassembler les KO et remarques, décider : ouverture ou corrections. | Décision écrite (DARC). | |
| F2 | Supprimer le dossier de recette (workflow « Firebase delete test cases », d'abord à blanc puis réel). | Base sans dossier fictif ; suppression inscrite dans la piste d'audit. | |
| F3 | Désactiver ou conserver les comptes créés selon qu'ils serviront en production. | Liste des comptes à jour. | |
