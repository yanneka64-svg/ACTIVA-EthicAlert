/**
 * === AMÉLIORATION AJOUTÉE (correctif — synchronisation Firestore) ===
 *
 * Firestore refuse tout document contenant une valeur `undefined`
 * (« Function setDoc() called with invalid data. Unsupported field value:
 * undefined »). Or les objets locaux en contiennent légitimement : champs
 * optionnels de `AlertRecord`, `alertId`/`trackingNumber` absents d'une
 * entrée d'audit de configuration, etc. Résultat : chaque tentative de
 * synchronisation échouait avant même d'atteindre le serveur.
 *
 * Copie profonde qui retire les propriétés `undefined` des objets (même
 * sémantique que l'option Firestore `ignoreUndefinedProperties`) et
 * remplace un élément `undefined` de tableau par `null` (les positions sont
 * conservées). Les fonctions sont ignorées. L'objet d'origine n'est jamais
 * modifié : l'état local (localStorage) reste strictement identique.
 */
export function toFirestoreData<T>(value: T): T {
  return sanitize(value) as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined || typeof item === 'function' ? null : sanitize(item)));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined || typeof v === 'function') continue;
      out[key] = sanitize(v);
    }
    return out;
  }
  // Primitives, Date, Timestamp, etc. : transmis tels quels.
  return value;
}
