import React from 'react';
import {
  Search,
  ChevronDown,
  Send,
  User,
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Menu Profil) ===
  Settings,
  HelpCircle,
  LogOut,
  // === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
  // barre latérale) ===
  ArrowLeftRight,
} from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (Phase 27) === `QrCode` et `Lock` retirés : ils ne
// servaient plus qu'aux icônes de l'en-tête public retirées cette phase.
// === AMÉLIORATION AJOUTÉE (Refonte en-tête — suppression de la cloche et
// de l'accès Firebase) === `AppNotification` retiré : plus utilisé une
// fois `NOTIFICATION_ICONS`/le centre de notifications retirés ci-dessous.
import { Language, UserProfile, UserRole } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
// === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) ===
import { ActivaLogo } from './ui';
import { canManageConfiguration } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) ===
import { computeAvailableSpaces } from '../domain/staffSpaces';

// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) === Extraite en fonction de module (comportement et
// libellés strictement inchangés — simple déplacement hors du composant)
// pour que StaffSpaceHome.tsx puisse réutiliser exactement le même libellé
// de rôle que la barre supérieure, sans dupliquer ce switch.
export const getRoleBadge = (role: UserRole) => {
  switch (role) {
    case 'functional_admin':
      return { label: 'Admin Fonctionnel / DARC', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'investigator':
      return { label: 'Investigateur DARC', color: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'senior_investigator':
      return { label: 'Investigateur Senior DARC', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    case 'darc_compliance':
      return { label: 'Conformité DARC', color: 'bg-teal-50 text-teal-800 border-teal-200' };
    case 'system_admin':
      return { label: 'Admin Système', color: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'security_admin':
      return { label: 'Admin Sécurité', color: 'bg-rose-50 text-rose-800 border-rose-200' };
    case 'consultation':
      return { label: 'Consultation / Audit', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'audit_committee':
      return { label: 'Comité d’Audit', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    case 'executive':
      return { label: 'Direction / Exécutif', color: 'bg-slate-800 text-white border-slate-700' };
    case 'reporter':
      return { label: 'Lanceur d’alerte', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
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
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
  // Remplace l'ancienne comparaison à 3 rôles codée en dur par la vraie
  // permission `cases.read` + visibilité globale (src/services/authz.ts).
  const isStaffUser = activeUser.role !== 'reporter';

  const badge = getRoleBadge(activeUser.role);

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
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm sticky top-0 z-40">
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
          <div
            id="brand-logo"
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
          >
            <ActivaLogo className="h-10 shrink-0" />
            {isStaffContext && (
              <>
                <div className="hidden md:block w-px h-8 bg-slate-200" />
                <div className="hidden md:block leading-tight">
                  <h1 className="text-[15px] font-extrabold tracking-tight text-[#0B2545] group-hover:text-blue-700 transition">
                    {t.app_title}
                  </h1>
                  <p className="text-[11px] text-slate-500 max-w-[260px] truncate">
                    {t.app_subtitle}
                  </p>
                </div>
              </>
            )}
          </div>

          {isStaffContext ? (
            <>
              {/* Search bar (staff portal) === AMÉLIORATION AJOUTÉE
                  (correctif débordement en-tête) === même correctif que le
                  nav public ci-dessous : aligné sur `lg` pour ne jamais se
                  superposer à la barre mobile de repli (`lg:hidden`). */}
              <form onSubmit={handleSearchSubmit} className="flex-1 hidden lg:block max-w-xl">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="navbar-search"
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={t.navbar_search_placeholder}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 border border-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                  />
                </div>
              </form>
              <div className="flex-1 md:hidden" />
            </>
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
            <nav className="hidden lg:flex items-center gap-1 flex-1">
              <button
                id="nav-btn-home"
                onClick={() => setCurrentTab('home')}
                className={`px-3 py-2 text-xs font-semibold transition border-b-2 ${
                  currentTab === 'home' || currentTab === 'new_alert' || currentTab === 'track'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-blue-700'
                }`}
              >
                {t.nav_public_home}
              </button>

              {/* === AMÉLIORATION AJOUTÉE (Phase 20) === lien "Comment ça
                  marche ?" retiré de l'en-tête sur demande explicite ; la
                  section elle-même reste sur la page d'accueil, simplement
                  plus reliée par un raccourci direct. */}

              {/* === AMÉLIORATION AJOUTÉE (Phase 18 — FAQ sortie de
                  l'accueil) === Vraie navigation vers l'onglet `/faq`
                  (FaqView.tsx) au lieu d'un défilement vers une ancre
                  aujourd'hui retirée de la page d'accueil. */}
              <button
                id="nav-btn-faq"
                onClick={() => setCurrentTab('faq')}
                className={`px-3 py-2 text-xs font-semibold transition border-b-2 ${
                  currentTab === 'faq'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-blue-700'
                }`}
              >
                {t.nav_public_faq}
              </button>

              {/* === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
                  Navigue désormais réellement vers `/contact` (ContactView.tsx,
                  WhatsApp Business + e-mail dédié) au lieu de simplement
                  faire défiler jusqu'au pied de page. */}
              <button
                id="nav-btn-contact"
                onClick={() => setCurrentTab('contact')}
                className={`px-3 py-2 text-xs font-semibold transition border-b-2 ${
                  currentTab === 'contact'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-blue-700'
                }`}
              >
                {t.nav_public_contact}
              </button>
            </nav>
          )}

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
              <>
                {/* === AMÉLIORATION AJOUTÉE (correctif débordement en-tête)
                    === `sm` (640px) → `md` (768px) : entre 640 et ~728px, ce
                    bouton + le séparateur redevenaient visibles alors que le
                    nav desktop était déjà masqué, mais la largeur cumulée
                    (logo + bouton + séparateur + reste du cluster droit) ne
                    tenait toujours pas dans le viewport, coupant
                    "Connexion" à droite. */}
                <button
                  id="nav-btn-track"
                  onClick={() => setCurrentTab('track')}
                  className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition whitespace-nowrap"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{t.btn_track_existing}</span>
                </button>
                {/* === AMÉLIORATION AJOUTÉE (correctif débordement en-tête)
                    === Libellé masqué sous `sm` (comme "Connexion" juste en
                    dessous) : seul bouton toujours visible sans repli
                    icône-seule, son texte long ("Signaler une
                    préoccupation") restait le dernier responsable du
                    débordement sur mobile étroit (ex. 390px). */}
                <button
                  id="nav-btn-new-alert"
                  onClick={() => setCurrentTab('new_alert')}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.btn_new_alert}</span>
                </button>
                <div className="hidden md:block w-px h-6 bg-slate-200" />
              </>
            )}

            {/* === AMÉLIORATION AJOUTÉE (repositionnement en-tête) ===
                Sélecteur de langue déplacé ici, juste avant Connexion/le
                menu de compte, pour que les deux se retrouvent groupés
                tout à droite de la barre — au lieu de vivre avant les
                boutons d'action publics ("Suivre mon signalement" /
                "Signaler une préoccupation"), sur demande explicite. */}
            <div className="relative" ref={langMenuRef}>
              <button
                id="btn-language-selector"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className={`flex items-center gap-1 rounded-lg transition text-xs ${
                  isStaffContext
                    ? 'px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'px-2 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
                title="Changer de langue"
              >
                <span className="font-bold uppercase">{lang}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {showLangDropdown && (
                <div
                  className="absolute right-0 mt-1 w-32 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs"
                  onClick={() => setShowLangDropdown(false)}
                >
                  <button
                    onClick={() => setLang('fr')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'fr' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇫🇷 Français</span>
                    {lang === 'fr' && <span>✓</span>}
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'en' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇬🇧 English</span>
                    {lang === 'en' && <span>✓</span>}
                  </button>
                  <button
                    onClick={() => setLang('pt')}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'pt' ? 'font-bold text-blue-700 bg-blue-50' : ''}`}
                  >
                    <span>🇵🇹 Português</span>
                    {lang === 'pt' && <span>✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Account menu */}
            <div className="relative" ref={userMenuRef}>
              {/* === AMÉLIORATION AJOUTÉE (page de connexion plein cadre,
                  sur maquette fournie) === Sur les pages publiques, le
                  bouton "Connexion" ouvre désormais le véritable écran de
                  connexion (deux volets, photo + formulaire) plutôt que ce
                  menu de changement de profil — cohérent avec la maquette,
                  qui montre un écran dédié, pas un menu déroulant. Dans
                  l'espace collaborateur (isStaffContext), rien ne change :
                  l'avatar + nom + rôle ouvre toujours ce même menu, la
                  fonction de test des rôles (CDC 3.2.3) reste entière. */}
              <button
                id="btn-role-switcher"
                onClick={() => (isStaffContext ? setShowUserDropdown(!showUserDropdown) : setCurrentTab('login'))}
                className={
                  isStaffContext
                    ? 'flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition'
                    : 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition'
                }
              >
                {isStaffContext ? (
                  <>
                    <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                      {initials}
                    </span>
                    <span className="hidden sm:block text-left leading-tight">
                      <span className="block text-xs font-bold text-slate-800 max-w-[140px] truncate">{activeUser.name}</span>
                      <span className="block text-[10px] text-slate-500 max-w-[140px] truncate">{badge?.label}</span>
                    </span>
                  </>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                )}
                {!isStaffContext && <span className="hidden sm:block text-xs font-bold">{t.nav_connexion}</span>}
                {/* Le chevron n'a de sens que pour le menu déroulant (espace
                    collaborateur) — "Connexion" ouvre désormais un écran,
                    pas un menu. */}
                {isStaffContext && <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />}
              </button>

              {showUserDropdown && (
                <div
                  className="absolute right-0 mt-1 w-72 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs"
                  onClick={() => setShowUserDropdown(false)}
                >
                  {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Menu Profil) ===
                      Résumé "Mon profil" (lecture seule, données réelles de
                      l'utilisateur actif — jamais un formulaire d'édition
                      fabriqué) + liens réels vers des écrans existants.
                      Choix délibéré à signaler : pas de "Changer le mot de
                      passe" ni de "Préférences de notification" — l'app n'a
                      volontairement aucun backend d'authentification réel
                      (voir StaffLoginView.tsx) ni aucun système de
                      préférences persistées ; les ajouter aurait été une
                      fausse fonctionnalité (brief §32). "Paramètres"
                      n'apparaît que pour un compte ayant réellement accès à
                      l'écran d'administration correspondant. */}
                  {isStaffUser && (
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="font-bold text-slate-900">{activeUser.name}</p>
                      <p className="text-[11px] text-slate-500">{activeUser.roleTitle}</p>
                      <p className="text-[11px] text-slate-400 truncate">{activeUser.email}</p>
                    </div>
                  )}
                  {isStaffUser && canManageConfiguration(activeUser) && (
                    <button
                      onClick={() => setCurrentTab('settings')}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium border-b border-slate-100"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" /> {t.profile_menu_settings}
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentTab('faq')}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium border-b border-slate-100"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> {t.profile_menu_help}
                  </button>
                  {/* === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace
                      le sélecteur en barre latérale) === Remplace le petit
                      bloc "ESPACES" qui vivait en permanence en haut de la
                      barre latérale (StaffPortalLayout.tsx) : le choix se
                      fait désormais une fois, sur une page d'accueil dédiée
                      (StaffSpaceHome.tsx) juste après connexion ; ce lien,
                      réservé aux comptes à 2 espaces ou plus, permet d'y
                      revenir à tout moment sans se déconnecter. */}
                  {isStaffUser && computeAvailableSpaces(activeUser).length >= 2 && (
                    <button
                      onClick={() => setCurrentTab('space_home')}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium border-b border-slate-100"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" /> {t.profile_menu_change_space}
                    </button>
                  )}

                  {/* === AMÉLIORATION AJOUTÉE (menu profil — recentré sur
                      l'identité connectée) === Le sélecteur "Changer de rôle
                      pour tester" (liste de tous les comptes) et le "Mode
                      Lanceur d'alerte (Public)" sont retirés de ce menu, sur
                      demande explicite : seuls le nom et les identifiants du
                      compte réellement connecté doivent y figurer. */}

                  {/* === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne
                      dédiée) === Déconnexion réelle de la session
                      "collaborateur" démo : referme l'accès aux écrans
                      internes (AuthenticatedRoute, App.tsx) jusqu'à une
                      nouvelle connexion via /login. */}
                  {isStaffUser && isStaffSessionActive && (
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-rose-50 text-rose-700 font-medium border-t border-slate-100"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Se déconnecter
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t border-slate-100 text-[11px] font-medium">
          <button
            onClick={() => setCurrentTab('home')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap ${currentTab === 'home' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            {t.nav_home}
          </button>
          <button
            onClick={() => setCurrentTab('track')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap ${currentTab === 'track' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            {t.nav_track}
          </button>
          <button
            onClick={() => setCurrentTab('portal')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${currentTab === 'portal' || isStaffContext ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}`}
          >
            <span>{t.nav_portal}</span>
            {pendingAlertsCount > 0 && <span className="bg-amber-400 text-slate-950 px-1 rounded-full text-[9px]">{pendingAlertsCount}</span>}
          </button>
          {/* === AMÉLIORATION AJOUTÉE (Phase 27) === bouton QR retiré de la
              barre mobile aussi, par cohérence avec l'en-tête desktop. */}
          {/* === AMÉLIORATION AJOUTÉE (Refonte en-tête — suppression de la
              cloche et de l'accès Firebase) === bouton "Firebase" retiré ici
              aussi, par cohérence avec l'en-tête desktop — écran toujours
              atteignable via son URL directe (/lookup). */}
        </div>
      </div>
    </header>
  );
};
