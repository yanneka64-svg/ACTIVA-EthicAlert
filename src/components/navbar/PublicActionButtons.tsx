/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Boutons publics « Suivre mon signalement » / « Signaler une
 * préoccupation » + séparateur. Rendu dans un fragment, comme avant.
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';
import { Search, Send } from 'lucide-react';

interface PublicActionButtonsProps {
  t: Record<string, string>;
  setCurrentTab: (tab: string) => void;
}

// === AMÉLIORATION AJOUTÉE (barre du haut au bleu ACTIVA) === même bleu que le corps de page (#2452A0). Contour du bouton « Suivre » neutre.
export const PublicActionButtons: React.FC<PublicActionButtonsProps> = ({
  t,
  setCurrentTab,
}) => {
  return (
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
        className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[#2452A0] hover:bg-[#EAF0FA] text-xs font-bold transition whitespace-nowrap"
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
      {/* === AMÉLIORATION AJOUTÉE (langue/connexion à l'extrême
          gauche du cluster droit sur mobile) === Sur demande
          explicite : `order-3 lg:order-none` repousse ce bouton
          après le sélecteur de langue et Connexion sur mobile
          (`lg:hidden` étant déjà le seuil où ce cluster droit
          devient visuellement le "haut de page" mobile) —
          inchangé à partir de `lg` (ordre naturel du DOM,
          cohérent avec le repositionnement desktop existant
          ci-dessous). */}
      <button
        id="nav-btn-new-alert"
        onClick={() => setCurrentTab('new_alert')}
        className="order-3 lg:order-none flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl bg-[#2452A0] hover:bg-[#1E4590] text-white text-xs font-bold shadow-sm transition whitespace-nowrap"
        // === AMÉLIORATION AJOUTÉE (débordement en-tête 640–1279px) ===
        // Libellé affiché à partir de `xl` seulement : entre `sm` et
        // `xl`, le logo complet + « Suivre mon signalement » +
        // langue + Connexion ne laissaient plus la place à ce
        // libellé long, qui sortait de l'écran. Icône seule en
        // dessous, avec info-bulle et libellé accessible.
        title={t.btn_new_alert}
        aria-label={t.btn_new_alert}
      >
        <Send className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">{t.btn_new_alert}</span>
      </button>
      <div className="hidden md:block w-px h-6 bg-slate-200" />
    </>
  );
};
