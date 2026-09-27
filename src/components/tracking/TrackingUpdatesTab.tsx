/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Onglet « Historique » (frise chronologique).
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 * Le type `TimelineEntry` (auparavant local à AlertTrackingView.tsx) est
 * désormais exporté d'ici ; la frise elle-même reste calculée dans
 * AlertTrackingView.tsx.
 */
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export type TimelineEntry = { title: string; desc?: string; time?: string; state: 'done' | 'current' | 'pending' };
interface TrackingUpdatesTabProps {
  t: Record<string, string>;
  timelineItems: TimelineEntry[];
}

export const TrackingUpdatesTab: React.FC<TrackingUpdatesTabProps> = ({
  t,
  timelineItems,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-900">{t.track_updates_title}</h3>
      <p className="text-xs text-slate-500 mb-6">{t.track_updates_subtitle}</p>

      <ol className="space-y-6">
        {timelineItems.map((item, i) => (
          <li key={i} className="relative pl-9">
            {i < timelineItems.length - 1 && (
              <span className="absolute left-[11px] top-6 h-[calc(100%+0.5rem)] w-px bg-slate-200" />
            )}
            <span
              className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                item.state === 'done'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : item.state === 'current'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-300'
              }`}
            >
              {item.state === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${item.state === 'current' ? 'bg-white' : 'bg-slate-300'}`} />
              )}
            </span>
            <div className={item.state === 'pending' ? 'opacity-60' : ''}>
              {item.time && <time className="text-[10px] font-semibold text-slate-400 block">{item.time}</time>}
              <div className="text-xs font-bold text-slate-900">{item.title}</div>
              {item.desc && <div className="text-[11px] text-slate-500">{item.desc}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
