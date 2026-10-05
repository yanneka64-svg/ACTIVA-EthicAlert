/**
 * === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
 * Notification à l'écran (en bas à droite) à l'arrivée d'un message du
 * déclarant : numéro du dossier, début du message, bouton « Ouvrir ».
 * Se ferme seule après 12 secondes.
 */
import React, { useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';

export const NewMessageToast: React.FC<{
  t: Record<string, string>;
  trackingNumber: string;
  preview: string;
  onOpen?: () => void;
  onClose: () => void;
}> = ({ t, trackingNumber, preview, onOpen, onClose }) => {
  useEffect(() => {
    const id = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(id);
  }, [trackingNumber, preview, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="activa-pop fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-2.5rem))] bg-white rounded-2xl border border-slate-200 shadow-[0_18px_40px_-12px_rgb(15_23_42/0.35)] p-4 flex gap-3"
    >
      <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200 flex items-center justify-center shrink-0">
        <MessageSquare className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-900">{t.chat_new_message_title || 'Nouveau message du déclarant'}</div>
        <div className="text-[11px] font-mono font-semibold text-blue-700 mt-0.5">{trackingNumber}</div>
        {preview && <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{preview}</p>}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5"
          >
            {t.chat_open || 'Ouvrir'}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} className="self-start p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label={t.chat_close || 'Fermer'}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
