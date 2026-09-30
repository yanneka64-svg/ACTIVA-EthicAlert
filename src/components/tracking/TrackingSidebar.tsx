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
import { LayoutGrid, MessageSquare, Paperclip, History } from 'lucide-react';
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
  const sidebarItems: { key: typeof activeTrackTab; icon: React.ComponentType<{ className?: string }>; label: string; count: number }[] = [
    { key: 'overview', icon: LayoutGrid, label: t.track_tab_overview, count: 0 },
    { key: 'messages', icon: MessageSquare, label: t.track_tab_messages, count: activeAlert.messages.length },
    { key: 'documents', icon: Paperclip, label: t.track_tab_documents, count: activeAlert.evidences.length },
    { key: 'updates', icon: History, label: t.track_tab_updates, count: 0 },
  ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = activeTrackTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTrackTab(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count > 0 && (
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-bold ${
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-bold text-slate-800">{t.sidebar_help_title}</div>
          <button
            type="button"
            onClick={onGoToContact}
            className="text-xs text-blue-700 hover:underline font-semibold mt-1"
          >
            {t.footer_contact}
          </button>
        </div>
      )}
    </aside>
  );
};
