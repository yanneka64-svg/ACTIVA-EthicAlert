/**
 * === AMÉLIORATION AJOUTÉE (suppression des dossiers de TEST automatiques) ===
 *
 * Lancé par .github/workflows/firebase-delete-test-cases.yml (manuel, main
 * uniquement). Supprime de Firestore les dossiers créés par les tests
 * automatiques de dépôt (scripts/e2e_public_submission.py), pour libérer
 * leurs numéros de suivi.
 *
 * Garde-fous :
 * - seuls les numéros de suivi passés dans TEST_REFS sont considérés ;
 * - un dossier n'est supprimé QUE si sa description commence par
 *   « [TEST AUTOMATIQUE] » (jamais un vrai signalement, même mal désigné) ;
 * - DRY_RUN=1 (défaut) : affiche ce qui serait supprimé, ne touche à rien ;
 * - chaque suppression est inscrite dans audit_logs (la piste d'audit est
 *   conservée, jamais effacée).
 *
 * === AMÉLIORATION AJOUTÉE (purge des dossiers de test saisis à la main) ===
 * ALLOW_UNMARKED=1 : accepte aussi des dossiers SANS le marqueur (dossiers
 * de recette saisis à la main dans le formulaire public), à condition que
 * chaque numéro soit RETAPÉ à l'identique dans CONFIRM_REFS (double saisie,
 * contre la faute de frappe). Affiche pour contrôle : statut, date, pays,
 * entité, nombre de messages et de pièces — jamais le contenu des faits.
 *
 * Supprimé pour chaque dossier : le dossier et toutes ses sous-collections,
 * ses identifiants de suivi (reporter_credentials), l'identité éventuelle
 * (reporter_identities), les réservations de numéro (external_references)
 * et les dépôts rejouables (reporter_submissions) qui pointent vers lui.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'activa-ethicalert-47246';
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || 'default');

const TEST_MARKER = '[TEST AUTOMATIQUE]';
const dryRun = process.env.DRY_RUN !== '0';
// === AMÉLIORATION AJOUTÉE (purge des dossiers de test saisis à la main) ===
const allowUnmarked = process.env.ALLOW_UNMARKED === '1';
const confirmRefs = new Set(
  (process.env.CONFIRM_REFS || '')
    .split(/[,\s]+/)
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean)
);
const refs = (process.env.TEST_REFS || '')
  .split(/[,\s]+/)
  .map((r) => r.trim().toUpperCase())
  .filter((r) => /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(r));

async function main() {
  console.log(`Mode : ${dryRun ? 'ESSAI À BLANC (rien n’est supprimé)' : 'SUPPRESSION RÉELLE'}`);
  if (!refs.length) throw new Error('Aucun numéro de suivi valide dans TEST_REFS.');
  if (allowUnmarked) {
    console.log('Dossiers SANS marqueur acceptés : chaque numéro doit être retapé à l’identique dans la confirmation.');
    const missing = refs.filter((r) => !confirmRefs.has(r));
    if (missing.length) throw new Error(`Confirmation incomplète : ${missing.join(', ')} non retapé(s). Rien n'est supprimé.`);
  }

  for (const ref of refs) {
    const reservation = await db.collection('external_references').doc(ref).get();
    if (!reservation.exists) {
      console.log(`${ref} : aucun dossier — ignoré`);
      continue;
    }
    const caseId = String(reservation.data()?.caseId ?? '');
    const caseRef = db.collection('cases').doc(caseId);
    const snap = await caseRef.get();
    const description = String(snap.data()?.description ?? '');
    const marked = description.startsWith(TEST_MARKER);
    if (!snap.exists || (!marked && !allowUnmarked)) {
      console.log(`${ref} : ${snap.exists ? 'PAS un dossier de test' : 'dossier introuvable'} — CONSERVÉ`);
      continue;
    }
    // === AMÉLIORATION AJOUTÉE (purge des dossiers de test saisis à la main) ===
    // Fiche de contrôle avant suppression (aucun contenu des faits).
    {
      const k = snap.data() ?? {};
      const msgs = (await caseRef.collection('communications').get()).size;
      const ev = (await caseRef.collection('evidence').get()).size;
      console.log(
        `${ref} : ${marked ? 'marqué [TEST AUTOMATIQUE]' : 'SANS marqueur (confirmé par double saisie)'} | créé ${k.createdAt ?? '?'} | statut ${k.status ?? '?'} | ${k.country ?? '?'} / ${k.entity ?? '?'} | messages ${msgs} | pièces ${ev}`
      );
    }

    const aliases = await db.collection('external_references').where('caseId', '==', caseId).get();
    const submissions = await db.collection('reporter_submissions').where('caseId', '==', caseId).get();
    const subcollections = await caseRef.listCollections();
    console.log(
      `${ref} → ${caseId} (${snap.data()?.caseNumber}) : dossier de test — sous-collections [${subcollections
        .map((c) => c.id)
        .join(', ')}], numéros [${aliases.docs.map((d) => d.id).join(', ')}], dépôts ${submissions.size}`
    );
    if (dryRun) continue;

    await db.recursiveDelete(caseRef);
    await db.collection('reporter_credentials').doc(caseId).delete();
    await db.collection('reporter_identities').doc(caseId).delete();
    for (const d of aliases.docs) await d.ref.delete();
    for (const d of submissions.docs) await d.ref.delete();
    const auditId = `audv2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db.collection('audit_logs').doc(auditId).set({
      id: auditId,
      actorId: 'maintenance',
      action: 'TEST_CASE_DELETED',
      caseId,
      objectType: 'case',
      objectId: caseId,
      reason: marked
        ? `Dossier de test automatique ${ref} supprimé à la demande de l'administrateur (libération du numéro).`
        : `Dossier de recette ${ref} (saisi à la main) supprimé avant la mise en production, à la demande de l'administrateur.`,
      timestamp: new Date().toISOString(),
    });
    console.log(`${ref} : SUPPRIMÉ`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
