/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Première étape du refactor par section d'InvestigationDesk.tsx (4628
 * lignes au démarrage de ce chantier, aucun découpage interne hors 3
 * petits helpers et 2 modales déjà migrées vers ConfirmDialog — voir la
 * PR #90 pour le premier chantier, la série #90-#98 pour le refactor
 * complet d'AdminConfigView.tsx qui a établi le même motif d'extraction).
 *
 * Choisi en premier car c'est le contenu d'onglet le plus autonome de tout
 * le composant : ni état local, ni gestionnaire d'action, seulement une
 * lecture de `selectedAlert` (piste d'audit + messages fusionnés et triés
 * chronologiquement). Code strictement déplacé, pas réécrit.
 */
import React from 'react';
import { AlertRecord, Language } from '../../types';
import { storage } from '../../services/storage';

interface CaseTimelineSectionProps {
  selectedAlert: AlertRecord;
  lang: Language;
  t: Record<string, string>;
}

export const CaseTimelineSection: React.FC<CaseTimelineSectionProps> = ({ selectedAlert, lang, t }) => {
  return (
    <div className="p-6 max-h-[560px] overflow-y-auto text-xs">
      {(() => {
        type TimelineItem = { timestamp: string; label: string };
        const auditItems: TimelineItem[] = storage
          .getAuditLogs()
          .filter((log) => log.trackingNumber === selectedAlert.trackingNumber)
          .map((log) => ({ timestamp: log.timestamp, label: log.details }));
        const messageItems: TimelineItem[] = selectedAlert.messages.map((m) => ({
          timestamp: m.createdAt,
          label: `${t.timeline_message_from} ${m.senderDisplayName} : « ${m.content.slice(0, 80)}${m.content.length > 80 ? '…' : ''} »`,
        }));
        const items = [...auditItems, ...messageItems].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        if (items.length === 0) {
          return <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">{t.timeline_empty}</div>;
        }
        return (
          <ol className="relative border-l-2 border-slate-200 ml-2 space-y-5">
            {items.map((item, i) => (
              <li key={i} className="ml-4">
                <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full -left-[5px] mt-1 border-2 border-white" />
                <time className="text-[10px] font-bold text-slate-400 uppercase">
                  {new Date(item.timestamp).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
                <p className="text-slate-700 mt-0.5">{item.label}</p>
              </li>
            ))}
          </ol>
        );
      })()}
    </div>
  );
};
