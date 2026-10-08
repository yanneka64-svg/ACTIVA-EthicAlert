/**
 * === AMÉLIORATION AJOUTÉE (double authentification du personnel) ===
 *
 * Écrans de la double authentification par application (TOTP) :
 * - `StaffMfaSetup` : activation (QR code, clé de secours, code de
 *   confirmation). Utilisé après la connexion pour les rôles qui l'exigent
 *   (StaffLoginView) et depuis le menu du profil (StaffMfaDialog).
 * - `StaffMfaDialog` : fenêtre du menu du profil (état, activation,
 *   désactivation avec confirmation du mot de passe).
 * - `TotpCodeInput` : champ « code à 6 chiffres », partagé avec l'étape de
 *   vérification de l'écran de connexion.
 *
 * Toutes les opérations Firebase passent par `api` (services/staffMfa.ts),
 * ce qui permet de tester et de prévisualiser ces écrans sans projet réel.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Check, Copy, X } from 'lucide-react';

import { formatTotpSecret, isMfaRequiredForRole, isValidTotpCode, mfaErrorKind, normalizeTotpCode } from '../domain/mfaPolicy';
import type { MfaApi, TotpEnrollmentStart } from '../services/staffMfa';
import { errorCode } from '../services/staffMfa';

type T = Record<string, string>;

const INPUT =
  'w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white text-xs focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 outline-none';
// === AMÉLIORATION AJOUTÉE (version sobre, sur demande) === bouton simple, sans effets.
export const MFA_PRIMARY_BTN =
  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] enabled:hover:bg-[#134074] text-white text-xs font-bold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';
const PRIMARY_BTN = MFA_PRIMARY_BTN;

/** Message d'erreur lisible pour une erreur Firebase. */
export function mfaErrorMessage(t: T, e: unknown): string {
  switch (mfaErrorKind(errorCode(e))) {
    case 'invalid_code':
      return t.mfa_error_invalid_code;
    case 'wrong_password':
      return t.mfa_error_wrong_password;
    case 'too_many':
      return t.mfa_error_too_many;
    case 'not_enabled':
      return t.mfa_error_not_enabled;
    default:
      return t.mfa_error_unknown;
  }
}

function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="activa-enter text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
      {text}
    </p>
  );
}

/** Champ « code à 6 chiffres » : chiffres uniquement, gros caractères espacés. */
export function TotpCodeInput({
  id,
  value,
  onChange,
  label,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(normalizeTotpCode(e.target.value))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={14}
        autoFocus={autoFocus}
        placeholder="000000"
        className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold tracking-[0.3em] tabular-nums text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

/** QR code SVG généré dans le navigateur (aucune image externe). */
function QrCode({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return (
    <div
      className="w-44 h-44 mx-auto p-2 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm [&_svg]:w-full [&_svg]:h-full"
      role="img"
      aria-label="QR code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

type SetupStep = 'intro' | 'password' | 'scan' | 'done';

export function StaffMfaSetup({
  t,
  api,
  accountLabel,
  required,
  onDone,
  onUnavailable,
}: {
  t: T;
  api: MfaApi;
  accountLabel: string;
  required: boolean;
  /** Fin du parcours (« Accéder au portail » / « Fermer »). */
  onDone: () => void;
  /** La plateforme n'a pas encore activé la TOTP : l'appelant décide (ex. laisser passer). */
  onUnavailable?: () => void;
}) {
  const [step, setStep] = useState<SetupStep>(required ? 'scan' : 'intro');
  const [start, setStart] = useState<TotpEnrollmentStart | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const begin = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const s = await api.startTotpEnrollment(accountLabel);
      setStart(s);
      setStep('scan');
    } catch (e) {
      const kind = mfaErrorKind(errorCode(e));
      if (kind === 'recent_login') {
        setStep('password');
      } else if (kind === 'not_enabled' && onUnavailable) {
        onUnavailable();
      } else {
        setError(mfaErrorMessage(t, e));
        if (!required) setStep('intro');
      }
    } finally {
      setBusy(false);
    }
  }, [api, accountLabel, onUnavailable, required, t]);

  // Rôle qui l'exige : le QR code est préparé dès l'ouverture.
  useEffect(() => {
    if (required && !started.current) {
      started.current = true;
      void begin();
    }
  }, [required, begin]);

  const confirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.reauthenticate(password);
      setPassword('');
      setBusy(false);
      await begin();
    } catch (err) {
      setBusy(false);
      setError(mfaErrorMessage(t, err));
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !isValidTotpCode(code)) return;
    setError('');
    setBusy(true);
    try {
      await api.finishTotpEnrollment(start, code);
      // === AMÉLIORATION AJOUTÉE (version épurée) === pas d'écran de
      // confirmation : on entre directement (ou la fenêtre se ferme).
      onDone();
    } catch (err) {
      setError(mfaErrorMessage(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!start) return;
    try {
      await navigator.clipboard.writeText(start.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : la clé reste lisible à l'écran */
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center space-y-4" id="mfa-setup-done">
        <div>
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-700">
            <Check className="w-4 h-4" strokeWidth={2.5} /> {t.mfa_done_title}
          </p>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.mfa_done_body}</p>
        </div>
        <button type="button" id="btn-mfa-done" onClick={onDone} className={PRIMARY_BTN}>
          {required ? t.mfa_continue : t.mfa_close}
        </button>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="space-y-4" id="mfa-setup-intro">
        <p className="text-xs text-slate-600 leading-relaxed">{t.mfa_intro}</p>
        <ErrorNote text={error} />
        <button type="button" id="btn-mfa-start" onClick={() => void begin()} disabled={busy} className={PRIMARY_BTN}>
          {busy ? t.mfa_verifying : t.mfa_activate}
        </button>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <form onSubmit={confirmPassword} className="space-y-4" id="mfa-setup-password">
        <p className="text-xs text-slate-600 leading-relaxed">{t.mfa_password_prompt}</p>
        <div>
          <label htmlFor="input-mfa-password" className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
            {t.mfa_password_label}
          </label>
          <input id="input-mfa-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </div>
        <ErrorNote text={error} />
        <button type="submit" disabled={!password || busy} className={PRIMARY_BTN}>
          {busy ? t.mfa_verifying : t.mfa_password_submit}
        </button>
      </form>
    );
  }

  // step === 'scan' — === AMÉLIORATION AJOUTÉE (version sobre, sur demande) ===
  // une consigne, le QR code, le code, un bouton ; la clé manuelle est repliée.
  return (
    <form onSubmit={confirmCode} className="space-y-4" id="mfa-setup-scan">
      <p className="text-xs font-semibold text-slate-800 leading-relaxed">{t.mfa_step_scan}</p>
      {start ? (
        <QrCode text={start.uri} />
      ) : (
        <div className="w-44 h-44 mx-auto rounded-2xl bg-slate-100 animate-pulse" aria-hidden="true" />
      )}
      {start && (
        <details className="text-center">
          <summary className="cursor-pointer text-[11px] font-semibold text-blue-700 hover:underline">{t.mfa_manual}</summary>
          <div className="mt-2 flex items-center gap-2 text-left">
            <code id="mfa-secret-key" className="flex-1 min-w-0 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2.5 py-2 text-[11.5px] font-bold tracking-wider text-slate-800 break-all">
              {formatTotpSecret(start.key)}
            </code>
            <button type="button" onClick={() => void copyKey()} aria-label={t.mfa_copy} title={t.mfa_copy} className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg text-blue-700 ring-1 ring-slate-200 hover:bg-slate-50">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </details>
      )}
      <TotpCodeInput id="input-mfa-enroll-code" value={code} onChange={setCode} label={t.mfa_code_label} />
      <ErrorNote text={error} />
      <button type="submit" id="btn-mfa-confirm" disabled={!start || !isValidTotpCode(code) || busy} className={PRIMARY_BTN}>
        {busy ? t.mfa_verifying : t.mfa_confirm}
      </button>
    </form>
  );
}

type DialogStep = 'status' | 'disable_password' | 'disable_code' | 'setup';

/** Fenêtre « Double authentification » du menu du profil. */
export function StaffMfaDialog({
  t,
  api,
  lang,
  accountLabel,
  role,
  onClose,
}: {
  t: T;
  api: MfaApi;
  lang: string;
  accountLabel: string;
  role: string;
  onClose: () => void;
}) {
  const [enrollment, setEnrollment] = useState(() => api.currentEnrollment());
  const [step, setStep] = useState<DialogStep>(enrollment ? 'status' : 'setup');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const required = isMfaRequiredForRole(role);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finishDisable = async () => {
    await api.disableTotp();
    setEnrollment(null);
    setInfo(t.mfa_disabled_done);
    setStep('setup');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.reauthenticate(password);
      setPassword('');
      await finishDisable();
    } catch (err) {
      if (api.hasPendingChallenge()) {
        setPassword('');
        setStep('disable_code');
      } else {
        setError(mfaErrorMessage(t, err));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTotpCode(code)) return;
    setError('');
    setBusy(true);
    try {
      await api.resolveChallenge(code);
      setCode('');
      await finishDisable();
    } catch (err) {
      setError(mfaErrorMessage(t, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const since = enrollment?.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 bg-[#0B2A66]/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mfa-dialog-title" onClick={onClose}>
      <div className="activa-modal-in relative w-full max-w-sm max-h-full overflow-y-auto bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={t.mfa_close} className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
        <div className="mb-4 pr-8">
          <p id="mfa-dialog-title" className="text-base font-bold text-slate-900">Google Authenticator</p>
          <p className={`mt-0.5 text-xs font-semibold ${enrollment ? 'text-emerald-700' : 'text-slate-500'}`}>{enrollment ? t.mfa_status_on : t.mfa_status_off}</p>
        </div>

        {info && <p className="mb-4 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{info}</p>}

        {step === 'setup' && (
          <StaffMfaSetup
            t={t}
            api={api}
            accountLabel={accountLabel}
            required={false}
            onDone={() => {
              setEnrollment(api.currentEnrollment() ?? { enrolledAt: new Date().toISOString() });
              onClose();
            }}
          />
        )}

        {step === 'status' && (
          <div className="space-y-4" id="mfa-dialog-status">
            <p className="text-xs text-slate-600 leading-relaxed">{t.mfa_intro}</p>
            {since && <p className="text-xs font-semibold text-slate-800">{t.mfa_enabled_since.replace('{date}', since)}</p>}
            {required ? (
              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{t.mfa_disable_locked}</p>
            ) : (
              <button
                type="button"
                id="btn-mfa-disable"
                onClick={() => {
                  setError('');
                  setStep('disable_password');
                }}
                className="w-full rounded-xl px-4 py-2.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 bg-white hover:bg-rose-50 transition"
              >
                {t.mfa_disable}
              </button>
            )}
          </div>
        )}

        {step === 'disable_password' && (
          <form onSubmit={submitPassword} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">{t.mfa_password_prompt}</p>
            <div>
              <label htmlFor="input-mfa-disable-password" className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                {t.mfa_password_label}
              </label>
              <input id="input-mfa-disable-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
            </div>
            <ErrorNote text={error} />
            <button type="submit" disabled={!password || busy} className={PRIMARY_BTN}>
              {busy ? t.mfa_verifying : t.mfa_password_submit}
            </button>
          </form>
        )}

        {step === 'disable_code' && (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">{t.mfa_challenge_body}</p>
            <TotpCodeInput id="input-mfa-disable-code" value={code} onChange={setCode} label={t.mfa_code_label} autoFocus />
            <ErrorNote text={error} />
            <button type="submit" disabled={!isValidTotpCode(code) || busy} className={PRIMARY_BTN}>
              {busy ? t.mfa_verifying : t.mfa_disable}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
