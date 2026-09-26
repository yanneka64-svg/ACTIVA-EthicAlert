/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 12 : miroir de
 * l'attribution — routage indépendant) ===
 *
 * Écriture miroir best-effort, silencieuse, additive du vrai backend
 * (Case/Firestore, via la Cloud Function `assignCase`) — même discipline
 * exacte que `statusMirrorSync.ts` (Phase 10)/`casesCloudSync.ts` (Phase 4) :
 * ne bloque jamais, ne remonte jamais d'erreur à l'appelant, ne change rien
 * à ce que voit l'utilisateur.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi ce module, et pas une extension de
 * statusMirrorSync.ts ===
 * Le routage indépendant (`storage.triggerIndependentRouting()`,
 * domain/independentRouting.ts) ne passe délibérément PAS par
 * `checkTransition()`/un changement de `workflowStatus` (voir son propre
 * commentaire) — c'est un changement d'ATTRIBUTION (qui est assigné au
 * dossier), pas de statut. Le contrepartie réelle côté serveur est donc
 * `assignCase` (caseId, assignee, additionalInvestigators), pas
 * `changeCaseStatus` — une forme d'appel différente, jamais réutilisable
 * telle quelle.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi seule l'issue "autorité trouvée" est
 * mirée, jamais l'issue "aucune autorité disponible" ===
 * `assignCase` exige un `assignee` non vide côté serveur
 * (`HttpsError('invalid-argument', ...)` sinon) — quand
 * `resolveIndependentAuthority()` ne trouve personne, il n'existe tout
 * simplement aucune valeur honnête à envoyer comme nouvel assigné. Forcer
 * un id arbitraire inventerait un état que le vrai backend n'a jamais
 * décidé. Ce cas reste donc un no-op local uniquement, cohérent avec le
 * principe déjà appliqué dans ce projet contre le code qui donne une fausse
 * impression que le système fonctionne.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi ceci restera un no-op dans l'immense
 * majorité des cas, même une fois déployé ===
 * Mêmes deux raisons que la Phase 10/11 (session Firebase Auth staff réelle
 * quasiment jamais établie — Phase 6 ; dossier sans `mirroredCaseId` pour
 * tout ce qui a été soumis avant l'activation complète — Phase 7) — plus
 * une troisième, propre à ce cas : l'autorité trouvée localement
 * (`UserProfile.id`, ex. `usr-xyz`) n'est presque jamais un vrai UID
 * Firebase Auth existant, donc `assignCase`'s `assertCaseBearingRole`
 * échouera côté serveur même si l'appelant, lui, est authentifié. Décision
 * de continuer quand même prise explicitement avec l'utilisateur (Phase
 * 8/9/10/11) : additif, jamais bloquant, jamais trompeur.
 */
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

export interface AssignmentMirrorInput {
  caseId: string;
  assignee: string;
  additionalInvestigators?: string[];
}

/** Toujours résout `true`/`false` (succès best-effort) — ne rejette jamais, ne doit jamais être `await`é de façon bloquante par l'appelant. */
export async function mirrorAssignmentToRealBackend(input: AssignmentMirrorInput): Promise<boolean> {
  if (!isPhase4Configured()) return false;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<AssignmentMirrorInput, { ok: true }>(functions, 'assignCase');
    await fn(input);
    return true;
  } catch {
    return false;
  }
}
