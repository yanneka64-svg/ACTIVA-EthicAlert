import React, { useEffect, useRef, useState } from 'react';
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
// === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { NewMessageToast } from './staffPortal/NewMessageToast';
import type { AlertRecord } from '../types';
import { MODE_CONFIG, type OperatorDeskMode } from './operatorDesk/modeConfig';

/** Entrées du menu qui affichent le nombre de messages du déclarant non lus. */
const UNREAD_BADGE_KEYS = new Set(['op_inbox', 'inv_inbox', 'inv_dashboard', 'communications']);
// === AMÉLIORATION AJOUTÉE (pastille fidèle à l'écran) === la pastille d'un
// écran de dossiers ne compte que les messages non lus des dossiers que cet
// écran affiche réellement (ex. la Boîte de réception opérateur ne liste que
// les nouveaux signalements) ; « Communications » compte tout.
const UNREAD_BADGE_MODES: Record<string, OperatorDeskMode> = {
  op_inbox: 'inbox',
  op_pending_info: 'pending_info',
  op_processed: 'assigned',
  inv_dashboard: 'inv_inbox',
  inv_pending: 'pending_info',
};

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
  // === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
  /** Ouvre un dossier (depuis la notification « Nouveau message »). */
  onOpenCase?: (trackingNumber: string) => void;
}

export const StaffPortalLayout: React.FC<StaffPortalLayoutProps> = ({
  lang,
  activeUser,
  currentTab,
  setCurrentTab,
  children,
  onOpenCase,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
  // Messages du déclarant non lus sur les dossiers visibles par ce compte :
  // pastille dans le menu, titre de l'onglet du navigateur, et notification
  // à l'écran à l'arrivée d'un nouveau message.
  const [allAlerts, setAllAlerts] = useState<AlertRecord[]>(() => storage.getAlerts());
  useEffect(() => storage.subscribe(() => setAllAlerts(storage.getAlerts())), []);
  const visibleForUnread = useVisibleAlerts(allAlerts, activeUser);
  const unread = useUnreadMessages(visibleForUnread, activeUser);
  const badgeCount = (key: string): number => {
    const mode = UNREAD_BADGE_MODES[key];
    if (!mode) return UNREAD_BADGE_KEYS.has(key) ? unread.total : 0;
    let n = 0;
    for (const a of visibleForUnread) if (MODE_CONFIG[mode].predicate(a)) n += unread.byAlert.get(a.id) ?? 0;
    return n;
  };
  const [toast, setToast] = useState<{ alertId: string; trackingNumber: string; preview: string } | null>(null);
  const previousUnread = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const prev = previousUnread.current;
    previousUnread.current = unread.byAlert;
    // === AMÉLIORATION AJOUTÉE === la notification se ferme d'elle-même une
    // fois la conversation de ce dossier lue.
    setToast((cur) => (cur && !unread.byAlert.get(cur.alertId) ? null : cur));
    if (!prev) return;
    for (const [alertId, n] of unread.byAlert) {
      if (n > (prev.get(alertId) ?? 0)) {
        const a = visibleForUnread.find((x) => x.id === alertId);
        if (!a) continue;
        const last = [...a.messages].reverse().find((m) => m.sender === 'whistleblower');
        setToast({ alertId, trackingNumber: a.trackingNumber, preview: last?.attachments?.length ? `📎 ${last.attachments[0].name}` : last?.content ?? '' });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);
  const baseTitle = useRef<string>(typeof document !== 'undefined' ? document.title.replace(/^\(\d+\)\s*/, '') : '');
  useEffect(() => {
    document.title = unread.total > 0 ? `(${unread.total}) ${baseTitle.current}` : baseTitle.current;
    return () => {
      document.title = baseTitle.current;
    };
  }, [unread.total]);

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

  // === AMÉLIORATION AJOUTÉE (écrans de travail — design modernisé) ===
  // À chaque changement d'écran, le contenu rejoue une apparition en fondu.
  // L'animation est relancée sur le même élément (sans `key`) : l'écran
  // affiché n'est jamais démonté/remonté pour l'occasion, son état interne
  // (filtres, saisie en cours…) reste donc strictement inchangé.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('activa-enter');
    void el.offsetWidth;
    el.classList.add('activa-enter');
  }, [currentTab]);

  const renderNavButton = (item: NavItem, mobile = false) => {
    const active = currentTab === item.key;
    if (mobile) {
      return (
        <button
          key={`${item.key}-${item.label}`}
          onClick={() => setCurrentTab(item.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all duration-300 ${
            active
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-md shadow-blue-600/25'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
          {/* === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) === */}
          {badgeCount(item.key) > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">{badgeCount(item.key)}</span>
          )}
        </button>
      );
    }
    return (
      <button
        id={`sidebar-nav-${item.key}-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
        key={`${item.key}-${item.label}`}
        onClick={() => setCurrentTab(item.key)}
        // === AMÉLIORATION AJOUTÉE (écrans de travail — design modernisé) ===
        // élément actif en dégradé doux avec repère latéral, léger décalage
        // au survol ; hauteur strictement identique actif/inactif (cf. ci-dessous).
        className={`group relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
          active
            ? 'bg-gradient-to-r from-blue-50 to-blue-50/30 text-blue-700 ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-50 hover:translate-x-0.5'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-sky-400 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}
        />
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
          <span className={`transition-colors duration-300 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </span>
        {/* === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) === */}
        {badgeCount(item.key) > 0 && (
          <span
            className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-rose-600/30 motion-safe:animate-pulse"
            title={(t.chat_unread_badge || '{n} message(s) non lu(s)').replace('{n}', String(badgeCount(item.key)))}
          >
            {badgeCount(item.key)}
          </span>
        )}
        {active && <ChevronRight className="activa-enter-x w-3.5 h-3.5 text-blue-500 shrink-0" />}
      </button>
    );
  };

  return (
    // === AMÉLIORATION AJOUTÉE (écrans de travail — design modernisé) ===
    // `activa-form` + `activa-portal` : finitions communes à tous les écrans
    // de travail (champs, boutons, icônes au trait fin, ombres douces,
    // fenêtres animées — voir index.css), sans toucher chaque écran.
    <div className="activa-form activa-portal max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6 px-0 lg:px-6 xl:px-8">
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
      <div ref={contentRef} className="flex-1 min-w-0 w-full max-w-[1600px] mx-auto lg:px-6 xl:px-8 lg:py-6">{children}</div>
      {/* === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) === */}
      {toast && (
        <NewMessageToast
          t={t}
          trackingNumber={toast.trackingNumber}
          preview={toast.preview}
          onOpen={onOpenCase ? () => { onOpenCase(toast.trackingNumber); setToast(null); } : undefined}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
