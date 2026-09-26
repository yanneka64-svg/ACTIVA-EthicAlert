/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4 : miroir de
 * la soumission publique) ===
 *
 * Écriture miroir best-effort, silencieuse, additive du vrai backend
 * (Case/Firestore/Cloud Functions) lors d'une soumission publique — même
 * principe exact que `saveAlertToCloud` (services/firebase.ts) pour le
 * modèle legacy : ne bloque jamais, ne remonte jamais d'erreur à
 * l'appelant, ne change rien à ce que voit le déclarant (le numéro de
 * suivi et le mot de passe affichés restent ceux du modèle local
 * `storage.ts`, seule source de vérité tant que les phases 5/6 n'ont pas
 * migré l'UI — voir docs/DATABASE.md).
 *
 * Appelle la nouvelle Cloud Function `createCaseAsReporter`
 * (functions/src/index.ts, Phase 4) plutôt que `createCase` : ce dernier
 * exige un vrai jeton Firebase Auth avec la permission `cases.create`
 * (personnel uniquement — `reporter` n'a aucune permission dans
 * permissions.ts), injoignable depuis ce formulaire public et anonyme.
 *
 * Toujours un no-op silencieux tant que les Cloud Functions ne sont pas
 * déployées (voir isPhase4Configured — même garde que `isFirebaseConfigured`
 * pour le modèle legacy).
 *
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 7 : lien
 * dossier local ↔ dossier réel) === Renvoie désormais l'identifiant/numéro
 * du dossier réel créé (au lieu d'un simple booléen) — `null` dans tous les
 * cas d'échec/non-configuré, comme avant. Seul changement de contrat côté
 * appelant : lire `caseId`/`caseNumber` sur le résultat au lieu de tester un
 * booléen ; le comportement best-effort/jamais-bloquant/jamais-rejeté reste
 * identique. Permet à `AlertSubmissionFlow.tsx` de persister ce lien sur
 * l'`AlertRecord` local (types.ts `mirroredCaseId`/`mirroredCaseNumber`),
 * préalable à toute future mise en miroir des mutations ultérieures.
 */
import { Case } from '../domain/caseTypes';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

export interface CaseMirrorInput {
  category: string;
  subcategory?: string;
  country: string;
  entity: string;
  description: string;
  reportingMode: Case['reportingMode'];
  confidentialityLevel: Case['confidentialityLevel'];
}

export interface CaseMirrorResult {
  caseId: string;
  caseNumber: string;
}

/** Toujours résout (succès best-effort) — ne rejette jamais, ne doit jamais être `await`é de façon bloquante par l'appelant. `null` si non configuré ou en cas d'échec. */
export async function mirrorSubmissionToRealBackend(input: CaseMirrorInput): Promise<CaseMirrorResult | null> {
  if (!isPhase4Configured()) return null;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<CaseMirrorInput, CaseMirrorResult>(functions, 'createCaseAsReporter');
    const response = await fn(input);
    return response.data;
  } catch {
    return null;
  }
}
