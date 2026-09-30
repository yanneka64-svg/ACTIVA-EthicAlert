/**
 * === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par
 * section) ===
 *
 * Listes de menu de chaque espace (Opérateur, Enquêteur, Administration,
 * repli général), déplacées telles quelles depuis le corps de
 * StaffPortalLayout.tsx dans `buildSpaceNavItems` — toujours recalculées à
 * chaque rendu, avec exactement les mêmes entrées, libellés, icônes et
 * conditions de permission. Le type `NavItem` (auparavant local au
 * composant) est désormais exporté d'ici. Aucun changement de comportement.
 */
import React from 'react';
import { LayoutDashboard, FolderOpen, Search, Paperclip, MessageSquare, Wrench, LayoutGrid, Users, ShieldCheck, Globe2, Network, SlidersHorizontal, Inbox, UserPlus, Clock3, CheckCircle2, ListChecks, BarChart3, Building2, Tag, ClipboardCheck, Eye, Archive } from 'lucide-react';
import type { UserProfile } from '../../types';
import { userCan } from '../../services/authz';
import type { Permission } from '../../domain/permissions';
import type { SpaceKey } from '../../domain/staffSpaces';

export type NavItem = { key: string; label: string; icon: React.ReactNode; group: string };

export function buildSpaceNavItems(
  t: Record<string, string>,
  activeUser: UserProfile,
  canSeeControlPanel: boolean,
): Record<SpaceKey, NavItem[]> {
  // === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
  // Groupe "Outils" — écrans transverses, communs aux espaces Opérateur,
  // Enquêteur et au repli général (jamais dans l'espace Administration :
  // un compte admin-only, ex. system_admin, n'a de toute façon aucun accès
  // réel aux dossiers — brief section 30 — ces raccourcis y étaient déjà
  // des impasses avant cette phase, pas une fonctionnalité perdue).
  //
  // === AMÉLIORATION AJOUTÉE (Revue navigation — libellés selon le
  // périmètre réel) === Ces 3 écrans (Tâches/Preuves/Communications) sont
  // filtrés par `computeVisibleAlerts` (useVisibleAlerts.ts) : un compte
  // sans vision globale du rôle (`isGlobalCaseViewer` — ex. investigator)
  // n'y voit JAMAIS "toutes" les données, seulement celles des dossiers qui
  // lui sont assignés. "Toutes les tâches" serait donc trompeur pour un tel
  // compte — le libellé bascule sur "Mes tâches"/"Mes preuves"/"Mes
  // communications" selon le périmètre réel du compte connecté, pas selon
  // l'espace actuellement sélectionné (un compte à vision globale, ex.
  // functional_admin, garde "Toutes les X" même depuis l'espace Enquêteur).
  const toolsItems: Array<Omit<NavItem, 'group'>> = [
    { key: 'advanced_search', label: t.nav_search_advanced, icon: <SlidersHorizontal className="w-4 h-4" /> },
    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des
    // investigations) === libellé unique (plus de distinction Mes/Toutes
    // les tâches) : cet écran n'est plus un registre à plat des tâches
    // mais un tableau de bord de suivi par dossier — le périmètre réel
    // (tous les dossiers pour un compte à vision globale, seulement les
    // siens sinon) reste géré par useVisibleAlerts comme partout ailleurs,
    // sans que le nom de l'écran ait besoin de le préciser.
    { key: 'tasks', label: t.reg_investigations_title, icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'evidence', label: canSeeControlPanel ? t.sidebar_evidence_registry : t.sidebar_my_evidence, icon: <Paperclip className="w-4 h-4" /> },
    { key: 'communications', label: canSeeControlPanel ? t.sidebar_comms_registry : t.sidebar_my_comms, icon: <MessageSquare className="w-4 h-4" /> },
    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des recommandations) ===
    { key: 'corrective_actions', label: t.reg_recommendations_title, icon: <Wrench className="w-4 h-4" /> },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  const operatorItems: NavItem[] = [
    { key: 'op_dashboard', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
    // === AMÉLIORATION AJOUTÉE (Retours visuels — nettoyage sidebar
    // Opérateur) === "Tous les dossiers" retiré sur demande explicite : les
    // 4 écrans ci-dessous (Boîte de réception/À attribuer/En attente
    // d'infos/Dossiers attribués) couvrent déjà tout le cycle de vie d'un
    // dossier côté Opérateur — cet onglet générique faisait doublon.
    // L'écran lui-même (`portal`) n'est pas supprimé : toujours atteignable
    // par URL (/cases) et utilisé par les liens profonds vers un dossier
    // précis (`navigateToCases`), inchangé pour l'espace général et pour
    // toute recherche.
    { key: 'op_inbox', label: t.sidebar_op_inbox, icon: <Inbox className="w-4 h-4" />, group: '' },
    { key: 'op_assign', label: t.sidebar_op_assign, icon: <UserPlus className="w-4 h-4" />, group: '' },
    { key: 'op_pending_info', label: t.sidebar_op_pending, icon: <Clock3 className="w-4 h-4" />, group: '' },
    { key: 'op_processed', label: t.sidebar_op_processed, icon: <CheckCircle2 className="w-4 h-4" />, group: '' },
    // === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers
    // envoyés en revue) === entre "Dossiers ouverts" et "Dossiers
    // clôturés" — suite logique du cycle de vie du dossier.
    { key: 'op_review', label: t.sidebar_op_review, icon: <Eye className="w-4 h-4" />, group: '' },
    // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === juste en
    // dessous de "Dossiers attribués", sur demande explicite.
    { key: 'op_closed', label: t.sidebar_op_closed, icon: <Archive className="w-4 h-4" />, group: '' },
    ...toolsItems.map((i) => ({ ...i, group: t.sidebar_group_tools })),
  ];

  const investigatorItems: NavItem[] = [
    // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
    // "Tableau de bord" remplacé par "Boîte de réception" sur demande
    // explicite de l'utilisateur : l'écran cible (`inv_dashboard` →
    // InvestigationDesk, `initialFilter={{ myCasesOnly: true }}`, voir
    // App.tsx) montre déjà uniquement les dossiers attribués à l'enquêteur
    // connecté — seuls le libellé et l'icône changent, clé de routage et
    // écran inchangés (route '/investigator/dashboard' conservée).
    { key: 'inv_dashboard', label: t.sidebar_inv_inbox, icon: <Inbox className="w-4 h-4" />, group: '' },
    { key: 'inv_my_cases', label: t.sidebar_inv_my_cases, icon: <FolderOpen className="w-4 h-4" />, group: '' },
    { key: 'inv_to_process', label: t.sidebar_inv_to_process, icon: <ListChecks className="w-4 h-4" />, group: '' },
    { key: 'inv_in_progress', label: t.sidebar_inv_in_progress, icon: <Search className="w-4 h-4" />, group: '' },
    { key: 'inv_pending', label: t.sidebar_inv_pending, icon: <Clock3 className="w-4 h-4" />, group: '' },
    ...toolsItems.map((i) => ({ ...i, group: t.sidebar_group_tools })),
  ];

  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée) ===
  // BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : l'écran
  // "Configuration Système" (AdminConfigView) se pilotait jusqu'ici par
  // DEUX navigations en parallèle — cette barre latérale (6 entrées) ET une
  // rangée de 9 onglets répétée en haut de son propre contenu (désormais
  // retirée, voir AdminConfigView.tsx), qui était la SEULE à donner accès à
  // "Matrice & SLA", "Entités", "Catégories" et "Base de données". Ces 4
  // entrées rejoignent ici les 6 déjà présentes (aucune renommée, aucune
  // retirée) — les 9 sections réelles sont désormais toutes atteignables
  // d'un seul endroit, dans l'ordre logique de l'ancienne rangée d'onglets.
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — retours visuels sur
  // capture de référence) === Ordre et libellés alignés sur la référence
  // fournie (Organisation, Catégories, Workflow, Utilisateurs, Rôles &
  // Permissions, Paramètres système) ; "Entités", "Gouvernance" et "Base de
  // données" (hors de la capture, mais bien réels — RI Phase 1-7 pour la
  // Gouvernance notamment) restent toutes atteignables, insérées près de la
  // section à laquelle elles se rattachent le plus. "admin_config" (ancienne
  // entrée "Matrice des risques & SLA") est retirée d'ici : elle pointait
  // vers exactement le même écran que "settings" (les deux sans onglet de
  // départ ⇒ 'matrix' par défaut, voir App.tsx) — garder les deux aurait
  // recréé le doublon de navigation qu'on vient de corriger. "settings"
  // (déjà la bonne route) porte donc directement le libellé "Paramètres
  // système" de la référence.
  const adminItems: NavItem[] = [
    { key: 'admin_organization', label: t.side_organisation, icon: <Globe2 className="w-4 h-4" />, group: '' },
    { key: 'admin_entities', label: t.guard_label_group_entities, icon: <Building2 className="w-4 h-4" />, group: '' },
    { key: 'admin_categories', label: t.side_categories, icon: <Tag className="w-4 h-4" />, group: '' },
    { key: 'admin_users', label: t.sidebar_admin_users, icon: <Users className="w-4 h-4" />, group: '' },
    { key: 'admin_roles', label: t.sidebar_admin_roles, icon: <ShieldCheck className="w-4 h-4" />, group: '' },
    { key: 'admin_governance', label: t.side_governance, icon: <Network className="w-4 h-4" />, group: '' },
    // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
    // données" retiré) === Entrée "Base de données" retirée d'ici, sur
    // demande explicite de l'utilisateur — l'écran (rattachement Firebase)
    // et sa route restent en place, seul le lien de menu disparaît.
    // === AMÉLIORATION AJOUTÉE (suppression du lien "Paramètres système") ===
    // Retiré sur `main`, sur demande explicite de l'utilisateur : ce lien
    // était redondant avec le titre affiché en tête de la sidebar
    // ci-dessous. L'écran qu'il ciblait ('settings' → route '/admin',
    // `configTab` par défaut 'matrix') reste l'écran d'accueil naturel de
    // l'espace Admin — atteint dès l'entrée dans l'espace, sans avoir
    // besoin d'un lien de menu dédié.
  ];

  // === AMÉLIORATION AJOUTÉE (Espace Consultation — Audit interne &
  // externe) === UN SEUL espace de repli général (comptes sans Opérateur/
  // Enquêteur/Admin — Consultation, Comité d'Audit, Exécutif, Admin
  // Sécurité), pas deux — sur retour explicite de l'utilisateur ("Auditeur
  // externe et interne c'est la même chose, pas besoin de faire deux
  // interfaces"). Consultation et Comité d'Audit ont désormais exactement
  // les mêmes permissions (domain/permissions.ts) et voient donc
  // exactement le même menu ci-dessous, calculé une seule fois à partir de
  // la permission réelle de chaque entrée — jamais une liste dupliquée par
  // rôle. Liste à plat (jamais de regroupement "OUTILS" ici, fidèle à la
  // capture de référence), libellés courts propres à cet espace (jamais un
  // renommage des clés i18n partagées `sidebar_all_cases`/
  // `sidebar_evidence_registry`/`sidebar_comms_registry`, toujours
  // utilisées telles quelles côté Opérateur/Enquêteur — seulement un
  // intitulé alternatif local à `generalItems`). "Suivi des
  // investigations"/"Suivi des recommandations" (tableaux de bord orientés
  // traitement actif d'un dossier) ne figurent volontairement pas dans
  // cette liste courte : toujours un accès réel à ces 2 écrans par URL
  // directe (`/investigation`, `/investigation/corrective-actions`), rien
  // n'est retiré — seule la barre latérale se resserre sur les 6 entrées
  // de la référence.
  const GENERAL_TOOLS: Array<{ key: string; label: string; icon: React.ReactNode; permission: Permission }> = [
    { key: 'advanced_search', label: t.nav_search_advanced, icon: <SlidersHorizontal className="w-4 h-4" />, permission: 'cases.read' },
    { key: 'evidence', label: t.nav_evidence, icon: <Paperclip className="w-4 h-4" />, permission: 'evidence.read' },
    { key: 'communications', label: t.nav_communications, icon: <MessageSquare className="w-4 h-4" />, permission: 'communications.read' },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <LayoutGrid className="w-4 h-4" />, permission: 'reports.read' },
  ];
  const generalItems: NavItem[] = [
    ...(canSeeControlPanel ? [{ key: 'control_panel', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' }] : []),
    ...(userCan(activeUser, 'cases.read') ? [{ key: 'portal', label: t.breadcrumb_cases, icon: <FolderOpen className="w-4 h-4" />, group: '' }] : []),
    ...GENERAL_TOOLS.filter((i) => userCan(activeUser, i.permission)).map(({ permission: _permission, ...i }) => ({ ...i, group: '' })),
    // === AMÉLIORATION AJOUTÉE (Espaces Audit interne/externe) === "Piste
    // d'Audit" (`audit`, déjà un écran réel — AuditTrailView.tsx, gardé par
    // `canSeeAuditTrail`/`audit.read`, route `/audit-log`) n'apparaissait
    // jusqu'ici dans AUCUN menu pour un compte en repli général — seuls les
    // comptes admin y accédaient via "admin_audit". Rejoint cette liste pour
    // tout compte ayant réellement `audit.read` (ex. Comité d'Audit).
    ...(userCan(activeUser, 'audit.read') ? [{ key: 'audit', label: t.nav_audit, icon: <ClipboardCheck className="w-4 h-4" />, group: '' }] : []),
  ];

  const itemsBySpace: Record<SpaceKey, NavItem[]> = {
    operator: operatorItems,
    investigator: investigatorItems,
    admin: adminItems,
    general: generalItems,
  };
  return itemsBySpace;
}
