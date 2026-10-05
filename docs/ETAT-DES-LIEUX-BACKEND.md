# État des lieux — portail ↔ serveur (Firebase)

_Établi le 5 octobre 2026. Mis à jour au fil des phases de branchement._

Le portail affiche les dossiers lus sur le serveur (`listCases` / `getCaseDetails`,
synchronisation toutes les 20 s), mais chaque écran écrit d'abord dans une copie
locale du navigateur (`services/storage.ts`). Une action n'est **partagée** (visible
sur un autre poste, par un autre compte, et conservée) que si elle est aussi
envoyée au serveur.

## 1. Déjà branché

| Domaine | Action | Fonction serveur |
|---|---|---|
| Déclarant | Dépôt d'un signalement (formulaire complet, file d'attente hors ligne) | `createCaseAsReporter` |
| Déclarant | Suivi, messages, documents, « en train d'écrire » | `getCaseForReporter`, `reporterConversation`, `addCommunicationAsReporter`, `addEvidenceAsReporter` |
| Personnel | Connexion, profil, changement de mot de passe | Firebase Auth, `getMyStaffProfile`, `changeMyStaffPassword` |
| Personnel | Annuaire et gestion des comptes | `listStaffDirectory`, `create/update/delete/resetStaffAccount…` |
| Dossiers | Liste et détail | `listCases`, `getCaseDetails` |
| Dossiers | Création manuelle par le personnel | `createCase` |
| Dossiers | Message au déclarant (fiche dossier, Boîte de réception) | `addCommunication`, `staffConversation` |
| Dossiers | Note interne, tâche (ajout), entretien, conflit d'intérêts | `addInvestigationNote`, `addTask`, `addInterview`, `declareConflictOfInterest` |
| Dossiers | Personne impliquée / témoin (ajout), évaluation du risque, mesure corrective | `addPerson`, `recordRiskAssessment`, `addCorrectiveAction` |
| Dossiers | Téléchargement des documents du déclarant | `getEvidenceFileForStaff` |

## 2. Écrit seulement dans le navigateur (perdu pour les autres postes)

| Priorité | Action | Écran / code | Conséquence |
|---|---|---|---|
| **Critique** | **Attribution à un enquêteur** (unitaire et en masse) | `useAssignForm`, `OperatorCaseDesk` | L'enquêteur ne reçoit jamais le dossier ; l'attribution disparaît au rechargement |
| **Critique** | Changement de statut, classement sans suite, demande d'informations, revue | `transitionStatus`, `useRequestInfoForm`, `useDismissForm` | Le serveur refuse la plupart des transitions ; le statut revient en arrière |
| **Critique** | Clôture (synthèse, message au déclarant), réouverture | `useCloseForm`, `useReopenForm` | Dossier jamais clôturé côté serveur ; le déclarant ne voit pas la clôture |
| Haute | Escalade, routage indépendant (personne mise en cause) | `escalateAlert`, `triggerIndependentRouting` | Protection de la personne mise en cause non appliquée sur les autres postes |
| Haute | Rapport d'enquête (texte + fichier), pièces ajoutées par le personnel | `useInvestigationReportForm`, `InvestigationDesk` | Fichiers visibles uniquement sur le poste qui les a ajoutés |
| Haute | Mise à jour d'une tâche, rattachement d'une personne à un compte | `updateTask`, `usePersonForms` | Avancement et exclusion non partagés |
| Haute | Message envoyé depuis « Toutes les communications » | `CommunicationsRegistry` | Le déclarant ne le reçoit pas |
| Moyenne | Configuration : entités, pays, catégories, SLA, niveaux hiérarchiques, rôles, workflow, destinataires d'escalade | `admin/*Tab.tsx` | Chaque poste a sa propre configuration |
| Moyenne | Piste d'audit affichée | `AuditTrailView` | Montre le journal du navigateur, pas celui du serveur (`audit_logs`) |
| Sans objet | Brouillon du formulaire public | `saveDraft` | Volontairement local (confidentialité) |

## 3. Plan de branchement

1. **Dossiers — travail du personnel** : attribution, statuts, clôture, réouverture,
   escalade, routage, rapport, tâches, rattachements → nouvelle fonction serveur
   `applyPortalUpdate` (droits vérifiés, audit, historique) appelée automatiquement
   à chaque enregistrement d'un dossier du serveur.
2. **Documents du personnel et messages restants** : pièces et rapport d'enquête
   stockés sur le serveur ; message depuis « Toutes les communications ».
3. **Configuration partagée** : `getPortalConfig` / `savePortalConfig`.
4. **Piste d'audit serveur** : `listAuditLogs` pour les comptes habilités.

## 4. Avancement

- **Phase 1 — livrée** : `applyPortalUpdate` + envoi automatique depuis `storage.ts`
  (file d'attente hors ligne `services/portalSync.ts`). Attribution, statuts,
  clôture (et message de clôture au déclarant), réouverture, escalade, routage
  indépendant, rapport d'enquête (texte), avancement des tâches, rattachement
  d'une personne à un compte, message depuis « Toutes les communications ».
  Le déclarant voit désormais le statut réel de son dossier. Vérifié de bout en
  bout sur émulateurs : `scripts/e2ePortalUpdate.emulator.mts`.
