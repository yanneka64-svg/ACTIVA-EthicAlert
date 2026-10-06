/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Logo + menu déroulant mobile public (Accueil / FAQ / Contact).
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { EthicAlertBrand } from '../ui';

interface NavbarBrandProps {
  t: Record<string, string>;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isStaffContext: boolean;
  showMobileNavMenu: boolean;
  setShowMobileNavMenu: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavMenuRef: React.RefObject<HTMLDivElement | null>;
}

export const NavbarBrand: React.FC<NavbarBrandProps> = ({
  t,
  currentTab,
  setCurrentTab,
  isStaffContext,
  showMobileNavMenu,
  setShowMobileNavMenu,
  mobileNavMenuRef,
}) => {
  return (
    <div className="relative shrink-0" ref={mobileNavMenuRef}>
      <div
        id="brand-logo"
        onClick={() => setCurrentTab('home')}
        className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
      >
        {/* === AMÉLIORATION AJOUTÉE === icône EthicAlert + nom
            « activa.whistleblowing » à la place du logo corporate
            (ActivaLogo reste utilisé par les vues d'impression). */}
        <EthicAlertBrand className="h-10 shrink-0" />
        {/* === AMÉLIORATION AJOUTÉE (topbar staff sans doublon) === Le
            logo « Activa.whistleblowing » contient déjà le nom de la
            plateforme : le titre + sous-titre répétaient ce nom juste à
            côté (sous-titre de plus tronqué). Séparateur et bloc texte
            masqués visuellement ; le titre reste lisible par les
            lecteurs d'écran (`sr-only`). */}
        {isStaffContext && (
          <>
            <div className="hidden" />
            <div className="sr-only">
              <h1 className="text-[15px] font-extrabold tracking-tight text-[#0B2545] group-hover:text-[#2452A0] transition">
                {t.app_title}
              </h1>
              <p className="text-[11px] text-slate-500 max-w-[260px] truncate">
                {t.app_subtitle}
              </p>
            </div>
          </>
        )}
        {!isStaffContext && (
          <button
            type="button"
            aria-label={t.common_menu}
            onClick={(e) => {
              e.stopPropagation();
              setShowMobileNavMenu(!showMobileNavMenu);
            }}
            className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showMobileNavMenu ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {!isStaffContext && showMobileNavMenu && (
        <div className="lg:hidden absolute left-0 top-full mt-1 w-48 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs">
          <button
            onClick={() => { setCurrentTab('home'); setShowMobileNavMenu(false); }}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold ${currentTab === 'home' || currentTab === 'new_alert' || currentTab === 'track' ? 'text-[#2452A0]' : 'text-slate-700'}`}
          >
            {t.nav_public_home}
          </button>
          <button
            onClick={() => { setCurrentTab('faq'); setShowMobileNavMenu(false); }}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold ${currentTab === 'faq' ? 'text-[#2452A0]' : 'text-slate-700'}`}
          >
            {t.nav_public_faq}
          </button>
          <button
            onClick={() => { setCurrentTab('contact'); setShowMobileNavMenu(false); }}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 font-semibold ${currentTab === 'contact' ? 'text-[#2452A0]' : 'text-slate-700'}`}
          >
            {t.nav_public_contact}
          </button>
        </div>
      )}
    </div>
  );
};
