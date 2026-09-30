/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 2 : primitives
 * Firebase Auth réelles pour le personnel) ===
 *
 * Jusqu'ici, la SEULE connexion réelle à Firebase Auth de toute
 * l'application vivait dans `CaseLookup.tsx` (l'outil "Suivre mon
 * signalement" réservé au personnel, lecture d'un dossier par id connu).
 * Le reste du portail staff (`StaffLoginView.tsx`, tout `App.tsx`) reste
 * sur un login 100 % local (`storage.verifyStaffLogin`), sans aucun lien
 * avec Firebase Auth — documenté ainsi dans App.tsx.
 *
 * Ce module extrait le patron de connexion déjà écrit et déjà vérifié en
 * direct dans `CaseLookup.tsx` (email/mot de passe + lecture des
 * "custom claims" — role/countries/entities — posées par
 * `scripts/setupAuthUsers.ts`) en primitives réutilisables, pour que
 * d'autres écrans du personnel (à commencer par un futur remplacement de
 * `StaffLoginView.tsx`, phase ultérieure) puissent s'y brancher sans
 * dupliquer cette logique.
 *
 * **Volontairement PAS branché à `StaffLoginView.tsx` dans cette phase** :
 * le login local doit continuer à fonctionner exactement comme aujourd'hui
 * tant que l'activation réelle du backend n'a pas eu lieu (voir le plan —
 * Cloud Functions non déployées, comptes Firebase Auth réels aujourd'hui
 * obsolètes puisque `INITIAL_USERS`, dont ils étaient provisionnés, a été
 * vidé depuis). Réutilise la même instance Firebase nommée que
 * `CaseLookup.tsx` (`services/firebaseClient.ts`, "Phase 4") plutôt que
 * d'en créer une troisième : ce sont les mêmes comptes réels, la même
 * authentification.
 *
 * Pas de test dédié ici, cohérent avec `services/firebase.ts`/
 * `services/firebaseClient.ts` (déjà sans test) : ce module n'est qu'un fin
 * wrapper d'appels SDK Firebase (E/S réelle, non mockée dans ce projet) — la
 * logique métier qui compte (mapping rôle → permissions) est ailleurs, déjà
 * testée (`domain/permissions.test.ts`).
 */
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  Unsubscribe,
  User as FirebaseUser,
} from 'firebase/auth';

import { RoleId } from '../domain/caseTypes';
import { getPhase4Firebase, isPhase4Configured } from './firebaseClient';

/** Les "custom claims" posées sur le compte Firebase Auth réel par scripts/setupAuthUsers.ts. */
export interface StaffClaims {
  role?: RoleId;
  countries?: string[];
  entities?: string[];
  /** Trace vers l'id du compte local (services/storage.ts) — jamais utilisé pour autoriser quoi que ce soit ici. */
  legacyRole?: string;
}

/** True si une configuration Firebase valide (VITE_FIREBASE_*) est présente. */
export function isStaffAuthConfigured(): boolean {
  return isPhase4Configured();
}

/** Lit les custom claims du compte connecté — `null` si absentes/illisibles (jamais une exception qui casserait l'appelant). */
export async function getStaffClaims(user: FirebaseUser): Promise<StaffClaims | null> {
  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims as StaffClaims;
  } catch {
    return null;
  }
}

/**
 * S'abonne à l'état de connexion réel + ses claims, même patron que
 * `CaseLookup.tsx` (onAuthStateChanged -> getIdTokenResult). Retourne la
 * fonction de désabonnement Firebase telle quelle.
 */
export function onStaffAuthStateChanged(
  callback: (user: FirebaseUser | null, claims: StaffClaims | null) => void
): Unsubscribe {
  const { auth } = getPhase4Firebase();
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    callback(user, await getStaffClaims(user));
  });
}

/** Connexion réelle par e-mail/mot de passe contre le projet Firebase Auth réel. Laisse toute erreur remonter à l'appelant. */
export async function signInStaff(email: string, password: string): Promise<FirebaseUser> {
  const { auth } = getPhase4Firebase();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/** Déconnexion réelle du compte Firebase Auth actif. */
export async function signOutStaff(): Promise<void> {
  const { auth } = getPhase4Firebase();
  await signOut(auth);
}
