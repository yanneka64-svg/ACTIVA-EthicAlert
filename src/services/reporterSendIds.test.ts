/** === AMÉLIORATION AJOUTÉE (envoi rejouable sans doublon) === */
import { describe, expect, it } from 'vitest';
import { clearSendId, isTransientCallableError, newClientSendId, sendIdFor } from './reporterCloudAccess';

describe('identifiants d’envoi du déclarant', () => {
  it('format accepté par le serveur (8 à 64 caractères sûrs)', () => {
    expect(newClientSendId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('même contenu renvoyé après un échec → même identifiant (pas de doublon)', () => {
    const a = sendIdFor('k1', 1000);
    expect(sendIdFor('k1', 2000)).toBe(a);
    expect(sendIdFor('k2', 2000)).not.toBe(a);
  });

  it('nouvel identifiant après un envoi réussi, ou après 10 minutes', () => {
    const a = sendIdFor('k3', 1000);
    clearSendId('k3');
    const b = sendIdFor('k3', 1000);
    expect(b).not.toBe(a);
    expect(sendIdFor('k3', 1000 + 11 * 60 * 1000)).not.toBe(b);
  });

  it('seules les erreurs passagères sont rejouées', () => {
    expect(isTransientCallableError({ code: 'functions/deadline-exceeded' })).toBe(true);
    expect(isTransientCallableError({ code: 'functions/unavailable' })).toBe(true);
    expect(isTransientCallableError({ code: 'functions/permission-denied' })).toBe(false);
    expect(isTransientCallableError(new Error('x'))).toBe(false);
  });
});
