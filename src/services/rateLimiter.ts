/**
 * === AMÉLIORATION AJOUTÉE : limitation du débit (rate limiting) des tentatives d'accès ===
 *
 * Lightweight client-side throttle for the anonymous case-tracking login form.
 * After MAX_ATTEMPTS consecutive failures for a given tracking number, further
 * attempts are locked out for LOCKOUT_MS.
 *
 * SECURITY NOTE: because this counter lives in the browser's localStorage, a
 * determined attacker can reset it (clearing site data, private browsing, a
 * different browser/device). It still meaningfully slows down casual brute
 * forcing and scripted attempts from the same browser session, but true
 * rate limiting must ultimately be enforced server-side (Cloud Functions /
 * Firestore security rules with a server-tracked attempt counter).
 */

const STORAGE_KEY = 'activa_login_attempts_v1';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

interface AttemptRecord {
  count: number;
  lockedUntil?: number;
}

function readStore(): Record<string, AttemptRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, AttemptRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore persistence errors (e.g. private browsing quota) — fail open on storage,
    // never fail closed on availability for the whistleblower.
  }
}

export interface LockStatus {
  locked: boolean;
  remainingMs: number;
  attemptsRemaining: number;
}

/** Returns the current lock status for a given identifier (e.g. tracking number) without recording an attempt. */
export function getLockStatus(key: string): LockStatus {
  const store = readStore();
  const rec = store[key.trim().toUpperCase()];
  if (!rec) return { locked: false, remainingMs: 0, attemptsRemaining: MAX_ATTEMPTS };

  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: rec.lockedUntil - Date.now(), attemptsRemaining: 0 };
  }
  return { locked: false, remainingMs: 0, attemptsRemaining: Math.max(0, MAX_ATTEMPTS - rec.count) };
}

/** Records a failed attempt and locks the identifier out once the threshold is reached. */
export function recordFailedAttempt(key: string): LockStatus {
  const normalized = key.trim().toUpperCase();
  const store = readStore();
  const rec = store[normalized] || { count: 0 };

  // If a previous lock has expired, start counting fresh.
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
    rec.count = 0;
    rec.lockedUntil = undefined;
  }

  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
  }

  store[normalized] = rec;
  writeStore(store);
  return getLockStatus(normalized);
}

/** Clears the attempt counter after a successful login. */
export function clearAttempts(key: string): void {
  const normalized = key.trim().toUpperCase();
  const store = readStore();
  if (store[normalized]) {
    delete store[normalized];
    writeStore(store);
  }
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}
