/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Écran de connexion au suivi (panneau photo + formulaire).
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 */
import React from 'react';
import { Eye, EyeOff, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';

interface TrackingLoginProps {
  t: Record<string, string>;
  trackingNumberInput: string;
  setTrackingNumberInput: React.Dispatch<React.SetStateAction<string>>;
  passwordInput: string;
  setPasswordInput: React.Dispatch<React.SetStateAction<string>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  loginError: string;
  isVerifying: boolean;
  handleLogin: (e: React.FormEvent) => void;
  onGoToNewAlert: () => void;
}

export const TrackingLogin: React.FC<TrackingLoginProps> = ({
  t,
  trackingNumberInput,
  setTrackingNumberInput,
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  loginError,
  isVerifying,
  handleLogin,
  onGoToNewAlert,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8 px-4 sm:px-6">
    <div className="w-full max-w-3xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        {/* === AMÉLIORATION AJOUTÉE (nouvelle photo de fond, fournie par
            l'utilisateur) === Remplace la photo du siège par une photo de
            bureau avec vue sur skyline, servie depuis
            public/brand/track-login-bg.jpg. */}
        {/* === AMÉLIORATION AJOUTÉE (photo de fond lente à l'affichage) ===
            BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : couleur de
            repli (`bg-[#0B2545]`, même teinte que le voile ci-dessous) le
            temps du chargement au lieu d'un flash blanc, + priorité de
            chargement explicite sur l'image. */}
        <div className="relative hidden lg:flex flex-col justify-end p-6 sm:p-8 min-h-[260px] text-white overflow-hidden bg-[#0B2545]">
          <img
            src="/brand/track-login-bg.jpg"
            alt={t.space_img_alt}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-left"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545]/90 via-[#0B2545]/55 to-[#0B2545]/15" />
          <div className="relative z-10 space-y-5">
            {/* === AMÉLIORATION AJOUTÉE (texte du bandeau photo) === Remplace
                l'accroche générique par le même texte explicatif que le
                formulaire ("Consultez l'avancement de votre dossier...",
                `t.track_subtitle`), sur demande explicite de l'utilisateur.
                `track_login_tagline` reste défini dans translations.ts
                (non supprimé) mais n'est plus utilisé ici. */}
            <p className="text-2xl font-bold leading-snug max-w-xs">{t.track_subtitle}</p>
            <div className="w-10 h-px bg-white/40" />
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold">{t.sidebar_confidentiality_title}</div>
                <div className="text-xs text-white/80">{t.track_login_photo_note}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white p-6 sm:p-8 flex flex-col justify-center">
          {/* === AMÉLIORATION AJOUTÉE (alignement avec l'accueil des
              espaces) === Cadenas retiré et titre aligné à gauche
              (au lieu de centré) — même style que le titre "Espaces de
              travail" de StaffSpaceHome.tsx, sur demande explicite. */}
          {/* === AMÉLIORATION AJOUTÉE (retrait du doublon de texte) ===
              Le sous-titre (`t.track_subtitle`) était répété ici alors
              qu'il s'affiche désormais aussi sur le bandeau photo à
              gauche — retiré ici sur demande explicite de l'utilisateur,
              la clé de traduction reste inchangée et utilisée côté photo. */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">{t.track_title}</h2>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="activa-caret-blink space-y-4">
            <div>
              <label htmlFor="input-tracking-number" className="block text-xs font-semibold text-slate-700 mb-1">
                {t.track_label_case_number} *
              </label>
              <input
                type="text"
                id="input-tracking-number"
                value={trackingNumberInput}
                onChange={(e) => setTrackingNumberInput(e.target.value)}
                /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.track_placeholder_case_number}) */
                className="w-full px-3 py-2.5 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
              />
            </div>

            <div>
              <label htmlFor="input-tracking-password" className="block text-xs font-semibold text-slate-700 mb-1">
                {t.track_label_password} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-tracking-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={t.track_placeholder_password}
                  className="w-full px-3 py-2.5 pr-9 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* === AMÉLIORATION AJOUTÉE (Audit frontend — correction élevée) ===
                  BUG PRÉEXISTANT CORRIGÉ : `track_login_help` existait déjà dans
                  les traductions (avertissement sur la non-récupérabilité des
                  accès) mais n'était affiché nulle part dans l'application. */}
              <p className="mt-1.5 text-[11px] text-slate-500">{t.track_login_help}</p>
            </div>

            <button
              type="submit"
              id="btn-submit-tracking-login"
              disabled={isVerifying}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <span>{isVerifying ? t.common_verifying : t.btn_login_tracking}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            {/* === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, contraste) ===
                BUG PRÉEXISTANT CORRIGÉ, mesuré via axe-core : text-slate-400
                sur fond blanc à cette taille ne passe pas le seuil WCAG AA
                (2.63:1, minimum 4.5:1) — text-slate-500 y remédie. */}
            <span className="text-[11px] text-slate-500 uppercase font-semibold">{t.track_divider_or}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={onGoToNewAlert}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-semibold transition"
          >
            <span>{t.track_switch_to_new_alert}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};
