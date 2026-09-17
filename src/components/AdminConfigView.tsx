import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Language, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
// onglet) === premier onglet extrait dans son propre composant (voir
// src/components/admin/RolesPermissionsTab.tsx) ; c'est ce composant qui
// importe désormais Permission/RoleId/ChevronRight/ChevronDown, plus
// utilisés directement ici. Neuvième et dernière étape (UsersTab) :
// Building2/Users/Clock/Globe n'étaient déjà plus utilisés nulle part
// dans ce fichier avant même cette extraction (vérifié par grep) — retirés
// à cette occasion plutôt que laissés comme imports morts, puisque ce
// fichier devient désormais un simple routeur d'onglets.
// === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
// données" retiré, fusion avec la structure `main`) === `DatabaseFirebaseTab`
// n'est plus importé ici : sur demande explicite de l'utilisateur, ce
// routeur ne propose plus jamais cet onglet (voir plus bas).
import { RolesPermissionsTab } from './admin/RolesPermissionsTab';
import { OrganizationCountriesTab } from './admin/OrganizationCountriesTab';
import { EntitiesTab } from './admin/EntitiesTab';
import { GovernanceRecipientsTab } from './admin/GovernanceRecipientsTab';
import { RiskMatrixSlaTab } from './admin/RiskMatrixSlaTab';
import { CategoriesTab } from './admin/CategoriesTab';
import { UsersTab } from './admin/UsersTab';

interface AdminConfigViewProps {
  lang: Language;
  activeUser: UserProfile;
  // === AMÉLIORATION AJOUTÉE (Phase 9 — écrans "Utilisateurs & Rôles" /
  // "Configuration" dédiés dans le menu, façon maquette) ===
  // Optionnel, avec le même défaut ('matrix') qu'avant cette phase : ne
  // change rien pour l'entrée existante `settings`. Les deux nouvelles
  // entrées de menu ('admin_users' / 'admin_config') pointent vers ce même
  // composant, seulement avec un onglet de départ différent — aucun onglet
  // n'est retiré, le sélecteur d'onglets complet reste toujours visible et
  // navigable, exactement comme avant.
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) === 'governance'
  // === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
  // données" retiré) === 'database' retiré de cette union, sur demande
  // explicite de l'utilisateur — `DatabaseFirebaseTab` n'est plus routé.
  initialTab?: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'governance';
}

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({
  lang,
  activeUser,
  initialTab,
}) => {
  const t = TRANSLATIONS[lang];

  // === AMÉLIORATION AJOUTÉE (navigation Admin figée après le premier clic)
  // === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : "aucune des
  // fenêtres de cette page ne s'affiche lorsque je clique dessus excepté la
  // première". `configTab` était un `useState` initialisé UNE SEULE FOIS
  // depuis `initialTab` — un clic sur un autre lien de la sidebar
  // (StaffPortalLayout.tsx) change bien `currentTab`/l'URL et donc la prop
  // `initialTab` reçue ici, mais React réutilise la même instance de ce
  // composant (même position dans l'arbre, App.tsx le rend depuis 8
  // branches différentes sans `key`) sans jamais réexécuter l'initialiseur
  // du `useState` : l'écran restait figé sur le tout premier onglet visité,
  // quel que soit le lien cliqué ensuite. Aucun code de ce composant
  // n'appelle plus jamais `setConfigTab` par ailleurs (la sidebar est la
  // SEULE source de navigation depuis la suppression de l'ancienne rangée
  // d'onglets interne — voir plus bas) : `configTab` peut donc être dérivé
  // directement de la prop à chaque rendu, sans état local du tout.
  const configTab: 'matrix' | 'entities' | 'organization' | 'categories' | 'users' | 'roles' | 'governance' = initialTab ?? 'matrix';
  const [saveBanner, setSaveBanner] = useState('');

  const users = storage.getUsers();
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === real,
  // persisted, editable config — no longer the static activaConfig
  // imports. Re-fetched fresh on every render (this component already
  // re-renders after every CRUD action via its own local state, e.g. the
  // save banner or closing a modal — the same lightweight pattern the rest
  // of this file already uses, no dedicated storage.subscribe needed).
  const entities = storage.getEntities();
  const categoriesConfig = storage.getCategories();
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  // Comptage réel des dossiers par catégorie (colonne "Dossiers associés")
  // — jamais un chiffre inventé, même motif de lecture directe que
  // `categoriesConfig` ci-dessus.
  const allAlertsForCategoryCounts = storage.getAlerts();
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // Remplace l'import statique ACTIVA_COUNTRIES (utilisé ci-dessous dans
  // les listes déroulantes pays des formulaires Entité/Compte) par la
  // copie réelle, persistée, éditable — même motif que entities/
  // categoriesConfig ci-dessus. Un pays ajouté depuis le nouvel onglet
  // "Pays" apparaît donc immédiatement dans ces listes.
  const countries = storage.getCountries();
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === même motif que entities/countries ci-dessus.
  const escalationRecipients = storage.getEscalationRecipients();

  const slugify = (name: string) =>
    name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

  const flashBanner = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(''), 3000);
  };

  // === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
  // onglet, fusion avec `main`) === Tous les gestionnaires CRUD
  // entités/pays/catégories/utilisateurs qui vivaient ici (handleSaveEntity,
  // handleSaveCountry, handleSaveCategory, handleSaveUser, etc.), la table
  // de rôles/permissions (PERMISSION_GROUPS) et les constantes
  // ALL_ROLE_IDS/ALL_CASE_STATUSES/ROLE_ID_LABELS ont été retirés d'ici : ce
  // sont désormais exactement les mêmes gestionnaires et constantes, mais
  // déplacés dans leurs composants d'onglet respectifs
  // (src/components/admin/EntitiesTab.tsx, OrganizationCountriesTab.tsx,
  // CategoriesTab.tsx, UsersTab.tsx, RolesPermissionsTab.tsx) lors du
  // refactor d'extraction par onglet de `main` — aucune fonctionnalité
  // perdue, uniquement du code mort ici (les variables d'état locales que
  // ces gestionnaires référençaient n'existent même plus dans ce fichier).

  return (
    // === AMÉLIORATION AJOUTÉE (alignement sidebar/contenu Admin) === BUG
    // PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : ce `py-8` s'ajoutait
    // au `lg:py-6` déjà appliqué par le conteneur parent (StaffPortalLayout,
    // "Content canvas"), faisant démarrer la première carte de ce contenu
    // ~32px plus bas que le haut de la sidebar (qui, elle, n'a pas de
    // padding interne avant sa première carte). `lg:pt-0` aligne les deux
    // sur grand écran — `pt-8` reste sur mobile, où la sidebar est masquée
    // (remplacée par le nav horizontal) et cet espace au-dessus reste utile.
    // === AMÉLIORATION AJOUTÉE (Correction demandée — taille de la barre
    // latérale conservée) === BUG PRÉEXISTANT CORRIGÉ (introduit par la
    // correction d'alignement ci-dessus), signalé par l'utilisateur :
    // passer `py-8` (64px de padding total) à `pt-8 lg:pt-0 pb-8` réduirait
    // la hauteur totale de cette colonne de contenu sur desktop — et donc,
    // via `lg:self-stretch` (StaffPortalLayout.tsx, réservé à l'espace
    // Admin), rétrécirait d'autant la barre latérale, qui s'étire toujours
    // à la hauteur de la plus grande des deux colonnes. `pb-16` (64px)
    // restitue le même total de padding qu'avec `py-8` à l'origine — même
    // hauteur de colonne, donc même taille de barre latérale — tout en
    // gardant l'alignement `pt-8 lg:pt-0` ci-dessus.
    <div className="max-w-7xl mx-auto pt-8 lg:pt-0 pb-16 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* === AMÉLIORATION AJOUTÉE (suppression de la bande au-dessus des
          tableaux) === BUG PRÉEXISTANT CORRIGÉ, sur demande explicite de
          l'utilisateur : la carte "Configuration Système" + "Réinitialiser
          jeu de démonstration" (déjà retirée) puis le repère de section
          gris restant ("MATRICE DES RISQUES & DÉLAIS SLA", etc.) sont
          retirés — ce bandeau permanent est redondant avec le titre déjà
          actif dans la sidebar (StaffPortalLayout.tsx) et avec le titre de
          chaque carte de contenu ci-dessous. `saveBanner` (retours de
          succès CRUD, utilisé par ~20 actions de cet écran) reste affiché,
          mais seulement quand un message est réellement présent — plus de
          carte vide en permanence au-dessus des tableaux. */}
      {saveBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* 1. MATRIX & SLA TAB.
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/RiskMatrixSlaTab.tsx. */}
      {configTab === 'matrix' && <RiskMatrixSlaTab activeUser={activeUser} onSaved={flashBanner} />}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          2. ENTITIES TAB.
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/EntitiesTab.tsx (modale Ajouter/Modifier
          entité incluse). */}
      {configTab === 'entities' && (
        <EntitiesTab entities={entities} countries={countries} activeUser={activeUser} onSaved={flashBanner} slugify={slugify} />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
          ORGANIZATION TAB (pays) — même motif CRUD que l'onglet Entités
          ci-dessus, un niveau au-dessus dans la hiérarchie ACTIVA GROUP →
          Pays → Entité → Utilisateurs (brief §2). Un pays supprimé alors
          qu'une entité y est encore rattachée est refusé — voir
          storage.deleteCountry(). Validation frontend uniquement (comme
          partout ailleurs dans cet écran) : signalé, pas contourné. */}
      {/* === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/OrganizationCountriesTab.tsx (modale
          Ajouter/Modifier pays incluse). */}
      {configTab === 'organization' && (
        <OrganizationCountriesTab countries={countries} entities={entities} activeUser={activeUser} onSaved={flashBanner} />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          3. CATEGORIES TAB — real CRUD (categories + their subcategories)
          against storage.ts, replacing the static ALERT_CATEGORIES display. */}
      {/* === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table
          Catégories) === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur
          (capture de référence) : remplace la liste de cartes par un
          tableau (#, Nom, Code, Description, Statut, Dossiers associés,
          Date de création, Actions) — mêmes handlers CRUD qu'avant
          (openAddCategory/openEditCategory/handleDeleteCategory), aucun
          retiré. La gestion des sous-catégories (ajout/retrait), qui
          n'apparaît pas dans la capture de référence, reste accessible
          intégralement sur une seconde ligne sous chaque catégorie —
          aucune fonctionnalité existante supprimée. */}
      {/* === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/CategoriesTab.tsx (table + fenêtre de
          gestion des sous-catégories + modale Ajouter/Renommer incluses). */}
      {configTab === 'categories' && (
        <CategoriesTab
          categoriesConfig={categoriesConfig}
          allAlertsForCategoryCounts={allAlertsForCategoryCounts}
          activeUser={activeUser}
          onSaved={flashBanner}
          slugify={slugify}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
          4. USERS & ROLES TAB — real CRUD against storage.ts (addUser
          already existed; updateUser/deleteUser are new).
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/UsersTab.tsx (modale Ajouter/Modifier +
          modale d'identifiants générés incluses). */}
      {configTab === 'users' && (
        <UsersTab users={users} entities={entities} countries={countries} activeUser={activeUser} onSaved={flashBanner} slugify={slugify} />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — matrice des rôles & permissions) ===
          6. ROLES & PERMISSIONS TAB.
          === AMÉLIORATION AJOUTÉE (Rôles & permissions éditables) === n'est
          plus un affichage en lecture seule : chaque case est une vraie
          case à cocher, sauvegardée via storage.updateRolePermissions()
          (voir domain/permissionOverrides.ts pour la mécanique complète —
          domain/permissions.ts, la table PAR DÉFAUT, reste inchangée).
          === AMÉLIORATION AJOUTÉE (Phase 12.3) === this table is no longer
          a separate/future model — it is the exact set of permissions this
          application actually enforces (see src/services/authz.ts).
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/RolesPermissionsTab.tsx. */}
      {configTab === 'roles' && <RolesPermissionsTab activeUser={activeUser} onSaved={flashBanner} />}

      {/* === AMÉLIORATION AJOUTÉE (Phase 5 — routage indépendant) ===
          GOUVERNANCE TAB. La hiérarchie par rôle utilisée par
          domain/independentRouting.ts (niveaux + vue dérivée en lecture
          seule) a été retirée de cet écran sur demande explicite — les
          niveaux restent en place côté données (storage.getHierarchyLevels,
          toujours utilisés par le moteur de routage indépendant), seul cet
          écran d'édition disparaît.
          === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
          onglet) === contenu déplacé tel quel dans son propre composant,
          voir src/components/admin/GovernanceRecipientsTab.tsx (modale
          Ajouter/Modifier destinataire incluse). */}
      {configTab === 'governance' && (
        <GovernanceRecipientsTab
          escalationRecipients={escalationRecipients}
          users={users}
          activeUser={activeUser}
          onSaved={flashBanner}
          slugify={slugify}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Workflows & statuts éditables, fusion avec
          `main`) === L'onglet "Workflows & Statuts" (matrice d'adjacence des
          14 statuts CaseStatus, domain/workflow.ts) disparaît d'ici : le
          refactor par extraction d'onglet de `main`
          (src/components/admin/*Tab.tsx) n'en a jamais réextrait de
          composant dédié, ce type d'onglet n'existe donc plus dans
          `AdminConfigView`. Le backend
          (storage.getWorkflowTransitions/updateWorkflowTransitions,
          domain/workflow.ts ALLOWED_TRANSITIONS) reste entièrement intact,
          seul cet accès d'administration disparaît — alignement avec l'état
          actuel de `main` plutôt qu'une reconstruction hors périmètre de
          cette fusion.
          === AMÉLIORATION AJOUTÉE (Correction demandée — onglet "Base de
          données" retiré) === L'onglet "Base de données" (rattachement
          Firebase, règles de sécurité Firestore, synchronisation manuelle)
          disparaît d'ici, sur demande explicite de l'utilisateur. Le
          service Firebase lui-même (src/services/firebase.ts, utilisé par
          storage.ts pour la synchronisation Cloud en arrière-plan à chaque
          sauvegarde) reste entièrement inchangé — seul cet écran
          d'administration pour le configurer manuellement disparaît. */}

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === Modals */}

    </div>
  );
};
