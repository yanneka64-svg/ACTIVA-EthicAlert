/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Modes de l'écran (type OperatorDeskMode, actions de ligne, table
 * MODE_CONFIG : icône, libellés, prédicat de panier, action proposée).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 * `OperatorDeskMode` reste réexporté par OperatorCaseDesk.tsx (chemin
 * d'import existant inchangé). Seul ajout : le mot-clé `export` sur
 * RowAction/ModeConfig/MODE_CONFIG, nécessaire pour les partager.
 */
import React from 'react';
import { Inbox, ListChecks, HelpCircle, FolderCheck, FolderOpen, Clock, Archive, Eye } from 'lucide-react';
import { AlertRecord } from '../../types';

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace Enquêteur) ===
// 3 nouveaux modes purement additifs : `my_cases`/`to_process`/`in_progress`
// remplacent le rendu InvestigationDesk+initialFilter des écrans Enquêteur
// `inv_my_cases`/`inv_to_process`/`inv_in_progress` (mêmes règles de
// périmètre qu'avant — `useVisibleAlerts` limite déjà un enquêteur non
// global à ses propres dossiers, donc aucune notion d'attribution n'a de
// sens ici : pas de case à cocher, pas de bouton Attribuer). L'écran
// Enquêteur "En attente" (`inv_pending`) réutilise directement le mode
// `pending_info` existant (règle et action "Relancer" identiques), avec ses
// libellés surchargés via `titleOverride`/`subtitleOverride`/`emptyOverride`
// ci-dessous plutôt qu'un 5e mode dupliqué.
// === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === `closed`,
// juste en dessous de `assigned` ("Dossiers attribués") dans la barre
// latérale (StaffPortalLayout.tsx) : les dossiers attribués ET clôturés,
// en lecture seule (`rowAction: 'none'`, comme les 3 écrans Enquêteur
// "de travail" ci-dessus) — jamais de réattribution sur un dossier déjà
// clos.
// === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers envoyés
// en revue) === `review`, entre `assigned` et `closed` : dossiers dont le
// rapport d'investigation a été envoyé en revue (workflowStatus
// conclusion_pending/functional_review, InvestigationDesk.handleSendToReview)
// — en lecture seule ici aussi (`rowAction: 'none'`), la clôture réelle se
// fait sur la fiche dossier complète via `onOpenCase`, qui réutilise telle
// quelle la validation déjà existante (handleCloseAlert — au moins une
// mesure corrective documentée) plutôt que de la dupliquer.
export type OperatorDeskMode = 'inbox' | 'to_assign' | 'pending_info' | 'assigned' | 'review' | 'closed' | 'my_cases' | 'to_process' | 'in_progress' | 'inv_inbox';

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace Enquêteur) ===
// `rowAction` dit quelle action de ligne/groupée cet écran propose :
// 'assign'/'reassign' (gardées en plus par `cases.assign`, voir `canAssign`
// plus bas), 'followup' (relance — aucune permission dédiée, comme la
// messagerie déjà réelle d'InvestigationDesk), ou 'none' (les 3 écrans
// Enquêteur "de travail" — aucune notion d'attribution n'a de sens sur son
// propre périmètre déjà filtré par `useVisibleAlerts`) : ni case à cocher,
// ni colonne d'action, ni barre d'actions groupées.
export type RowAction = 'assign' | 'reassign' | 'followup' | 'none';

export interface ModeConfig {
  icon: React.ComponentType<{ className?: string }>;
  titleKey:
    | 'sidebar_op_inbox' | 'sidebar_op_assign' | 'sidebar_op_pending' | 'sidebar_op_processed' | 'sidebar_op_review' | 'sidebar_op_closed'
    | 'sidebar_inv_my_cases' | 'sidebar_inv_to_process' | 'sidebar_inv_in_progress' | 'sidebar_inv_inbox';
  subtitleKey:
    | 'ocd_inbox_subtitle' | 'ocd_to_assign_subtitle' | 'ocd_pending_info_subtitle' | 'ocd_assigned_subtitle' | 'ocd_review_subtitle' | 'ocd_closed_subtitle'
    | 'ocd_my_cases_subtitle' | 'ocd_to_process_subtitle' | 'ocd_in_progress_subtitle';
  emptyKey:
    | 'ocd_empty_inbox' | 'ocd_empty_to_assign' | 'ocd_empty_pending_info' | 'ocd_empty_assigned' | 'ocd_empty_review' | 'ocd_empty_closed'
    | 'ocd_empty_my_cases' | 'ocd_empty_to_process' | 'ocd_empty_in_progress';
  predicate: (a: AlertRecord) => boolean;
  rowAction: RowAction;
}

export const MODE_CONFIG: Record<OperatorDeskMode, ModeConfig> = {
  inbox: {
    icon: Inbox,
    titleKey: 'sidebar_op_inbox',
    subtitleKey: 'ocd_inbox_subtitle',
    emptyKey: 'ocd_empty_inbox',
    predicate: (a) => a.status === 'new',
    rowAction: 'assign',
  },
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === "toutes les affaires
  // nouvelles et en cours" — même règle que l'ancien `excludeClosed`.
  to_assign: {
    icon: ListChecks,
    titleKey: 'sidebar_op_assign',
    subtitleKey: 'ocd_to_assign_subtitle',
    emptyKey: 'ocd_empty_to_assign',
    predicate: (a) => a.status !== 'corrective_action' && a.status !== 'closed' && a.status !== 'archived',
    rowAction: 'assign',
  },
  pending_info: {
    icon: HelpCircle,
    titleKey: 'sidebar_op_pending',
    subtitleKey: 'ocd_pending_info_subtitle',
    emptyKey: 'ocd_empty_pending_info',
    predicate: (a) => a.status === 'under_review',
    rowAction: 'followup',
  },
  // === AMÉLIORATION AJOUTÉE (Dossiers ouverts, ex-"Dossiers attribués") ===
  // Renommé sur demande explicite, maintenant que les dossiers clôturés ont
  // leur propre onglet dédié (`closed`, ci-dessous) : exclut désormais les
  // dossiers déjà clôturés, pour ne plus faire doublon avec ce nouvel
  // onglet — inverse exact de "non attribués" restreint aux dossiers
  // encore ouverts.
  assigned: {
    icon: FolderCheck,
    titleKey: 'sidebar_op_processed',
    subtitleKey: 'ocd_assigned_subtitle',
    emptyKey: 'ocd_empty_assigned',
    predicate: (a) => a.assignedInvestigators.length > 0 && a.status !== 'closed',
    rowAction: 'reassign',
  },
  // === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers
  // envoyés en revue) === Se base sur `workflowStatus` (moteur riche,
  // InvestigationDesk.handleSendToReview) plutôt que sur le statut legacy
  // `corrective_action` : ce dernier est aussi atteint par l'ancien
  // mécanisme "Mesure corrective ajoutée", sans rapport avec un envoi en
  // revue — les deux ne doivent pas être confondus ici. Exclut closed/
  // archived explicitement : `handleCloseAlert` ne remet pas `workflowStatus`
  // à jour, donc un dossier clôturé depuis cet état y resterait sinon
  // indéfiniment visible.
  review: {
    icon: Eye,
    titleKey: 'sidebar_op_review',
    subtitleKey: 'ocd_review_subtitle',
    emptyKey: 'ocd_empty_review',
    predicate: (a) =>
      (a.workflowStatus === 'conclusion_pending' || a.workflowStatus === 'functional_review') &&
      a.status !== 'closed' &&
      a.status !== 'archived',
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === même
  // périmètre que `assigned` (dossiers réellement attribués), restreint aux
  // dossiers clôturés — jamais de réattribution possible sur ceux-ci
  // (`rowAction: 'none'`), colonnes dédiées ci-dessous (Réf./Nature/Pays/
  // Entité/Reçu le/Clôturé le/Résumé).
  closed: {
    icon: Archive,
    titleKey: 'sidebar_op_closed',
    subtitleKey: 'ocd_closed_subtitle',
    emptyKey: 'ocd_empty_closed',
    // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
    // périmètre) === Un dossier classé "Doublon"/"Hors périmètre"
    // (storage.transitionStatus) n'a par nature jamais d'investigateur
    // assigné — sans cette clause, il resterait invisible de cet onglet
    // (et de fait de toute l'interface Opérateur) une fois clôturé.
    predicate: (a) => a.status === 'closed' && (a.assignedInvestigators.length > 0 || a.workflowStatus === 'duplicate' || a.workflowStatus === 'out_of_scope'),
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace
  // Enquêteur) === 3 modes ci-dessous : mêmes règles exactes que les
  // anciens `initialFilter` d'App.tsx (`myCasesOnly`/`excludeClosed`/
  // `status`) — mais `myCasesOnly` lui-même n'a plus besoin d'être recalculé
  // ici : `useVisibleAlerts` restreint déjà un compte non global-viewer à
  // ses seuls dossiers assignés, donc le prédicat n'a besoin d'exprimer que
  // la nuance de statut propre à chaque écran.
  my_cases: {
    icon: FolderOpen,
    titleKey: 'sidebar_inv_my_cases',
    subtitleKey: 'ocd_my_cases_subtitle',
    emptyKey: 'ocd_empty_my_cases',
    predicate: () => true,
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
  // Nouvel onglet d'accueil de l'espace Enquêteur (`inv_dashboard`, voir
  // App.tsx) : même périmètre exact que `my_cases` ci-dessus (tous les
  // dossiers attribués à l'enquêteur connecté, `useVisibleAlerts` s'en
  // charge déjà) — seule la présentation change, avec le panneau liste +
  // détail/réponse côte à côte de la Boîte de réception Opérateur (voir
  // `mode === 'inbox' || mode === 'inv_inbox'` plus bas), sur demande
  // explicite de l'utilisateur ("appliquer les éléments de la boite de
  // réception opérateur excepté la première partie [les cartes KPI]").
  // Jamais de case à cocher ni de bouton Attribuer (`rowAction: 'none'`,
  // même raison que `my_cases`/`to_process`/`in_progress` : un enquêteur
  // n'a pas à s'auto-attribuer ses propres dossiers).
  inv_inbox: {
    icon: Inbox,
    titleKey: 'sidebar_inv_inbox',
    subtitleKey: 'ocd_my_cases_subtitle',
    emptyKey: 'ocd_empty_my_cases',
    predicate: () => true,
    rowAction: 'none',
  },
  to_process: {
    icon: ListChecks,
    titleKey: 'sidebar_inv_to_process',
    subtitleKey: 'ocd_to_process_subtitle',
    emptyKey: 'ocd_empty_to_process',
    predicate: (a) => a.status !== 'corrective_action' && a.status !== 'closed' && a.status !== 'archived',
    rowAction: 'none',
  },
  in_progress: {
    icon: Clock,
    titleKey: 'sidebar_inv_in_progress',
    subtitleKey: 'ocd_in_progress_subtitle',
    emptyKey: 'ocd_empty_in_progress',
    predicate: (a) => a.status === 'investigation',
    rowAction: 'none',
  },
};
