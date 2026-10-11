// === AMÉLIORATION AJOUTÉE (tests sur émulateurs dans la CI) ===
// Faux service d'envoi d'e-mails (remplace Resend pendant les tests) : chaque
// e-mail reçu est ajouté, une ligne JSON par e-mail, au fichier passé en
// argument. Aucun e-mail réel n'est jamais envoyé.
// Usage : node scripts/devops/fakeResend.mjs /chemin/sent.jsonl
import { appendFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const capture = process.argv[2];
if (!capture) throw new Error('Fichier de capture requis.');
writeFileSync(capture, '');
createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      /* corps illisible : enregistré vide */
    }
    const to = Array.isArray(body.to) ? body.to : [body.to];
    appendFileSync(capture, JSON.stringify({ to, subject: body.subject ?? '', text: body.text ?? '' }) + '\n');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"id":"fake"}');
  });
}).listen(5555, '127.0.0.1');
