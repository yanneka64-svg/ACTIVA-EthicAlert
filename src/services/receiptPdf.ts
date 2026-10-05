/**
 * === AMÉLIORATION AJOUTÉE (accusé de réception en vrai fichier PDF) ===
 *
 * Signalé par l'utilisateur : « J'ai imprimé un accusé de réception en PDF
 * mais lorsque je l'ouvre il n'affiche rien ». Le bouton « Télécharger
 * l'accusé de réception » passait par `window.print()` : le résultat dépend
 * alors du navigateur et du téléphone (boîte d'impression, « Enregistrer en
 * PDF », page encore ouverte dans une ancienne version…), et certains
 * produisent une page vierge.
 *
 * Désormais, le bouton fabrique directement un fichier PDF (jsPDF, chargé
 * seulement au clic) et le télécharge : même contenu que l'accusé imprimable
 * (ReceiptPrintView.tsx) — numéro de dossier, date, catégorie, entité,
 * statut, mode de signalement et, à la fin du dépôt uniquement, le mot de
 * passe. Jamais la description des faits ni les personnes citées.
 * En cas d'échec, l'ancienne impression reste utilisée (repli).
 */
import type { AlertRecord } from '../types';
import { trData } from '../i18n/dataLabels';
import { getCurrentLang } from '../i18n/currentLang';

const STATUS_KEYS: Record<string, string> = {
  new: 'status_new',
  under_review: 'status_under_review',
  investigation: 'status_investigation',
  corrective_action: 'status_corrective_action',
  closed: 'status_closed',
  reopened: 'status_reopened',
  archived: 'status_archived',
};

export interface ReceiptRow {
  label: string;
  value: string;
}

/** Lignes de l'accusé (mêmes que ReceiptPrintView), plus le mot de passe s'il est connu. */
export function buildReceiptRows(t: Record<string, string>, alert: AlertRecord, password?: string, locale = 'fr-FR'): ReceiptRow[] {
  const submitted = new Date(alert.createdAt);
  const rows: ReceiptRow[] = [
    { label: t.ack_tracking_num, value: alert.trackingNumber },
    {
      label: t.receipt_print_submitted,
      value: `${submitted.toLocaleDateString(locale)} ${submitted.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`,
    },
    { label: t.track_field_category, value: trData(alert.category) },
    { label: t.track_field_entity, value: alert.concernedEntity },
    { label: t.receipt_print_status, value: t[STATUS_KEYS[alert.status] ?? ''] ?? alert.status },
    { label: t.receipt_print_identity, value: alert.whistleblower?.isAnonymous === false ? t.track_id_identified : t.track_id_anonymous },
  ];
  if (password) rows.push({ label: t.ack_password_label, value: password });
  return rows.map((r) => ({ label: r.label ?? '', value: r.value ?? '' }));
}

/** Nom de fichier sûr : accuse-reception-AACMR-26-10-0001.pdf */
export function receiptFileName(trackingNumber: string): string {
  const safe = (trackingNumber || 'dossier').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'dossier';
  return `accuse-reception-${safe}.pdf`;
}

/** Les polices PDF standard (WinAnsi) ne couvrent pas tous les caractères : remplacements sûrs. */
export function pdfSafeText(text: string): string {
  return (text ?? '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  ]/g, ' ');
}

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch('/brand/activa-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 100 });
      img.onerror = () => resolve({ w: 300, h: 100 });
      img.src = data;
    });
    return { data, ...size };
  } catch {
    return null;
  }
}

/**
 * Fabrique et télécharge l'accusé de réception en PDF. Renvoie `true` si le
 * fichier a été produit ; `false` en cas d'échec (l'appelant peut alors
 * revenir à l'impression).
 */
export async function downloadReceiptPdf(t: Record<string, string>, alert: AlertRecord, password?: string): Promise<boolean> {
  try {
    const { jsPDF } = await import('jspdf');
    const lang = getCurrentLang();
    const locale = lang === 'en' ? 'en-GB' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 18;
    const navy: [number, number, number] = [11, 37, 69];
    const slate: [number, number, number] = [100, 116, 139];
    const ink: [number, number, number] = [15, 23, 42];
    let y = M;

    // En-tête : logo à gauche, titre et date à droite.
    const logo = await loadLogo();
    if (logo) {
      const h = 14;
      doc.addImage(logo.data, 'PNG', M, y, (logo.w / logo.h) * h, h);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...navy);
    doc.text(pdfSafeText(t.receipt_print_title || 'Accusé de réception'), W - M, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...slate);
    doc.text(new Date().toLocaleDateString(locale), W - M, y + 12, { align: 'right' });
    y += 20;
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    y += 9;

    // Introduction.
    doc.setFontSize(10.5);
    doc.setTextColor(...ink);
    const intro = doc.splitTextToSize(pdfSafeText(t.receipt_print_intro || ''), W - 2 * M);
    doc.text(intro, M, y);
    y += intro.length * 5 + 6;

    // Tableau des informations.
    const labelW = 62;
    for (const row of buildReceiptRows(t, alert, password, locale)) {
      const isSecret = row.label === t.ack_password_label;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...ink);
      const label = doc.splitTextToSize(pdfSafeText(row.label), labelW - 4);
      doc.setFont(isSecret ? 'courier' : 'helvetica', isSecret ? 'bold' : 'normal');
      doc.setFontSize(isSecret ? 12 : 10.5);
      const value = doc.splitTextToSize(pdfSafeText(row.value), W - 2 * M - labelW);
      const lines = Math.max(label.length, value.length);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(label, M, y);
      doc.setFont(isSecret ? 'courier' : 'helvetica', isSecret ? 'bold' : 'normal');
      doc.setFontSize(isSecret ? 12 : 10.5);
      doc.text(value, M + labelW, y);
      y += lines * 5 + 3;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(M, y - 2, W - M, y - 2);
      y += 3;
    }

    // Encadré « À conserver en lieu sûr ».
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const note = doc.splitTextToSize(pdfSafeText(t.ack_credentials_note || ''), W - 2 * M - 10);
    const boxH = 12 + note.length * 4.6;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, W - 2 * M, boxH, 2, 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text(pdfSafeText(t.receipt_print_keep_title || ''), M + 5, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(note, M + 5, y + 13);
    y += boxH + 8;

    // Comment suivre le dossier.
    doc.setTextColor(...slate);
    const hint = doc.splitTextToSize(pdfSafeText(t.receipt_print_track_hint || ''), W - 2 * M);
    doc.text(hint, M, y);

    // Pied de page.
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(M, H - 18, W - M, H - 18);
    doc.setFontSize(8.5);
    doc.text(pdfSafeText(t.receipt_print_footer || ''), M, H - 12);

    doc.save(receiptFileName(alert.trackingNumber));
    return true;
  } catch (err) {
    console.warn('ACTIVA EthicAlert: accusé PDF non généré, repli sur l’impression', err);
    return false;
  }
}
