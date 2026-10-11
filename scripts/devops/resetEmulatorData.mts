/**
 * === AMÉLIORATION AJOUTÉE (tests sur émulateurs dans la CI) ===
 * Efface toutes les données des émulateurs (base Firestore `default` et
 * comptes Auth) entre deux scénarios : chaque scénario part d'une base vide
 * et ne dépend jamais des comptes ou dossiers créés par un autre.
 * Seule exception : la clé de signature des sessions déclarant
 * (`system/reporter_session`), que les fonctions déjà démarrées gardent en
 * mémoire — elle est remise telle quelle après l'effacement.
 * N'agit QUE sur les émulateurs locaux (127.0.0.1), jamais sur un vrai projet.
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = 'demo-activa';
const db = getFirestore(initializeApp({ projectId: PROJECT }), 'default');
const keep = await db.collection('system').doc('reporter_session').get();

const targets = [
  `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/default/documents`,
  `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`,
];
for (const url of targets) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Effacement impossible (${res.status}) : ${url}`);
}
if (keep.exists) await db.collection('system').doc('reporter_session').set(keep.data()!);
console.log('Données des émulateurs effacées.');
