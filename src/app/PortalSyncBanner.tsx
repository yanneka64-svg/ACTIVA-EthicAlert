/**
 * === AMÉLIORATION AJOUTÉE (modifications simultanées et envois en échec) ===
 *
 * Bandeau affiché quand le travail du personnel n'a pas pu être enregistré
 * sur le serveur (services/portalSync.ts, événement PORTAL_SYNC_EVENT) :
 * - conflit : un collègue a modifié le même champ en même temps ; sa
 *   version est conservée et rechargée, rien n'est écrasé ;
 * - refus : droits insuffisants ou données invalides ;
 * - en attente : serveur lent ou injoignable, renvoi automatique.
 * Avant, ces trois cas n'étaient visibles que dans la console du
 * navigateur. Invisible en fonctionnement normal.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, RefreshCw, X } from 'lucide-react';
import { PORTAL_SYNC_EVENT, type PortalSyncDetail } from '../services/portalSync';
import { storage } from '../services/storage';

type Issue = { kind: 'conflict' | 'rejected' | 'pending'; caseId: string };

interface PortalSyncBannerProps {
  t: Record<string, string>;
}

/** Référence lisible du dossier (numéro de suivi), sinon son identifiant. */
function caseLabel(caseId: string): string {
  const alert = storage.getAlerts().find((a) => a.mirroredCaseId === caseId || a.id === `case-${caseId}`);
  return alert?.trackingNumber || caseId;
}

/** Recharge tout de suite la version du serveur pour ce dossier. */
function refreshFromServer(caseId: string) {
  import('../services/cloudCasesSync')
    .then(({ preferServerVersion, syncCloudCases }) => {
      preferServerVersion(caseId);
      return syncCloudCases(storage.getActiveUser());
    })
    .catch(() => {});
}

export function issueFromDetail(d: PortalSyncDetail): Issue | null {
  if (d.conflicts?.length) return { kind: 'conflict', caseId: d.caseId };
  if (d.ok) return null;
  return { kind: d.pending ? 'pending' : 'rejected', caseId: d.caseId };
}

export const PortalSyncBanner: React.FC<PortalSyncBannerProps> = ({ t }) => {
  const [issue, setIssue] = useState<Issue | null>(null);

  useEffect(() => {
    const onSync = (event: Event) => {
      const d = (event as CustomEvent<PortalSyncDetail>).detail;
      const next = issueFromDetail(d);
      if (next) {
        setIssue(next);
        if (next.kind === 'conflict') refreshFromServer(next.caseId);
      } else {
        // Envoi abouti : un « en attente » sur ce dossier n'a plus lieu d'être.
        setIssue((cur) => (cur && cur.kind === 'pending' && cur.caseId === d.caseId ? null : cur));
      }
    };
    window.addEventListener(PORTAL_SYNC_EVENT, onSync);
    return () => window.removeEventListener(PORTAL_SYNC_EVENT, onSync);
  }, []);

  if (!issue) return null;

  const warn = issue.kind !== 'rejected';
  const Icon = issue.kind === 'pending' ? CloudOff : AlertTriangle;
  const title = t[`portal_sync_${issue.kind}_title`];
  const body = t[`portal_sync_${issue.kind}_body`];

  return (
    <div
      id="portal-sync-banner"
      role="alert"
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-2xl rounded-xl border shadow-lg p-4 flex items-start gap-3 ${
        warn ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-red-300 bg-red-50 text-red-900'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${warn ? 'text-amber-600' : 'text-red-600'}`} aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-bold">{title}</p>
        <p className="mt-1">{body}</p>
        <p className="mt-1 text-xs opacity-80">
          {t.portal_sync_case} {caseLabel(issue.caseId)}
        </p>
        {issue.kind === 'conflict' && (
          <button
            type="button"
            onClick={() => refreshFromServer(issue.caseId)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t.portal_sync_refresh}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIssue(null)}
        className={`shrink-0 rounded-md p-1 focus:outline-none focus-visible:ring-2 ${
          warn ? 'text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500' : 'text-red-700 hover:bg-red-100 focus-visible:ring-red-500'
        }`}
        aria-label={t.persist_failure_dismiss}
        title={t.persist_failure_dismiss}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
