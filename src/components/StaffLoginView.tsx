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
 * doit être changé à la première connexion et expire sous 24h
 * (storage.ts `verifyStaffLogin`) — voilà l'ancienne note "champ
 * décoratif" (brief section 32) devenue fausse, retirée ici plutôt que
 * laissée trompeuse. Le sélecteur "Compte" reste une simple commodité de
 * démonstration (préremplit qui l'on prétend être) ; c'est le mot de passe
 * saisi, désormais réellement vérifié, qui autorise ou non la connexion —
 * jamais d'accès accordé sur la seule sélection. Les comptes de
 * démonstration préexistants (INITIAL_USERS, jamais passés par ce nouveau
 * flux) gardent leur mot de passe fixe "demo" (repli documenté dans
 * `verifyStaffLogin`), comportement inchangé pour eux.
 */
import React, { useState } from 'react';
import { LogIn, Lock, Mail, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../types';
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
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onLogin, onGoToContact }) => {
  const staffUsers = storage.getUsers();
  const [selectedId, setSelectedId] = useState<string>(staffUsers[0]?.id ?? '');
  const selectedUser = staffUsers.find((u) => u.id === selectedId) ?? staffUsers[0];

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
    if (!selectedUser) return;

    const rateLimitKey = selectedUser.email;
    const lockStatus = getLockStatus(rateLimitKey);
    if (lockStatus.locked) {
      setLoginError(`Trop de tentatives incorrectes. Réessayez dans ${formatRemaining(lockStatus.remainingMs)}.`);
      return;
    }

    setIsVerifying(true);
    const result = await storage.verifyStaffLogin(selectedUser.email, password);

    // === AMÉLIORATION AJOUTÉE ===
    // `=== false` plutôt que `!result.ok` : ce projet compile sans
    // `strict`/`strictNullChecks` (tsconfig.json), sous lequel TypeScript ne
    // rétrécit pas de façon fiable une union discriminée par un booléen
    // littéral via la simple négation — vérifié directement (`!result.ok`
    // provoquait une erreur de compilation malgré un code par ailleurs
    // correct), `=== false` rétrécit correctement dans les deux cas.
    if (result.ok === false) {
      if (result.reason === 'expired') {
        setLoginError('Ce mot de passe temporaire a expiré (validité 24h). Contactez un administrateur pour en obtenir un nouveau.');
        setIsVerifying(false);
        return;
      }
      const status = recordFailedAttempt(rateLimitKey);
      storage.logAudit(
        'ACCESS_DENIED',
        `Tentative de connexion refusée (mot de passe incorrect) pour ${selectedUser.email}. Tentatives restantes : ${status.attemptsRemaining}.`,
        undefined,
        selectedUser
      );
      setLoginError(
        status.locked
          ? `Trop de tentatives incorrectes. Accès verrouillé ${formatRemaining(status.remainingMs)}.`
          : 'Identifiant ou mot de passe incorrect.'
      );
      setIsVerifying(false);
      return;
    }

    clearAttempts(rateLimitKey);
    setIsVerifying(false);

    if (result.mustChangePassword) {
      setPendingUser(result.user);
      return;
    }
    onLogin(result.user);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    if (!pendingUser) return;
    if (newPassword.length < 8) {
      setChangeError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Les deux mots de passe ne correspondent pas.');
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
            <p className="text-sm font-bold text-slate-900">Changez votre mot de passe</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Première connexion de {pendingUser.name} : un nouveau mot de passe est requis avant d'accéder à votre espace.
            </p>
            <div className="w-10 h-1 rounded-full bg-amber-500 mx-auto mt-3" />
          </div>

          <form onSubmit={handleChangePassword} className="activa-caret-blink space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                id="input-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                id="input-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {changeError && (
              <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{changeError}</p>
            )}

            <button
              type="submit"
              id="btn-submit-change-password"
              disabled={isChangingPassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] text-white text-sm font-bold hover:bg-[#0B2545]/90 disabled:opacity-50 transition"
            >
              {isChangingPassword ? 'Mise à jour…' : 'Définir ce mot de passe'}
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
          <p className="text-sm font-bold text-slate-900">Accédez à votre espace de travail sécurisé</p>
          <div className="w-10 h-1 rounded-full bg-blue-500 mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="activa-caret-blink space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Compte
            </label>
            {staffUsers.length > 0 ? (
              <select
                id="login-account-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.roleTitle}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-rose-600">Aucun compte de démonstration disponible.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={selectedUser?.email ?? ''}
                readOnly
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Mot de passe
              </label>
              {onGoToContact && (
                <button
                  type="button"
                  onClick={onGoToContact}
                  className="text-[11px] font-semibold text-blue-700 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{loginError}</p>
          )}

          <button
            type="submit"
            id="btn-submit-staff-login"
            disabled={!selectedUser || isVerifying}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] text-white text-sm font-bold hover:bg-[#0B2545]/90 disabled:opacity-50 transition"
          >
            <LogIn className="w-4 h-4" />
            {isVerifying ? 'Vérification…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};
