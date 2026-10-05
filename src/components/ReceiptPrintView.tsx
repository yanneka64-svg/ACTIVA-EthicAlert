/**
 * === AMÉLIORATION AJOUTÉE (accusé de réception imprimable) ===
 *
 * BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : « Télécharger
 * l'accusé de réception » (fin du formulaire) et « Télécharger le
 * récépissé » (page de suivi) appelaient `window.print()`, mais depuis
 * l'isolation d'impression (index.css, `@media print`), seul un bloc
 * `.print-only` est imprimé — ces deux écrans n'en avaient aucun, d'où une
 * page vierge.
 *
 * Ce composant est ce document : masqué à l'écran, seul contenu imprimé
 * (même motif que CaseReportPrintView.tsx). Il ne contient que ce que le
 * déclarant voit déjà à l'écran : numéro de dossier, date, catégorie,
 * entité, statut, mode d'identification — et, uniquement à la fin du
 * dépôt (seul moment où il est connu), le mot de passe de suivi, comme
 * l'écran de confirmation l'affiche déjà. Jamais la description des faits
 * ni les personnes citées.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { AlertRecord } from '../types';
import { trData } from '../i18n/dataLabels';
import { getCurrentLang } from '../i18n/currentLang';

interface ReceiptPrintViewProps {
  t: Record<string, string>;
  alert: AlertRecord;
  /** Mot de passe de suivi : fourni uniquement à la fin du dépôt. */
  password?: string;
}

const STATUS_KEYS: Record<string, string> = {
  new: 'status_new',
  under_review: 'status_under_review',
  investigation: 'status_investigation',
  corrective_action: 'status_corrective_action',
  closed: 'status_closed',
  reopened: 'status_reopened',
  archived: 'status_archived',
};

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({ t, alert, password }) => {
  // Dates dans la langue choisie sur la plateforme (pas celle du navigateur).
  const lang = getCurrentLang();
  const locale = lang === 'en' ? 'en-GB' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
  const now = new Date();
  const submitted = new Date(alert.createdAt);
  const rows: { label: string; value: string }[] = [
    { label: t.ack_tracking_num, value: alert.trackingNumber },
    { label: t.receipt_print_submitted, value: `${submitted.toLocaleDateString(locale)} ${submitted.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` },
    { label: t.track_field_category, value: trData(alert.category) },
    { label: t.track_field_entity, value: alert.concernedEntity },
    { label: t.receipt_print_status, value: t[STATUS_KEYS[alert.status] ?? ''] ?? alert.status },
    { label: t.receipt_print_identity, value: alert.whistleblower.isAnonymous ? t.track_id_anonymous : t.track_id_identified },
  ];

  // Rendu directement dans <body> : la règle d'impression positionne
  // `.print-only` en haut de page ; placé dans une carte de l'écran
  // (`relative overflow-hidden`), il serait rogné à la taille de la carte.
  return createPortal(
    <div className="print-only bg-white text-slate-900 text-[12px] leading-relaxed p-10">
      <header className="flex items-start justify-between border-b-2 border-[#0B2545] pb-4 mb-6">
        {/* === AMÉLIORATION AJOUTÉE (logo du site d'alerte sur l'accusé) === */}
        <img src="/brand/activa-whistleblowing-logo.png" alt="activa.whistleblowing" className="h-10 w-auto object-contain" />
        <div className="text-right">
          <p className="text-base font-extrabold text-[#0B2545]">{t.receipt_print_title}</p>
          <p className="text-slate-500">{now.toLocaleDateString(locale)}</p>
        </div>
      </header>

      <p className="mb-6">{t.receipt_print_intro}</p>

      <table className="w-full border-collapse mb-6">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-200">
              <td className="font-semibold py-2 pr-4 w-64 align-top">{r.label}</td>
              <td className="py-2">{r.value}</td>
            </tr>
          ))}
          {password && (
            <tr className="border-b border-slate-200">
              <td className="font-semibold py-2 pr-4 w-64 align-top">{t.ack_password_label}</td>
              <td className="py-2 font-mono font-bold">{password}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border border-slate-300 rounded p-4 mb-6">
        <p className="font-bold mb-1">{t.receipt_print_keep_title}</p>
        <p>{t.ack_credentials_note}</p>
      </div>

      <p className="text-slate-600">{t.receipt_print_track_hint}</p>

      <footer className="mt-10 pt-4 border-t border-slate-200 text-[10px] text-slate-500">{t.receipt_print_footer}</footer>
    </div>,
    document.body
  );
};
