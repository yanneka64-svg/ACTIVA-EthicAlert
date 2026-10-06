/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Modale de confidentialité affichée avant le formulaire (Phase 33).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { X, ArrowRight } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (fenêtre de confidentialité — couleurs ACTIVA) ===
import { Lock, EyeOff, FileCheck2, ShieldCheck } from 'lucide-react';
import { Language } from '../../types';

interface ConfidentialityGateProps {
  t: Record<string, string>;
  lang: Language;
  onCancel: () => void;
  setConfidentialityConfirmed: (v: boolean) => void;
}

export const ConfidentialityGate: React.FC<ConfidentialityGateProps> = ({
  t,
  lang,
  onCancel,
  setConfidentialityConfirmed,
}) => {
  return (
    // === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) === la fenêtre
    // apparaît en douceur ; bouton de confirmation en dégradé avec reflet.
    <div className="activa-fade-in fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="activa-modal-in relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl shadow-slate-900/40 overflow-hidden grid grid-cols-1 md:grid-cols-[5fr_7fr]">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t.confidentiality_gate_cancel}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-500 shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* === AMÉLIORATION AJOUTÉE (Phase 35 — photo fournie par
            l'utilisateur, icône bouclier + cadenas déjà intégrée à
            l'image) === Remplace la photo générique + l'icône dessinée en
            CSS (Phase 34) par la photo exacte de la maquette (main sur
            clavier, icône déjà incrustée dans l'image), servie depuis
            public/brand/confidentiality-gate-bg.jpg. */}
        {/* === AMÉLIORATION AJOUTÉE (photo de fond lente à l'affichage) ===
            BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : cette photo
            était la seule des 4 photos de fond de l'app à n'avoir ni
            priorité de chargement explicite ni couleur de repli — même
            correctif que les 3 autres (WhistleblowerHome/AlertTrackingView/
            StaffSpaceHome), plus le préchargement ajouté dans index.html. */}
        <div className="relative hidden md:flex items-center justify-center min-h-[460px] overflow-hidden bg-slate-100">
          {/* === AMÉLIORATION AJOUTÉE (luminosité réduite de la photo) ===
              sur demande explicite de l'utilisateur : le flou testé
              précédemment a été retiré (image nette d'origine) au profit
              d'une simple réduction de luminosité (`brightness-75`). */}
          <img
            src="/brand/confidentiality-gate-bg.jpg"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-left"
          />
          {/* === AMÉLIORATION AJOUTÉE (couleurs ACTIVA) === voile bleu ACTIVA
              léger à la place de la simple baisse de luminosité. */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#12305F]/70 via-[#2452A0]/25 to-[#2452A0]/10" />
        </div>

        {/* === AMÉLIORATION AJOUTÉE (fenêtre de confidentialité revue) ===
            Sur demande explicite : le texte justifié coupait les mots en fin
            de ligne (« se-ront », « uni-quement »). Les mêmes phrases (mêmes
            clés de traduction) sont présentées en trois points, sans coupure
            de mots, avec une icône chacun.
            === AMÉLIORATION AJOUTÉE (texte justifié) === sur demande
            explicite : chaque point est justifié, toujours sans coupure de
            mots (`hyphens: manual`) ; la dernière ligne reste alignée à
            gauche. */}
        <div className="p-6 sm:p-12 flex flex-col justify-center space-y-6">
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#2452A0]">
              <ShieldCheck className="w-4 h-4" strokeWidth={2} />
              {t.confidentiality_gate_eyebrow}
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#12305F] leading-tight [text-wrap:balance]">
              {t.confidentiality_gate_title}
            </h2>
            <div className="mt-3 w-10 h-1 rounded-full bg-[#2452A0]" />
          </div>
          {/* === AMÉLIORATION AJOUTÉE (texte justifié) === colonne de texte
              élargie (photo 5/12, texte 7/12) et pictogrammes plus compacts
              sur téléphone : moins de blancs entre les mots justifiés. */}
          <ul lang={lang} className="space-y-4">
            {[
              { Icon: Lock, text: <>{t.confidentiality_gate_body1_pre}<span>{t.confidentiality_gate_body1_bold}</span>{t.confidentiality_gate_body1_post}</> },
              { Icon: EyeOff, text: <>{t.confidentiality_gate_body2_pre}<span>{t.confidentiality_gate_body2_bold}</span></> },
              { Icon: FileCheck2, text: <>{t.confidentiality_gate_body2_post.trim()}</> },
            ].map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EAF0FA] text-[#2452A0] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={1.75} />
                </span>
                <p className="flex-1 pt-1.5 text-sm sm:text-[15px] text-slate-700 leading-relaxed text-justify [hyphens:manual] [text-align-last:left]">{text}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
            >
              {t.confidentiality_gate_cancel}
            </button>
            <button
              type="button"
              id="confidentiality-gate-confirm"
              onClick={() => setConfidentialityConfirmed(true)}
              className="activa-shine group flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#2F63B8] to-[#2452A0] hover:from-[#2452A0] hover:to-[#1E4590] text-white font-bold text-sm shadow-lg shadow-[#2452A0]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2452A0]/30"
            >
              {t.confidentiality_gate_confirm}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
