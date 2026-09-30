import React, { useEffect, useState } from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par section) ===
// Seul `ChevronRight` (utilisé par `renderNavButton`, resté ici) est encore
// importé : les autres icônes vivent désormais dans ./staffPortal/navItems.tsx
// et ./staffPortal/DesktopSidebar.tsx, qui les importent eux-mêmes.
import { ChevronRight } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) === logique de disponibilité des espaces désormais
// partagée avec StaffSpaceHome.tsx et App.tsx (voir domain/staffSpaces.ts).
import { SpaceKey, computeAvailableSpaces } from '../domain/staffSpaces';
// === AMÉLIORATION AJOUTÉE : fil d'Ariane partagé avec la topbar ===
import { setStaffBreadcrumb } from '../services/staffBreadcrumb';
// === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par section) ===
// `spaceOfTab`, les listes de menu par espace et la barre latérale desktop
// déplacés dans ./staffPortal/ — voir l'en-tête de chaque fichier.
import { spaceOfTab } from './staffPortal/spaceOfTab';
import { buildSpaceNavItems } from './staffPortal/navItems';
import type { NavItem } from './staffPortal/navItems';
import { DesktopSidebar } from './staffPortal/DesktopSidebar';

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

  // === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par section) ===
  // Listes de menu de chaque espace déplacées telles quelles dans
  // ./staffPortal/navItems.tsx (`buildSpaceNavItems`), toujours recalculées
  // à chaque rendu avec le même `t`, le même compte et la même visibilité.
  const itemsBySpace: Record<SpaceKey, NavItem[]> = buildSpaceNavItems(t, activeUser, canSeeControlPanel);
  const navItems = itemsBySpace[selectedSpace];

  // === AMÉLIORATION AJOUTÉE : fil d'Ariane « Espace › Page » dans la topbar ===
  // Publie l'espace affiché et le libellé de l'onglet actif (celui du menu
  // ci-dessous) pour que Navbar.tsx les affiche ; effacé en quittant l'espace.
  const spaceTitles: Record<SpaceKey, string> = {
    operator: t.space_home_operator_title,
    investigator: t.space_home_investigator_title,
    admin: t.space_home_admin_title,
    general: t.space_home_general_title,
  };
  const activeNavLabel = navItems.find((i) => i.key === currentTab)?.label ?? '';
  useEffect(() => {
    setStaffBreadcrumb({ section: spaceTitles[selectedSpace] ?? '', page: activeNavLabel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpace, activeNavLabel, lang]);
  useEffect(() => () => setStaffBreadcrumb(null), []);

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
          bon endroit dès `top-0`, relatif à ce nouveau conteneur.
          === AMÉLIORATION AJOUTÉE (Correction bug — la barre de navigation
          s'arrête bien avant le pied de page) === BUG PRÉEXISTANT CORRIGÉ,
          signalé par l'utilisateur, capture de référence à l'appui :
          `lg:self-start` limitait la hauteur de cette carte à son seul
          contenu, plus courte que la colonne de contenu à droite dès qu'un
          écran est un peu long. `lg:self-stretch`, réservé à
          `selectedSpace === 'admin'`, étire la carte à la hauteur réelle
          de la ligne ; `<nav>` porte déjà `flex-1` et pousse donc
          naturellement la carte "Besoin d'aide ?" tout en bas. Les espaces
          Opérateur/Enquêteur (tableaux de bord bien plus longs que leur
          propre menu) gardent `lg:self-start`. */}
      <DesktopSidebar
        t={t}
        selectedSpace={selectedSpace}
        navItems={navItems}
        renderNavButton={renderNavButton}
      />

      {/* Mobile horizontal nav */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-1 -mb-2">
        {navItems.map((item) => renderNavButton(item, true))}
      </div>

      {/* Content canvas — sa propre largeur maximale centrée */}
      <div className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto lg:px-6 xl:px-8 lg:py-6">{children}</div>
    </div>
  );
};
