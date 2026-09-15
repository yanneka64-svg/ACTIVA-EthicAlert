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
 * Carte de connexion unique, centrée (le volet gauche photo + branding a
 * été retiré sur demande explicite — ne restait que "la partie
 * connexion"), à taille compacte plutôt qu'en plein cadre. Le sélecteur
 * "Votre profil" (Opérateur / Enquêteur / Administrateur / Consultant),
 * qui vivait auparavant dans le volet photo, est désormais intégré en
 * haut du formulaire lui-même — il continue de restreindre la liste de
 * comptes de démonstration proposée au groupe de rôles RBAC correspondant
 * (voir PROFILE_GROUPS) ; après connexion, App.tsx (`handleLogin`) route
 * vers l'espace adapté au rôle réel du compte choisi.
 *
 * IMPORTANT (brief section 32, "no fake functionality" / "règle de
 * non-hallucination") : cette application n'a pas de backend
 * d'authentification réel pour ces comptes — c'est le même mécanisme de
 * démonstration/QA que le sélecteur de profil déjà présent dans l'en-tête
 * (Navbar.tsx), simplement présenté comme un vrai écran de connexion pour
 * que le flux `/login` du brief existe réellement. Le champ "Mot de passe"
 * est donc décoratif (n'importe quelle valeur est acceptée) ; le texte à
 * l'écran le dit explicitement, rien n'est présenté comme sécurisé alors
 * que ça ne l'est pas.
 */
import React, { useMemo, useState } from 'react';
import { LogIn, ChevronDown, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { Language, UserRole, UserProfile } from '../types';
import { storage } from '../services/storage';

interface StaffLoginViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  onLogin: (user: UserProfile) => void;
}

type ProfileKey = 'operator' | 'investigator' | 'administrator' | 'consultant';

const PROFILE_GROUPS: Record<ProfileKey, { label: string; roles: UserRole[] }> = {
  operator: { label: 'Opérateur', roles: ['functional_admin', 'darc_compliance'] },
  investigator: { label: 'Enquêteur', roles: ['investigator', 'senior_investigator'] },
  administrator: { label: 'Administrateur', roles: ['system_admin', 'security_admin'] },
  consultant: { label: 'Consultant', roles: ['consultation', 'audit_committee', 'executive'] },
};

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ lang, setLang, onLogin }) => {
  const staffUsers = storage.getUsers();
  const [profileKey, setProfileKey] = useState<ProfileKey>('operator');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const accountsForProfile = useMemo(
    () => staffUsers.filter((u) => PROFILE_GROUPS[profileKey].roles.includes(u.role)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileKey]
  );
  const [selectedId, setSelectedId] = useState<string>(accountsForProfile[0]?.id ?? '');
  const selectedUser = accountsForProfile.find((u) => u.id === selectedId) ?? accountsForProfile[0];

  const handleProfileChange = (key: ProfileKey) => {
    setProfileKey(key);
    const first = staffUsers.find((u) => PROFILE_GROUPS[key].roles.includes(u.role));
    setSelectedId(first?.id ?? '');
  };

  // Décoratif (fidélité à la maquette) : ne pilote pas la connexion — seul
  // le compte de démonstration choisi ci-dessus le fait.
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) onLogin(selectedUser);
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4">
      <div className="relative flex justify-end mb-3">
        {/* Sélecteur de langue */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase transition"
          >
            {lang}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
          {showLangDropdown && (
            <div
              className="absolute right-0 mt-1 w-32 bg-white text-slate-900 rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs"
              onClick={() => setShowLangDropdown(false)}
            >
              <button onClick={() => setLang('fr')} className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${lang === 'fr' ? 'font-bold text-blue-700' : ''}`}>🇫🇷 Français</button>
              <button onClick={() => setLang('en')} className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${lang === 'en' ? 'font-bold text-blue-700' : ''}`}>🇬🇧 English</button>
              <button onClick={() => setLang('pt')} className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${lang === 'pt' ? 'font-bold text-blue-700' : ''}`}>🇵🇹 Português</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6" />
          </span>
          <p className="text-lg font-bold text-slate-900">Accédez à votre espace de travail sécurisé</p>
          <div className="w-10 h-1 rounded-full bg-blue-500 mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Votre profil
            </label>
            <select
              id="login-profile-select"
              value={profileKey}
              onChange={(e) => handleProfileChange(e.target.value as ProfileKey)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {(Object.keys(PROFILE_GROUPS) as ProfileKey[]).map((key) => (
                <option key={key} value={key}>
                  {PROFILE_GROUPS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Compte
            </label>
            {accountsForProfile.length > 0 ? (
              <select
                id="login-account-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {accountsForProfile.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.roleTitle}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-rose-600">Aucun compte de démonstration pour ce profil.</p>
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
              <button type="button" className="text-[11px] font-semibold text-blue-700 hover:underline">
                Mot de passe oublié ?
              </button>
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

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
            Environnement de démonstration : le mot de passe n'est pas vérifié réellement — la
            sélection d'un compte simule la connexion pour illustrer le fonctionnement des
            habilitations par profil.
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
