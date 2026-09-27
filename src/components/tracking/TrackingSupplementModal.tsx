/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Modale « Compléter sa déclaration ».
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 */
import React from 'react';
import { Send, FileText, X, Info } from 'lucide-react';

interface TrackingSupplementModalProps {
  t: Record<string, string>;
  supplementText: string;
  setSupplementText: React.Dispatch<React.SetStateAction<string>>;
  setShowSupplementModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddSupplement: () => void;
}

export const TrackingSupplementModal: React.FC<TrackingSupplementModalProps> = ({
  t,
  supplementText,
  setSupplementText,
  setShowSupplementModal,
  handleAddSupplement,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
        <button
          type="button"
          onClick={() => setShowSupplementModal(false)}
          className="absolute right-4 top-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center pb-3 border-b border-slate-100 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t.track_supplement_title}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{t.track_supplement_desc}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.track_supplement_label} *
          </label>
          <textarea
            rows={5}
            maxLength={2000}
            value={supplementText}
            onChange={(e) => setSupplementText(e.target.value)}
            placeholder={t.track_supplement_placeholder}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div className="text-right text-[10px] text-slate-400 mt-0.5">{supplementText.length} / 2000</div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>{t.track_supplement_warning}</p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowSupplementModal(false)}
            className="px-3 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            type="button"
            onClick={handleAddSupplement}
            disabled={!supplementText.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white text-xs font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            {t.track_supplement_submit}
          </button>
        </div>
      </div>
    </div>
  );
};
