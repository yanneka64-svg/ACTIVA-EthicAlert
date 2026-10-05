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
import { createHash } from 'node:crypto';
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
    const [persons, evidence, risks, identity, comms] = await Promise.all([
      d.ref.collection('persons').count().get(),
      d.ref.collection('evidence').count().get(),
      d.ref.collection('risk_assessments').count().get(),
      db.collection('reporter_identities').doc(d.id).get(),
      // === AMÉLIORATION AJOUTÉE (messagerie) === expéditeur et heure seulement, jamais le contenu.
      d.ref.collection('communications').get(),
    ]);
    console.log(
      `    ↳ dates=${c.incidentDate ? 'oui' : 'non'} | lieu=${c.incidentLocation ? 'oui' : 'non'} | impact=${c.impactType ? 'oui' : 'non'} | priorité=${c.priority} | score=${c.riskScore} | personnes=${persons.data().count} | pièces=${evidence.data().count} | évaluations=${risks.data().count} | identité=${identity.exists ? 'oui' : 'non'} | échéance=${c.slaDueAt ? 'oui' : 'non'}`
    );
    const msgs = comms.docs.map((m) => m.data()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    console.log(`    ↳ messages=${msgs.length}${msgs.map((m) => ` [${m.createdAt} ${m.sender}]`).join('')}`);
    // === AMÉLIORATION AJOUTÉE (documents du déclarant) === intégrité des
    // documents stockés par morceaux : taille et empreinte SHA-256 recalculées
    // depuis les morceaux (aucun nom ni contenu affiché).
    const evDocs = await d.ref.collection('evidence').get();
    for (const ev of evDocs.docs) {
      const e = ev.data();
      if (!String(e.storagePath ?? '').startsWith('firestore:')) continue;
      const chunks = await d.ref.collection('evidence_chunks').where('evidenceId', '==', ev.id).get();
      const buf = Buffer.concat(
        chunks.docs
          .map((x) => x.data() as { index: number; data: Uint8Array })
          .sort((a, b) => a.index - b.index)
          .map((x) => Buffer.from(x.data))
      );
      const sha = createHash('sha256').update(buf).digest('hex');
      const linked = msgs.some((m) => (m.attachmentFiles ?? []).some((a: { evidenceId?: string }) => a.evidenceId === ev.id));
      console.log(
        `    ↳ document ${ev.id} [${e.createdAt}] type=${e.fileType} taille=${e.fileSize} morceaux=${chunks.size} reconstitué=${buf.length} empreinte=${sha === e.sha256Hash ? 'OK' : 'DIFFÉRENTE'} message=${linked ? 'oui' : 'non'}`
      );
    }
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
    // === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur) ===
    'applyPortalUpdate',
    'addSubmissionEvidenceAsReporter',
    'addEvidenceAsStaff',
    'getPortalConfig',
    'savePortalConfig',
    'recordPortalAudit',
    'listAuditLogs',
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
  const services = ['listcases', 'getcasedetails', 'getmystaffprofile', 'liststaffdirectory', 'createcaseasreporter', 'addcommunication', 'getcaseforreporter', 'addcommunicationasreporter'];
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

// === AMÉLIORATION AJOUTÉE (inventaire avant mise en production) ===
/**
 * Points de préparation à la production, en lecture seule : sauvegardes
 * Firestore, réglages d'envoi des e-mails (domaine d'expédition, jamais la
 * clé), notifications configurées (nombre d'adresses, jamais les adresses),
 * résultats d'envoi récents, supervision, double authentification, budget
 * des fonctions. Chaque contrôle indique « impossible » sans bloquer les
 * autres si le compte du workflow n'a pas le droit de lire l'information.
 */
async function readinessDiagnostics() {
  console.log(`\n=== Préparation à la production ===`);
  let token = '';
  try {
    token = (await applicationDefault().getAccessToken()).access_token ?? '';
  } catch (e) {
    console.log(`jeton indisponible : ${e instanceof Error ? e.message : e}`);
  }
  const getJson = async (url: string): Promise<{ status: number; body: any }> => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': projectId } });
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    return { status: res.status, body };
  };
  const line = (label: string, value: string) => console.log(`${label} : ${value}`);
  const dbId = process.env.FIRESTORE_DATABASE_ID || 'default';

  // 1. Sauvegardes Firestore
  try {
    const d = await getJson(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}`);
    if (d.status === 200) {
      line('Restauration à la seconde (PITR)', d.body.pointInTimeRecoveryEnablement ?? '?');
      line('Protection contre la suppression de la base', d.body.deleteProtectionState ?? '?');
      line('Emplacement de la base', d.body.locationId ?? '?');
    } else line('Configuration de la base', `impossible (HTTP ${d.status} ${d.body?.error?.message?.slice(0, 160) ?? ''})`);
    const b = await getJson(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/backupSchedules`);
    if (b.status === 200) {
      const list = (b.body.backupSchedules ?? []) as any[];
      line('Sauvegardes programmées', list.length ? list.map((x) => `${x.dailyRecurrence ? 'quotidienne' : x.weeklyRecurrence ? 'hebdomadaire' : '?'} (conservée ${x.retention})`).join(', ') : 'AUCUNE');
    } else line('Sauvegardes programmées', `impossible (HTTP ${b.status} ${b.body?.error?.message?.slice(0, 160) ?? ''})`);
  } catch (e) {
    line('Sauvegardes', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 2. Réglages des fonctions (variables non secrètes)
  try {
    const r = await getJson(`https://run.googleapis.com/v2/projects/${projectId}/locations/us-central1/services/applyportalupdate`);
    if (r.status === 200) {
      const env = ((r.body.template?.containers ?? [])[0]?.env ?? []) as { name: string; value?: string; valueSource?: unknown }[];
      const val = (n: string) => env.find((x) => x.name === n);
      const from = val('NOTIFY_FROM_EMAIL')?.value ?? '';
      const fromDomain = from.match(/@([^>\s]+)/)?.[1] ?? '';
      line("Adresse d'expédition des e-mails", from ? `définie (domaine ${fromDomain || '?'})` : 'NON définie → expéditeur de test onboarding@resend.dev');
      line('Domaines de destinataires autorisés', val('NOTIFY_ALLOWED_RECIPIENT_DOMAINS')?.value || '(défaut group-activa.com)');
      line('Clé Resend', val('RESEND_API_KEY') ? 'présente (secret)' : 'ABSENTE');
      line('App Check imposé', val('ENFORCE_APP_CHECK')?.value || 'non');
      line('Lien du portail dans les e-mails', val('NOTIFY_APP_URL')?.value || '(défaut)');
      const scaling = r.body.template?.scaling ?? {};
      line('Instances (min / max) de applyPortalUpdate', `${scaling.minInstanceCount ?? 0} / ${scaling.maxInstanceCount ?? '?'}`);
    } else line('Réglages des fonctions', `impossible (HTTP ${r.status} ${r.body?.error?.message?.slice(0, 160) ?? ''})`);
  } catch (e) {
    line('Réglages des fonctions', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 3. Notifications configurées (comptes et nombre d'adresses, jamais les adresses)
  try {
    const cfg = await db.collection('config').doc('portal').get();
    const raw = (cfg.data() ?? {}).sections?.emailNotifications;
    let value: any = null;
    try {
      value = typeof raw === 'string' ? JSON.parse(raw) : null;
    } catch {
      value = null;
    }
    const sections = Object.keys((cfg.data() ?? {}).sections ?? {});
    line('Sections de configuration partagées', sections.length ? sections.join(', ') : 'AUCUNE (chaque poste garde sa configuration locale)');
    if (!value?.groups) line('Notifications e-mail', 'réglages par défaut (jamais enregistrés depuis l’administration)');
    else {
      for (const g of value.groups as any[]) {
        line(`Notifications — ${g.id}`, `${g.enabled === false ? 'DÉSACTIVÉ' : 'activé'}, ${(g.roles ?? []).length} rôle(s), ${(g.extraEmails ?? []).length} adresse(s) saisie(s)`);
      }
    }
    const staff = await db.collection('staff_users').get();
    const withEmail = staff.docs.filter((d) => /@/.test(String(d.data().email ?? '')) && d.data().active !== false);
    line('Comptes actifs avec une adresse e-mail réelle', `${withEmail.length} / ${staff.size}`);
  } catch (e) {
    line('Notifications e-mail', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 4. Résultats d'envoi des 30 derniers jours
  try {
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    for (const action of ['EMAIL_NOTIFICATION_SENT', 'EMAIL_NOTIFICATION_FAILED', 'EMAIL_TEST_SENT']) {
      const q = await db.collection('audit_logs').where('action', '==', action).get();
      const recent = q.docs.filter((d) => String(d.data().timestamp ?? d.data().createdAt ?? '') >= since);
      line(`Audit ${action} (30 j)`, String(recent.length));
      if (action === 'EMAIL_NOTIFICATION_FAILED' && recent.length) {
        const last = recent.map((d) => d.data()).sort((a, b) => String(b.timestamp ?? b.createdAt).localeCompare(String(a.timestamp ?? a.createdAt)))[0];
        const reason = JSON.stringify(last.newValue ?? last.details ?? '').replace(/[\w.+-]+@[\w.-]+/g, '<adresse>').slice(0, 300);
        line('  dernier échec', reason);
      }
      if (action === 'EMAIL_TEST_SENT' && recent.length) {
        const results = recent.flatMap((d) => (Array.isArray(d.data().newValue) ? d.data().newValue : [])) as { ok?: boolean }[];
        line('  essais réussis / total', `${results.filter((x) => x.ok).length} / ${results.length}`);
      }
    }
  } catch (e) {
    line('Résultats d’envoi', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 5. Supervision et alertes
  try {
    const a = await getJson(`https://monitoring.googleapis.com/v3/projects/${projectId}/alertPolicies`);
    line('Règles d’alerte (Cloud Monitoring)', a.status === 200 ? String((a.body.alertPolicies ?? []).length) : `impossible (HTTP ${a.status})`);
    const u = await getJson(`https://monitoring.googleapis.com/v3/projects/${projectId}/uptimeCheckConfigs`);
    line('Tests de disponibilité', u.status === 200 ? String((u.body.uptimeCheckConfigs ?? []).length) : `impossible (HTTP ${u.status})`);
  } catch (e) {
    line('Supervision', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 6. Authentification du personnel
  try {
    const c = await getJson(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`);
    if (c.status === 200) {
      line('Double authentification (MFA)', c.body.mfa?.state ?? 'DISABLED');
      line('Politique de mots de passe', c.body.passwordPolicyConfig?.passwordPolicyEnforcementState ?? 'non configurée');
      line('Inscription publique de comptes', c.body.signIn?.email?.enabled ? 'connexion e-mail active' : 'connexion e-mail inactive');
      line('Identity Platform (requis pour la MFA)', c.body.subtype ?? '?');
    } else line('Authentification', `impossible (HTTP ${c.status} ${c.body?.error?.message?.slice(0, 160) ?? ''})`);
  } catch (e) {
    line('Authentification', `erreur ${e instanceof Error ? e.message : e}`);
  }

  // 7. Domaines du site
  try {
    const h = await getJson(`https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${projectId}/customDomains`);
    if (h.status === 200) {
      const doms = (h.body.customDomains ?? []) as any[];
      line('Domaines personnalisés', doms.length ? doms.map((d) => `${d.name?.split('/').pop()} (${d.hostState ?? '?'} / ${d.ownershipState ?? '?'} / certificat ${d.cert?.state ?? '?'})`).join(', ') : 'aucun (site sur *.web.app)');
    } else line('Domaines personnalisés', `impossible (HTTP ${h.status})`);
  } catch (e) {
    line('Domaines', `erreur ${e instanceof Error ? e.message : e}`);
  }
}

main()
  .then(() => functionLogs().catch((e) => console.log(`journaux : ${e instanceof Error ? e.message : e}`)))
  .then(() => appCheckDiagnostics())
  // === AMÉLIORATION AJOUTÉE (inventaire avant mise en production) ===
  .then(() => readinessDiagnostics().catch((e) => console.log(`préparation : ${e instanceof Error ? e.message : e}`)))
  .then(
  () => process.exit(0),
  (e) => {
    console.error('Diagnostic impossible :', e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
