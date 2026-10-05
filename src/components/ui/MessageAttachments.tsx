/**
 * === AMÉLIORATION AJOUTÉE (documents du déclarant dans les échanges) ===
 * Pièces jointes d'un message : nom, taille et bouton « Télécharger ».
 * Côté équipe, un document envoyé depuis la messagerie du déclarant est
 * téléchargé à la demande depuis le serveur (accès audité) ; un fichier
 * local (dataUrl) est téléchargé directement.
 */
import React, { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { EvidenceFile } from '../../types';

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const MessageAttachments: React.FC<{
  files: EvidenceFile[];
  t: Record<string, string>;
  /** Le téléchargement depuis le serveur n'est proposé qu'à l'équipe. */
  allowCloudDownload?: boolean;
  tone?: 'light' | 'dark';
}> = ({ files, t, allowCloudDownload = false, tone = 'light' }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  if (!files?.length) return null;

  const download = async (f: EvidenceFile) => {
    setError(false);
    if (f.dataUrl) {
      const a = document.createElement('a');
      a.href = f.dataUrl;
      a.download = f.name;
      a.click();
      return;
    }
    if (!allowCloudDownload || !f.cloudCaseId) return;
    setBusy(f.id);
    const { downloadCaseFile } = await import('../../services/staffConversation');
    const ok = await downloadCaseFile(f.cloudCaseId, f.id);
    setBusy(null);
    if (!ok) setError(true);
  };

  return (
    <div className="mt-2 space-y-1.5">
      {files.map((f) => {
        const canDownload = Boolean(f.dataUrl) || (allowCloudDownload && Boolean(f.cloudCaseId));
        return (
          <div
            key={f.id}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border ${
              tone === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0 opacity-80" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold truncate">{f.name}</span>
              {formatSize(f.size) && <span className="block text-[10px] opacity-70">{formatSize(f.size)}</span>}
            </span>
            {canDownload && (
              <button
                type="button"
                onClick={() => void download(f)}
                className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                  tone === 'dark' ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {busy === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {t.chat_download}
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="text-[10px] text-rose-600 font-semibold">{t.chat_download_failed}</p>}
    </div>
  );
};
