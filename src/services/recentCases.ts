/**
 * === AMÉLIORATION AJOUTÉE (accueil des espaces — « Derniers dossiers consultés ») ===
 *
 * Mémorise, par compte et sur ce navigateur uniquement, les numéros des
 * derniers dossiers ouverts (fiche dossier). Aucune donnée du dossier n'est
 * conservée ici : seulement le numéro et la date d'ouverture. À l'affichage,
 * la liste est toujours recoupée avec les dossiers que le compte a le droit
 * de voir (computeVisibleAlerts) : un dossier devenu inaccessible (personne
 * mise en cause, réattribution…) disparaît aussitôt.
 */
const KEY_PREFIX = 'activa.recentCases.';
const MAX_ENTRIES = 5;

export interface RecentCaseEntry {
  trackingNumber: string;
  viewedAt: string;
}

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Derniers dossiers consultés par ce compte, du plus récent au plus ancien. */
export function getRecentCases(userId: string): RecentCaseEntry[] {
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((e): e is RecentCaseEntry => !!e && typeof e.trackingNumber === 'string' && typeof e.viewedAt === 'string')
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Ajoute (ou remonte en tête) un dossier ouvert. N'échoue jamais. */
export function recordRecentCase(userId: string, trackingNumber: string, now: Date = new Date()): void {
  const ref = String(trackingNumber || '').trim();
  if (!userId || !ref) return;
  try {
    const next = [{ trackingNumber: ref, viewedAt: now.toISOString() }, ...getRecentCases(userId).filter((e) => e.trackingNumber !== ref)].slice(
      0,
      MAX_ENTRIES
    );
    window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* stockage indisponible (navigation privée, quota) : rien à mémoriser */
  }
}
