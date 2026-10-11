# Robustesse : base lente, modifications simultanées, pannes, observabilité

> === AMÉLIORATION AJOUTÉE (transactions, concurrence, observabilité) ===

Ce document décrit le comportement de la plateforme quand les choses ne se
passent pas comme prévu. Il indique ce qui a été corrigé et comment surveiller
la production.

## 1. La base de données ralentit

| Où | Comportement |
|---|---|
| Dépôt d'un signalement | Il est enregistré en une seule transaction : le dossier, les personnes, les exclusions des mis en cause, l'historique et l'audit. Si la réponse n'arrive pas, le navigateur renvoie le dépôt avec le même identifiant (`submissionId`) et le serveur reconnaît le doublon. |
| Travail du personnel (statut, attribution, rapport…) | Il est d'abord enregistré dans le navigateur, puis envoyé par une file d'attente rejouée toutes les 30 s et au retour du réseau. **Nouveau** : après 3 essais sans réponse (~1 min), un bandeau orange prévient que l'enregistrement sur le serveur est en attente. Le travail n'est pas perdu. |
| Message ou document du déclarant | **Nouveau** : chaque envoi porte un identifiant. Il est rejoué une fois automatiquement si le serveur ne répond pas, sans risque de doublon. Si le déclarant renvoie le même texte après un échec, le même identifiant est réutilisé. |
| E-mails | Délai maximal de 10 s. Un échec n'empêche jamais l'action, et il est tracé (`EMAIL_NOTIFICATION_FAILED`). |
| Synchronisation des dossiers | Toutes les 20 s, seuls les dossiers modifiés sont rechargés. Un appel lent retarde l'affichage, sans perte. |

## 2. Deux personnes modifient la même donnée

**Avant** : le dernier qui enregistrait écrasait l'autre, sans que personne
ne le sache.

**Maintenant** (`applyPortalUpdate`, transaction Firestore) :

- Chaque envoi contient la valeur que la personne voyait avant de modifier
  (`expected`). Cela vaut pour les champs saisis : synthèse, rapport, motifs,
  dates.
- Le serveur relit le dossier **dans la transaction**. Si un collègue a changé
  ce champ entre-temps, la modification n'est **pas** écrite. Le champ est
  renvoyé en « conflit », l'événement est tracé (`PORTAL_UPDATE_CONFLICT`) et
  un bandeau explique la situation. La version du collègue est rechargée
  aussitôt.
- Si deux personnes modifient **des champs différents** en même temps, les
  deux modifications sont gardées.
- Il n'y a jamais de faux conflit : un champ absent du serveur, ou une valeur
  déjà écrite (envoi rejoué), est accepté.
- Les attributions, statuts, tâches et rattachements sont contrôlés sur
  l'état **frais** du dossier. Par exemple, on ne peut pas attribuer un
  dossier à une personne rattachée entre-temps comme mise en cause.
- Les anciennes versions du site, sans `expected`, gardent leur comportement
  d'avant.

## 3. Une requête échoue au milieu d'une opération

| Opération | Avant | Maintenant |
|---|---|---|
| Dépôt avec une personne mise en cause | Les exclusions étaient posées **après** l'enregistrement, et une erreur était ignorée : le dossier pouvait rester visible par la personne mise en cause. | Exclusions calculées avant, puis écrites **dans la même transaction** que le dossier. |
| Mise à jour par le personnel | Lot de modifications, puis audit et historique écrits séparément : une panne entre les deux laissait une modification sans trace d'audit. | Dossier, personnes, tâches, audit et historique écrits dans **une seule transaction**. |
| File d'envoi du navigateur | Une modification faite **pendant** un envoi était effacée avec lui quand il réussissait : elle était perdue en silence. | Seule la partie envoyée est retirée. Le reste repart, avec les bonnes valeurs attendues. |
| Message du déclarant | Message, historique et date d'activité écrits séparément. | Une seule transaction, puis l'e-mail. |
| Document du déclarant | Limite de documents vérifiée hors transaction : deux envois simultanés pouvaient la dépasser. | Limite revérifiée dans une transaction qui verrouille le dossier. Le fichier, le message, l'historique et l'audit sont écrits ensemble. |

Ce qui n'est **pas** transactionnel, volontairement : les e-mails. Un
e-mail envoyé ne se reprend pas. Ils partent **après** l'enregistrement et
ne peuvent pas l'annuler.

## 4. Erreurs

- Erreur prévue (droits, saisie invalide, session expirée) : code précis
  (`permission-denied`, `invalid-argument`, `unauthenticated`…), sans
  détail interne.
- Erreur imprévue : réponse générique `internal` au navigateur. Le journal du
  serveur conserve le nom, le message et la pile d'appels (voir §6).
- Refus définitif d'un envoi du personnel : bandeau rouge. Avant, ces refus
  n'apparaissaient que dans la console du navigateur.

## 5. Sécurité dans ces situations

- Aucune nouvelle donnée n'est acceptée sans validation. `expected` passe la
  même validation que le reste. Les identifiants d'envoi (`clientMessageId`,
  `clientUploadId`) ont un format strict et ne valent que dans le dossier de
  la session du déclarant.
- Les contrôles d'accès sont refaits **dans** la transaction : un droit retiré
  entre la lecture et l'écriture est pris en compte.
- Le journal ne contient **aucune donnée personnelle** : pas de contenu, pas
  de nom, pas d'e-mail, pas de numéro de suivi du déclarant. Un compte n'y
  figure que sous forme d'empreinte courte.

## 6. Observabilité

Chaque appel à une Cloud Function écrit **une ligne JSON** dans Cloud Logging
(`src/domain/callObservability.ts`, `guardedHandler` dans
`functions/src/index.ts`) :

```json
{ "severity": "WARNING", "event": "callable", "fn": "applyPortalUpdate",
  "outcome": "ok", "durationMs": 4210, "slow": true, "role": "investigator",
  "actor": "3f9a1c0b7e21", "correlationId": "9c1e…" }
```

- `severity` : `INFO` (normal), `WARNING` (lent ≥ 3 s, ou refus normal),
  `ERROR` (panne : `internal`, `deadline-exceeded`, `unavailable`,
  `aborted`). Les erreurs imprévues ajoutent `error.name`, `error.message` et
  `error.stack`.
- La trace Cloud est rattachée (`logging.googleapis.com/trace`) quand elle
  est disponible.

### Requêtes utiles (Logs Explorer)

```
jsonPayload.event="callable" severity>=ERROR
jsonPayload.event="callable" jsonPayload.slow=true
jsonPayload.event="callable" jsonPayload.fn="applyPortalUpdate" jsonPayload.outcome!="ok"
```

Le taux de conflits figure aussi dans la piste d'audit du portail (action
`PORTAL_UPDATE_CONFLICT`).

### Alertes à créer (une fois, Cloud Shell du projet de production)

```bash
PROJECT=activa-ethicalert-47246
# Métriques à partir des journaux
gcloud logging metrics create callable_errors --project "$PROJECT" \
  --description="Appels en panne (erreurs imprévues, délais, indisponibilité)" \
  --log-filter='jsonPayload.event="callable" AND severity>=ERROR'
gcloud logging metrics create callable_slow --project "$PROJECT" \
  --description="Appels lents (>= 3 s)" \
  --log-filter='jsonPayload.event="callable" AND jsonPayload.slow=true'
```

Ensuite, dans Cloud Monitoring → Alerting → Create policy, utiliser :

- `logging.googleapis.com/user/callable_errors` : seuil **> 5 en 5 min**,
  avec notification par e-mail à l'équipe DARC/IT ;
- `logging.googleapis.com/user/callable_slow` : seuil **> 20 en 15 min**
  (base ou fonctions ralenties).

Il faut aussi activer l'alerte de budget de facturation, si ce n'est pas
déjà fait.

## 7. Tests

| Test | Contenu |
|---|---|
| `scripts/e2eConcurrency.emulator.mts` (CI, émulateurs) | Même champ modifié simultanément, champs différents, envoi rejoué, ancienne version du site, dépôt envoyé deux fois en parallèle, exclusion immédiate du mis en cause, message et document envoyés deux fois, 4 documents simultanés pour 2 places. |
| `src/domain/portalUpdate.test.ts` | Détection des conflits, fusion, validation, reste à envoyer. |
| `src/services/portalSync.test.ts` | File d'envoi : une modification faite pendant un envoi n'est plus perdue. |
| `src/services/reporterSendIds.test.ts` | Identifiants d'envoi du déclarant. |
| `src/domain/callObservability.test.ts` | Gravité, appels lents, format du journal. |
| `src/app/PortalSyncBanner.test.ts` | Choix du bandeau (conflit, refus, attente). |
