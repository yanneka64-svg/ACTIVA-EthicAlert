// === AMÉLIORATION AJOUTÉE (autotest d'envoi depuis un appareil) ===
(function () {
  var PROJECT = 'activa-ethicalert-47246';
  var TARGETS = [
    { id: 'site', label: "Adresse du site (chemin normal)", url: '/createCaseAsReporter' },
    { id: 'direct', label: 'Adresse directe des fonctions', url: 'https://us-central1-' + PROJECT + '.cloudfunctions.net/createCaseAsReporter' },
  ];

  function row(t) {
    var el = document.createElement('div');
    el.className = 'row run';
    el.id = 'row-' + t.id;
    el.innerHTML = '<span class="dot"></span><div><div class="label"></div><div class="detail">Test en cours…</div></div>';
    el.querySelector('.label').textContent = t.label;
    return el;
  }

  function probe(t) {
    var started = Date.now();
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(t.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.text().then(function (body) {
          var reached = body.indexOf('INVALID_ARGUMENT') !== -1;
          return { ok: reached, detail: reached ? 'Serveur joint (' + (Date.now() - started) + ' ms)' : 'Réponse inattendue : HTTP ' + res.status };
        });
      })
      .catch(function (e) {
        return { ok: false, detail: 'Injoignable : ' + ((e && (e.name + ' ' + e.message)) || 'erreur réseau') };
      })
      .then(function (r) { clearTimeout(timer); return r; });
  }

  function run() {
    var box = document.getElementById('checks');
    var verdict = document.getElementById('verdict');
    box.innerHTML = '';
    verdict.className = '';
    verdict.textContent = '';
    TARGETS.forEach(function (t) { box.appendChild(row(t)); });
    var results = {};
    Promise.all(TARGETS.map(function (t) {
      return probe(t).then(function (r) {
        results[t.id] = r.ok;
        var el = document.getElementById('row-' + t.id);
        el.className = 'row ' + (r.ok ? 'ok' : 'ko');
        el.querySelector('.detail').textContent = r.detail;
      });
    })).then(function () {
      if (results.site) {
        verdict.className = 'good';
        verdict.textContent = results.direct
          ? 'Tout est en ordre : cet appareil transmet les signalements normalement.'
          : "Cet appareil transmet les signalements par l'adresse du site. Son réseau bloque l'adresse directe des fonctions : c'est ce qui empêchait l'envoi avant la correction.";
      } else {
        verdict.className = 'bad';
        verdict.textContent = "Cet appareil n'atteint pas le serveur. Faites une capture de cet écran et transmettez-la à l'administrateur.";
      }
    });
    var c = navigator.connection || {};
    document.getElementById('meta').textContent =
      new Date().toLocaleString('fr-FR') + ' · ' + (navigator.onLine ? 'en ligne' : 'hors ligne') +
      (c.effectiveType ? ' · réseau ' + c.effectiveType : '') + ' · ' + navigator.userAgent;
  }

  document.getElementById('again').addEventListener('click', run);
  run();
})();
