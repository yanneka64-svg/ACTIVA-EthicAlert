/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : plus de perte de données silencieuse) ===
 *
 * Bannière d'alerte affichée quand StorageService n'a pas pu enregistrer
 * dans le localStorage (voir services/persistFailure.ts). Invisible tant
 * qu'aucun échec n'a eu lieu : aucun changement visuel en fonctionnement
 * normal. Réapparaît à chaque nouvel échec après avoir été fermée.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { PERSIST_FAILURE_EVENT, PersistFailureDetail, getLastPersistFailure } from '../services/persistFailure';

interface PersistFailureBannerProps {
  t: Record<string, string>;
}

export const PersistFailureBanner: React.FC<PersistFailureBannerProps> = ({ t }) => {
  const [failure, setFailure] = useState<PersistFailureDetail | null>(() => getLastPersistFailure());

  useEffect(() => {
    const onFailure = (event: Event) => setFailure((event as CustomEvent<PersistFailureDetail>).detail);
    window.addEventListener(PERSIST_FAILURE_EVENT, onFailure);
    return () => window.removeEventListener(PERSIST_FAILURE_EVENT, onFailure);
  }, []);

  if (!failure) return null;

  return (
    <div
      id="persist-failure-banner"
      role="alert"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-red-300 bg-red-50 text-red-900 shadow-lg p-4 flex items-start gap-3"
    >
      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-bold">{t.persist_failure_title}</p>
        <p className="mt-1">{failure.quotaExceeded ? t.persist_failure_quota : t.persist_failure_generic}</p>
      </div>
      <button
        type="button"
        onClick={() => setFailure(null)}
        className="shrink-0 rounded-md p-1 text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label={t.persist_failure_dismiss}
        title={t.persist_failure_dismiss}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
