/**
 * === AMÉLIORATION AJOUTÉE (correctif App Check — requêtes « non validées ») ===
 * App Check doit être initialisé AVANT getAuth()/getFirestore() : les
 * appelants font `void activateAppCheck(app)` puis créent Auth/Firestore
 * immédiatement. Ce test verrouille que l'initialisation est SYNCHRONE
 * (aucun `await` avant initializeAppCheck). Aucun appel réseau réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirebaseApp } from 'firebase/app';

const mockInitializeAppCheck = vi.fn();
const mockGetToken = vi.fn();

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  ReCaptchaEnterpriseProvider: class {
    constructor(public siteKey: string) {}
  },
}));

const fakeApp = () => ({ name: 'test-' + Math.random() }) as unknown as FirebaseApp;

async function loadModule() {
  vi.resetModules();
  return import('./appCheck');
}

beforeEach(() => {
  mockInitializeAppCheck.mockReset().mockReturnValue({ fake: 'instance' });
  mockGetToken.mockReset();
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('activateAppCheck', () => {
  it('initialise App Check de façon synchrone, avant tout autre service', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key');
    const { activateAppCheck } = await loadModule();
    const app = fakeApp();

    const pending = activateAppCheck(app);
    // Pas encore de `await` : l'initialisation doit déjà avoir eu lieu.
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck.mock.calls[0][0]).toBe(app);
    expect(mockInitializeAppCheck.mock.calls[0][1]).toMatchObject({ isTokenAutoRefreshEnabled: true });
    await expect(pending).resolves.toBe(true);
  });

  it("n'initialise qu'une fois par application", async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key');
    const { activateAppCheck } = await loadModule();
    const app = fakeApp();
    await activateAppCheck(app);
    await expect(activateAppCheck(app)).resolves.toBe(false);
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it('reste dormant sans clé de site', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '');
    const { activateAppCheck, getAppCheckToken } = await loadModule();
    const app = fakeApp();
    await expect(activateAppCheck(app)).resolves.toBe(false);
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    await expect(getAppCheckToken(app)).resolves.toBeNull();
  });

  it("ne lève jamais si l'initialisation échoue", async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key');
    mockInitializeAppCheck.mockImplementation(() => {
      throw new Error('boom');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { activateAppCheck, getAppCheckToken } = await loadModule();
    const app = fakeApp();
    await expect(activateAppCheck(app)).resolves.toBe(false);
    await expect(getAppCheckToken(app)).resolves.toBeNull();
    warn.mockRestore();
  });
});

describe('getAppCheckToken', () => {
  it("renvoie le jeton de l'instance activée", async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key');
    mockGetToken.mockResolvedValue({ token: 'tok-123' });
    const { activateAppCheck, getAppCheckToken } = await loadModule();
    const app = fakeApp();
    await activateAppCheck(app);
    await expect(getAppCheckToken(app)).resolves.toBe('tok-123');
    expect(mockGetToken).toHaveBeenCalledWith({ fake: 'instance' }, false);
  });

  it('renvoie null si le jeton est refusé (ex. 403 attestation)', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key');
    mockGetToken.mockRejectedValue(new Error('appCheck/fetch-status-error 403'));
    const { activateAppCheck, getAppCheckToken } = await loadModule();
    const app = fakeApp();
    await activateAppCheck(app);
    await expect(getAppCheckToken(app)).resolves.toBeNull();
  });
});
