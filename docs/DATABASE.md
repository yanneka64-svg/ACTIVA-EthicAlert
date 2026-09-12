# ACTIVA Hotline — Data Model

## A. Modèle actuel (`src/types.ts`, inchangé par la Phase 2)

Un seul objet monolithique par signalement :

```text
AlertRecord
├── id, trackingNumber, accessCodeHash, accessCodeSalt, channel
├── whistleblower: WhistleblowerInfo
├── category, subCategory, customViolationType, detailedDescription,
│   incidentDates, incidentLocation, concernedEntity, country
├── riskEvaluation: RiskEvaluation
├── impactType, estimatedImpactValue
├── involvedPersons: InvolvedPerson[]
├── witnesses: Witness[]
├── evidences: EvidenceFile[]        (métadonnées seulement, pas de contenu)
├── status: AlertStatus
├── assignedInvestigators: string[]
├── internalNotes: InternalNote[]
├── messages: CaseMessage[]
└── correctiveMeasures: CorrectiveMeasure[]
```

Stocké intégralement dans `localStorage` (clé `activa_ethicalert_records_v1`) et répliqué best-effort vers Firestore (collection `alerts`, un document = un `AlertRecord`).

**Ce modèle reste la source de vérité de l'application tant que les phases 4/5/6 n'ont pas migré l'UI vers le nouveau modèle.** Il n'est ni modifié ni supprimé par cette phase.

## B. Modèle cible (`src/domain/caseTypes.ts`, introduit par la Phase 2)

Collections normalisées, prêtes pour Firestore (chaque bloc = une collection ou sous-collection) :

```text
users/{userId}
roles/{roleId}
countries/{countryCode}
entities/{entityId}
departments/{departmentId}
configuration/{key}              // risk matrix, SLA rules, categories, workflow, assignment rules...

cases/{caseId}
cases/{caseId}/allegations/{allegationId}
cases/{caseId}/persons/{personId}          // subjects (implicated) + witnesses, distingués par `kind`
cases/{caseId}/evidence/{evidenceId}
cases/{caseId}/tasks/{taskId}
cases/{caseId}/interviews/{interviewId}
cases/{caseId}/investigation_notes/{noteId}   // STRICTEMENT interne, jamais exposé au reporter
cases/{caseId}/communications/{messageId}     // STRICTEMENT reporter ⇄ investigateur, jamais les notes internes
cases/{caseId}/findings/{findingId}
cases/{caseId}/corrective_actions/{actionId}
cases/{caseId}/risk_assessments/{assessmentId}
cases/{caseId}/timeline/{eventId}

audit_logs/{logId}               // collection racine, append-only, jamais sous cases/ (isolation — une fuite
                                  // d'un Case ne doit pas donner accès en écriture à son propre audit trail)
notifications/{notificationId}
```

### `Case` (objet central)

```text
caseId              // identifiant système immuable (jamais affiché)
caseNumber           // "CASE-2026-000123", généré côté serveur, séquentiel
status               // voir workflow.ts — CaseStatus
category, subcategory
country, entity
reportingMode        // 'anonymous' | 'identified'
priority             // dérivée du dernier risk_assessment actif
riskScore
confidentialityLevel // 'restricted' | 'confidential' | 'highly_confidential'
assignee             // primary investigator (userId)
additionalInvestigators: string[]
reviewer             // userId du functional reviewer, si applicable
slaStartAt, slaDueAt, slaStatus   // 'ok' | 'at_risk' | 'overdue' | 'escalated'
receivedAt, incidentDate
description, impact
createdAt, updatedAt, closedAt, archivedAt
retentionUntil        // calculé à la clôture (règle de rétention configurable)
legalHold: boolean
```

### `Allegation`

```text
allegationId, caseId
category, subcategory, description
status                 // 'open' | 'assessed'
finding                // SUBSTANTIATED | PARTIALLY_SUBSTANTIATED | UNSUBSTANTIATED | INCONCLUSIVE | OUT_OF_SCOPE | DUPLICATE
findingRationale
findingDocumentedBy, findingDocumentedAt
```

Un `Case` peut contenir 1..n `Allegation`. **Le finding global du dossier est dérivé** des findings documentés par allégation (jamais saisi directement) — cf. `domain/workflow.ts`.

### `Person`

```text
personId, caseId
kind                    // 'subject' (personne mise en cause) | 'witness'
name, position, entity, country
hierarchyLevel           // 'employee' | 'manager' | 'senior_manager' | 'director_plus'
allegedRole               // texte libre, uniquement pour kind = 'subject'
linkedUserId              // si cette personne est aussi un compte utilisateur du système
                           // → utilisé pour bloquer automatiquement son accès au dossier
```

### `Evidence`

```text
evidenceId, caseId
fileName, fileType, fileSize
description
storagePath              // jamais une URL publique — résolue via une Cloud Function signée
uploadedBy, uploadedAt
version, previousVersionId
sha256Hash
confidentiality           // 'standard' | 'restricted'
status                     // 'active' | 'superseded' | 'deleted' (jamais de suppression physique)
```

### `Task`, `Interview`, `InvestigationNote`, `Communication`, `Finding` (au niveau global du dossier), `CorrectiveAction`, `RiskAssessment`, `TimelineEvent`

→ champs détaillés directement dans `src/domain/caseTypes.ts` (commenté), pour éviter la duplication et le risque de désynchronisation entre ce document et le code.

### `User` / `Role` / `Permission`

```text
User { userId, name, email, roleId, countries[], entities[], active, mfaEnabled, createdAt, disabledAt }
Role { roleId, name, permissions[] }              // ex: 'investigator' → ['cases.read','evidence.upload',...]
Permission (liste fermée, voir permissions.ts)     // cases.read, cases.create, cases.assign, cases.reassign,
                                                     // cases.edit, cases.close, cases.reopen, cases.export,
                                                     // evidence.read, evidence.upload, evidence.delete,
                                                     // communications.read, communications.send,
                                                     // reports.read, reports.export,
                                                     // configuration.manage, users.manage, audit.read
```

L'accès effectif à un `Case` = **Authentication ∧ Role a la permission ∧ scope pays/entité couvre le dossier ∧ (assigné OU rôle global autorisé) ∧ confidentialityLevel compatible avec le rôle**.

## C. Table de correspondance (migration sans perte)

| Ancien (`AlertRecord`) | Nouveau |
|---|---|
| `id`, `trackingNumber` | `caseId` (nouveau UUID), `caseNumber` (reformaté `CASE-YYYY-NNNNNN`) |
| `accessCodeHash/Salt` | conservés tels quels sur un document séparé `reporter_credentials/{caseId}` (jamais dans `Case`, cf. section « isolation des identifiants » du prompt) |
| `whistleblower.*` | `reporter_identity/{caseId}` — collection séparée, accessible seulement via un contrôle d'accès explicite et audité (section 44 du cahier des charges : « aucun investigateur n'obtient l'identité simplement parce qu'elle a été fournie ») |
| `category/subCategory/detailedDescription` | `Allegation` unique générée (1 allégation par défaut ; l'UI future permettra d'en scinder plusieurs) |
| `involvedPersons[]` | `Person[]` avec `kind = 'subject'` |
| `witnesses[]` | `Person[]` avec `kind = 'witness'` |
| `evidences[]` | `Evidence[]` (métadonnées reprises, `storagePath` vide tant que l'upload réel n'existe pas — Phase 8) |
| `riskEvaluation` (+ `overridePriority/overrideReason`) | `RiskAssessment` (avec traçabilité `originalScore/overrideScore/overrideReason/user/date` déjà prévue) |
| `internalNotes[]` | `InvestigationNote[]` |
| `messages[]` | `Communication[]` |
| `correctiveMeasures[]` | `CorrectiveAction[]` |
| `status` | `CaseStatus` (mappage direct pour les statuts communs ; `under_review` legacy → `triage`) |

Cette table est implémentée et vérifiée par `src/data-access/migrateLegacy.ts` (voir script de vérification en section « Tests » du rapport de phase).
