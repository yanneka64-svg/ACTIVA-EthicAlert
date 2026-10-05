/**
 * === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
 *
 * Indicateur de chargement des écrans staff chargés à la demande,
 * déplacé tel quel depuis App.tsx.
 */
// === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, découpage de code) ===
// État de chargement partagé par tous les `<Suspense>` ci-dessous, pendant
// le chargement à la demande d'un écran staff (`React.lazy`) — l'app n'en
// avait jusqu'ici quasiment aucun (relevé par l'audit), la donnée étant par
// ailleurs toujours synchrone (localStorage). En pratique quasi instantané
// une fois le module mis en cache par le navigateur ; ne s'affiche
// réellement qu'au tout premier accès à chaque écran.
export function StaffLoadingFallback() {
  return (
    // === AMÉLIORATION AJOUTÉE (revue design) === squelette de page animé
    // (titre, chiffres clés, liste) sous l'indicateur existant : l'écran
    // « se dessine » au lieu d'un simple sablier.
    <div role="status" aria-label="Chargement" className="px-4 lg:px-0 py-8 space-y-5">
      <div className="flex items-center justify-center py-2 text-slate-400">
        <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div aria-hidden="true" className="space-y-5">
        <div className="activa-skeleton h-7 w-64 max-w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="activa-skeleton h-24" />
          ))}
        </div>
        <div className="activa-skeleton h-72" />
      </div>
    </div>
  );
}
