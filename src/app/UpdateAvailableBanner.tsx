/**
 * === AMÉLIORATION AJOUTÉE (nouvelle version disponible) ===
 * Vérifie /version.json toutes les 3 minutes et au retour sur l'onglet ;
 * si une nouvelle version a été déployée, propose de recharger la page.
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchRemoteBuild, isNewerBuild } from './appVersion';

const CHECK_INTERVAL_MS = 3 * 60 * 1000;

export const UpdateAvailableBanner: React.FC<{ t: Record<string, string> }> = ({ t }) => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (cancelled || available) return;
      const remote = await fetchRemoteBuild();
      if (!cancelled && isNewerBuild(remote)) setAvailable(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [available]);

  if (!available) return null;
  return (
    <div
      role="status"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-xl bg-[#0B2545] text-white shadow-xl px-4 py-2.5 text-xs max-w-[calc(100vw-2rem)]"
    >
      <span className="font-semibold">{t.app_update_available || 'Une nouvelle version est disponible.'}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white text-[#0B2545] font-bold px-3 py-1.5 hover:bg-slate-100"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t.app_update_reload || 'Recharger'}
      </button>
    </div>
  );
};
