/**
 * === AMÉLIORATION AJOUTÉE (documents du déclarant accessibles à l'enquêteur) ===
 * Bouton « Télécharger » compact pour une pièce du dossier : fichier local
 * (dataUrl) téléchargé directement, document envoyé par le déclarant
 * (cloudCaseId) récupéré à la demande depuis le serveur (accès audité).
 */
import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { EvidenceFile } from '../../types';

export const EvidenceDownloadButton: React.FC<{ file: EvidenceFile; t: Record<string, string> }> = ({ file, t }) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!file.dataUrl && !file.cloudCaseId) return null;

  const download = async () => {
    setFailed(false);
    if (file.dataUrl) {
      const a = document.createElement('a');
      a.href = file.dataUrl;
      a.download = file.name;
      a.click();
      return;
    }
    setBusy(true);
    const { downloadCaseFile } = await import('../../services/staffConversation');
    const ok = await downloadCaseFile(file.cloudCaseId as string, file.id);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      title={failed ? t.chat_download_failed : t.chat_download}
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${
        failed ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      {failed ? t.chat_download_failed : t.chat_download}
    </button>
  );
};
