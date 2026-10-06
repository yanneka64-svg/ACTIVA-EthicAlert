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
// === AMÉLIORATION AJOUTÉE (page de suivi — version B) ===
import { FileText, KeyRound, Activity, HelpCircle, MessagesSquare } from 'lucide-react';

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
  // === AMÉLIORATION AJOUTÉE (page de suivi — version B, choisie par
  // l'utilisateur) === même habillage que l'accueil : bandeau photo du siège
  // sous voile bleu ACTIVA avec le titre centré, formulaire dans une carte
  // qui chevauche le bandeau, puis trois cartes qui expliquent ce que l'on
  // peut faire une fois connecté. Formulaire, identifiants des champs et
  // actions strictement inchangés. L'ancien panneau photo latéral
  // (track-login-bg.jpg, `sidebar_confidentiality_title`,
  // `track_login_photo_note`) n'est plus affiché ici.
  // === AMÉLIORATION AJOUTÉE (alignement sur téléphone) === sur demande
  // explicite : sur petit écran, le texte du bandeau et le lien « Pas encore
  // de signalement ? » sont alignés à gauche, sur le même bord que le
  // formulaire et les cartes ; centrés à partir de la tablette.
  // === AMÉLIORATION AJOUTÉE (texte justifié) === sur demande explicite : les
  // paragraphes (accroche, aide sous le mot de passe, cartes) sont justifiés,
  // sans coupure de mots ; la dernière ligne garde l'alignement du bloc.
  const CAN_DO = [
    { Icon: Activity, title: t.track_can_1_title, desc: t.track_can_1_desc },
    { Icon: HelpCircle, title: t.track_can_2_title, desc: t.track_can_2_desc },
    { Icon: MessagesSquare, title: t.track_can_3_title, desc: t.track_can_3_desc },
  ];

  return (
    <div className="activa-form pb-8">
      <div className="relative overflow-hidden bg-[#12305F] min-h-[300px] sm:min-h-[340px]">
        <img
          src="/brand/activa-hq-hero.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="activa-kenburns absolute inset-0 w-full h-full object-cover object-right sm:object-[75%_45%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2452A0]/60 to-[#12305F]/[0.88]" />
        <div className="relative z-10 px-6 pt-10 pb-28 sm:px-5 sm:pt-14 sm:pb-32 text-left sm:text-center text-white">
          <p className="activa-enter text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-blue-200" style={{ '--d': '100ms' } as React.CSSProperties}>
            <ShieldCheck className="inline-block align-[-3px] w-4 h-4 mr-2 text-[#93B4EE]" strokeWidth={2} />
            {t.track_eyebrow}
          </p>
          <h1 className="activa-enter mt-3 text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.1] [text-wrap:balance]" style={{ '--d': '200ms' } as React.CSSProperties}>
            {t.track_title_part1}{' '}
            <span className="text-[#A9C4F2]">{t.track_title_part2}</span>
          </h1>
          <p className="activa-enter mt-3 sm:mx-auto max-w-2xl text-sm sm:text-base text-blue-100 leading-relaxed text-justify [hyphens:manual] [text-align-last:left] sm:[text-align-last:center]" style={{ '--d': '300ms' } as React.CSSProperties}>
            {t.track_subtitle}
          </p>
        </div>
      </div>

      <div className="relative z-20 -mt-20 sm:-mt-24 px-4">
        <div className="activa-modal-in mx-auto w-full max-w-[480px] bg-white rounded-2xl border border-slate-200/70 shadow-[0_30px_60px_-28px_rgb(15_23_42/0.5)] p-6 sm:p-8">
          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="activa-caret-blink space-y-4">
            <div>
              <label htmlFor="input-tracking-number" className="block text-xs font-bold text-slate-700 mb-1.5">
                {t.track_label_case_number} *
              </label>
              <div className="relative">
                <FileText aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={1.75} />
                <input
                  type="text"
                  id="input-tracking-number"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 text-sm font-mono font-bold bg-slate-50/60 focus:bg-white border border-slate-300 rounded-xl outline-none focus:border-[#2452A0] focus:ring-4 focus:ring-[#2452A0]/15 uppercase tracking-wider"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-tracking-password" className="block text-xs font-bold text-slate-700 mb-1.5">
                {t.track_label_password} *
              </label>
              <div className="relative">
                <KeyRound aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={1.75} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-tracking-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={t.track_placeholder_password}
                  className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50/60 focus:bg-white border border-slate-300 rounded-xl outline-none focus:border-[#2452A0] focus:ring-4 focus:ring-[#2452A0]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed text-justify [hyphens:manual] [text-align-last:left]">{t.track_login_help}</p>
            </div>

            <button
              type="submit"
              id="btn-submit-tracking-login"
              disabled={isVerifying}
              className="activa-shine group w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2F63B8] to-[#2452A0] hover:from-[#2452A0] hover:to-[#1E4590] disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-[#2452A0]/30 hover:shadow-xl enabled:hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2452A0]/30"
            >
              <span>{isVerifying ? t.common_verifying : t.btn_login_tracking}</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
            </button>
          </form>

          <p className="mt-5 text-left sm:text-center text-xs sm:text-[13px] text-slate-500">
            {t.track_no_alert_yet}{' '}
            <button
              type="button"
              onClick={onGoToNewAlert}
              aria-label={t.track_switch_to_new_alert}
              className="group inline-flex items-center gap-1 font-bold text-[#2452A0] hover:underline underline-offset-2"
            >
              {t.track_new_alert_link}
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.25} />
            </button>
          </p>
        </div>
      </div>

      <div className="mt-8 mx-auto max-w-5xl px-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CAN_DO.map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            className="activa-enter flex items-start gap-3 p-5 rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
            style={{ '--d': `${450 + i * 100}ms` } as React.CSSProperties}
          >
            <span className="w-10 h-10 rounded-xl bg-[#EAF0FA] text-[#2452A0] flex items-center justify-center shrink-0">
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </span>
            <div>
              <div className="text-sm font-bold text-[#12305F]">{title}</div>
              <div className="mt-0.5 text-xs text-slate-500 leading-relaxed text-justify [hyphens:manual] [text-align-last:left]">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
