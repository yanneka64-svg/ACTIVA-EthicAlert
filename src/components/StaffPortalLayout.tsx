import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  ListTodo,
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
  // === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables) ===
  GitBranch,
  // === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
  Inbox,
  UserPlus,
  Clock3,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, canManageConfiguration, userCan } from '../services/authz';

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

// === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
type SpaceKey = 'operator' | 'investigator' | 'admin' | 'general';

const ADMIN_TABS = ['settings', 'admin_users', 'admin_roles', 'admin_config', 'admin_audit', 'admin_reports', 'admin_organization', 'admin_governance', 'admin_workflow'];

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
  const canSeeAdmin = canManageConfiguration(activeUser);

  // === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === BUG
  // PRÉEXISTANT CORRIGÉ : `cases.assign` seul ne suffit plus à garantir
  // l'accès à /operator/dashboard depuis que la matrice de permissions est
  // éditable en administration — la vraie garde de cette route (App.tsx,
  // onglet `op_dashboard`) est `isGlobalViewer`, une table séparée que cet
  // onglet n'a jamais mise à jour. Corrigé en alignant cette condition sur
  // la garde réelle de la route, exactement comme `canSeeControlPanel`.
  const canSeeOperatorSpace = userCan(activeUser, 'cases.assign') && canSeeControlPanel;
  const canSeeInvestigatorSpace = userCan(activeUser, 'cases.edit');

  // === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
  // Espaces réellement disponibles pour ce compte, dans un ordre de
  // priorité stable. Un compte qui ne relève d'aucun des 3 (ex.
  // consultation/executive/audit_committee/security_admin — lecture
  // globale sans attribution ni investigation ni administration) reçoit un
  // espace "general" de repli : Tableau de bord + Tous les dossiers +
  // Outils, soit exactement l'ancienne liste plate, débarrassée de ses
  // doublons.
  const availableSpaces: SpaceKey[] = [
    ...(canSeeOperatorSpace ? (['operator'] as const) : []),
    ...(canSeeInvestigatorSpace ? (['investigator'] as const) : []),
    ...(canSeeAdmin ? (['admin'] as const) : []),
  ];
  const defaultSpace: SpaceKey = availableSpaces[0] ?? 'general';
  const showSpaceSwitcher = availableSpaces.length >= 2;

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
    { key: 'tasks', label: canSeeControlPanel ? t.sidebar_tasks_registry : t.sidebar_my_tasks, icon: <ListTodo className="w-4 h-4" /> },
    { key: 'evidence', label: canSeeControlPanel ? t.sidebar_evidence_registry : t.sidebar_my_evidence, icon: <Paperclip className="w-4 h-4" /> },
    { key: 'communications', label: canSeeControlPanel ? t.sidebar_comms_registry : t.sidebar_my_comms, icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'corrective_actions', label: t.sidebar_corrective_measures, icon: <Wrench className="w-4 h-4" /> },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  const operatorItems: NavItem[] = [
    { key: 'op_dashboard', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
    { key: 'portal', label: t.sidebar_all_cases, icon: <FolderOpen className="w-4 h-4" />, group: '' },
    { key: 'op_inbox', label: t.sidebar_op_inbox, icon: <Inbox className="w-4 h-4" />, group: '' },
    { key: 'op_assign', label: t.sidebar_op_assign, icon: <UserPlus className="w-4 h-4" />, group: '' },
    { key: 'op_pending_info', label: t.sidebar_op_pending, icon: <Clock3 className="w-4 h-4" />, group: '' },
    { key: 'op_processed', label: t.sidebar_op_processed, icon: <CheckCircle2 className="w-4 h-4" />, group: '' },
    ...toolsItems.map((i) => ({ ...i, group: t.sidebar_group_tools })),
  ];

  const investigatorItems: NavItem[] = [
    { key: 'inv_dashboard', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' },
    { key: 'inv_my_cases', label: t.sidebar_inv_my_cases, icon: <FolderOpen className="w-4 h-4" />, group: '' },
    { key: 'inv_to_process', label: t.sidebar_inv_to_process, icon: <ListChecks className="w-4 h-4" />, group: '' },
    { key: 'inv_in_progress', label: t.sidebar_inv_in_progress, icon: <Search className="w-4 h-4" />, group: '' },
    { key: 'inv_pending', label: t.sidebar_inv_pending, icon: <Clock3 className="w-4 h-4" />, group: '' },
    ...toolsItems.map((i) => ({ ...i, group: t.sidebar_group_tools })),
  ];

  const adminItems: NavItem[] = [
    { key: 'admin_organization', label: 'Organisation (Pays)', icon: <Globe2 className="w-4 h-4" />, group: '' },
    { key: 'admin_governance', label: 'Gouvernance', icon: <Network className="w-4 h-4" />, group: '' },
    { key: 'admin_workflow', label: 'Workflows & Statuts', icon: <GitBranch className="w-4 h-4" />, group: '' },
    { key: 'admin_users', label: t.sidebar_admin_users, icon: <Users className="w-4 h-4" />, group: '' },
    { key: 'admin_roles', label: t.sidebar_admin_roles, icon: <ShieldCheck className="w-4 h-4" />, group: '' },
    { key: 'settings', label: t.sidebar_admin_settings, icon: <Settings className="w-4 h-4" />, group: '' },
  ];

  const generalItems: NavItem[] = [
    ...(canSeeControlPanel ? [{ key: 'control_panel', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, group: '' }] : []),
    { key: 'portal', label: t.sidebar_all_cases, icon: <FolderOpen className="w-4 h-4" />, group: '' },
    ...toolsItems.map((i) => ({ ...i, group: t.sidebar_group_tools })),
  ];

  const itemsBySpace: Record<SpaceKey, NavItem[]> = {
    operator: operatorItems,
    investigator: investigatorItems,
    admin: adminItems,
    general: generalItems,
  };
  const navItems = itemsBySpace[selectedSpace];

  const SPACE_LABEL: Record<SpaceKey, string> = {
    operator: 'Espace Opérateur',
    investigator: 'Espace Enquêteur',
    admin: 'Administration',
    general: '',
  };
  const SPACE_DASHBOARD_TAB: Record<SpaceKey, string> = {
    operator: 'op_dashboard',
    investigator: 'inv_dashboard',
    admin: 'settings',
    general: canSeeControlPanel ? 'control_panel' : 'portal',
  };

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
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-[5.5rem] lg:self-start bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
        {/* === AMÉLIORATION AJOUTÉE (Réorganisation navigation — Proposition B) ===
            Le sélecteur pilote désormais réellement `selectedSpace`, qui
            détermine la LISTE affichée en dessous (plus seulement une
            navigation ponctuelle vers un tableau de bord). */}
        {showSpaceSwitcher && (
          <div className="p-2.5 border-b border-slate-100 space-y-1">
            <div className="px-0.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Espaces</div>
            <div className="flex flex-col gap-1">
              {availableSpaces.map((space) => (
                <button
                  key={space}
                  id={`space-switcher-${space}`}
                  onClick={() => {
                    setSelectedSpace(space);
                    setCurrentTab(SPACE_DASHBOARD_TAB[space]);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    selectedSpace === space ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {SPACE_LABEL[space]}
                </button>
              ))}
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
                  <div className="px-3 pt-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
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
