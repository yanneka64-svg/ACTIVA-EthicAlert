/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 * Shared breadcrumb trail (brief §58: "Control Panel > Cases > ACT-2026-0047").
 * Purely presentational — navigation happens through the same tab-state
 * setters every other screen already uses (no router).
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export const Breadcrumb: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <nav className="flex items-center flex-wrap gap-1 text-xs text-slate-500 mb-1">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
        {item.onClick ? (
          <button onClick={item.onClick} className="hover:text-blue-700 hover:underline font-medium">
            {item.label}
          </button>
        ) : (
          <span className={i === items.length - 1 ? 'text-slate-800 font-semibold' : 'font-medium'}>{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);
