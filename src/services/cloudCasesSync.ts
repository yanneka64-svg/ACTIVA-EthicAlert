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
import { AlertRecord, CaseMessage, UserProfile } from '../types';
import { AppUser, Case } from '../domain/caseTypes';
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

// === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
// Empreinte (`updatedAt` + `lastActivityAt`) de chaque dossier au moment de
// son dernier chargement complet : un dossier inchangé n'est plus rechargé
// (getCaseDetails) à chaque synchronisation. Rechargement complet de
// sécurité toutes les 10 minutes.
const FINGERPRINTS_KEY = 'activa_cloud_case_fingerprints_v1';
const FULL_REFRESH_MS = 10 * 60 * 1000;
// Démarre « à jour » : à la connexion, une copie locale déjà présente
// (empreintes enregistrées) évite de tout recharger ; le rechargement
// complet de sécurité a lieu 10 minutes plus tard.
let lastFullRefresh = Date.now();

/** Empreinte de version d'un dossier Firebase (change à chaque action sur le dossier). */
export function caseFingerprint(kase: { updatedAt?: string; lastActivityAt?: string }): string {
  return `${kase.updatedAt ?? ''}|${kase.lastActivityAt ?? ''}`;
}

/**
 * Dossiers dont le détail doit être (re)chargé : nouveaux, modifiés depuis
 * le dernier chargement, ou absents de la copie locale. Pur et testable.
 */
export function casesNeedingDetails(
  listed: { caseId: string; updatedAt?: string; lastActivityAt?: string }[],
  fingerprints: Record<string, string>,
  hasLocalCopy: (caseId: string) => boolean,
  forceAll: boolean
): string[] {
  return listed
    .filter((c) => forceAll || !hasLocalCopy(c.caseId) || fingerprints[c.caseId] !== caseFingerprint(c))
    .map((c) => c.caseId);
}

function readFingerprints(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FINGERPRINTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFingerprints(map: Record<string, string>): void {
  try {
    localStorage.setItem(FINGERPRINTS_KEY, JSON.stringify(map));
  } catch {
    /* stockage indisponible : simple perte d'optimisation */
  }
}

/** Plus récente des deux dates d'un dossier Firebase (un message ne change que `lastActivityAt`). */
export function latestCloudStamp(kase: { updatedAt?: string; lastActivityAt?: string }): string | undefined {
  const a = kase.updatedAt ?? '';
  const b = kase.lastActivityAt ?? '';
  return (a > b ? a : b) || undefined;
}

/** Messages du déclarant présents dans le détail Firebase, au format du portail. */
export function reporterMessagesFromDetail(d: CaseDetail): CaseMessage[] {
  return d.communications
    .filter((c) => c.sender === 'reporter')
    .map((c) => ({ id: c.messageId, sender: 'whistleblower' as const, senderDisplayName: c.senderDisplayName, content: c.content, createdAt: c.createdAt }));
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
    // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) === dossiers listés (avec leur version).
    const listed: Case[] = [];
    let offset: number | undefined = 0;
    for (let page = 0; page < MAX_PAGES && offset !== undefined; page++) {
      const result = await repo.listCases({}, PLACEHOLDER_USER, PAGE_SIZE, offset);
      caseIds.push(...result.items.map((c) => c.caseId));
      listed.push(...result.items);
      offset = result.nextOffset;
    }

    // Dossiers créés dans ce navigateur et déjà liés : la copie locale reste la référence.
    const localAlerts = storage.getAlerts();
    const ownedLocally = new Set(localAlerts.filter((a) => !a.cloudImported && a.mirroredCaseId).map((a) => a.mirroredCaseId as string));
    // === AMÉLIORATION AJOUTÉE (correctif — pagination sans fin) === sans doublon.
    const toLoad = Array.from(new Set(caseIds)).filter((id) => !ownedLocally.has(id));
    // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) === seuls les
    // dossiers nouveaux ou modifiés sont rechargés ; les autres reprennent
    // leur copie locale déjà à jour.
    const now0 = Date.now();
    const forceAll = now0 - lastFullRefresh > FULL_REFRESH_MS;
    const fingerprints = readFingerprints();
    const localById = new Map<string, AlertRecord>(localAlerts.map((a) => [a.id, a]));
    const toLoadSet = new Set(toLoad);
    const listedToLoad = listed.filter((c) => toLoadSet.has(c.caseId));
    const stale = new Set(
      casesNeedingDetails(listedToLoad, fingerprints, (id) => localById.get(caseSummaryId(id))?.cloudImported === true, forceAll)
    );
    const unchanged = toLoad.filter((id) => !stale.has(id));
    // === AMÉLIORATION AJOUTÉE (messagerie déclarant → équipe) === dossiers
    // créés dans CE navigateur : copie locale toujours la référence, mais
    // leurs nouvelles réponses du déclarant (enregistrées sur le serveur)
    // doivent y apparaître. Rechargés seulement s'ils ont changé.
    const listedOwned = listed.filter((c) => ownedLocally.has(c.caseId));
    const ownedStale = casesNeedingDetails(listedOwned, fingerprints, () => true, forceAll);

    const { httpsCallable } = await import('firebase/functions');
    const getCaseDetails = httpsCallable<{ caseIds: string[] }, { details: CaseDetail[] }>(await getPhase4Functions(), 'getCaseDetails');
    const details: CaseDetail[] = [];
    const staleIds = [...toLoad.filter((id) => stale.has(id)), ...ownedStale];
    for (let i = 0; i < staleIds.length; i += DETAILS_BATCH) {
      const res = await getCaseDetails({ caseIds: staleIds.slice(i, i + DETAILS_BATCH) });
      details.push(...res.data.details);
    }

    // La session a pu changer pendant les appels (déconnexion, autre compte).
    if (!(await sessionMatches(activeUser))) return null;

    const users = storage.getUsers();
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name;
    const existingById = new Map<string, AlertRecord>(localAlerts.map((a) => [a.id, a]));
    const now = Date.now();
    // === AMÉLIORATION AJOUTÉE (messagerie déclarant → équipe) === dossiers
    // créés dans ce navigateur : on y ajoute seulement les messages du
    // déclarant venus du serveur (jamais de doublon des messages de l'équipe).
    const ownedSet = new Set(ownedStale);
    const ownedByCaseId = new Map(localAlerts.filter((a) => !a.cloudImported && a.mirroredCaseId).map((a) => [a.mirroredCaseId as string, a]));
    for (const d of details.filter((x) => ownedSet.has(x.case.caseId))) {
      const local = ownedByCaseId.get(d.case.caseId);
      if (local) storage.mergeReporterMessagesFromCloud(local.id, reporterMessagesFromDetail(d));
    }
    // Dossiers dont la copie locale a été gardée (modification locale toute
    // récente) : leur empreinte n'est PAS enregistrée, pour qu'ils soient
    // rechargés au passage suivant (sinon une réponse arrivée entre-temps
    // n'apparaissait qu'au rechargement complet, 10 minutes plus tard).
    const keptLocal = new Set<string>();
    const records = details.filter((d) => !ownedSet.has(d.case.caseId)).map((d) => {
      const existing = existingById.get(caseSummaryId(d.case.caseId));
      // Modification locale toute récente, pas encore visible côté Firebase
      // (miroir en cours) : on garde la copie locale jusqu'au prochain passage
      // plutôt que de faire réapparaître l'ancien état quelques secondes.
      // === AMÉLIORATION AJOUTÉE (messagerie) === comparée à la DERNIÈRE
      // activité du dossier (un message ne change pas `updatedAt`).
      if (existing && isFreshLocalEdit(existing.updatedAt, latestCloudStamp(d.case), now)) {
        keptLocal.add(d.case.caseId);
        return existing;
      }
      return caseDetailToAlertRecord(d, existing, nameOf);
    });
    // === AMÉLIORATION AJOUTÉE (chargement rapide du portail) === dossiers
    // inchangés : copie locale reprise telle quelle (même ordre que la liste).
    const fresh = new Map(records.map((r) => [r.id, r]));
    const allRecords: AlertRecord[] = [];
    for (const id of toLoad) {
      const rid = caseSummaryId(id);
      const rec = fresh.get(rid) ?? (unchanged.includes(id) ? existingById.get(rid) : undefined);
      if (rec) allRecords.push(rec);
    }
    storage.replaceCloudImportedAlerts(allRecords);
    const nextFingerprints: Record<string, string> = {};
    for (const c of listedToLoad) {
      if (keptLocal.has(c.caseId)) continue;
      if (fresh.has(caseSummaryId(c.caseId)) || unchanged.includes(c.caseId)) nextFingerprints[c.caseId] = caseFingerprint(c);
    }
    // === AMÉLIORATION AJOUTÉE (messagerie déclarant → équipe) ===
    const loadedOwned = new Set(details.map((d) => d.case.caseId));
    for (const c of listedOwned) {
      if (loadedOwned.has(c.caseId) || !ownedSet.has(c.caseId)) nextFingerprints[c.caseId] = caseFingerprint(c);
    }
    writeFingerprints(nextFingerprints);
    if (forceAll) lastFullRefresh = now0;
    return allRecords.length;
  } catch {
    return null;
  }
}
