/**
 * === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
 *
 * Pied de page (copyright + liens Mentions légales / Confidentialité /
 * Contact), déplacé tel quel depuis App.tsx. Toujours rendu au même
 * endroit (frère direct de la zone scrollable, voir App.tsx) ; `goToTab`
 * reste possédé par App.tsx.
 */
import React from 'react';

interface AppFooterProps {
  t: Record<string, string>;
  goToTab: (tab: string) => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ t, goToTab }) => {
  return (
    <footer className="shrink-0 bg-[#0B2545] text-slate-300 text-[11px] py-5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* === AMÉLIORATION AJOUTÉE (Phase 20) === logo retiré du pied de page sur demande explicite (ajouté Phase 17). */}
        <span>{t.footer_copyright.replace('{year}', String(new Date().getFullYear()))}</span>
        {/* === AMÉLIORATION AJOUTÉE (liens réels du pied de page) === Les
            3 boutons étaient décoratifs (aucun `onClick`, aucune
            destination) — reliés désormais à de vrais onglets publics via
            `goToTab`, même mécanisme que le reste de la navigation. */}
        <div className="flex items-center gap-4">
          <button onClick={() => goToTab('legal_notice')} className="hover:text-white hover:underline">{t.footer_legal_notice}</button>
          <button onClick={() => goToTab('privacy_policy')} className="hover:text-white hover:underline">{t.footer_privacy_policy}</button>
          <button onClick={() => goToTab('contact')} className="hover:text-white hover:underline">{t.footer_contact}</button>
        </div>
      </div>
    </footer>
  );
};
