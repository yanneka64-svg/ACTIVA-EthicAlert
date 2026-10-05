/**
 * === AMÉLIORATION AJOUTÉE (diagnostic Firebase en lecture seule) ===
 *
 * Lancé par .github/workflows/firebase-diagnostics.yml (manuel, main
 * uniquement). Affiche dans le journal du workflow, SANS RIEN MODIFIER :
 * - le nombre de dossiers et les 15 plus récents (numéros, statut, pays,
 *   entité, confidentialité, date, attribution oui/non) — jamais la
 *   description des faits ni les personnes citées ;
 * - les réservations de numéros de suivi récentes (external_references) ;
 * - les comptes du personnel (identifiant, rôle, périmètre, actif) — jamais
 *   d'adresse e-mail ni de mot de passe ;
 * - les compteurs anti-abus de dépôt (rate_limits create_*).
 * Sert à vérifier qu'un signalement externe est bien arrivé dans Firebase
 * et qui peut le voir.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'activa-ethicalert-47246';
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || 'default');

async function main() {
  const casesCount = (await db.collection('cases').count().get()).data().count;
  console.log(`\n=== Dossiers (cases) : ${casesCount} au total ===`);
  const recent = await db.collection('cases').orderBy('createdAt', 'desc').limit(15).get();
  for (const d of recent.docs) {
    const c = d.data();
    console.log(
      [
        c.createdAt,
        c.caseNumber,
        `ref=${c.externalReference ?? '-'}`,
        `statut=${c.status}`,
        `pays=${c.country}`,
        `entité=${c.entity}`,
        `conf=${c.confidentialityLevel}`,
        `par=${c.createdBy === 'reporter' ? 'déclarant' : 'personnel'}`,
        `attribué=${c.assignee ? 'oui' : 'non'}`,
      ].join(' | ')
    );
  }

  const refs = await db.collection('external_references').orderBy('createdAt', 'desc').limit(10).get();
  console.log(`\n=== Numéros de suivi réservés (10 derniers) ===`);
  for (const d of refs.docs) console.log(`${d.id} -> ${d.data().caseId} (${d.data().createdAt})`);

  const staff = await db.collection('staff_users').get();
  console.log(`\n=== Comptes du personnel : ${staff.size} ===`);
  for (const d of staff.docs) {
    const s = d.data();
    console.log(
      [
        s.username,
        `rôle=${s.role}`,
        `pays=${(s.countries ?? []).join(',') || 'tous'}`,
        `entités=${(s.entities ?? []).join(',') || 'toutes'}`,
        `actif=${s.active !== false ? 'oui' : 'non'}`,
      ].join(' | ')
    );
  }

  // Appel anonyme de chaque fonction (corps vide) : 400/401/403 en JSON =
  // la fonction est joignable et répond elle-même ; 403 en HTML (« Forbidden »)
  // = Cloud Run bloque l'appel avant la fonction (droit d'invocation absent).
  console.log(`\n=== Fonctions joignables depuis un navigateur ? ===`);
  const names = [
    'createCaseAsReporter',
    'getCaseForReporter',
    'addCommunicationAsReporter',
    'listCases',
    'getCaseDetails',
    'assignCase',
    'getMyStaffProfile',
    'listStaffDirectory',
  ];
  for (const name of names) {
    try {
      const res = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      });
      const text = await res.text();
      const blocked = !text.trim().startsWith('{');
      console.log(`${name} : HTTP ${res.status} ${blocked ? 'BLOQUÉE par Cloud Run (droit d’invocation absent)' : 'joignable'}`);
    } catch (e) {
      console.log(`${name} : erreur réseau ${e instanceof Error ? e.message : e}`);
    }
  }

  const limits = await db.collection('rate_limits').get();
  const creates = limits.docs.filter((d) => d.id.startsWith('create_'));
  console.log(`\n=== Compteurs de dépôt (anti-abus) : ${creates.length} ===`);
  for (const d of creates.slice(0, 10)) {
    const r = d.data();
    console.log(`count=${r.count} depuis ${r.windowStart ? new Date(r.windowStart).toISOString() : '-'}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('Diagnostic impossible :', e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
