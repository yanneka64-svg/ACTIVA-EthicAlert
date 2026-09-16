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
 * branding a été retiré sur demande explicite). Le sélecteur "Votre
 * profil" a lui aussi été retiré (demande explicite) : "Compte" liste
 * désormais tous les comptes de démonstration directement, sans filtre
 * par groupe de rôles. Le sélecteur de langue propre à cet écran a été
 * retiré également — redondant avec celui, toujours visible, de la
 * Navbar (celle-ci ne disparaît plus jamais, voir App.tsx).
 *
 * IMPORTANT (brief section 32, "no fake functionality" / "règle de
 * non-hallucination") : cette application n'a pas de backend
 * d'authentification réel pour ces comptes — c'est le même mécanisme de
 * démonstration/QA que le sélecteur de profil déjà présent dans l'en-tête
 * (Navbar.tsx), simplement présenté comme un vrai écran de connexion pour
 * que le flux `/login` du brief existe réellement. Le champ "Mot de passe"
 * est donc décoratif (n'importe quelle valeur est acceptée). L'encart
 * d'avertissement qui le disait explicitement à l'écran a été retiré sur
 * demande explicite ; cette note de code reste la seule trace de ce choix.
 */
import React, { useState } from 'react';
import { LogIn, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '../types';
import { storage } from '../services/storage';

interface StaffLoginViewProps {
  onLogin: (user: UserProfile) => void;
  // === AMÉLIORATION AJOUTÉE (bouton "Mot de passe oublié ?" sans action) ===
  // Optionnel : sans backend d'authentification réel (voir note ci-dessus),
  // aucun vrai mécanisme de réinitialisation n'existe — plutôt que de
  // fabriquer un flux fictif, le bouton renvoie vers le canal de contact
  // réel du Groupe ACTIVA (même prop/pattern que AlertTrackingView.onGoToContact).
  onGoToContact?: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onLogin, onGoToContact }) => {
  const staffUsers = storage.getUsers();
  const [selectedId, setSelectedId] = useState<string>(staffUsers[0]?.id ?? '');
  const selectedUser = staffUsers.find((u) => u.id === selectedId) ?? staffUsers[0];

  // Décoratif (fidélité à la maquette) : ne pilote pas la connexion — seul
  // le compte de démonstration choisi ci-dessus le fait.
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) onLogin(selectedUser);
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

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={!selectedUser}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B2545] text-white text-sm font-bold hover:bg-[#0B2545]/90 disabled:opacity-50 transition"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
};
