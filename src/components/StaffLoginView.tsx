/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée, puis
 * reproduction fidèle de la maquette écran de connexion) ===
 *
 * Écran de connexion pour les collaborateurs internes (brief section 13),
 * distinct du portail du lanceur d'alerte (Case ID + code d'accès +
 * mot de passe, dans AlertTrackingView) — les deux ne doivent jamais se
 * confondre (brief section 8 : "le lanceur d'alerte ne doit PAS utiliser
 * le compte interne ACTIVA").
 *
 * Carte de connexion unique, centrée et compacte (le volet gauche photo +
 * branding a été retiré sur demande explicite). Le sélecteur de langue
 * propre à cet écran a été retiré également — redondant avec celui,
 * toujours visible, de la Navbar (celle-ci ne disparaît plus jamais, voir
 * App.tsx).
 *
 * === AMÉLIORATION AJOUTÉE (création de comptes par l'admin — mot de passe
 * temporaire réel) === Le champ "Mot de passe" n'est plus décoratif : les
 * comptes créés depuis l'administration (AdminConfigView.tsx) reçoivent un
 * mot de passe temporaire réel, salé et haché (services/crypto.ts), qui
 * doit être changé à la première connexion et expire sous 4h (storage.ts
 * `verifyStaffLogin`) — voilà l'ancienne note "champ décoratif" (brief
 * section 32) devenue fausse, retirée ici plutôt que laissée trompeuse.
 * C'est le mot de passe saisi, réellement vérifié, qui autorise ou non la
 * connexion.
 *
 * === AMÉLIORATION AJOUTÉE (identifiant de connexion distinct de l'email) ===
 * Sur demande explicite : la connexion se fait avec un IDENTIFIANT dédié
 * (`UserProfile.username`), jamais l'adresse e-mail directement — l'email
 * reste l'adresse de contact réelle (notifications, "mot de passe
 * oublié ?"), distincte de l'identifiant de connexion.
 */
import React, { useState } from 'react';
import { LogIn, Lock, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Language, UserProfile } from '../types';
// === AMÉLIORATION AJOUTÉE : page de connexion traduite (FR/EN/PT) ===
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { getLockStatus, recordFailedAttempt, clearAttempts, formatRemaining } from '../services/rateLimiter';

interface StaffLoginViewProps {
  onLogin: (user: UserProfile) => void;
  // === AMÉLIORATION AJOUTÉE (bouton "Mot de passe oublié ?" sans action) ===
  // Optionnel : sans mécanisme d'envoi d'e-mail réel, aucun vrai flux de
  // réinitialisation automatisé n'existe — plutôt que de fabriquer un flux
  // fictif, le bouton renvoie vers le canal de contact réel du Groupe
  // ACTIVA (même prop/pattern que AlertTrackingView.onGoToContact). Un
  // administrateur peut aussi régénérer un mot de passe temporaire depuis
  // AdminConfigView.tsx.
  onGoToContact?: () => void;
  // === AMÉLIORATION AJOUTÉE : langue d'affichage (défaut FR, comportement inchangé) ===
  lang?: Language;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onLogin, onGoToContact, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE : suppression du sélecteur "Compte" ===
  // Le menu déroulant "Compte" (retiré) exposait publiquement, sans
  // authentification, la liste complète du personnel (noms + fonctions) —
  // en plus de n'être qu'une commodité de démonstration. L'identifiant est
  // désormais un champ de saisie normal, comme sur un vrai écran de
  // connexion.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // === AMÉLIORATION AJOUTÉE (changement de mot de passe obligatoire à la
  // première connexion) === `pendingUser` est le compte dont l'identifiant
  // + mot de passe temporaire viennent d'être vérifiés avec succès, mais
  // qui doit changer ce mot de passe avant d'obtenir réellement accès
  // (`onLogin` n'est appelé qu'après, jamais avant) — voir handleChangePassword.
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;

    const rateLimitKey = trimmedUsername;
    const lockStatus = getLockStatus(rateLimitKey);
    if (lockStatus.locked) {
      setLoginError(t.login_error_locked_retry.replace('{time}', formatRemaining(lockStatus.remainingMs)));
      return;
    }

    setIsVerifying(true);
    // === AMÉLIORATION AJOUTÉE (correctif — écran bloqué indéfiniment sur
    // "Vérification…") === BUG RÉEL SIGNALÉ : une exception inattendue ici
    // (promesse rejetée) laissait `isVerifying` bloqué à `true` pour
    // toujours, sans aucun message — le bouton restait figé, y compris avec
    // un mot de passe erroné. `try/finally` garantit désormais qu'on sorte
    // toujours de l'état "en cours", quoi qu'il arrive.
    try {
      const result = await storage.verifyStaffLogin(trimmedUsername, password);

      // === AMÉLIORATION AJOUTÉE ===
      // `=== false` plutôt que `!result.ok` : ce projet compile sans
      // `strict`/`strictNullChecks` (tsconfig.json), sous lequel TypeScript ne
      // rétrécit pas de façon fiable une union discriminée par un booléen
      // littéral via la simple négation — vérifié directement (`!result.ok`
      // provoquait une erreur de compilation malgré un code par ailleurs
      // correct), `=== false` rétrécit correctement dans les deux cas.
      if (result.ok === false) {
        if (result.reason === 'expired') {
          setLoginError(t.login_error_expired);
          return;
        }
        const status = recordFailedAttempt(rateLimitKey);
        // Le compte peut ne pas exister (identifiant inconnu saisi) : logAudit
        // retombe alors sur son acteur système par défaut (4e argument omis).
        const attemptedUser = storage.getUsers().find((u) => u.username?.toLowerCase() === trimmedUsername.toLowerCase());
        storage.logAudit(
          'ACCESS_DENIED',
          `Tentative de connexion refusée (${result.reason === 'not_found' ? 'identifiant inconnu' : 'mot de passe incorrect'}) pour ${trimmedUsername}. Tentatives restantes : ${status.attemptsRemaining}.`,
          undefined,
          attemptedUser
        );
        setLoginError(
          status.locked
            ? t.login_error_locked.replace('{time}', formatRemaining(status.remainingMs))
            : t.login_error_invalid
        );
        return;
      }

      clearAttempts(rateLimitKey);

      if (result.mustChangePassword) {
        setPendingUser(result.user);
        return;
      }
      onLogin(result.user);
    } catch {
      setLoginError(t.login_error_unexpected);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    if (!pendingUser) return;
    if (newPassword.length < 8) {
      setChangeError(t.login_error_too_short);
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError(t.login_error_mismatch);
      return;
    }
    setIsChangingPassword(true);
    await storage.changePassword(pendingUser.id, newPassword, pendingUser);
    setIsChangingPassword(false);
    onLogin({ ...pendingUser, mustChangePassword: false });
  };

  // === AMÉLIORATION AJOUTÉE (correction de bug — centrage vertical) ===
  // `min-h-[70vh]` était une fraction arbitraire de la hauteur de la
  // fenêtre : sur un écran où le contenu réel entre la Navbar et le pied
  // de page dépasse 70vh, la carte se retrouvait centrée dans une boîte
  // plus petite que l'espace disponible, laissant un vide visible en
  // dessous. `min-h-full` centre réellement sur toute la hauteur donnée
  // par le parent (`<main className="flex-1 pb-16">` dans App.tsx, qui
  // occupe déjà tout l'espace entre Navbar et pied de page).
  //
  // === AMÉLIORATION AJOUTÉE (correction de bug — carte perçue trop haute,
  // puis nouvel ajustement sur demande explicite) === `<main>` porte 64px
  // de marge basse (`pb-16`) réservée pour les autres écrans ; comme
  // `min-height: 100%` se calcule sur la boîte de contenu (donc hors ce
  // padding), un centrage naïf se ferait dans un espace qui s'arrête 64px
  // trop tôt en bas — la carte apparaîtrait décalée vers le haut. `pt-32`
  // compense cette marge (pt-16 suffisait pour un centrage strict) et
  // pousse en plus la carte plus bas que le milieu exact, comme demandé.
  // === AMÉLIORATION AJOUTÉE (changement de mot de passe obligatoire à la
  // première connexion) === même carte/emplacement que l'écran de
  // connexion, contenu remplacé tant que `pendingUser` est défini — aucun
  // accès (onLogin) n'est accordé avant que ce formulaire soit validé.
  if (pendingUser) {
    return (
      <div className="min-h-full flex items-center justify-center px-4 pt-32">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className="inline-flex w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <p className="text-xs font-bold text-slate-900">{t.login_change_title}</p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {t.login_change_intro.replace('{name}', pendingUser.name)}
            </p>
            <div className="w-10 h-1 rounded-full bg-amber-500 mx-auto mt-3" />
          </div>

          <form onSubmit={handleChangePassword} className="activa-caret-blink space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                {t.login_new_password}
              </label>
              <input
                type="password"
                id="input-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.login_new_password_hint}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                {t.login_confirm_password}
              </label>
              <input
                type="password"
                id="input-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {changeError && (
              <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{changeError}</p>
            )}

            <button
              type="submit"
              id="btn-submit-change-password"
              disabled={isChangingPassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] text-white text-xs font-bold hover:bg-[#0B2545]/90 disabled:opacity-50 transition"
            >
              {isChangingPassword ? t.login_change_pending : t.login_change_submit}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 pt-32">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6" />
          </span>
          <p className="text-xs font-bold text-slate-900">{t.login_heading}</p>
          <div className="w-10 h-1 rounded-full bg-blue-500 mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="activa-caret-blink space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              {t.login_username}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="input-login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                {t.login_password}
              </label>
              {onGoToContact && (
                <button
                  type="button"
                  onClick={onGoToContact}
                  className="text-[10px] font-semibold text-blue-700 hover:underline"
                >
                  {t.login_forgot}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? t.login_hide_password : t.login_show_password}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{loginError}</p>
          )}

          {/* === AMÉLIORATION AJOUTÉE (bouton "Se connecter" redessiné, plus
              professionnel) === Ombre portée + légère élévation au survol,
              retour tactile à l'appui (scale), indicateur de chargement réel
              (roue animée) à la place du simple changement de texte, anneau
              de focus visible au clavier — même couleur de marque (#0B2545,
              cohérente avec "Définir ce mot de passe" ci-dessus), juste une
              exécution plus soignée. */}
          <button
            type="submit"
            id="btn-submit-staff-login"
            disabled={!username.trim() || !password || isVerifying}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] text-white text-xs font-bold tracking-wide shadow-md shadow-[#0B2545]/25 hover:bg-[#12294f] hover:shadow-lg hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545]/50 focus-visible:ring-offset-2 transition-all duration-150"
          >
            {isVerifying ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isVerifying ? t.login_verifying : t.login_submit}
          </button>
        </form>
      </div>
    </div>
  );
};
