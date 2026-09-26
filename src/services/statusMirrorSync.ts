/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 10 : miroir du
 * changement de statut) ===
 *
 * Écriture miroir best-effort, silencieuse, additive du vrai backend
 * (Case/Firestore, via la Cloud Function `changeCaseStatus`) lors d'un
 * changement de statut local (`storage.transitionStatus()`) — même
 * discipline exacte que `casesCloudSync.ts` (Phase 4) : ne bloque jamais, ne
 * remonte jamais d'erreur à l'appelant, ne change rien à ce que voit
 * l'utilisateur (le modèle local `storage.ts` reste la seule source de
 * vérité pour l'écran).
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi ceci restera un no-op dans l'immense
 * majorité des cas, même une fois les Cloud Functions déployées ===
 * `changeCaseStatus` exige un vrai jeton Firebase Auth staff
 * (`requireAppUser` côté serveur). Comme documenté en Phase 6
 * (`staffAuthSync.ts`), le personnel n'a aujourd'hui quasiment jamais de
 * session Firebase Auth réelle établie (mots de passe non synchronisés) —
 * et ce miroir ne s'applique de toute façon qu'aux dossiers portant un lien
 * réel actif (`AlertRecord.mirroredCaseId`, posé par la Phase 7), c'est-à-
 * dire les dossiers soumis après l'activation complète. Décision de
 * continuer quand même prise explicitement avec l'utilisateur (voir Phase
 * 8/9) : additif, jamais bloquant, jamais trompeur (aucune UI ne prétend
 * que ce miroir a réussi), donc sans risque même largement inatteignable
 * aujourd'hui.
 *
 * `checkTransition()` (domain/workflow.ts, partagé) n'a besoin du contexte
 * allégations/mesures correctives/revue fonctionnelle que pour sa
 * vérification de clôture (`to === 'closed'`) — `storage.transitionStatus()`
 * ne transite jamais vers `closed` (voir son propre commentaire), donc
 * aucune des cibles réellement utilisées ici (pending_information,
 * investigation, conclusion_pending, functional_review, duplicate,
 * out_of_scope) n'est affectée par l'absence de ce contexte côté serveur.
 */
import { CaseStatus } from '../domain/caseTypes';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

export interface StatusMirrorInput {
  caseId: string;
  to: CaseStatus;
  reason?: string;
}

/** Toujours résout `true`/`false` (succès best-effort) — ne rejette jamais, ne doit jamais être `await`é de façon bloquante par l'appelant. */
export async function mirrorStatusChangeToRealBackend(input: StatusMirrorInput): Promise<boolean> {
  if (!isPhase4Configured()) return false;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<StatusMirrorInput, { ok: true; status: CaseStatus }>(functions, 'changeCaseStatus');
    await fn(input);
    return true;
  } catch {
    return false;
  }
}
