/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 13 : miroir de
 * la création de dossier par le personnel) ===
 *
 * Écriture miroir best-effort, silencieuse, additive du vrai backend
 * (Case/Firestore) lors d'une création de dossier PAR LE PERSONNEL
 * (InvestigationDesk.tsx, "Créer un nouveau dossier" — un opérateur saisit
 * directement un signalement reçu par téléphone/en personne, canal
 * `direct`). Même discipline exacte que `casesCloudSync.ts` (Phase 4) : ne
 * bloque jamais, ne remonte jamais d'erreur à l'appelant, ne change rien à
 * ce que voit l'opérateur.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi un nouveau fichier, pas une extension
 * de casesCloudSync.ts ===
 * `casesCloudSync.ts` (Phase 4) appelle `createCaseAsReporter` — une Cloud
 * Function délibérément SANS authentification, pour un formulaire public
 * anonyme qui n'a aucun jeton Firebase Auth. "Créer un nouveau dossier" est
 * à l'inverse une action du PERSONNEL, déjà authentifié dans le contexte
 * réel de l'application : sa contrepartie serveur est donc `createCase`
 * (`cases.create`, `requireAppUser`), jamais `createCaseAsReporter` — deux
 * fonctions aux garanties d'autorisation opposées, jamais interchangeables.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi ce gap existait avant cette phase ===
 * Avant la Phase 13, seule la soumission publique (`AlertSubmissionFlow.tsx`)
 * était mirée vers le vrai backend (Phase 4) — un dossier créé par un
 * opérateur via ce formulaire ne recevait donc jamais de
 * `mirroredCaseId` (Phase 7), et restait par construction hors de portée
 * de tous les miroirs de mutation ultérieurs (Phases 10-12), même une fois
 * le backend réel pleinement activé. Ce module ferme ce trou.
 *
 * Même statut « no-op dans l'immense majorité des cas » que les Phases
 * 10-12 (session Firebase Auth staff réelle quasiment jamais établie —
 * Phase 6) tant que l'activation complète n'a pas eu lieu — décision de
 * continuer quand même déjà prise explicitement avec l'utilisateur.
 */
import { Case } from '../domain/caseTypes';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

export interface StaffCaseCreationInput {
  category: string;
  subcategory?: string;
  country: string;
  entity: string;
  description: string;
  reportingMode: Case['reportingMode'];
  confidentialityLevel: Case['confidentialityLevel'];
}

export interface StaffCaseCreationResult {
  caseId: string;
  caseNumber: string;
}

/** Toujours résout (succès best-effort) — ne rejette jamais, ne doit jamais être `await`é de façon bloquante par l'appelant. `null` si non configuré ou en cas d'échec. */
export async function mirrorStaffCaseCreationToRealBackend(input: StaffCaseCreationInput): Promise<StaffCaseCreationResult | null> {
  if (!isPhase4Configured()) return null;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<StaffCaseCreationInput, StaffCaseCreationResult>(functions, 'createCase');
    const response = await fn(input);
    return response.data;
  } catch {
    return null;
  }
}
