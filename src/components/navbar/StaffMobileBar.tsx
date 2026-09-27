/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Barre de bulles mobile de l'espace collaborateur (Accueil / Suivre /
 * Espace Gestion DARC + badge de dossiers en attente).
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';

interface StaffMobileBarProps {
  t: Record<string, string>;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingAlertsCount: number;
}

export const StaffMobileBar: React.FC<StaffMobileBarProps> = ({
  t,
  currentTab,
  setCurrentTab,
  pendingAlertsCount,
}) => {
  return (
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
        className={`px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 bg-blue-600 text-white font-bold`}
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
  );
};
