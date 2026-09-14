import React from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  ListTodo,
  Paperclip,
  MessageSquare,
  Wrench,
  LayoutGrid,
  Package,
  Users,
  ShieldCheck,
  Settings,
  ChevronRight,
  HelpCircle,
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  Globe2,
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
  Network,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, canSeeAuditTrail, canManageConfiguration, userCan } from '../services/authz';

/**
 * === AMÉLIORATION AJOUTÉE (Phase 11 — reproduction fidèle de la maquette) ===
 *
 * Barre latérale entièrement reconstruite pour correspondre exactement à la
 * maquette de référence (image 1) : 1 item autonome ("Tableau de bord"),
 * puis 4 groupes ("GESTION DES DOSSIERS" / "CONFORMITÉ" / "RAPPORTS" /
 * "ADMINISTRATION") avec exactement les items qui y figurent, plus le
 * bloc d'aide "Besoin d'aide ?" en bas. Chaque item pointe vers un écran
 * réel déjà existant (voir App.tsx `renderStaffContent`) — rien n'est
 * supprimé côté code, seule la liste de raccourcis affichée ici est
 * désormais celle de la maquette (les anciens raccourcis Triage/
 * Attribution/Mes Dossiers/Vue Exécutive/Piste d'Audit restent de vrais
 * écrans fonctionnels, simplement non listés ici car absents de la
 * maquette de référence).
 */

interface StaffPortalLayoutProps {
  lang: Language;
  activeUser: UserProfile;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
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
  // Un compte peut relever de plusieurs "espaces" à la fois (ex :
  // functional_admin a à la fois `cases.assign` — Opérateur — et
  // `cases.edit` — Enquêteur). Réutilise exactement les mêmes permissions
  // déjà appliquées ailleurs (bouton "Assigner" d'InvestigationDesk pour
  // Opérateur, `investigatorUsers`/candidats d'attribution pour Enquêteur,
  // `canSeeAdmin` ci-dessus pour Admin) plutôt que d'inventer un nouveau
  // critère. Choix délibéré pour cette phase : n'AJOUTE qu'un sélecteur
  // d'espace au-dessus de la barre latérale existante, qui reste
  // entièrement inchangée pour tout le monde (y compris les rôles
  // consultation/executive/audit_committee/security_admin, qui ne relèvent
  // d'aucun des 3 espaces mais gardent leur accès actuel aux écrans
  // existants) — une restructuration complète de la barre latérale en 3
  // silos stricts est repoussée à une phase ultérieure nécessitant une
  // vérification plus large par rôle.
  // === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === BUG
  // PRÉEXISTANT CORRIGÉ : `cases.assign` seul ne suffit plus à garantir
  // l'accès à /operator/dashboard depuis que la matrice de permissions est
  // éditable en administration (system_admin peut désormais accorder
  // `cases.assign` à n'importe quel rôle, ex. `investigator`) — la vraie
  // garde de cette route (App.tsx, onglet `op_dashboard`) est
  // `isGlobalViewer`/`isGlobalCaseViewer`, une table SÉPARÉE
  // (GLOBAL_VISIBILITY_ROLES) que cet onglet n'a jamais mise à jour.
  // Jusqu'ici les deux coïncidaient toujours par construction (seuls
  // functional_admin/darc_compliance avaient `cases.assign`, et les deux
  // sont aussi à vision globale) ; ce n'est plus garanti. Vérifié en
  // direct : accorder `cases.assign` à `investigator` faisait apparaître
  // "Espace Opérateur" dans ce sélecteur puis un "Accès restreint" au
  // clic. Corrigé en alignant cette condition sur la garde réelle de la
  // route, exactement comme `canSeeControlPanel` ci-dessus.
  const canSeeOperatorSpace = userCan(activeUser, 'cases.assign') && canSeeControlPanel;
  const canSeeInvestigatorSpace = userCan(activeUser, 'cases.edit');
  const spaceCount = [canSeeOperatorSpace, canSeeInvestigatorSpace, canSeeAdmin].filter(Boolean).length;
  const showSpaceSwitcher = spaceCount >= 2;
  const isOperatorTabActive = currentTab.startsWith('op_');
  const isInvestigatorTabActive = currentTab.startsWith('inv_');
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) === 'admin_governance' ajouté
  const isAdminTabActive = ['settings', 'admin_users', 'admin_roles', 'admin_config', 'admin_audit', 'admin_reports', 'admin_organization', 'admin_governance'].includes(currentTab);

  const navItems: Array<{ key: string; label: string; icon: React.ReactNode; visible: boolean; group: string }> = [
    { key: 'control_panel', label: t.sidebar_dashboard, icon: <LayoutDashboard className="w-4 h-4" />, visible: canSeeControlPanel, group: '' },

    { key: 'portal', label: t.sidebar_dossiers, icon: <FolderOpen className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'investigations', label: t.nav_investigations, icon: <Search className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'tasks', label: t.nav_tasks, icon: <ListTodo className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'evidence', label: t.sidebar_evidence, icon: <Paperclip className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },
    { key: 'communications', label: t.nav_communications, icon: <MessageSquare className="w-4 h-4" />, visible: true, group: t.sidebar_group_dossiers },

    { key: 'corrective_actions', label: t.sidebar_corrective_measures, icon: <Wrench className="w-4 h-4" />, visible: true, group: t.sidebar_group_compliance },

    { key: 'reports', label: t.sidebar_reports_dashboards, icon: <LayoutGrid className="w-4 h-4" />, visible: true, group: t.sidebar_group_reports },
    { key: 'reports', label: t.sidebar_reports_exports, icon: <Package className="w-4 h-4" />, visible: true, group: t.sidebar_group_reports },

    // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
    { key: 'admin_organization', label: 'Organisation (Pays)', icon: <Globe2 className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) === libellé en
    // dur, même précédent que "Organisation (Pays)" ci-dessus (Phase 8) —
    // pas de nouvelle clé i18n pour un libellé admin-only.
    { key: 'admin_governance', label: 'Gouvernance', icon: <Network className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    { key: 'admin_users', label: t.sidebar_admin_users, icon: <Users className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    { key: 'admin_roles', label: t.sidebar_admin_roles, icon: <ShieldCheck className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
    { key: 'settings', label: t.sidebar_admin_settings, icon: <Settings className="w-4 h-4" />, visible: canSeeAdmin, group: t.sidebar_group_admin },
  ];
  // Écrans existants non repris dans cette liste (car absents de la
  // maquette de référence) mais toujours fonctionnels dans le code :
  // 'triage' / 'assignment' / 'my_cases' (des préréglages de filtre sur ce
  // même écran "Dossiers", déjà accessibles via sa barre de filtres),
  // 'executive' (Vue Exécutive) et 'audit' (Piste d'Audit).

  const visibleNavItems = navItems.filter((i) => i.visible);
  let lastGroup: string | null = null;

  const renderNavButton = (item: (typeof navItems)[number], mobile = false) => {
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
        <span className="flex items-center gap-2.5">
          <span className={active ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {active && <ChevronRight className="w-3.5 h-3.5 text-blue-500" />}
      </button>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6 px-0 lg:px-6 xl:px-8">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-[5.5rem] lg:self-start bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
        {/* === AMÉLIORATION AJOUTÉE (Phase 6 — espaces /operator /investigator /admin) ===
            Sélecteur d'espace — additif, visible uniquement pour un compte
            relevant de 2 espaces ou plus (ex : functional_admin, à la fois
            Opérateur et Enquêteur). N'affecte en rien la navigation
            existante en dessous. */}
        {showSpaceSwitcher && (
          <div className="p-2.5 border-b border-slate-100 space-y-1">
            <div className="px-0.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Espaces</div>
            <div className="flex flex-col gap-1">
              {canSeeOperatorSpace && (
                <button
                  id="space-switcher-operator"
                  onClick={() => setCurrentTab('op_dashboard')}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    isOperatorTabActive ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Espace Opérateur
                </button>
              )}
              {canSeeInvestigatorSpace && (
                <button
                  id="space-switcher-investigator"
                  onClick={() => setCurrentTab('inv_dashboard')}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    isInvestigatorTabActive ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Espace Enquêteur
                </button>
              )}
              {canSeeAdmin && (
                <button
                  id="space-switcher-admin"
                  onClick={() => setCurrentTab('settings')}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    isAdminTabActive ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Administration
                </button>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 py-3 px-2.5">
          {visibleNavItems.map((item) => {
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
        {visibleNavItems.map((item) => renderNavButton(item, true))}
      </div>

      {/* Content canvas — sa propre largeur maximale centrée */}
      <div className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto lg:px-6 xl:px-8 lg:py-6">{children}</div>
    </div>
  );
};
