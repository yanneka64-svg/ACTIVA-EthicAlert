/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Bouton « Connexion » (public) ou avatar + menu profil (espace
 * collaborateur : aide, changement d'espace, déconnexion).
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';
import { ChevronDown, User, HelpCircle, LogOut, ArrowLeftRight } from 'lucide-react';
import type { UserProfile } from '../../types';
import { computeAvailableSpaces } from '../../domain/staffSpaces';

interface AccountMenuProps {
  t: Record<string, string>;
  isStaffContext: boolean;
  setCurrentTab: (tab: string) => void;
  activeUser: UserProfile;
  initials: string;
  badge: { label: string; color: string } | undefined;
  isStaffUser: boolean;
  isStaffSessionActive: boolean;
  onLogout: () => void;
  showUserDropdown: boolean;
  setShowUserDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  userMenuRef: React.RefObject<HTMLDivElement | null>;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  t,
  isStaffContext,
  setCurrentTab,
  activeUser,
  initials,
  badge,
  isStaffUser,
  isStaffSessionActive,
  onLogout,
  showUserDropdown,
  setShowUserDropdown,
  userMenuRef,
}) => {
  return (
    <div className="order-2 lg:order-none relative" ref={userMenuRef}>
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
            {/* === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3,
                contraste) === BUG PRÉEXISTANT CORRIGÉ, mesuré via
                axe-core : texte blanc en gras sur bg-amber-500 ne
                passe pas le seuil WCAG AA (2.13:1, minimum 4.5:1) —
                bg-amber-700 y remédie. */}
            <span className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
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
              fausse fonctionnalité (brief §32).
              === AMÉLIORATION AJOUTÉE (retrait du lien "Paramètres")
              === Retiré sur demande explicite : ce lien menait au
              même écran déjà accessible depuis la barre latérale
              (StaffPortalLayout.tsx), aucune fonctionnalité perdue. */}
          {isStaffUser && (
            <div className="px-3 py-2.5 border-b border-slate-100">
              <p className="font-bold text-slate-900">{activeUser.name}</p>
              <p className="text-[11px] text-slate-500">{activeUser.roleTitle}</p>
              <p className="text-[11px] text-slate-400 truncate">{activeUser.email}</p>
            </div>
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
              <LogOut className="w-3.5 h-3.5" /> {t.nav_logout}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
