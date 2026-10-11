/**
 * === AMÉLIORATION AJOUTÉE (séparation test / production) ===
 * Bandeau qui distingue sans ambiguïté une version de TEST du site réel :
 * - recette (VITE_APP_ENV=staging) : bandeau orange en haut de page ;
 * - version de test reliée par erreur à la base de production : bandeau rouge ;
 * - poste de développement : petite étiquette discrète en bas à gauche.
 * En production : rien n'est affiché.
 */
import React from 'react';
import { environmentInfo } from '../domain/environment';

const metaEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};

export const EnvironmentBanner: React.FC = () => {
  const { banner } = environmentInfo({ appEnv: metaEnv.VITE_APP_ENV, projectId: metaEnv.VITE_FIREBASE_PROJECT_ID, isDevServer: metaEnv.DEV === true });
  if (!banner) return null;
  if (banner.kind === 'development') {
    return (
      <div role="note" className="fixed bottom-3 left-3 z-[9999] rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white shadow-lg pointer-events-none">
        {banner.label}
      </div>
    );
  }
  const tone = banner.kind === 'misconfigured' ? 'bg-red-600' : 'bg-amber-500';
  return (
    <div role="alert" className={`${tone} relative z-[9999] w-full px-4 py-1.5 text-center text-[12.5px] font-bold text-white`}>
      {banner.label}
    </div>
  );
};
