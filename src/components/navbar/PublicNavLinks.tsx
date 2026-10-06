/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Navigation publique desktop (Accueil / FAQ / Nous contacter).
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';

interface PublicNavLinksProps {
  t: Record<string, string>;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

// === AMÉLIORATION AJOUTÉE (barre du haut au bleu ACTIVA) === même bleu que le corps de page (#1449B0).
export const PublicNavLinks: React.FC<PublicNavLinksProps> = ({
  t,
  currentTab,
  setCurrentTab,
}) => {
  return (
    // === AMÉLIORATION AJOUTÉE (ordre du menu) === Accueil, Ligne d'assistance, Nous contacter, FAQ — via `order-*`.
    <nav className="hidden lg:flex items-center gap-1 flex-1">
      <button
        id="nav-btn-home"
        onClick={() => setCurrentTab('home')}
        className={`order-1 px-3 py-2 text-xs font-semibold transition border-b-2 ${
          currentTab === 'home' || currentTab === 'new_alert' || currentTab === 'track'
            ? 'border-[#1449B0] text-[#1449B0]'
            : 'border-transparent text-slate-600 hover:text-[#1449B0]'
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
        className={`order-4 px-3 py-2 text-xs font-semibold transition border-b-2 ${
          currentTab === 'faq'
            ? 'border-[#1449B0] text-[#1449B0]'
            : 'border-transparent text-slate-600 hover:text-[#1449B0]'
        }`}
      >
        {t.nav_public_faq}
      </button>

      {/* === AMÉLIORATION AJOUTÉE (ligne d'assistance téléphonique) === */}
      <button
        id="nav-btn-helpline"
        onClick={() => setCurrentTab('helpline')}
        className={`order-2 px-3 py-2 text-xs font-semibold transition border-b-2 ${
          currentTab === 'helpline'
            ? 'border-[#1449B0] text-[#1449B0]'
            : 'border-transparent text-slate-600 hover:text-[#1449B0]'
        }`}
      >
        {t.helpline_nav}
      </button>

      {/* === AMÉLIORATION AJOUTÉE (Phase 27 — onglet Contact réel) ===
          Navigue désormais réellement vers `/contact` (ContactView.tsx,
          WhatsApp Business + e-mail dédié) au lieu de simplement
          faire défiler jusqu'au pied de page. */}
      <button
        id="nav-btn-contact"
        onClick={() => setCurrentTab('contact')}
        className={`order-3 px-3 py-2 text-xs font-semibold transition border-b-2 ${
          currentTab === 'contact'
            ? 'border-[#1449B0] text-[#1449B0]'
            : 'border-transparent text-slate-600 hover:text-[#1449B0]'
        }`}
      >
        {t.nav_public_contact}
      </button>
    </nav>
  );
};
