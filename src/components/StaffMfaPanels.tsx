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
// === AMÉLIORATION AJOUTÉE (fenêtre affichée en entier) ===
import { createPortal } from 'react-dom';
import { Check, Copy, ShieldCheck, Smartphone, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatTotpSecret, isMfaRequiredForRole, isValidTotpCode, mfaErrorKind, normalizeTotpCode } from '../domain/mfaPolicy';
import type { MfaApi, TotpEnrollmentStart } from '../services/staffMfa';
import { errorCode } from '../services/staffMfa';

type T = Record<string, string>;

const INPUT =
  'w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white text-xs focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 outline-none';
// === AMÉLIORATION AJOUTÉE (version sobre, sur demande) === bouton simple, sans effets.
export const MFA_PRIMARY_BTN_PLAIN =
  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] enabled:hover:bg-[#134074] text-white text-xs font-bold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';
// === AMÉLIORATION AJOUTÉE (présentation plus stylée, sur demande) === même
// bouton que l'écran de connexion : dégradé ACTIVA, ombre douce, reflet au survol.
// (La version unie reste disponible : MFA_PRIMARY_BTN_PLAIN.)
export const MFA_PRIMARY_BTN =
  'activa-shine w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#0B2545] to-[#134074] text-white text-xs font-bold shadow-lg shadow-[#0B2545]/25 enabled:hover:shadow-xl enabled:hover:-translate-y-0.5 disabled:opacity-40 disabled:shadow-none transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';
const PRIMARY_BTN = MFA_PRIMARY_BTN;

/**
 * === AMÉLIORATION AJOUTÉE (présentation plus stylée, sur demande) ===
 * En-tête commun des cartes de double authentification : pastille d'icône
 * bleue, titre, consigne et petit trait d'accent — même langage visuel que la
 * carte de connexion du personnel.
 */
export function MfaCardHeader({ icon: Icon = ShieldCheck, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-5">
      <span className="activa-enter inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
        <Icon className="w-5 h-5" strokeWidth={1.9} />
      </span>
      <p className="text-base font-extrabold tracking-tight text-slate-900 [text-wrap:balance]">{title}</p>
      {subtitle && <p className="mt-1.5 text-xs text-slate-600 leading-relaxed [text-wrap:balance]">{subtitle}</p>}
      <div className="activa-draw-x w-10 h-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-400 mx-auto mt-3" style={{ transformOrigin: 'center' }} />
    </div>
  );
}

/** Pastille numérotée d'une étape (1 : scanner, 2 : saisir le code). */
function StepBadge({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="shrink-0 inline-flex w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold items-center justify-center tabular-nums">
      {n}
    </span>
  );
}

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
  step,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  label: string;
  autoFocus?: boolean;
  /** Numéro d'étape affiché devant le libellé (écran d'activation). */
  step?: number;
}) {
  // === AMÉLIORATION AJOUTÉE (présentation plus stylée, sur demande) ===
  // Six cases groupées 3 + 3, comme le code affiché par Google Authenticator.
  // Un seul vrai champ (transparent, posé sur les cases) reçoit la saisie : le
  // collage, le remplissage automatique et le clavier numérique fonctionnent
  // comme avant.
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 5);
  const slot = (i: number) => {
    const digit = value[i] ?? '';
    const isActive = focused && i === active && value.length < 6;
    const tone = isActive
      ? 'border-blue-500 bg-white ring-4 ring-blue-500/15'
      : digit
        ? 'border-blue-200 bg-blue-50/60'
        : 'border-slate-200 bg-slate-50';
    return (
      <span key={i} className={`h-12 flex-1 min-w-0 rounded-xl border flex items-center justify-center text-xl font-extrabold tabular-nums text-[#0B2545] transition-all duration-150 ${tone}`}>
        {digit || (isActive ? <span className="w-0.5 h-5 rounded-full bg-blue-600 animate-pulse" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />)}
      </span>
    );
  };
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
        {step !== undefined && <StepBadge n={step} />}
        {label}
      </label>
      <div className="relative">
        <div aria-hidden="true" className="flex items-center gap-1.5 sm:gap-2 pointer-events-none select-none">
          {[0, 1, 2].map(slot)}
          <span className="w-2 h-0.5 shrink-0 rounded-full bg-slate-300" />
          {[3, 4, 5].map(slot)}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(normalizeTotpCode(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={14}
          autoFocus={autoFocus}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text text-transparent caret-transparent outline-none"
        />
      </div>
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
      className="w-40 h-40 mx-auto p-2 rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_10px_24px_-14px_rgb(11_37_69/0.45)] [&_svg]:w-full [&_svg]:h-full"
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
      {/* === AMÉLIORATION AJOUTÉE (présentation plus stylée) === étapes
          numérotées et QR code posé dans un cadre bleuté. */}
      <p className="flex items-start gap-2 text-xs font-semibold text-slate-800 leading-relaxed">
        <StepBadge n={1} />
        <span>{t.mfa_step_scan}</span>
      </p>
      <div className="rounded-2xl bg-gradient-to-b from-blue-50 to-slate-50/40 ring-1 ring-blue-100 px-4 pt-4 pb-3">
      {start ? (
        <QrCode text={start.uri} />
      ) : (
        <div className="w-40 h-40 mx-auto rounded-xl bg-white/80 animate-pulse" aria-hidden="true" />
      )}
      {start && (
        <details className="mt-3 text-center">
          <summary className="cursor-pointer text-[11px] font-semibold text-blue-700 hover:underline">{t.mfa_manual}</summary>
          <div className="mt-2 flex items-center gap-2 text-left">
            <code id="mfa-secret-key" className="flex-1 min-w-0 rounded-lg bg-white ring-1 ring-slate-200 px-2.5 py-2 text-[11.5px] font-bold tracking-wider text-slate-800 break-all">
              {formatTotpSecret(start.key)}
            </code>
            <button type="button" onClick={() => void copyKey()} aria-label={t.mfa_copy} title={t.mfa_copy} className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </details>
      )}
      </div>
      <TotpCodeInput id="input-mfa-enroll-code" value={code} onChange={setCode} label={t.mfa_code_label} step={2} />
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

  // === AMÉLIORATION AJOUTÉE (fenêtre affichée en entier) === rendue au
  // niveau de la page (portail) : ouverte depuis le menu du profil, elle
  // restait sinon enfermée dans la barre du haut (dont le flou d'arrière-plan
  // limite les éléments « fixes ») et apparaissait coupée.
  const dialog = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 bg-[#0B2A66]/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mfa-dialog-title" onClick={onClose}>
      <div className="activa-modal-in relative w-full max-w-sm max-h-full overflow-y-auto bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={t.mfa_close} className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
        {/* === AMÉLIORATION AJOUTÉE (présentation plus stylée) === pastille
            d'icône et statut sous forme de badge. */}
        <div className="mb-5 pr-8 flex items-center gap-3">
          <span className="shrink-0 inline-flex w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white items-center justify-center shadow-lg shadow-blue-600/30">
            <Smartphone className="w-5 h-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p id="mfa-dialog-title" className="text-base font-extrabold tracking-tight text-slate-900">Google Authenticator</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${enrollment ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${enrollment ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {enrollment ? t.mfa_status_on : t.mfa_status_off}
            </span>
          </div>
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
            {since && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50/70 ring-1 ring-emerald-100 px-3 py-2.5 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={2} />
                {t.mfa_enabled_since.replace('{date}', since)}
              </p>
            )}
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
  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
}
