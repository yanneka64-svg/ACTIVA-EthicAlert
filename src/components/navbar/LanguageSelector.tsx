/**
 * === AMÉLIORATION AJOUTÉE (Refactor Navbar — extraction par section) ===
 *
 * Sélecteur de langue (FR / EN / PT) et son menu déroulant.
 *
 * Code strictement déplacé depuis Navbar.tsx, pas réécrit — aucun
 * changement de comportement. L'état des menus déroulants, les `ref`
 * utilisés par l'écouteur « clic extérieur » (passés ici comme props
 * ordinaires et reposés sur le même élément), la recherche et les
 * callbacks de navigation restent possédés par Navbar.tsx.
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { Language } from '../../types';

interface LanguageSelectorProps {
  t: Record<string, string>;
  lang: Language;
  setLang: (lang: Language) => void;
  isStaffContext: boolean;
  showLangDropdown: boolean;
  setShowLangDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  langMenuRef: React.RefObject<HTMLDivElement | null>;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  t,
  lang,
  setLang,
  isStaffContext,
  showLangDropdown,
  setShowLangDropdown,
  langMenuRef,
}) => {
  return (
    <div className="order-1 lg:order-none relative" ref={langMenuRef}>
      <button
        id="btn-language-selector"
        onClick={() => setShowLangDropdown(!showLangDropdown)}
        className={`flex items-center gap-1 rounded-lg transition text-xs ${
          isStaffContext
            ? 'px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600'
            : 'px-2 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        title={t.nav_change_language}
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
            className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'fr' ? 'font-bold text-[#1449B0] bg-[#EAF0FA]' : ''}`}
          >
            <span>🇫🇷 Français</span>
            {lang === 'fr' && <span>✓</span>}
          </button>
          <button
            onClick={() => setLang('en')}
            className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'en' ? 'font-bold text-[#1449B0] bg-[#EAF0FA]' : ''}`}
          >
            <span>🇬🇧 English</span>
            {lang === 'en' && <span>✓</span>}
          </button>
          <button
            onClick={() => setLang('pt')}
            className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${lang === 'pt' ? 'font-bold text-[#1449B0] bg-[#EAF0FA]' : ''}`}
          >
            <span>🇵🇹 Português</span>
            {lang === 'pt' && <span>✓</span>}
          </button>
        </div>
      )}
    </div>
  );
};
