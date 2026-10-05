/**
 * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
 *
 * Charge les dossiers enregistrés dans Firebase et visibles par le compte
 * connecté, puis les place dans storage.ts : tous les écrans du portail
 * (Boîte de réception, À attribuer, Mes dossiers, fiche dossier, recherche,
 * rapports…) les voient alors comme les dossiers locaux. C'est ce qui fait
 * arriver chez l'opérateur une alerte déposée depuis n'importe quel poste.
 *
 * Déroulé :
 * 1. `listCases` (toutes les pages) : dossiers visibles, mêmes règles que le
 *    serveur (mis en cause exclu, périmètre, confidentialité, attribution) ;
 * 2. `getCaseDetails` par lots de 50 : détail complet de chaque dossier ;
 * 3. conversion (domain/caseDetailToAlert.ts) et remplacement de la copie
 *    locale (storage.replaceCloudImportedAlerts).
 *
 * Un dossier créé dans CE navigateur et déjà lié à Firebase
 * (`mirroredCaseId`, sans `cloudImported`) n'est pas rechargé : la copie
 * locale reste la référence, ses modifications partent déjà vers Firebase.
 *
 * Les actions faites ensuite sur un dossier chargé passent par les miroirs
 * existants (attribution, statut, tâches, notes…) grâce à `mirroredCaseId`,
 * et la synchronisation suivante reflète l'état serveur.
 *
 * Ne lève jamais : `null` si Firebase n'est pas configuré, si aucune
 * session Firebase ne correspond au compte connecté, ou en cas d'erreur
 * (la copie locale est alors laissée telle quelle).
 */
import { AlertRecord, UserProfile } from '../types';
import { AppUser } from '../domain/caseTypes';
import { CaseDetail, caseDetailToAlertRecord } from '../domain/caseDetailToAlert';
import { caseSummaryId } from '../domain/caseToAlertSummary';
import { getPhase4Firebase, getPhase4Functions, isPhase4Configured } from './firebaseClient';
import { storage } from './storage';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const DETAILS_BATCH = 50;

// listCases déduit l'appelant du jeton vérifié côté serveur ; cet objet ne
// sert qu'à satisfaire la signature du dépôt (même usage que
// controlPanelCloudSync.ts).
const PLACEHOLDER_USER: AppUser = {
  userId: '',
  name: 'Synchronisation',
  email: '',
  roleId: 'functional_admin',
  countries: [],
  entities: [],
  active: true,
  mfaEnabled: false,
  createdAt: new Date(0).toISOString(),
};

/** La session Firebase ouverte dans ce navigateur est-elle bien celle du compte connecté au portail ? */
async function sessionMatches(activeUser: UserProfile): Promise<boolean> {
  const { auth } = getPhase4Firebase();
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  const current = auth.currentUser;
  if (!current) return false;
  if (activeUser.authSource === 'firebase') return current.uid === activeUser.id;
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
  return !!norm(activeUser.email) && norm(current.email) === norm(activeUser.email);
}

/** Délai pendant lequel une modification locale prime sur une version Firebase plus ancienne. */
const LOCAL_EDIT_GRACE_MS = 90 * 1000;

/** Vrai si la copie locale a été modifiée il y a moins de LOCAL_EDIT_GRACE_MS et après la version Firebase. */
export function isFreshLocalEdit(localUpdatedAt: string | undefined, cloudUpdatedAt: string | undefined, now: number): boolean {
  const local = Date.parse(localUpdatedAt ?? '');
  const cloud = Date.parse(cloudUpdatedAt ?? '');
  if (Number.isNaN(local)) return false;
  return now - local < LOCAL_EDIT_GRACE_MS && (Number.isNaN(cloud) || local > cloud);
}

let inFlight: Promise<number | null> | null = null;

/** Synchronise les dossiers Firebase visibles par `activeUser`. Renvoie le nombre de dossiers chargés, ou `null`. */
export function syncCloudCases(activeUser: UserProfile): Promise<number | null> {
  if (!isPhase4Configured() || !activeUser || activeUser.role === 'reporter') return Promise.resolve(null);
  if (inFlight) return inFlight;
  inFlight = run(activeUser).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(activeUser: UserProfile): Promise<number | null> {
  try {
    if (!(await sessionMatches(activeUser))) return null;

    const { FirestoreCaseRepository } = await import('../data-access/firestoreCaseRepository');
    const repo = new FirestoreCaseRepository();
    const caseIds: string[] = [];
    let offset: number | undefined = 0;
    for (let page = 0; page < MAX_PAGES && offset !== undefined; page++) {
      const result = await repo.listCases({}, PLACEHOLDER_USER, PAGE_SIZE, offset);
      caseIds.push(...result.items.map((c) => c.caseId));
      offset = result.nextOffset;
    }

    // Dossiers créés dans ce navigateur et déjà liés : la copie locale reste la référence.
    const localAlerts = storage.getAlerts();
    const ownedLocally = new Set(localAlerts.filter((a) => !a.cloudImported && a.mirroredCaseId).map((a) => a.mirroredCaseId as string));
    const toLoad = caseIds.filter((id) => !ownedLocally.has(id));

    const { httpsCallable } = await import('firebase/functions');
    const getCaseDetails = httpsCallable<{ caseIds: string[] }, { details: CaseDetail[] }>(await getPhase4Functions(), 'getCaseDetails');
    const details: CaseDetail[] = [];
    for (let i = 0; i < toLoad.length; i += DETAILS_BATCH) {
      const res = await getCaseDetails({ caseIds: toLoad.slice(i, i + DETAILS_BATCH) });
      details.push(...res.data.details);
    }

    // La session a pu changer pendant les appels (déconnexion, autre compte).
    if (!(await sessionMatches(activeUser))) return null;

    const users = storage.getUsers();
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name;
    const existingById = new Map<string, AlertRecord>(localAlerts.map((a) => [a.id, a]));
    const now = Date.now();
    const records = details.map((d) => {
      const existing = existingById.get(caseSummaryId(d.case.caseId));
      // Modification locale toute récente, pas encore visible côté Firebase
      // (miroir en cours) : on garde la copie locale jusqu'au prochain passage
      // plutôt que de faire réapparaître l'ancien état quelques secondes.
      if (existing && isFreshLocalEdit(existing.updatedAt, d.case.updatedAt, now)) return existing;
      return caseDetailToAlertRecord(d, existing, nameOf);
    });
    storage.replaceCloudImportedAlerts(records);
    return records.length;
  } catch {
    return null;
  }
}
