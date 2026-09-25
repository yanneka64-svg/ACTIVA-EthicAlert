/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 6 : synchronisation
 * best-effort, plafonnée, de la session Firebase Auth réelle du personnel) ===
 *
 * Ferme la boucle laissée ouverte par la Phase 5 : `controlPanelCloudSync.ts`
 * appelle `listCases` (Cloud Function), qui exige un jeton Firebase Auth réel
 * (`requireAppUser` côté serveur) — mais personne n'est aujourd'hui réellement
 * connecté à Firebase Auth, donc cet appel échoue systématiquement
 * (`unauthenticated`), capturé et traité comme "non configuré". Ce module
 * tente, en arrière-plan et sans jamais bloquer ni modifier le login local
 * (`storage.verifyStaffLogin`, toujours la seule source de vérité pour
 * `onLogin`), d'établir EN PLUS une session Firebase Auth réelle avec les
 * mêmes identifiants — via `staffAuth.ts` (Phase 2), qui partage la même
 * instance Firebase nommée que `CaseLookup.tsx` et que
 * `FirestoreCaseRepository`/`getPhase4Functions()` (Phase 3/5). Dès qu'une
 * telle tentative réussit, le jeton réel est automatiquement porté par tous
 * les appels `httpsCallable` suivants (y compris `listCases`) — aucun autre
 * câblage n'est nécessaire pour que la Phase 5 cesse d'être un no-op.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi ceci échoue silencieusement aujourd'hui,
 * même une fois les Cloud Functions déployées ===
 * Le mot de passe local (haché/salé, `services/crypto.ts`, propre à
 * `storage.ts`) et le mot de passe réel du compte Firebase Auth (temporaire,
 * généré aléatoirement par `scripts/setupAuthUsers.ts`, jamais stocké) sont
 * deux systèmes de mots de passe totalement indépendants — la tentative ci-
 * dessous échouera donc presque toujours tant qu'aucune synchronisation des
 * deux mots de passe n'a été mise en place (hors périmètre de cette phase).
 * C'est un no-op honnête de plus, pour une raison différente de celle de la
 * Phase 5 mais avec le même résultat observable.
 *
 * === AMÉLIORATION AJOUTÉE : pourquoi une seule tentative par compte et par
 * navigateur (jamais à chaque connexion locale) ===
 * Firebase Auth limite les tentatives de connexion échouées par compte
 * (`auth/too-many-requests`). Tenter systématiquement une connexion Firebase
 * Auth réelle à CHAQUE connexion locale (potentiellement plusieurs fois par
 * jour et par utilisateur) risquerait, avec un mot de passe qui ne
 * correspondra presque jamais (voir ci-dessus), de finir par bloquer le
 * compte côté Firebase Auth — ce qui casserait `CaseLookup.tsx` ("Suivre mon
 * signalement"), le seul flux Firebase Auth déjà réellement utilisé en
 * production aujourd'hui par ce même compte. Interdit par la règle "ne
 * jamais casser l'existant". La mémorisation ci-dessous (localStorage, même
 * motif que `rateLimiter.ts`) plafonne donc le coût total à une tentative par
 * (compte, navigateur) — jamais répétée, y compris après un échec.
 */
import { isStaffAuthConfigured, signInStaff, signOutStaff } from './staffAuth';

const STORAGE_KEY = 'activa_staff_authsync_attempted_v1';

function readAttempted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // Échec de lecture (quota, navigation privée…) : par prudence, on se
    // comporte comme si tout avait déjà été tenté plutôt que de risquer des
    // tentatives répétées non plafonnées — voir note ci-dessus sur le risque
    // de blocage Firebase Auth.
    return ['*'];
  }
}

function markAttempted(email: string): void {
  try {
    const attempted = readAttempted();
    if (attempted.includes('*') || attempted.includes(email)) return;
    attempted.push(email);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempted));
  } catch {
    // Ignore — au pire une tentative de plus sera faite plus tard, jamais
    // moins sûr que l'absence totale de plafonnement.
  }
}

function hasAttempted(email: string): boolean {
  const attempted = readAttempted();
  return attempted.includes('*') || attempted.includes(email);
}

/**
 * Toujours résout (jamais de rejet) — best-effort pur. Ne fait rien si
 * Firebase n'est pas configuré, si l'email est vide, ou si ce compte a déjà
 * été tenté dans ce navigateur (voir note plafonnement ci-dessus).
 */
export async function syncStaffAuthSession(email: string, password: string): Promise<void> {
  if (!isStaffAuthConfigured() || !email) return;
  if (hasAttempted(email)) return;
  // Marqué AVANT la tentative : même une erreur inattendue (réseau, etc.)
  // ne doit jamais autoriser une seconde tentative pour ce compte.
  markAttempted(email);
  try {
    await signInStaff(email, password);
  } catch {
    // Attendu aujourd'hui dans l'écrasante majorité des cas — voir l'en-tête
    // de ce fichier. Aucune UI, aucun blocage de la connexion locale.
  }
}

/**
 * Déconnexion best-effort de la session Firebase Auth réelle éventuellement
 * établie ci-dessus — appelée à chaque déconnexion locale (App.tsx) pour
 * qu'une session réelle laissée ouverte par un précédent utilisateur du même
 * navigateur ne fuite jamais vers le compte local suivant. Toujours résout.
 */
export async function clearStaffAuthSession(): Promise<void> {
  if (!isStaffAuthConfigured()) return;
  try {
    await signOutStaff();
  } catch {
    // Ignore — pas de session réelle à fermer, ou déjà fermée.
  }
}
