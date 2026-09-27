import React from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
// Icônes lucide-react, `EthicAlertBrand` et `computeAvailableSpaces` ne sont
// plus utilisés qu'à l'intérieur des sous-composants de ./navbar/, qui les
// importent eux-mêmes (`ActivaLogo`, déjà inutilisé ici, partageait la ligne
// d'import d'`EthicAlertBrand`).
// === AMÉLIORATION AJOUTÉE (Phase 27) === `QrCode` et `Lock` retirés : ils ne
// servaient plus qu'aux icônes de l'en-tête public retirées cette phase.
// === AMÉLIORATION AJOUTÉE (Refonte en-tête — suppression de la cloche et
// de l'accès Firebase) === `AppNotification` retiré : plus utilisé une
// fois `NOTIFICATION_ICONS`/le centre de notifications retirés ci-dessous.
import { Language, UserProfile, UserRole } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE : fil d'Ariane de l'espace staff ===
import { useStaffBreadcrumb } from '../services/staffBreadcrumb';
// === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
// Blocs de rendu de l'en-tête déplacés dans ./navbar/ — voir l'en-tête de
// chaque fichier. `getRoleBadge` (exporté, réutilisé ailleurs) reste ici.
import { NavbarBrand } from './navbar/NavbarBrand';
import { StaffBreadcrumbSearch } from './navbar/StaffBreadcrumbSearch';
import { PublicNavLinks } from './navbar/PublicNavLinks';
import { PublicActionButtons } from './navbar/PublicActionButtons';
import { LanguageSelector } from './navbar/LanguageSelector';
import { AccountMenu } from './navbar/AccountMenu';
import { StaffMobileBar } from './navbar/StaffMobileBar';

// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) === Extraite en fonction de module (comportement et
// libellés strictement inchangés — simple déplacement hors du composant)
// pour que StaffSpaceHome.tsx puisse réutiliser exactement le même libellé
// de rôle que la barre supérieure, sans dupliquer ce switch.
// === AMÉLIORATION AJOUTÉE : libellé traduit (paramètre `lang` optionnel, FR par défaut) ===
export const getRoleBadge = (role: UserRole, lang: Language = 'fr') => {
  const tr = TRANSLATIONS[lang];
  switch (role) {
    case 'functional_admin':
      return { label: tr.role_badge_functional_admin, color: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'investigator':
      return { label: tr.role_badge_investigator, color: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'senior_investigator':
      return { label: tr.role_badge_senior_investigator, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    case 'darc_compliance':
      return { label: tr.role_badge_darc_compliance, color: 'bg-teal-50 text-teal-800 border-teal-200' };
    case 'system_admin':
      return { label: tr.role_badge_system_admin, color: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'security_admin':
      return { label: tr.role_badge_security_admin, color: 'bg-rose-50 text-rose-800 border-rose-200' };
    case 'consultation':
      return { label: tr.role_badge_consultation, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'audit_committee':
      return { label: tr.role_badge_audit_committee, color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    case 'executive':
      return { label: tr.role_badge_executive, color: 'bg-slate-800 text-white border-slate-700' };
    case 'reporter':
      return { label: tr.role_badge_reporter, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
};

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  activeUser: UserProfile;
  setActiveUser: (user: UserProfile) => void;
  onOpenQrModal: () => void;
  pendingAlertsCount: number;
  // === AMÉLIORATION AJOUTÉE (Phase 4) === lets a clicked notification deep
  // link straight into its case, reusing the same trackingNumber filter
  // already wired from the Control Panel (App.tsx's navigateToCases).
  onNavigateToCase: (trackingNumber: string) => void;
  // === AMÉLIORATION AJOUTÉE (Phase 10 — refonte visuelle façon maquette) ===
  // Distinguishes the "staff portal" chrome (white top bar with a search
  // field, notification bell and account menu — the wrapped screen already
  // has its own left sidebar via StaffPortalLayout, see App.tsx) from the
  // "public" chrome (simple text nav for the whistleblower-facing pages).
  // Purely presentational: every tab/handler below is unchanged and still
  // reachable, only the layout of this bar differs.
  isStaffContext: boolean;
  // === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
  // Perdus lors de la fusion avec la refonte visuelle (Phase 13) alors que
  // le bouton "Se déconnecter" plus bas s'appuie dessus — restaurés ici.
  isStaffSessionActive: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
  activeUser,
  setActiveUser,
  onOpenQrModal,
  pendingAlertsCount,
  onNavigateToCase,
  isStaffContext,
  isStaffSessionActive,
  onLogout,
}) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE : « Espace › Page » publié par le menu latéral ===
  const staffBreadcrumb = useStaffBreadcrumb();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showLangDropdown, setShowLangDropdown] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // === AMÉLIORATION AJOUTÉE (menu profil — fermeture au clic extérieur) ===
  // Les deux menus déroulants (profil, langue) ne se refermaient jusqu'ici
  // qu'en cliquant À L'INTÉRIEUR d'eux-mêmes — un clic ailleurs sur la page
  // les laissait ouverts. Un écouteur global les referme désormais dès
  // qu'un clic a lieu en dehors de leur zone respective, comme un menu
  // déroulant standard.
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const langMenuRef = React.useRef<HTMLDivElement>(null);
  // === AMÉLIORATION AJOUTÉE (menu mobile — Accueil/FAQ/Contact rangés sous
  // le logo) === Sur demande explicite : remplace la barre de bulles mobile
  // (Accueil & Signalement / Suivre mon alerte / Connexion), désormais
  // redondante avec le gros bouton "Suivre mon signalement" déjà présent
  // sur l'accueil et l'icône profil (Connexion). Mêmes liens que le nav
  // desktop (`nav-btn-home`/`faq`/`contact`), simplement rangés dans un
  // menu déroulant ouvert au clic sur le logo, visible seulement sous `lg`
  // (le nav desktop les affiche déjà en ligne au-delà).
  const mobileNavMenuRef = React.useRef<HTMLDivElement>(null);
  const [showMobileNavMenu, setShowMobileNavMenu] = React.useState(false);
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
      if (mobileNavMenuRef.current && !mobileNavMenuRef.current.contains(event.target as Node)) {
        setShowMobileNavMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
  // Remplace l'ancienne comparaison à 3 rôles codée en dur par la vraie
  // permission `cases.read` + visibilité globale (src/services/authz.ts).
  const isStaffUser = activeUser.role !== 'reporter';

  const badge = getRoleBadge(activeUser.role, lang);

  // === AMÉLIORATION AJOUTÉE (Phase 11) === two-letter initials ("B. Y.
  // Ekani" → "BY"), matching the avatar shown in the reference mockup.
  const initials = activeUser.name
    .replace(/[.,]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onNavigateToCase(searchValue.trim());
      setSearchValue('');
    }
  };

  return (
    // === AMÉLIORATION AJOUTÉE (Ascenseur sous l'en-tête) === `sticky
    // top-0` devenu inutile : App.tsx a été restructuré pour que ce
    // `<header>` vive hors de la zone désormais seule scrollable de la
    // page — il reste donc déjà visible en permanence sans "coller" à
    // rien. `shrink-0` évite qu'un flex-parent ne le rétrécisse jamais ;
    // `z-40` reste nécessaire pour que les menus déroulants (langue,
    // compte) de ce header s'affichent au-dessus du contenu en dessous.
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm shrink-0 relative z-40">
      {/* === AMÉLIORATION AJOUTÉE (Phase 24) === bande utilitaire (Phase 23)
          retirée sur demande explicite. */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-5 py-3">
          {/* === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) === Le
              logo réel remplace le monogramme provisoire. Sur les pages
              publiques (accueil...), seul le logo est affiché, comme dans
              la maquette d'accueil ; le bloc "EthicsAlert.Com" + sous-titre
              n'apparaît qu'en contexte portail (déjà le cas avant, la
              maquette détaillée de la fiche dossier montrant ce bloc). */}
          <NavbarBrand
            t={t}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            isStaffContext={isStaffContext}
            showMobileNavMenu={showMobileNavMenu}
            setShowMobileNavMenu={setShowMobileNavMenu}
            mobileNavMenuRef={mobileNavMenuRef}
          />

          {isStaffContext ? (
            <StaffBreadcrumbSearch
              t={t}
              staffBreadcrumb={staffBreadcrumb}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              handleSearchSubmit={handleSearchSubmit}
            />
          ) : (
            /* === AMÉLIORATION AJOUTÉE (Phase 13) === Nav publique exacte de
                la nouvelle maquette d'accueil : Accueil / Comment ça marche ? /
                FAQ / Nous contacter. Les trois derniers font défiler la page
                d'accueil jusqu'à la section correspondante (id posé dans
                WhistleblowerHome.tsx) plutôt que de changer d'écran. */
            /* === AMÉLIORATION AJOUTÉE (correctif débordement en-tête) ===
                BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur ("la barre
                de navigation traverse le topbar") : ce nav desktop
                apparaissait dès `md` (768px) alors que la barre mobile de
                repli ci-dessous ne disparaît qu'à `lg` (1024px) — entre les
                deux, les deux barres s'affichaient en même temps et le
                cumul logo + nav + cluster droit dépassait la largeur
                disponible, poussant "FR"/"Connexion" hors du cadre visible
                de l'en-tête. Aligné sur `lg`, exactement le seuil où la
                barre mobile disparaît (`lg:hidden` plus bas). */
            <PublicNavLinks
              t={t}
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
            />
          )}

          {/* Right cluster */}
          {/* === AMÉLIORATION AJOUTÉE (topbar staff) === `ml-auto` : la
              recherche est plafonnée (`max-w-xl`), le cluster langue/profil
              restait donc collé à elle avec un grand vide à droite sur les
              écrans larges — il est désormais toujours aligné au bord droit. */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* === AMÉLIORATION AJOUTÉE (Phase 27) === Icône « cloche » (accès
                espace collaborateur, ex-`#nav-btn-portal`) retirée de l'en-tête
                public sur demande explicite. L'espace collaborateur reste
                accessible directement via /login (Phase 12.4, StaffLoginView)
                — aucune fonctionnalité n'est supprimée côté application,
                seul ce raccourci discret dans l'en-tête disparaît. */}
            {/* === AMÉLIORATION AJOUTÉE (Refonte en-tête — suppression de la
                cloche et de l'accès Firebase) === Les deux boutons qui
                vivaient ici pour `isStaffContext` (cloche de notifications
                + accès "Firebase" / recherche technique, `#nav-btn-firebase-
                lookup`) sont retirés sur demande explicite. L'écran
                `firebase_lookup` (CaseLookup.tsx) et le centre de
                notifications restent dans le code — App.tsx route toujours
                `firebase_lookup`, atteignable par son URL directe
                (`/lookup`) — seuls ces deux raccourcis d'en-tête
                disparaissent. */}

            {/* === AMÉLIORATION AJOUTÉE (Phase 27) === Icône QR Code retirée
                de l'en-tête public sur demande explicite. */}

            {!isStaffContext && (
              /* === AMÉLIORATION AJOUTÉE (Phase 23 — fidélité au modèle
                  fourni) === "Suivre mon signalement" reprend le style
                  large façon barre de recherche de la maquette (icône +
                  texte dans un encadré large, coins arrondis) plutôt qu'un
                  simple bouton contour ; "Signaler une préoccupation" passe
                  en coins arrondis, comme le reste du modèle. */
              <PublicActionButtons
                t={t}
                setCurrentTab={setCurrentTab}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (repositionnement en-tête) ===
                Sélecteur de langue déplacé ici, juste avant Connexion/le
                menu de compte, pour que les deux se retrouvent groupés
                tout à droite de la barre — au lieu de vivre avant les
                boutons d'action publics ("Suivre mon signalement" /
                "Signaler une préoccupation"), sur demande explicite.
                === AMÉLIORATION AJOUTÉE (langue/connexion à l'extrême
                gauche du cluster droit sur mobile) === Sur demande
                explicite, uniquement sur mobile (`order-1`, neutralisé par
                `lg:order-none`) : la répartition "tout à droite" de la
                barre desktop ci-dessus reste inchangée à partir de `lg`. */}
            <LanguageSelector
              t={t}
              lang={lang}
              setLang={setLang}
              isStaffContext={isStaffContext}
              showLangDropdown={showLangDropdown}
              setShowLangDropdown={setShowLangDropdown}
              langMenuRef={langMenuRef}
            />

            {/* Account menu === AMÉLIORATION AJOUTÉE (langue/connexion à
                l'extrême gauche du cluster droit sur mobile) === `order-2
                lg:order-none`, même motif que le sélecteur de langue
                ci-dessus. */}
            <AccountMenu
              t={t}
              isStaffContext={isStaffContext}
              setCurrentTab={setCurrentTab}
              activeUser={activeUser}
              initials={initials}
              badge={badge}
              isStaffUser={isStaffUser}
              isStaffSessionActive={isStaffSessionActive}
              onLogout={onLogout}
              showUserDropdown={showUserDropdown}
              setShowUserDropdown={setShowUserDropdown}
              userMenuRef={userMenuRef}
            />
          </div>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (menu mobile public — retrait des bulles)
            === Sur demande explicite : cette barre de bulles n'a plus de
            raison d'être pour un visiteur anonyme (Accueil/FAQ/Contact sont
            désormais dans le menu déroulant sous le logo ci-dessus,
            "Suivre mon signalement" déjà visible en gros bouton sur
            l'accueil, "Connexion" déjà accessible via l'icône profil) —
            réservée à l'espace collaborateur (isStaffContext), où elle
            reste strictement inchangée (Accueil/Suivre/Espace Gestion
            DARC + badge de dossiers en attente). */}
        {isStaffContext && (
          <StaffMobileBar
            t={t}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            pendingAlertsCount={pendingAlertsCount}
          />
        )}
      </div>
    </header>
  );
};
