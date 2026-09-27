/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Centre de la barre en espace collaborateur : fil d'Ariane
 * « Espace › Page » et recherche de dossier. Rendu dans un fragment,
 * comme avant (enfants directs de la rangée flex de l'en-tête).
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';
import { Search, ChevronRight } from 'lucide-react';
import type { StaffBreadcrumb } from '../../services/staffBreadcrumb';

interface StaffBreadcrumbSearchProps {
  t: Record<string, string>;
  staffBreadcrumb: StaffBreadcrumb | null;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  handleSearchSubmit: (e: React.FormEvent) => void;
}

export const StaffBreadcrumbSearch: React.FC<StaffBreadcrumbSearchProps> = ({
  t,
  staffBreadcrumb,
  searchValue,
  setSearchValue,
  handleSearchSubmit,
}) => {
  return (
    <>
      {/* === AMÉLIORATION AJOUTÉE (fil d'Ariane de navigation) ===
          « Espace › Page » (publié par StaffPortalLayout.tsx via
          services/staffBreadcrumb.ts), mis à jour à chaque changement
          d'onglet avec un léger fondu (`activa-fade-in`, désactivé si
          l'utilisateur préfère réduire les animations). Affiché à
          partir de `md` ; rien n'est retiré de la topbar existante. */}
      {staffBreadcrumb && (staffBreadcrumb.section || staffBreadcrumb.page) && (
        <nav aria-label={t.nav_breadcrumb} className="hidden md:flex items-center gap-2 min-w-0 shrink-0 pl-4 border-l border-slate-200 text-xs">
          <span key={`s-${staffBreadcrumb.section}`} className="activa-fade-in text-slate-500 font-medium whitespace-nowrap">
            {staffBreadcrumb.section}
          </span>
          {staffBreadcrumb.page && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span
                key={`p-${staffBreadcrumb.page}`}
                aria-current="page"
                className="activa-fade-in font-bold text-[#0B2545] whitespace-nowrap truncate max-w-[220px]"
              >
                {staffBreadcrumb.page}
              </span>
            </>
          )}
        </nav>
      )}
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
  );
};
