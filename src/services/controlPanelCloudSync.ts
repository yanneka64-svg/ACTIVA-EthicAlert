/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5 : fusion
 * Centre de Pilotage) ===
 *
 * Lit les dossiers du vrai backend (Case/Firestore, via la Cloud Function
 * `listCases`, Phase 1) et les convertit en résumés au format `AlertRecord`
 * (`domain/caseToAlertSummary.ts`) pour que `ControlPanel.tsx` (Centre de
 * Pilotage) puisse les fusionner avec ses données locales — jamais les
 * remplacer, jamais casser la vue 100 % locale actuelle si l'appel échoue
 * ou n'est pas configuré. Même discipline "best-effort, ne bloque jamais,
 * ne rejette jamais" que `casesCloudSync.ts`/`services/firebase.ts`.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi cet appel échoue silencieusement
 * aujourd'hui, même une fois les Cloud Functions déployées ===
 * `listCases` exige un jeton Firebase Auth réel (`requireAppUser` côté
 * serveur). Aucun membre du personnel n'est aujourd'hui réellement
 * connecté à Firebase Auth : `StaffLoginView.tsx` reste sur le login
 * local (`storage.verifyStaffLogin`) — les primitives réelles construites
 * en Phase 2 (`services/staffAuth.ts`) existent mais ne sont volontairement
 * pas branchées à cet écran. Tant que ce branchement n'a pas eu lieu (voir
 * le plan, Phase 6+), cet appel échouera systématiquement avec
 * `unauthenticated`, capturé ci-dessous et traité exactement comme
 * "non configuré" — un no-op silencieux de plus, pour une raison
 * différente mais avec le même résultat observable : rien ne change tant
 * que l'activation complète n'a pas eu lieu.
 */
import { caseSummaryId, caseToAlertSummary } from '../domain/caseToAlertSummary';
import { AlertRecord } from '../types';
import { AppUser } from '../domain/caseTypes';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) === type-only :
// `FirestoreCaseRepository` (et le SDK `firebase/functions` qu'elle importe)
// n'est chargée dynamiquement que dans `fetchMirroredCasesForControlPanel`
// ci-dessous, jamais statiquement ici — sinon TOUT écran import ant ce
// module (ControlPanel.tsx) paierait le coût de ce SDK même quand Firebase
// n'est pas configuré. Même discipline que `services/firebaseClient.ts`.
// === AMÉLIORATION AJOUTÉE (nettoyage des imports morts) === l'`import type`
// de `FirestoreCaseRepository` qui suivait ce commentaire a été retiré : il
// n'était plus référencé (le type est obtenu via l'import dynamique de
// `fetchMirroredCasesForControlPanel`). La règle ci-dessus reste valable.
import { isPhase4Configured } from './firebaseClient';
// === AMÉLIORATION AJOUTÉE (revue PR #139) === vérification de l'identité Firebase.
import { getPhase4Firebase } from './firebaseClient';

// Pas de limite de pagination réelle côté UI ici : le Centre de Pilotage
// affiche des KPI agrégés sur TOUS les dossiers visibles, jamais une page
// à la fois — 100 couvre largement le volume actuel (3 dossiers de démo).
// À revoir si `listCases` gagne une vraie pagination ergonomique côté
// Centre de Pilotage (hors périmètre de cette phase).
const FETCH_LIMIT = 100;

/**
 * `requestingUser` n'est renseigné que pour respecter la signature de
 * `CaseRepository.listCases` — `FirestoreCaseRepository` l'ignore
 * volontairement (voir son propre commentaire) : la véritable autorisation
 * vient du jeton Firebase Auth vérifié côté serveur, jamais de ce
 * paramètre côté client.
 */
const PLACEHOLDER_USER: AppUser = {
  userId: 'control-panel-cloud-sync',
  name: 'Centre de Pilotage',
  email: '',
  roleId: 'functional_admin',
  countries: [],
  entities: [],
  active: true,
  mfaEnabled: false,
  createdAt: new Date(0).toISOString(),
};

// === AMÉLIORATION AJOUTÉE (revue PR #139) === plafond de sécurité du
// parcours des pages (FETCH_LIMIT × MAX_PAGES dossiers au maximum).
const MAX_PAGES = 50;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Toujours résout un tableau (vide en cas d'échec) — ne rejette jamais.
 *
 * === AMÉLIORATION AJOUTÉE (revue PR #139) ===
 * - `expectedEmail` (compte local actif) est OBLIGATOIRE : les dossiers ne
 *   sont renvoyés que si la session Firebase Auth courante appartient à ce
 *   même compte. Sinon (session d'un utilisateur précédent restée ouverte,
 *   connexion Firebase absente ou en cours), rien n'est affiché : jamais
 *   des dossiers obtenus avec les droits d'un autre compte.
 * - Toutes les pages sont parcourues (`nextOffset`), plus seulement les
 *   100 premiers dossiers.
 */
export async function fetchMirroredCasesForControlPanel(expectedEmail?: string): Promise<AlertRecord[]> {
  if (!isPhase4Configured()) return [];
  const expected = normalizeEmail(expectedEmail);
  if (!expected) return [];
  try {
    const { auth } = getPhase4Firebase();
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (normalizeEmail(auth.currentUser?.email) !== expected) return [];

    const { FirestoreCaseRepository } = await import('../data-access/firestoreCaseRepository');
    const repo = new FirestoreCaseRepository();
    const items: AlertRecord[] = [];
    let offset: number | undefined = 0;
    for (let page = 0; page < MAX_PAGES && offset !== undefined; page++) {
      const result = await repo.listCases({}, PLACEHOLDER_USER, FETCH_LIMIT, offset);
      items.push(...result.items.map(caseToAlertSummary));
      offset = result.nextOffset;
    }
    // La session a pu changer pendant les appels : on revérifie avant de rendre.
    if (normalizeEmail(auth.currentUser?.email) !== expected) return [];
    return items;
  } catch {
    return [];
  }
}

/**
 * === AMÉLIORATION AJOUTÉE (revue PR #139) ===
 * Fusionne dossiers locaux et résumés du vrai backend sans doublon : un
 * résumé dont le dossier est déjà présent localement (lien
 * `mirroredCaseId`, posé après un miroir réussi) est écarté — le dossier
 * local, plus complet, est conservé.
 */
export function mergeMirroredCases(local: AlertRecord[], mirrored: AlertRecord[]): AlertRecord[] {
  if (mirrored.length === 0) return local;
  const linked = new Set(local.filter((a) => a.mirroredCaseId).map((a) => caseSummaryId(a.mirroredCaseId as string)));
  return [...local, ...mirrored.filter((m) => !linked.has(m.id))];
}
