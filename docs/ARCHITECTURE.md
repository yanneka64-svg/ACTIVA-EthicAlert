# ACTIVA Hotline — Architecture

> Statut : **Phase 2 — Data model & architecture cible.**
> Ce document décrit (A) l'architecture réellement en place aujourd'hui et (B) l'architecture cible vers laquelle le projet migre par phases contrôlées (voir `README` de section « Plan de migration » ci-dessous). Aucune fonctionnalité existante n'est supprimée pendant cette migration : le nouveau modèle est ajouté en parallèle (`src/domain`, `src/data-access`) puis progressivement consommé par l'UI dans les phases suivantes.

## A. Architecture actuelle (au 2026-09, avant Phase 2)

> **Nettoyage hygiène — mise à jour de ce diagramme** : ce diagramme date
> d'avant l'ajout du routage par URL (`react-router-dom`, `src/routing/`)
> et d'avant la Phase 3 (voir `docs/FIREBASE-SETUP.md`), qui a réellement
> déployé Firebase Authentication et des règles Firestore restrictives
> pour le nouveau modèle `cases/{caseId}/...`. Corrigé ci-dessous sur ces
> deux points précis ; le reste du document (sections B/C/D) n'a pas été
> ré-audité au-delà de ce qui est cité explicitement.

```text
Browser
  │
  ├── React 19 + TypeScript + Vite + Tailwind 4 (SPA, routée par URL via
  │      react-router-dom — src/routing/routes.ts, src/routing/guards.tsx)
  │      App.tsx ──► Navbar / StaffPortalLayout ──► Views (components/*.tsx)
  │
  ├── services/storage.ts  (source de vérité = localStorage du navigateur,
  │      pour TOUT ce que l'UI actuelle affiche et modifie)
  │      └── best-effort, fire-and-forget sync vers Firestore si configuré
  │         (voir services/firebase.ts ci-dessous — désormais bloquée en
  │         écriture par les règles Firestore déployées, voir plus bas)
  │
  ├── services/firebase.ts (SDK initialisé seulement si l'utilisateur colle
  │      un firebaseConfig dans l'écran Admin ; jamais utilisé pour Auth ;
  │      écran retiré de la navigation Admin sur demande explicite —
  │      atteignable seulement via /admin/database)
  │
  ├── services/crypto.ts, services/rateLimiter.ts (durcissements ajoutés
  │      en Phase 1 : hash salé du mot de passe lanceur d'alerte, verrou
  │      anti-brute-force — tout deux côté client uniquement)
  │
  └── Backend applicatif RÉEL mais NON branché sur cette UI (voir
         docs/FIREBASE-SETUP.md) : Firebase Auth (5 comptes staff réels)
         et règles Firestore restrictives déployées et vérifiées en
         conditions réelles pour le modèle `cases/{caseId}/...` cible ;
         Cloud Functions écrites mais non déployées (plan Spark, Cloud
         Build indisponible) — aucune mutation métier réelle possible
         tant que ce blocage n'est pas levé. L'UI ci-dessus (localStorage)
         et ce backend restent deux systèmes étanches l'un à l'autre.
```

**Limitations structurelles** (détaillées dans l'audit livré avant cette phase) :
- Toute autorisation est évaluée en React, donc contournable côté client.
- Un seul document `AlertRecord` monolithique porte l'identité du lanceur, le contenu du signalement, les notes internes, les messages et les mesures correctives.
- Pas de machine à états pour les transitions de statut.
- Pas de scope pays/entité, uniquement « assigné » vs « vue globale ».

## B. Architecture cible

```text
Reporter ──► Public Portal ──► Cloud Functions (API métier) ──► Firestore (normalisé) + Storage
                                         │
                   Firebase Auth (custom claims : role, countries[], entities[])
                                         │
   ┌───────────────┬───────────────┬────┼────┬───────────────┬───────────────┐
 Risk Engine   SLA Engine   Assignment Engine   Workflow Engine   Notify Engine
   └───────────────┴───────────────┴─────────┴───────────────┴───────────────┘
                                   │
                     Audit Log (append-only — écrit uniquement
                       par les Cloud Functions, jamais par le client)
```

Principes directeurs :
1. **Le client ne décide jamais seul d'une mutation sensible.** Toute opération métier (création de dossier, changement de statut, affectation, clôture...) passe par une fonction serveur qui revalide permissions, scope et règles de transition avant d'écrire.
2. **Les Security Rules Firestore sont la deuxième ligne de défense**, pas la seule : lecture/écriture directe du client refusée par défaut, sauf lectures explicitement scopées et vérifiables nativement en rules (ex. `request.auth.uid in resource.data.assignedInvestigators`).
3. **Modèle de données normalisé** en sous-collections sous `cases/{caseId}/...` (voir `DATABASE.md`), au lieu d'un document unique.
4. **`localStorage` devient un cache/fallback offline**, plus la source de vérité, une fois Firebase réellement provisionné.
5. **Le Control Panel est le cockpit opérationnel** ; le **Case est l'objet central** ; l'**Investigation Workspace** est l'espace de traitement ; le **Reporter Portal** reste isolé du reste.

## C. Ce que la Phase 2 introduit concrètement

Cette phase est **additive uniquement** — aucun fichier existant consommé par l'UI actuelle n'est modifié ni supprimé :

| Nouveau dossier | Rôle |
|---|---|
| `src/domain/caseTypes.ts` | Modèle de données cible (Case, Allegation, Person, Evidence, Task, Interview, Finding, CorrectiveAction, RiskAssessment, TimelineEvent, Communication, InvestigationNote, AuditEvent, User/Role/Permission, Configuration). |
| `src/domain/workflow.ts` | Machine à états du cycle de vie du Case (statuts cibles + transitions autorisées) — logique pure, testable, indépendante du stockage. |
| `src/domain/permissions.ts` | Modèle RBAC granulaire (permissions atomiques `cases.read`, `evidence.upload`, etc.) + scope pays/entité + fonction pure `can(user, permission, context)`. |
| `src/data-access/caseRepository.ts` | Interface `CaseRepository` (façade d'accès aux données, pensée pour être réimplémentée demain par des appels Firestore/Cloud Functions) + une implémentation `LocalCaseRepository` fonctionnelle (persistance réelle en `localStorage`, sous des clés distinctes `activa_v2_*`, sans toucher aux clés `activa_ethicalert_*` existantes). |
| `src/data-access/migrateLegacy.ts` | Fonction de migration **sans perte** : convertit les `AlertRecord` existants (ancien modèle) vers le nouveau modèle normalisé, pour prouver que la migration réelle des 3 dossiers de démonstration fonctionne. Elle ne modifie ni ne supprime les données existantes ; elle produit une copie dans le nouveau modèle. |

Ce nouveau modèle **n'est pas encore branché sur l'interface** : c'est volontaire. Le brancher sur l'UI (nouveau Control Panel, Investigation Workspace, etc.) est prévu aux phases 4, 5 et 6, une fois l'authentification réelle (Phase 3) disponible pour appliquer les permissions pour de vrai. Faire l'inverse (UI d'abord) reviendrait à construire — comme l'interdit explicitement le cahier des charges — une interface qui « donne l'impression que le système fonctionne » sans moteur réel derrière.

## D. Dépendance bloquante pour la Phase 3

La Phase 3 (authentification réelle, Cloud Functions, Security Rules restrictives) nécessite un projet Firebase provisionné (Auth + Firestore + Storage + Functions, plan Blaze). Ce projet n'existe pas encore dans cet environnement. Le code de la Phase 3 sera écrit de façon déployable (Functions, Rules, intégration client) mais restera inactif tant qu'un projet réel n'est pas connecté.
