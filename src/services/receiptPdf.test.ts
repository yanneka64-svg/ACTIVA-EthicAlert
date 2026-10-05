/**
 * === AMÉLIORATION AJOUTÉE (accusé de réception en vrai fichier PDF) ===
 */
import { describe, expect, it } from 'vitest';
import type { AlertRecord } from '../types';
import { buildReceiptRows, pdfSafeText, receiptFileName } from './receiptPdf';

const t: Record<string, string> = {
  ack_tracking_num: 'Numéro',
  receipt_print_submitted: 'Date',
  track_field_category: 'Catégorie',
  track_field_entity: 'Entité',
  receipt_print_status: 'Statut',
  receipt_print_identity: 'Mode',
  track_id_anonymous: 'Anonyme',
  track_id_identified: 'Identifié',
  ack_password_label: 'Mot de passe',
  status_new: 'Nouveau',
};

const alert = {
  trackingNumber: 'AACMR-26-10-0001',
  createdAt: '2026-10-05T08:00:00.000Z',
  category: 'Fraude',
  concernedEntity: 'ACTIVA Assurances',
  status: 'new',
  whistleblower: { isAnonymous: true },
  detailedDescription: 'Faits confidentiels',
} as unknown as AlertRecord;

describe('buildReceiptRows', () => {
  it('reprend les informations de l’accusé, sans la description des faits', () => {
    const rows = buildReceiptRows(t, alert);
    expect(rows.map((r) => r.label)).toEqual(['Numéro', 'Date', 'Catégorie', 'Entité', 'Statut', 'Mode']);
    expect(rows[0].value).toBe('AACMR-26-10-0001');
    expect(rows[4].value).toBe('Nouveau');
    expect(rows[5].value).toBe('Anonyme');
    expect(JSON.stringify(rows)).not.toContain('Faits confidentiels');
  });

  it("n'ajoute le mot de passe que s'il est fourni (fin du dépôt)", () => {
    expect(buildReceiptRows(t, alert, 'KFebE8dP').at(-1)).toEqual({ label: 'Mot de passe', value: 'KFebE8dP' });
    expect(buildReceiptRows(t, alert).some((r) => r.label === 'Mot de passe')).toBe(false);
  });
});

describe('receiptFileName', () => {
  it('produit un nom de fichier sûr', () => {
    expect(receiptFileName('AACMR-26-10-0001')).toBe('accuse-reception-AACMR-26-10-0001.pdf');
    expect(receiptFileName('../x y')).toBe('accuse-reception-x-y.pdf');
    expect(receiptFileName('')).toBe('accuse-reception-dossier.pdf');
  });
});

describe('pdfSafeText', () => {
  it('remplace les caractères absents des polices PDF standard', () => {
    expect(pdfSafeText('l’équipe — « suivi »…')).toBe("l'équipe - « suivi »...");
  });
});
