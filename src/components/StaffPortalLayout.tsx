import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  Paperclip,
  MessageSquare,
  Wrench,
  LayoutGrid,
  Users,
  ShieldCheck,
  Settings,
  ChevronRight,
  HelpCircle,
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  Globe2,
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  Network,
  // === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
  SlidersHorizontal,
  // === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
  Inbox,
  UserPlus,
  Clock3,
  CheckCircle2,
  ListChecks,
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des investigations) ===
  BarChart3,
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée) === icônes pour les
  // 3 sections jusqu'ici seulement atteignables via la rangée d'onglets
  // interne d'AdminConfigView (Matrice & SLA réutilise déjà `Settings`,
  // importé plus haut), désormais aussi présentes en barre latérale.
  Building2,
  Tag,
  // === AMÉLIORATION AJOUTÉE (Espaces Audit interne/externe) ===
  ClipboardCheck,
  Eye,
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) ===
  Archive,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Espaces Audit interne/externe) ===
import { Permission } from '../domain/permissions';
// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) === logique de disponibilité des espaces désormais
// partagée avec StaffSpaceHome.tsx et App.tsx (voir domain/staffSpaces.ts).
import { SpaceKey, computeAvailableSpaces } from '../domain/staffSpaces';

/**
 * === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
 *
 * Refonte demandée par l'utilisateur ("on a du mal à s'y retrouver") après
 * un audit du menu existant (voir l'artefact de diagnostic partagé avant
 * cette phase). Trois problèmes concrets corrigés ici :
 *
 * 1. Le sélecteur "Espace" (Opérateur/Enquêteur/Administration) ne faisait
 *    jusqu'ici que naviguer UNE FOIS vers un tableau de bord — la liste de
 *    menu en dessous ne changeait jamais selon l'espace actif. 8 écrans
 *    réels et déjà fonctionnels (op_inbox/op_assign/op_pending_info/
 *    op_processed/inv_to_process/inv_in_progress/inv_pending/
 *    inv_my_cases, voir App.tsx) n'avaient donc AUCUN bouton de menu nulle
 *    part. Le sélecteur pilote désormais réellement la liste affichée.
 * 2. "Investigations" (doublon exact de "Dossiers" — même écran, seul le
 *    filtre initial différait) est retiré : son filtre existe déjà comme
 *    onglet "En cours" sur l'écran Dossiers depuis le repère visuel
 *    (InvestigationDesk.tsx). "Tableaux de bord"/"Rapports" (deux boutons
 *    vers le MÊME écran) sont fusionnés en une seule entrée "Rapports".
 * 3. "Tâches"/"Preuves & Pièces jointes"/"Communications" sont renommés
 *    pour ne plus porter EXACTEMENT le même nom que l'onglet interne d'un
 *    dossier (qui, lui, n'affiche que les données de CE dossier) — voir
 *    `sidebar_tasks_registry`/`sidebar_evidence_registry`/
 *    `sidebar_comms_registry` (i18n/translations.ts).
 *
 * Aucun écran n'est supprimé côté code — seuls des raccourcis de menu
 * apparaissent, disparaissent de tel ou tel espace, ou changent de libellé.
 * Tous les écrans déjà démontrés au repère visuel restent atteignables par
 * URL comme avant.
 */

interface StaffPortalLayoutProps {
  lang: Language;
  activeUser: UserProfile;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

const ADMIN_TABS =['settings', 'admin_users', 'admin_roles', 'admin_config', 'admin_audit', 'admin_reports', 'admin_organization', 'admin_governance', 'admin_entities', 'admin_categories', 'admin_database'];

// Dérive l'espace concerné par un `currentTab` donné — `null` pour un onglet
// "partagé" (Dossiers, Recherche, Rapports, registres...) qui n'appartient à
// aucun espace en particulier, pour ne JAMAIS faire changer l'espace
// visuellement sélectionné quand on clique dessus (voir l'effet plus bas).
function spaceOfTab(tab: string): SpaceKey | null {
  if (tab.startsWith('op_')) return 'operator';
  if (tab.startsWith('inv_')) return 'investigator';
  if (ADMIN_TABS.includes(tab)) return 'admin';
  return null;
}

export const StaffPortalLayout: React.FC<StaffPortalLayoutProps> = ({
  lang,
  activeUser,
  currentTab,
  setCurrentTab,
  children,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE : correction post-fusion === ces deux
  // vérifications utilisaient encore l'ancien rôle `auditor` (5 rôles),
  // absent du modèle RBAC actuel (10 rôles, voir domain/caseTypes.ts) —
  // remplacées par les mêmes helpers déjà importés ci-dessus (jusqu'ici
  // inutilisés), qui expriment la même intention via de vraies permissions
  // plutôt qu'une liste de rôles codée en dur.
  const canSeeControlPanel = isGlobalCaseViewer(activeUser);

  // === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
  // barre latérale) === le calcul de "quels espaces ce compte peut-il
  // voir" vit désormais dans domain/staffSpaces.ts (réutilisé par
  // StaffSpaceHome.tsx et App.tsx) — plus de duplication locale. Un compte
  // qui ne relève d'aucun des 3 (ex. consultation/executive/audit_committee/
  // security_admin) reçoit toujours un espace "general" de repli : Tableau
  // de bord + Tous les dossiers + Outils, exactement comme avant.
  const availableSpaces: SpaceKey[] = computeAvailableSpaces(activeUser);
  const defaultSpace: SpaceKey = availableSpaces[0] ?? 'general';

  const [selectedSpace, setSelectedSpace] = useState<SpaceKey>(() => spaceOfTab(currentTab) ?? defaultSpace);

  // Garde l'espace affiché synchronisé avec la navigation réelle : cliquer
  // un onglet propre à un espace (op_*/inv_*/admin_*) — y compris via un
  // lien profond, une notification, ou le bouton retour du navigateur —
  // fait basculer visuellement le sélecteur sur cet espace. Cliquer un
  // onglet PARTAGÉ (Dossiers, Recherche avancée, un registre, Rapports...)
  // laisse l'espace actuellement sélectionné inchangé, pour que ces écrans
  // restent entourés du même menu contextuel qu'avant le clic.
  useEffect(() => {
    const derived = spaceOfTab(currentTab);
    if (derived && derived !== selectedSpace) setSelectedSpace(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  type NavItem = { key: string; label: string; icon: React.ReactNode; group: string };

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
    { key: 'admin_organization', label: 'Organisation', icon: <Globe2 className="w-4 h-4" />, group: '' },
    { key: 'admin_entities', label: 'Entités du Groupe', icon: <Building2 className="w-4 h-4" />, group: '' },
    { key: 'admin_categories', label: 'Catégories', icon: <Tag className="w-4 h-4" />, group: '' },
    { key: 'admin_users', label: t.sidebar_admin_users, icon: <Users className="w-4 h-4" />, group: '' },
    { key: 'admin_roles', label: t.sidebar_admin_roles, icon: <ShieldCheck className="w-4 h-4" />, group: '' },
    { key: 'admin_governance', label: 'Gouvernance', icon: <Network className="w-4 h-4" />, group: '' },
    // === AMÉLIORATION AJOUTÉE (suppression de l'onglet Base de données) ===
    // Retiré de la navigation sur demande explicite de l'utilisateur. L'écran
    // (rattachement Firebase, AdminConfigView.tsx, `configTab === 'database'`)
    // et sa route ('/admin/database') restent en place — seul ce lien de
    // menu disparaît, aucune fonctionnalité n'est supprimée.
    // === AMÉLIORATION AJOUTÉE (suppression du lien "Paramètres système") ===
    // Retiré sur demande explicite de l'utilisateur : ce lien était
    // redondant avec le titre "Paramètre système" désormais affiché en tête
    // de la sidebar ci-dessous. L'écran qu'il ciblait ('settings' → route
    // '/admin', `configTab` par défaut 'matrix') reste l'écran d'accueil
    // naturel de l'espace Admin — atteint dès l'entrée dans l'espace, sans
    // avoir besoin d'un lien de menu dédié.
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
    { key: 'evidence', label: 'Preuves', icon: <Paperclip className="w-4 h-4" />, permission: 'evidence.read' },
    { key: 'communications', label: 'Communications', icon: <MessageSquare className="w-4 h-4" />, permission: 'communications.read' },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <LayoutGrid className="w-4 h-4" />, permission: 'reports.read' },
  ];
  const generalItems: NavItem[] = [
    ...(canSeeControlPanel ? [{ key: 'control_panel', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' }] : []),
    ...(userCan(activeUser, 'cases.read') ? [{ key: 'portal', label: 'Dossiers', icon: <FolderOpen className="w-4 h-4" />, group: '' }] : []),
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
  const navItems = itemsBySpace[selectedSpace];

  let lastGroup: string | null = null;

  const renderNavButton = (item: NavItem, mobile = false) => {
    const active = currentTab === item.key;
    if (mobile) {
      return (
        <button
          key={`${item.key}-${item.label}`}
          onClick={() => setCurrentTab(item.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition ${
            active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      );
    }
    return (
      <button
        id={`sidebar-nav-${item.key}-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
        key={`${item.key}-${item.label}`}
        onClick={() => setCurrentTab(item.key)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
          active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        {/* === AMÉLIORATION AJOUTÉE (Correction bug — la liste change de
            position au clic) === BUG PRÉEXISTANT CORRIGÉ, signalé par
            l'utilisateur sur "Toutes les communications" : sans
            `whitespace-nowrap`, le libellé le plus long du menu passait sur 2
            lignes une fois actif (le `<ChevronRight>` ci-dessous, affiché
            uniquement à l'état actif, réduit la largeur dispo pour le
            texte) — le bouton devenait alors plus haut, poussant tous les
            éléments suivants vers le bas. `truncate` + `min-w-0` sur le
            libellé garantit une hauteur strictement identique, actif ou
            non, pour tous les éléments du menu. */}
        <span className="flex items-center gap-2.5 min-w-0">
          <span className={active ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </span>
        {active && <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6 px-0 lg:px-6 xl:px-8">
      {/* Sidebar (desktop) */}
      {/* === AMÉLIORATION AJOUTÉE (sidebar sous la topbar) === z-index
          explicite, strictement inférieur à celui de la topbar
          (Navbar.tsx, `z-40`), pour garantir que la sidebar collante ne
          puisse jamais s'afficher par-dessus elle pendant le défilement —
          elle doit toujours commencer juste en dessous.
          === AMÉLIORATION AJOUTÉE (Ascenseur sous l'en-tête) === `top-
          [5.5rem]` → `top-0` : cet offset compensait l'en-tête `sticky`
          flottant par-dessus le contenu pendant le défilement de la page
          entière. App.tsx a été restructuré pour que l'en-tête vive hors
          de la zone désormais seule scrollable (qui commence déjà juste
          en dessous de lui) — cette sidebar colle donc naturellement au
          bon endroit dès `top-0`, relatif à ce nouveau conteneur. */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-0 lg:z-30 lg:self-start bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
        {/* === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le
            sélecteur en barre latérale) === Le petit bloc "ESPACES" qui
            vivait ici (2-3 boutons empilés en haut de la sidebar) est
            retiré, sur demande explicite de l'utilisateur : le choix
            d'espace se fait désormais une seule fois, sur une vraie page
            d'accueil dédiée (StaffSpaceHome.tsx) juste après connexion,
            pas en permanence dans la barre latérale. `selectedSpace`
            (calculé ci-dessus depuis `currentTab`) continue de déterminer
            la LISTE de menu affichée ci-dessous — rien ne change côté
            contenu du menu lui-même, seul ce bloc de sélection disparaît.
            Pour changer d'espace après coup, voir le lien "Changer
            d'espace" du menu Profil (Navbar.tsx). */}
        {/* === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — retours
            visuels sur capture de référence) === Bloc titre "Configuration"
            en tête de la barre latérale, propre à l'espace Admin (fidèle à
            la référence) — purement visuel, ne change ni `navItems` ni la
            navigation elle-même.
            === AMÉLIORATION AJOUTÉE (renommage du bloc titre) === sur
            demande explicite de l'utilisateur : "Administration" devient
            "Configuration" puis "Paramètres", puis enfin "Paramètre
            système" (remplace aussi le lien de menu du même nom, retiré
            juste au-dessus) — le sous-texte ("Paramètres, utilisateurs et
            configuration") reste retiré. */}
        {selectedSpace === 'admin' && (
          <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-1">
            <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <Settings className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 text-sm leading-tight truncate">Paramètres système</p>
            </div>
          </div>
        )}
        {/* === AMÉLIORATION AJOUTÉE (Espaces Audit interne/externe) === Même
            motif que le bloc "Administration" ci-dessus, pour l'espace de
            repli général (Consultation, Comité d'Audit, Exécutif, Admin
            Sécurité — aucun n'a de droit d'écriture sur les dossiers) :
            repère visuel honnête indiquant que cet espace n'affiche que du
            contenu réellement consultable, sans aucune action d'attribution
            ou de modification. */}
        {selectedSpace === 'general' && (
          <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-1">
            <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <Eye className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 text-sm leading-tight">Consultation</p>
              <p className="text-[10px] text-slate-500 leading-snug">Accès en lecture seule, limité à vos habilitations</p>
            </div>
          </div>
        )}
        <nav className="flex-1 py-3 px-2.5">
          {navItems.map((item) => {
            const showGroupHeader = !!item.group && item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.key}-${item.label}`}>
                {showGroupHeader && (
                  // === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, contraste) ===
                  // BUG PRÉEXISTANT CORRIGÉ, mesuré via axe-core :
                  // text-slate-400 à cette taille ne passe pas le seuil WCAG
                  // AA (2.63:1, minimum 4.5:1) — text-slate-600 y remédie
                  // (text-slate-500 seul restait tout juste insuffisant,
                  // 4.46:1, sur le fond légèrement teinté de la sidebar).
                  <div className="px-3 pt-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {item.group}
                  </div>
                )}
                {renderNavButton(item)}
              </React.Fragment>
            );
          })}
        </nav>

        {/* "Besoin d'aide ?" — exact match with the reference mockup's sidebar footer */}
        <div className="m-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div className="text-[11px] leading-snug">
            <p className="font-bold text-slate-700">{t.sidebar_help_title}</p>
            <p className="text-slate-500 mt-0.5">{t.sidebar_help_body}</p>
          </div>
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-1 -mb-2">
        {navItems.map((item) => renderNavButton(item, true))}
      </div>

      {/* Content canvas — sa propre largeur maximale centrée */}
      <div className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto lg:px-6 xl:px-8 lg:py-6">{children}</div>
    </div>
  );
};
