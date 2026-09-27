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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
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
            className="absolute inset-0 w-full h-full object-cover object-left brightness-75"
          />
        </div>

        <div className="p-8 sm:p-12 flex flex-col justify-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] leading-tight">
            {t.confidentiality_gate_title}
          </h2>
          {/* === AMÉLIORATION AJOUTÉE : texte de confidentialité justifié (text-justify) === */}
          {/* === AMÉLIORATION AJOUTÉE : espaces trop larges entre les mots corrigés ===
              `hyphens-auto` + `lang` : le navigateur coupe les mots longs en fin de
              ligne (dictionnaire de la langue affichée), ce qui évite les grands
              blancs du texte justifié dans cette colonne étroite. Le gras a été
              retiré (demande explicite) : les <span> restent, sans style. */}
          <p lang={lang} className="text-sm sm:text-base text-slate-700 leading-relaxed text-justify hyphens-auto">
            {t.confidentiality_gate_body1_pre}
            <span>{t.confidentiality_gate_body1_bold}</span>
            {t.confidentiality_gate_body1_post}
            {/* === AMÉLIORATION AJOUTÉE : « Vous pouvez choisir de rester
                anonyme. » déplacé à la fin du premier paragraphe (mêmes
                clés de traduction, simple réorganisation de l'affichage) === */}
            {' '}
            {t.confidentiality_gate_body2_pre}
            <span>{t.confidentiality_gate_body2_bold}</span>
          </p>
          <p lang={lang} className="text-sm sm:text-base text-slate-700 leading-relaxed text-justify hyphens-auto">
            {t.confidentiality_gate_body2_post.trim()}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              {t.confidentiality_gate_cancel}
            </button>
            <button
              type="button"
              id="confidentiality-gate-confirm"
              onClick={() => setConfidentialityConfirmed(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition"
            >
              {t.confidentiality_gate_confirm}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
