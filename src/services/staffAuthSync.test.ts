/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 6) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * casesCloudSync.test.ts / controlPanelCloudSync.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestLocalStorage } from '../data-access/testLocalStorageStub';

const mockIsStaffAuthConfigured = vi.fn();
const mockSignInStaff = vi.fn();
const mockSignOutStaff = vi.fn();

vi.mock('./staffAuth', () => ({
  isStaffAuthConfigured: () => mockIsStaffAuthConfigured(),
  signInStaff: (...args: unknown[]) => mockSignInStaff(...args),
  signOutStaff: (...args: unknown[]) => mockSignOutStaff(...args),
}));

import { clearStaffAuthSession, syncStaffAuthSession } from './staffAuthSync';

beforeEach(() => {
  mockIsStaffAuthConfigured.mockReset();
  mockSignInStaff.mockReset();
  mockSignOutStaff.mockReset();
  // localStorage est absent de l'environnement Vitest par défaut de ce
  // projet (pas de jsdom) — même polyfill en mémoire que
  // data-access/*.test.ts (voir testLocalStorageStub.ts), réinstallé à
  // chaque test pour repartir d'un stockage vide.
  installTestLocalStorage();
});

describe('syncStaffAuthSession', () => {
  it("ne tente rien si Firebase n'est pas configuré", async () => {
    mockIsStaffAuthConfigured.mockReturnValue(false);
    await syncStaffAuthSession('op@activa.example', 'secret123');
    expect(mockSignInStaff).not.toHaveBeenCalled();
  });

  it("ne tente rien si l'email est vide", async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    await syncStaffAuthSession('', 'secret123');
    expect(mockSignInStaff).not.toHaveBeenCalled();
  });

  it('tente une connexion réelle avec les mêmes identifiants la première fois', async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignInStaff.mockResolvedValue({ uid: 'abc' });
    await syncStaffAuthSession('op@activa.example', 'secret123');
    expect(mockSignInStaff).toHaveBeenCalledWith('op@activa.example', 'secret123');
  });

  it("ne rejette jamais, même si la connexion réelle échoue (cas attendu aujourd'hui)", async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignInStaff.mockRejectedValue(new Error('auth/wrong-password'));
    await expect(syncStaffAuthSession('op@activa.example', 'secret123')).resolves.toBeUndefined();
  });

  it('ne retente jamais pour le même compte dans le même navigateur, même après un échec', async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignInStaff.mockRejectedValue(new Error('auth/wrong-password'));

    await syncStaffAuthSession('op@activa.example', 'secret123');
    await syncStaffAuthSession('op@activa.example', 'autre-mot-de-passe');

    expect(mockSignInStaff).toHaveBeenCalledTimes(1);
  });

  it('plafonne indépendamment par compte (un autre email peut toujours être tenté)', async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignInStaff.mockRejectedValue(new Error('auth/wrong-password'));

    await syncStaffAuthSession('op@activa.example', 'secret123');
    await syncStaffAuthSession('autre@activa.example', 'secret456');

    expect(mockSignInStaff).toHaveBeenCalledTimes(2);
  });
});

describe('clearStaffAuthSession', () => {
  it("ne tente rien si Firebase n'est pas configuré", async () => {
    mockIsStaffAuthConfigured.mockReturnValue(false);
    await clearStaffAuthSession();
    expect(mockSignOutStaff).not.toHaveBeenCalled();
  });

  it('déconnecte la session réelle si configuré', async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignOutStaff.mockResolvedValue(undefined);
    await clearStaffAuthSession();
    expect(mockSignOutStaff).toHaveBeenCalled();
  });

  it('ne rejette jamais, même si la déconnexion échoue', async () => {
    mockIsStaffAuthConfigured.mockReturnValue(true);
    mockSignOutStaff.mockRejectedValue(new Error('network'));
    await expect(clearStaffAuthSession()).resolves.toBeUndefined();
  });
});
