/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Navigation latérale entre les 4 onglets + lien d'aide.
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 * `sidebarItems` déplacé ici (seul utilisateur).
 */
import React from 'react';
import { LayoutGrid, MessageSquare, Paperclip, History, ChevronRight } from 'lucide-react';
import { AlertRecord } from '../../types';

interface TrackingSidebarProps {
  t: Record<string, string>;
  activeAlert: AlertRecord;
  activeTrackTab: 'overview' | 'messages' | 'documents' | 'updates';
  setActiveTrackTab: React.Dispatch<React.SetStateAction<'overview' | 'messages' | 'documents' | 'updates'>>;
  onGoToContact: (() => void) | undefined;
}

export const TrackingSidebar: React.FC<TrackingSidebarProps> = ({
  t,
  activeAlert,
  activeTrackTab,
  setActiveTrackTab,
  onGoToContact,
}) => {
  // === AMÉLIORATION AJOUTÉE (Phase 34 — navigation latérale) ===
  const sidebarItems: { key: typeof activeTrackTab; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; count: number }[] = [
    { key: 'overview', icon: LayoutGrid, label: t.track_tab_overview, count: 0 },
    { key: 'messages', icon: MessageSquare, label: t.track_tab_messages, count: activeAlert.messages.length },
    { key: 'documents', icon: Paperclip, label: t.track_tab_documents, count: activeAlert.evidences.length },
    { key: 'updates', icon: History, label: t.track_tab_updates, count: 0 },
  ];

  return (
    // === AMÉLIORATION AJOUTÉE (suivi — design modernisé) === onglet actif
    // en dégradé avec repère latéral, icônes au trait fin dans une tuile,
    // léger décalage au survol ; encart d'aide avec lien animé.
    <aside className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_40px_-20px_rgb(15_23_42/0.18)] p-2.5">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = activeTrackTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTrackTab(item.key)}
                className={`group relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-r from-blue-50 to-blue-50/30 text-blue-700 ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:translate-x-0.5'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-sky-400 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}
                />
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200 group-hover:text-blue-600 group-hover:ring-blue-200'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.count > 0 && (
                  <span
                    className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
                      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {onGoToContact && (
        <div className="bg-gradient-to-br from-blue-50 to-sky-50/60 rounded-2xl border border-blue-100 p-4">
          <div className="text-xs font-bold text-slate-800">{t.sidebar_help_title}</div>
          <button
            type="button"
            onClick={onGoToContact}
            className="group inline-flex items-center gap-1 text-xs text-blue-700 font-semibold mt-1.5 hover:text-blue-800"
          >
            {t.footer_contact}
            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </aside>
  );
};
