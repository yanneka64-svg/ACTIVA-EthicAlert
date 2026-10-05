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
// === AMÉLIORATION AJOUTÉE (diagnostic boîte de réception) ===
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.GCLOUD_PROJECT || 'activa-ethicalert-47246';
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || 'default');

// === AMÉLIORATION AJOUTÉE (diagnostic boîte de réception) ===
/**
 * Pour un compte du personnel : droits portés par sa session Firebase
 * (claims), puis appel RÉEL de listCases / getCaseDetails avec ces droits
 * (jeton personnalisé → jeton d'identité). Lecture seule : aucune donnée
 * de dossier n'est affichée, seulement des numéros et des comptes.
 */
async function staffProbe(uid: string, username: string): Promise<void> {
  try {
    const user = await getAuth(app).getUser(uid);
    const c = (user.customClaims ?? {}) as Record<string, unknown>;
    console.log(
      `    ↳ session Firebase : rôle=${c.role ?? 'AUCUN'} | pays=${JSON.stringify(c.countries ?? null)} | entités=${JSON.stringify(c.entities ?? null)} | mdp temporaire=${c.pwdTemp === true ? 'OUI (fonctions bloquées)' : 'non'} | désactivé=${user.disabled ? 'OUI' : 'non'} | dernière connexion=${user.metadata.lastSignInTime ?? '-'}`
    );
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) return;
    let idToken: string;
    try {
      const custom = await getAuth(app).createCustomToken(uid);
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      });
      const body = (await res.json()) as { idToken?: string; error?: { message?: string } };
      if (!body.idToken) {
        console.log(`    ↳ test serveur impossible (connexion) : ${body.error?.message ?? res.status}`);
        return;
      }
      idToken = body.idToken;
    } catch (e) {
      console.log(`    ↳ test serveur impossible (jeton) : ${e instanceof Error ? e.message.slice(0, 200) : e}`);
      return;
    }
    const call = async (name: string, data: unknown) => {
      const res = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ data }),
      });
      return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> };
    };
    const list = await call('listCases', { filter: {}, limit: 100, offset: 0 });
    if (list.status !== 200) {
      console.log(`    ↳ listCases (${username}) : HTTP ${list.status} ${JSON.stringify(list.body.error ?? list.body).slice(0, 300)}`);
      return;
    }
    const items = (list.body.result?.items ?? []) as { caseId: string; caseNumber: string; externalReference?: string }[];
    console.log(`    ↳ listCases (${username}) : ${items.length} dossier(s) visibles — ${items.map((i) => i.externalReference || i.caseNumber).join(', ') || 'aucun'}`);
    if (!items.length) return;
    const details = await call('getCaseDetails', { caseIds: items.map((i) => i.caseId).slice(0, 50) });
    if (details.status !== 200) {
      console.log(`    ↳ getCaseDetails : HTTP ${details.status} ${JSON.stringify(details.body.error ?? details.body).slice(0, 300)}`);
      return;
    }
    console.log(`    ↳ getCaseDetails : ${(details.body.result?.details ?? []).length} détail(s) renvoyé(s)`);
  } catch (e) {
    console.log(`    ↳ diagnostic du compte impossible : ${e instanceof Error ? e.message.slice(0, 200) : e}`);
  }
}

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
    // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) === contenu
    // détaillé réellement stocké (comptes uniquement, aucune donnée personnelle).
    const [persons, evidence, risks, identity] = await Promise.all([
      d.ref.collection('persons').count().get(),
      d.ref.collection('evidence').count().get(),
      d.ref.collection('risk_assessments').count().get(),
      db.collection('reporter_identities').doc(d.id).get(),
    ]);
    console.log(
      `    ↳ dates=${c.incidentDate ? 'oui' : 'non'} | lieu=${c.incidentLocation ? 'oui' : 'non'} | impact=${c.impactType ? 'oui' : 'non'} | priorité=${c.priority} | score=${c.riskScore} | personnes=${persons.data().count} | pièces=${evidence.data().count} | évaluations=${risks.data().count} | identité=${identity.exists ? 'oui' : 'non'} | échéance=${c.slaDueAt ? 'oui' : 'non'}`
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
    // === AMÉLIORATION AJOUTÉE (diagnostic boîte de réception) === droits
    // réellement portés par la session Firebase du compte, puis ce que le
    // serveur lui renvoie (listCases / getCaseDetails), en lecture seule.
    await staffProbe(d.id, s.username);
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

// === AMÉLIORATION AJOUTÉE (diagnostic App Check) ===
// Vérifie, sans rien modifier, chaque réglage dont dépend l'échange du jeton
// reCAPTCHA contre un jeton App Check (erreur 403 vue dans le navigateur).
// N'affiche jamais la clé API ; la clé de site reCAPTCHA est publique (elle
// figure dans le code du site).
async function appCheckDiagnostics() {
  console.log(`\n=== App Check ===`);
  const appId = process.env.FIREBASE_APP_ID || '';
  const apiKey = process.env.FIREBASE_API_KEY || '';
  const siteKey = (process.env.APPCHECK_SITE_KEY || '').trim();
  console.log(`Clé de site utilisée par le site : ${siteKey || '(aucune)'}`);
  let token = '';
  try {
    token = (await applicationDefault().getAccessToken()).access_token;
  } catch (e) {
    console.log(`Jeton Google indisponible : ${e instanceof Error ? e.message : e}`);
  }
  const get = async (label: string, url: string) => {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': projectId } });
      const body = await res.text();
      // La clé de site est un secret GitHub : le journal la masquerait.
      // On indique donc explicitement si elle figure dans la réponse.
      const mentionsSiteKey = siteKey ? body.includes(siteKey) : false;
      console.log(`${label} : HTTP ${res.status}${siteKey ? ` [clé de site du site ${mentionsSiteKey ? 'PRÉSENTE' : 'absente'}]` : ''} ${body.replace(/\s+/g, ' ').slice(0, 900)}`);
    } catch (e) {
      console.log(`${label} : erreur ${e instanceof Error ? e.message : e}`);
    }
  };
  await get('API App Check activée ?', `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/firebaseappcheck.googleapis.com`);
  await get('API reCAPTCHA Enterprise activée ?', `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/recaptchaenterprise.googleapis.com`);
  if (appId) {
    await get('App Check → reCAPTCHA Enterprise', `https://firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}/recaptchaEnterpriseConfig`);
    await get('App Check → reCAPTCHA v3', `https://firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}/recaptchaV3Config`);
  } else {
    console.log('FIREBASE_APP_ID absent : configuration App Check non lue.');
  }
  await get('Clés reCAPTCHA Enterprise du projet', `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/keys`);
  await get('Clés API du projet (restrictions)', `https://apikeys.googleapis.com/v2/projects/${projectId}/locations/global/keys`);
  if (apiKey && appId) {
    // Échange avec un faux jeton reCAPTCHA, comme le ferait le navigateur :
    // « invalid token » = tout est bien câblé ; « API key / service blocked /
    // disabled / not configured » = réglage à corriger.
    try {
      const res = await fetch(
        `https://firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}:exchangeRecaptchaEnterpriseToken?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Referer: `https://${projectId}.web.app/` },
          body: JSON.stringify({ recaptchaEnterpriseToken: 'diagnostic-invalid-token' }),
        }
      );
      const body = (await res.text()).split(apiKey).join('***');
      console.log(`Échange de jeton (faux jeton, comme le navigateur) : HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 700)}`);
    } catch (e) {
      console.log(`Échange de jeton : erreur ${e instanceof Error ? e.message : e}`);
    }
  }
}

// === AMÉLIORATION AJOUTÉE (diagnostic boîte de réception) ===
/**
 * Journaux Cloud Logging des fonctions lues par le portail (2 dernières
 * heures) : chaque appel reçu (heure, code HTTP) et chaque erreur. Montre
 * si le navigateur d'un membre du personnel appelle bien listCases /
 * getCaseDetails, et ce que le serveur répond.
 */
async function functionLogs() {
  console.log(`\n=== Journaux des fonctions du portail (2 h) ===`);
  let token = '';
  try {
    token = (await applicationDefault().getAccessToken()).access_token ?? '';
  } catch (e) {
    console.log(`jeton indisponible : ${e instanceof Error ? e.message : e}`);
    return;
  }
  const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const services = ['listcases', 'getcasedetails', 'getmystaffprofile', 'liststaffdirectory', 'createcaseasreporter'];
  const filter = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name=(${services.map((x) => `"${x}"`).join(' OR ')})`,
    `timestamp>="${since}"`,
  ].join(' AND ');
  const res = await fetch('https://logging.googleapis.com/v2/entries:list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resourceNames: [`projects/${projectId}`], filter, orderBy: 'timestamp desc', pageSize: 120 }),
  });
  const body = (await res.json()) as { entries?: any[]; error?: { message?: string } };
  if (!res.ok) {
    console.log(`lecture des journaux impossible : HTTP ${res.status} ${body.error?.message?.slice(0, 200) ?? ''}`);
    return;
  }
  const entries = body.entries ?? [];
  if (!entries.length) {
    console.log('aucune entrée');
    return;
  }
  for (const e of entries.reverse()) {
    const svc = e.resource?.labels?.service_name ?? '?';
    if (e.httpRequest) {
      console.log(`${e.timestamp} | ${svc} | HTTP ${e.httpRequest.status} | ${e.httpRequest.latency ?? ''}`);
    } else if ((e.severity ?? '') !== 'DEFAULT' && (e.severity ?? '') !== 'INFO' && (e.severity ?? '') !== 'DEBUG') {
      const msg = e.textPayload ?? e.jsonPayload?.message ?? JSON.stringify(e.jsonPayload ?? {});
      console.log(`${e.timestamp} | ${svc} | ${e.severity} | ${String(msg).replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }
}

main()
  .then(() => functionLogs().catch((e) => console.log(`journaux : ${e instanceof Error ? e.message : e}`)))
  .then(() => appCheckDiagnostics())
  .then(
  () => process.exit(0),
  (e) => {
    console.error('Diagnostic impossible :', e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
