/**
 * === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
 *
 * Bandeau de l'accusé de réception quand le serveur n'a pas encore confirmé
 * le dépôt : le déclarant sait que l'envoi est en cours (au lieu de croire
 * le signalement transmis). Le renvoi est relancé régulièrement tant que la
 * page est ouverte ; le bandeau passe au vert dès que le dossier est lié au
 * serveur.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload } from 'lucide-react';

import { storage } from '../../services/storage';
import { flushSubmissionOutbox } from '../../services/submissionOutbox';

export function PendingTransmissionNotice({ t, alertId }: { t: Record<string, string>; alertId: string }) {
  const [delivered, setDelivered] = useState(() => Boolean(storage.getAlertById(alertId)?.mirroredCaseId));

  useEffect(() => {
    if (delivered) return;
    const check = () => {
      if (storage.getAlertById(alertId)?.mirroredCaseId) setDelivered(true);
    };
    const poll = window.setInterval(check, 3000);
    const retry = window.setInterval(() => void flushSubmissionOutbox().then(check), 15000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(retry);
    };
  }, [alertId, delivered]);

  if (delivered) {
    return (
      <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="w-4 h-4 shrink-0" /> {t.sub_pending_done}
      </p>
    );
  }
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
      <CloudUpload className="w-5 h-5 shrink-0 text-amber-700 animate-pulse" />
      <div>
        <p className="text-xs font-bold text-amber-900">{t.sub_pending_title}</p>
        <p className="mt-0.5 text-xs text-amber-900/90 leading-relaxed">{t.sub_pending_body}</p>
      </div>
    </div>
  );
}
