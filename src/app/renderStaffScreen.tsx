/**
 * === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
 *
 * Aiguillage des écrans de l'espace collaborateur (auparavant le corps de
 * `renderStaffContent()` dans App.tsx), déplacé tel quel : mêmes branches,
 * même ordre, mêmes `PermissionGuard`, mêmes `key` React, mêmes props.
 *
 * Volontairement une FONCTION ordinaire (appelée par `renderStaffContent()`,
 * toujours présent dans App.tsx) et non un composant : l'arbre React
 * produit est strictement identique à avant — aucune couche de composant
 * supplémentaire entre `<Suspense>` et l'écran, donc exactement les mêmes
 * remontages/conservations d'état lors des changements d'onglet.
 *
 * Tout ce que le corps lisait dans la portée d'`AppShell` lui est passé via
 * `ctx`, puis déstructuré sous les mêmes noms.
 */
import React from 'react';
import type { Language, UserProfile } from '../types';
import { PermissionGuard } from '../routing/guards';
import { canSeeAuditTrail, canManageConfiguration, userCan } from '../services/authz';
import { InvestigationDesk, OperatorCaseDesk, ControlPanel, ReportingDashboard, ExecutiveDashboard, AuditTrailView, AdminConfigView, TasksRegistry, EvidenceRegistry, CommunicationsRegistry, CorrectiveActionsRegistry, AdvancedSearchView, EmailNotificationsTab } from './lazyScreens';

export type StaffCaseFilter = { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean; trackingNumber?: string; myCasesOnly?: boolean };

export interface StaffScreenContext {
  currentTab: string;
  lang: Language;
  t: Record<string, string>;
  activeUser: UserProfile;
  isGlobalViewer: boolean;
  effectiveCaseFilter: StaffCaseFilter | undefined;
  navigateToCases: (filter?: StaffCaseFilter) => void;
  goToTab: (tab: string) => void;
}

export function renderStaffScreen(ctx: StaffScreenContext): React.ReactNode {
  const { currentTab, lang, t, activeUser, isGlobalViewer, effectiveCaseFilter, navigateToCases, goToTab } = ctx;

  if (currentTab === 'control_panel') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.cp_title}>
        <ControlPanel
          lang={lang}
          activeUser={activeUser}
          onNavigateToCases={navigateToCases}
          onNavigateToReports={() => goToTab('reports')}
          onNavigateToNewCase={() => goToTab('new_alert')}
        />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Correction bug — filtres de dossiers figés) ===
  // BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : "Boîte de
  // réception"/"À attribuer"/"En attente d'infos"/"Dossiers traités"
  // affichaient tous le même contenu que "Tous les dossiers". Cause
  // racine : toutes ces branches rendent le MÊME type de composant
  // (`InvestigationDesk`) à la MÊME position de l'arbre — React ne le
  // démonte donc jamais en changeant d'onglet, il se contente de
  // re-rendre avec de nouvelles props. Or `InvestigationDesk` lit
  // `initialFilter` uniquement dans des `useState(...)` d'initialisation
  // (jamais resynchronisés par la suite, voir son commentaire d'origine
  // qui supposait à tort un remontage à chaque onglet) : le filtre reste
  // donc figé sur la toute première valeur vue, quel que soit l'onglet
  // cliqué ensuite. Corrigé en donnant à chaque rendu une vraie clé React
  // distincte (`key`) : `portal` varie avec le filtre effectif lui-même
  // (un lien profond vers un AUTRE dossier peut changer sans que l'onglet
  // ne change), les autres varient simplement avec `currentTab` puisque
  // leur filtre associé est fixe pour cet onglet. Aucune logique interne
  // d'InvestigationDesk n'est modifiée — seul le remontage est corrigé.
  // === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Dossiers", style
  // OperatorCaseDesk pour les comptes en lecture seule) === BUG
  // PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur (captures de
  // référence) : pour un compte sans aucun droit d'écriture sur les
  // dossiers (ni cases.edit ni cases.assign — ex. Consultation, Comité
  // d'Audit), "Dossiers" (`portal`) reprend désormais le même composant
  // que les écrans Opérateur/Enquêteur (cartes KPI réelles, tableau
  // Pays/Entité/Nature/Criticité/Sévérité-Urgence) plutôt que l'ancienne
  // vue InvestigationDesk (bandeau + filtres riches déjà allégés dans un
  // tour précédent, mais visuellement différente des écrans sœurs).
  // Réutilise le mode `my_cases` (prédicat toujours vrai, aucune
  // notion d'attribution) — `useVisibleAlerts` fait déjà le bon travail :
  // un compte à vision globale (Consultation/Comité d'Audit) y voit tous
  // les dossiers, pas seulement "les siens". Titre/sous-titre/état vide
  // surchargés pour ne jamais dire "vos dossiers attribués" à un compte
  // qui n'a justement aucune attribution.
  // La fiche dossier en détail (`/cases/:trackingNumber`, tout autre
  // appelant y compris ce même onglet `portal`) continue de passer par
  // InvestigationDesk, strictement inchangé — seule la LISTE change, et
  // seulement pour ces comptes précis (tout compte avec cases.edit ou
  // cases.assign garde exactement l'écran "Dossiers" d'avant).
  if (currentTab === 'portal') {
    // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
    // BUG PRÉEXISTANT CORRIGÉ : cet écran (et 19 autres, voir les
    // `PermissionGuard` ajoutés dans ce fichier) n'était protégé par
    // AUCUNE permission — seul `AuthenticatedRoute` vérifiait qu'une
    // session était active, pas que ce compte précis avait le droit de
    // voir des dossiers. `cases.read` est la permission de base pour
    // toute visibilité de dossier (domain/permissions.ts) — l'absence
    // volontaire de ce droit pour `system_admin`/`security_admin`
    // ("System Administrator ≠ Case Access", brief section 30) n'était
    // jusqu'ici pas réellement appliquée pour cet écran.
    const isReadOnlyCaseViewer = !userCan(activeUser, 'cases.edit') && !userCan(activeUser, 'cases.assign');
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label="Dossiers">
        {isReadOnlyCaseViewer && !effectiveCaseFilter?.trackingNumber ? (
          <OperatorCaseDesk
            key="portal-readonly-list"
            lang={lang}
            activeUser={activeUser}
            mode="my_cases"
            titleOverride={t.cases_readonly_title}
            subtitleOverride={t.cases_readonly_subtitle}
            emptyOverride={t.cases_readonly_empty}
            onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })}
          />
        ) : (
          <InvestigationDesk key={`portal-${JSON.stringify(effectiveCaseFilter ?? {})}`} lang={lang} activeUser={activeUser} onCreateNewCase={() => goToTab('new_alert')} initialFilter={effectiveCaseFilter} hideTopBanner simplifiedFilters />
        )}
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Phase 9 — écrans dédiés façon maquette) ===
  // Chacune de ces entrées réutilise InvestigationDesk (même liste, même
  // écran de détail, mêmes actions) avec un `initialFilter` préréglé
  // différent — pas une copie, un préréglage — exactement comme le
  // Centre de Pilotage le fait déjà pour ses propres cartes KPI.
  // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
  // Les 8 écrans ci-dessous n'avaient jusqu'ici AUCUN `PermissionGuard` —
  // voir la note complète sur l'onglet 'portal' plus haut. Chacun est
  // désormais gardé par la permission minimale réellement nécessaire pour
  // afficher un contenu pertinent (domain/permissions.ts) : `cases.read`
  // pour les vues de dossiers, `evidence.read`/`communications.read`/
  // `reports.read` pour les 3 registres transverses dédiés.
  if (currentTab === 'triage') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.guard_label_new_reports}>
        <InvestigationDesk key={currentTab} lang={lang} activeUser={activeUser} onCreateNewCase={() => goToTab('new_alert')} initialFilter={{ status: 'new' }} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'assignment') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label="Attribution">
        <InvestigationDesk key={currentTab} lang={lang} activeUser={activeUser} onCreateNewCase={() => goToTab('new_alert')} initialFilter={{ unassignedOnly: true }} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'my_cases') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.sidebar_inv_my_cases}>
        <InvestigationDesk key={currentTab} lang={lang} activeUser={activeUser} onCreateNewCase={() => goToTab('new_alert')} initialFilter={{ myCasesOnly: true }} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'investigations') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label="Investigations">
        <InvestigationDesk key={currentTab} lang={lang} activeUser={activeUser} onCreateNewCase={() => goToTab('new_alert')} initialFilter={{ status: 'investigation' }} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'tasks') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.reg_investigations_title}>
        <TasksRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'evidence') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'evidence.read')} label="Preuves">
        <EvidenceRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'communications') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'communications.read')} label="Communications">
        <CommunicationsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'corrective_actions') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.reg_recommendations_title}>
        <CorrectiveActionsRegistry lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'reports') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'reports.read')} label="Rapports">
        <ReportingDashboard lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'executive') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.guard_label_executive}>
        <ExecutiveDashboard lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'audit') {
    // === AMÉLIORATION AJOUTÉE (Phase 12.3) === garde désormais sur la
    // vraie permission `audit.read`, pas `isGlobalViewer` — `system_admin`
    // n'a plus accès aux dossiers mais garde bien accès à la piste
    // d'audit (il a `audit.read`), exactement comme dans l'ancien modèle.
    return (
      <PermissionGuard lang={lang} allowed={canSeeAuditTrail(activeUser)} label={t.nav_audit}>
        <AuditTrailView lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'settings') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label="Administration">
        <AdminConfigView lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Phase 9 — Administration scindée en 2 écrans
  // dédiés façon maquette) === Même composant, même CRUD, même garde de
  // rôle que 'settings' ci-dessus — seul l'onglet de départ diffère, et le
  // sélecteur d'onglets complet reste visible pour ne rien masquer.
  if (currentTab === 'admin_users') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label={t.guard_label_users_roles}>
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="users" />
      </PermissionGuard>
    );
  }
  if (currentTab === 'admin_config') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label="Configuration">
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="matrix" />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Phase 11 — "Rôles & Permissions" de la
  // maquette) === même composant/CRUD/garde que 'admin_users', onglet de
  // départ différent.
  if (currentTab === 'admin_roles') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label={t.sidebar_admin_roles}>
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="roles" />
      </PermissionGuard>
    );
  }

  // === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
  // Chaque nouvelle URL réutilise un écran déjà réel avec un
  // `initialFilter` préréglé différent — même technique que triage/
  // assignment/my_cases (Phase 9) ci-dessus, jamais un écran fabriqué ou
  // un placeholder. Voir routing/routes.ts pour la table complète des
  // nouveaux chemins.
  if (currentTab === 'op_dashboard') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.guard_label_operator_dashboard}>
        <ControlPanel
          lang={lang}
          activeUser={activeUser}
          onNavigateToCases={navigateToCases}
          // === AMÉLIORATION AJOUTÉE (Revue navigation — nettoyage des doublons morts) ===
          // Pointait vers `op_reports`, un doublon exact de `reports`
          // retiré ci-dessous — même écran, une seule route désormais.
          onNavigateToReports={() => goToTab('reports')}
          onNavigateToNewCase={() => goToTab('new_alert')}
        />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) ===
  // 4 écrans réécrits une seconde fois sur retour utilisateur détaillé
  // (captures de référence supplémentaires) : `OperatorCaseDesk` (KPI
  // réels, sélection multiple, filtres riches pays/entité/nature/
  // criticité/sévérité/urgence/canal/sensibilité, panneau liste+détail
  // pour la Boîte de réception) remplace le rendu InvestigationDesk+
  // initialFilter de la Refonte Opérateur (phase précédente) — même
  // périmètre de dossiers par écran (voir OperatorCaseDesk.tsx
  // MODE_CONFIG, qui reprend exactement les mêmes règles `status`/
  // `excludeClosed`/`assignedOnly` qu'avant). La fiche dossier complète
  // (InvestigationDesk, strictement inchangée) reste à un clic via
  // `onOpenCase`/`navigateToCases`.
  // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
  // Ces 5 écrans Opérateur n'avaient aucun `PermissionGuard`, contrairement
  // à leurs 2 écrans frères déjà gardés (op_assign/op_dashboard,
  // `isGlobalViewer`) — même garde appliquée ici, pour une cohérence
  // totale au sein de l'espace Opérateur.
  if (currentTab === 'op_inbox') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.sidebar_op_inbox}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="inbox" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'op_pending_info') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.sidebar_op_pending}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="pending_info" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'op_assign') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label="Attribution">
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="to_assign" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'op_processed') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.sidebar_op_processed}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="assigned" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers
  // envoyés en revue) ===
  if (currentTab === 'op_review') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.case_status_review}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="review" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) ===
  if (currentTab === 'op_closed') {
    return (
      <PermissionGuard lang={lang} allowed={isGlobalViewer} label={t.sidebar_op_closed}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="closed" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Revue navigation — nettoyage des doublons
  // morts) === `op_search`/`op_reports`/`op_communications` (Phase 6)
  // supprimés d'ici : ils rendaient exactement `advanced_search`/
  // `reports`/`communications` ci-dessous, sans aucune différence
  // fonctionnelle, et n'étaient plus reliés à aucun bouton de menu depuis
  // la Proposition B. Leurs anciennes URLs restent fonctionnelles
  // (routing/routes.ts, LEGACY_PATH_ALIASES) et retombent directement sur
  // ces mêmes branches partagées.

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — miroir Espace
  // Enquêteur) === Même redéfinition que côté Opérateur, appliquée à
  // l'équivalent Enquêteur de chaque écran (toujours restreint à
  // `myCasesOnly` — un enquêteur ne voit jamais que ses propres
  // dossiers, mécanisme inchangé) :
  // - "À traiter" (inv_to_process) capte désormais "mes affaires
  //   nouvelles et en cours" (`excludeClosed`), pas seulement les
  //   nouvelles — même principe que "À attribuer" côté Opérateur.
  // - "Mes dossiers" (inv_my_cases) était déjà l'équivalent exact de
  //   "Dossiers attribués" (aucun enquêteur ne voit un dossier non
  //   attribué) — filtre inchangé, bandeau retiré.
  // - "En attente" (inv_pending) : filtre déjà exact, bandeau retiré.
  // - "En cours" (inv_in_progress) : reste un raccourci plus étroit que
  //   "À traiter" (même principe que "En attente d'infos" à côté
  //   d'"À attribuer" côté Opérateur) — filtre inchangé, bandeau retiré.
  // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
  // "Tableau de bord" (bandeau KPI + simple liste, décision ci-dessous
  // historique) remplacé par un vrai panneau liste + détail/réponse,
  // sur demande explicite de l'utilisateur, qui a fourni une capture de
  // référence (Boîte de réception Opérateur) en précisant vouloir en
  // reprendre tous les éléments SAUF les cartes KPI, conservées à
  // l'identique (voir `OperatorCaseDesk` mode `inv_inbox`, mêmes 4
  // libellés/formules que l'ancien bandeau `InvestigationDesk`
  // ci-dessous). Périmètre inchangé : mêmes dossiers que "Mes dossiers"
  // (`useVisibleAlerts` restreint déjà un enquêteur non global-viewer à
  // ses seuls dossiers assignés).
  //
  // Ancienne décision (conservée pour mémoire, plus appliquée ici depuis
  // le remplacement ci-dessus) : Tableau de bord (inv_dashboard)
  // conservait son bandeau, comme le vrai Tableau de bord Opérateur
  // (ControlPanel) — hors périmètre de la refonte Opérateur v2, qui ne
  // concernait que les 4 écrans nommés explicitement.
  // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
  // Les 5 écrans Enquêteur ci-dessous n'avaient aucun `PermissionGuard` —
  // `cases.read`, la permission de base pour toute visibilité de dossier
  // (déjà utilisée pour 'portal'/'triage'/'my_cases' ci-dessus).
  if (currentTab === 'inv_dashboard') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.sidebar_op_inbox}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="inv_inbox" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace
  // Enquêteur) === même remplacement par `OperatorCaseDesk` que côté
  // Opérateur (voir plus haut) — `myCasesOnly` n'a plus besoin d'être
  // passé explicitement : `useVisibleAlerts` restreint déjà un compte non
  // global-viewer à ses seuls dossiers assignés (mécanisme strictement
  // inchangé), donc les nouveaux modes `my_cases`/`to_process`/
  // `in_progress` n'ont besoin d'exprimer que la nuance de statut propre à
  // chaque écran. "En attente" réutilise le mode `pending_info` existant
  // (même règle, même action "Relancer"), avec son libellé propre.
  if (currentTab === 'inv_my_cases') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.sidebar_inv_my_cases}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="my_cases" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'inv_to_process') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.db_bucket_a_traiter}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="to_process" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'inv_in_progress') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.corrective_status_in_progress}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="in_progress" onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'inv_pending') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.db_bucket_en_attente}>
        <OperatorCaseDesk key={currentTab} lang={lang} activeUser={activeUser} mode="pending_info" titleOverride={t.sidebar_inv_pending} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Revue navigation — nettoyage des doublons
  // morts) === `inv_tasks`/`inv_evidence`/`inv_communications`/
  // `inv_reports`/`inv_search` (Phase 6) supprimés d'ici, même motif que
  // op_search/op_reports/op_communications ci-dessus.
  // === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) === entrée de
  // barre latérale partagée (pas propre à un espace) — useVisibleAlerts
  // limite déjà correctement le périmètre pour n'importe quel rôle.
  // === AMÉLIORATION AJOUTÉE (Audit frontend — correction critique) ===
  if (currentTab === 'advanced_search') {
    return (
      <PermissionGuard lang={lang} allowed={userCan(activeUser, 'cases.read')} label={t.nav_search_advanced}>
        <AdvancedSearchView lang={lang} activeUser={activeUser} onOpenCase={(tn) => navigateToCases({ trackingNumber: tn })} />
      </PermissionGuard>
    );
  }

  if (currentTab === 'admin_audit') {
    return (
      <PermissionGuard lang={lang} allowed={canSeeAuditTrail(activeUser)} label={t.nav_audit}>
        <AuditTrailView lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'admin_reports') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label={t.guard_label_system_reports}>
        <ReportingDashboard lang={lang} activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  if (currentTab === 'admin_organization') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label="Organisation">
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="organization" />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  // === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
  if (currentTab === 'admin_notifications') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label="Notifications e-mail">
        <EmailNotificationsTab activeUser={activeUser} />
      </PermissionGuard>
    );
  }
  if (currentTab === 'admin_governance') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label="Gouvernance">
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="governance" />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée) === 3 nouvelles
  // entrées de barre latérale pour des sections déjà réelles
  // (AdminConfigView les rendait déjà, uniquement via sa rangée d'onglets
  // interne retirée) — même garde, même composant, seul l'onglet de
  // départ diffère, exactement le motif déjà suivi par admin_organization/
  // admin_governance ci-dessus.
  if (currentTab === 'admin_entities') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label={t.guard_label_group_entities}>
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="entities" />
      </PermissionGuard>
    );
  }
  if (currentTab === 'admin_categories') {
    return (
      <PermissionGuard lang={lang} allowed={canManageConfiguration(activeUser)} label={t.guard_label_alert_categories}>
        <AdminConfigView lang={lang} activeUser={activeUser} initialTab="categories" />
      </PermissionGuard>
    );
  }
  // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
  // données" retiré) === Branche `admin_database` retirée d'ici, sur
  // demande explicite de l'utilisateur : `AdminConfigView` ne supporte
  // plus `initialTab="database"` (type retiré sur cette branche ; sur
  // `main`, la même prop pointe désormais vers `DatabaseFirebaseTab`, un
  // composant extrait, sans lien de menu — voir la fusion ci-dessous).
  // L'ancienne URL `/admin/database` (routing/routes.ts) n'est plus
  // reliée à aucun écran ; une navigation directe y retombe sur
  // `return null` ci-dessous, même comportement qu'une route staff
  // inconnue.
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) === Branche
  // `admin_workflow` retirée en fusionnant avec `main`, dont le propre
  // refactor d'AdminConfigView.tsx (extraction par onglet, voir
  // src/components/admin/) n'a jamais réextrait d'onglet Workflow — ce
  // type d'onglet n'existe donc plus dans `AdminConfigView`. Le backend
  // (`storage.getWorkflowTransitions`/`updateWorkflowTransitions`) reste
  // intact, seul cet accès UI disparaît.

  return null;
}
