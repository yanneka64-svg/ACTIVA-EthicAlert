/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
 *
 * Écran de connexion pour les collaborateurs internes (brief section 13),
 * distinct du portail du lanceur d'alerte (Case ID + code d'accès +
 * mot de passe, dans AlertTrackingView) — les deux ne doivent jamais se
 * confondre (brief section 8 : "le lanceur d'alerte ne doit PAS utiliser
 * le compte interne ACTIVA").
 *
 * IMPORTANT (brief section 32, "no fake functionality" / "règle de
 * non-hallucination") : cette application n'a pas de backend
 * d'authentification réel pour ces comptes — c'est le même mécanisme de
 * démonstration/QA que le sélecteur de profil déjà présent dans l'en-tête
 * (Navbar.tsx), simplement présenté comme un vrai écran de connexion pour
 * que le flux `/login` du brief existe réellement. Le texte à l'écran le
 * dit explicitement ; rien n'est présenté comme sécurisé alors que ça ne
 * l'est pas.
 */
import React, { useState } from 'react';
import { ShieldAlert, LogIn, ChevronRight } from 'lucide-react';
import { UserProfile } from '../types';
import { storage } from '../services/storage';

interface StaffLoginViewProps {
  onLogin: (user: UserProfile) => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onLogin }) => {
  const staffUsers = storage.getUsers();
  const [selectedId, setSelectedId] = useState<string>(staffUsers[0]?.id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = staffUsers.find((u) => u.id === selectedId);
    if (user) onLogin(user);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow mx-auto mb-3">
            <ShieldAlert className="w-6 h-6 text-[#0B2545]" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Connexion — Espace collaborateur</h1>
          <p className="text-xs text-slate-500 mt-1">
            Réservé aux investigateurs, administrateurs et membres de la Direction ACTIVA.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Compte
            </label>
            <select
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
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
            Environnement de démonstration : aucune vérification de mot de passe réelle n'est
            effectuée ici — la sélection d'un compte simule la connexion pour illustrer le
            fonctionnement des habilitations par profil.
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B2545] text-white text-sm font-bold hover:bg-[#0B2545]/90 transition"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
