import React, { useState } from 'react';
import { QrCode, Copy, Check, X, Shield, Smartphone, Printer } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://activa-ethicalert.group-activa.com';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-center">
        {/* Header */}
        <div className="bg-[#0B2545] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-6 h-6 text-amber-400" />
          </div>

          <h3 className="text-lg font-bold">
            Accès Mobile Sécurisé (QR Code)
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            À afficher dans les locaux des 16 filiales Groupe ACTIVA pour un signalement confidentiel immédiat.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="p-6 bg-slate-50 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-[240px] mx-auto">
            {/* High visual quality SVG QR code simulation for ACTIVA EthicAlert */}
            <svg
              viewBox="0 0 160 160"
              className="w-full h-full text-slate-900"
              fill="currentColor"
            >
              {/* Pattern representation of QR code */}
              <rect x="0" y="0" width="40" height="40" rx="4" />
              <rect x="6" y="6" width="28" height="28" fill="white" rx="2" />
              <rect x="12" y="12" width="16" height="16" rx="1" />

              <rect x="120" y="0" width="40" height="40" rx="4" />
              <rect x="126" y="6" width="28" height="28" fill="white" rx="2" />
              <rect x="132" y="12" width="16" height="16" rx="1" />

              <rect x="0" y="120" width="40" height="40" rx="4" />
              <rect x="6" y="126" width="28" height="28" fill="white" rx="2" />
              <rect x="12" y="132" width="16" height="16" rx="1" />

              {/* Data dots */}
              <rect x="50" y="10" width="8" height="8" />
              <rect x="70" y="10" width="8" height="8" />
              <rect x="90" y="10" width="8" height="8" />
              <rect x="60" y="25" width="8" height="8" />
              <rect x="80" y="25" width="8" height="8" />
              <rect x="100" y="25" width="8" height="8" />

              <rect x="10" y="50" width="8" height="8" />
              <rect x="25" y="60" width="8" height="8" />
              <rect x="10" y="70" width="8" height="8" />
              <rect x="25" y="80" width="8" height="8" />
              <rect x="10" y="95" width="8" height="8" />

              <rect x="50" y="50" width="12" height="12" fill="#0B2545" />
              <rect x="70" y="50" width="8" height="8" />
              <rect x="85" y="50" width="10" height="10" />
              <rect x="105" y="50" width="8" height="8" />
              <rect x="130" y="60" width="10" height="10" />
              <rect x="145" y="75" width="10" height="10" />

              <rect x="50" y="70" width="8" height="8" />
              <rect x="70" y="70" width="20" height="20" fill="#D97706" rx="2" />
              <rect x="100" y="70" width="8" height="8" />
              <rect x="120" y="85" width="8" height="8" />

              <rect x="50" y="100" width="15" height="15" />
              <rect x="80" y="100" width="8" height="8" />
              <rect x="95" y="110" width="12" height="12" />
              <rect x="120" y="120" width="8" height="8" />
              <rect x="135" y="120" width="15" height="15" />
              <rect x="120" y="140" width="15" height="15" />
            </svg>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-center gap-1.5 font-medium">
            <Smartphone className="w-4 h-4 text-blue-700" />
            <span>Scannez avec un smartphone pour ouvrir le formulaire anonyme</span>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Lien copié' : 'Copier le lien direct'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-xs font-semibold text-white transition"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Imprimer l'affiche</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
