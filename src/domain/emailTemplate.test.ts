// === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) ===
import { describe, expect, it } from 'vitest';
import { escapeHtml, plainTextToBrandedHtml, renderBrandedEmailHtml } from './emailTemplate';
// === AMÉLIORATION AJOUTÉE (présentation de l'expéditeur) ===
import { formatSender } from './emailTemplate';
import { buildNotificationEmail } from './emailNotificationRules';

const APP = 'https://activa-alertes.com/';

describe('renderBrandedEmailHtml', () => {
  it('affiche le logo du site et le lien du portail (adresses absolues)', () => {
    const html = renderBrandedEmailHtml({ appUrl: APP, title: 'Titre', paragraphs: ['Bonjour'] });
    expect(html).toContain('src="https://activa-alertes.com/brand/activa-whistleblowing-logo.png"');
    expect(html).toContain('href="https://activa-alertes.com"');
    expect(html).toContain('>activa-alertes.com</a>');
  });

  it('échappe tout le contenu (aucun HTML injecté)', () => {
    const html = renderBrandedEmailHtml({
      appUrl: APP,
      title: '<b>x</b>',
      paragraphs: ['<script>alert(1)</script>'],
      facts: [{ label: 'Entité', value: '"><img src=x onerror=1>' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml(`a&b<'"`)).toBe('a&amp;b&lt;&#39;&quot;');
  });

  it('refuse les liens non http(s) dans le bouton', () => {
    const html = renderBrandedEmailHtml({ appUrl: APP, title: 't', paragraphs: [], cta: { label: 'Go', url: 'javascript:alert(1)' } });
    expect(html).not.toContain('href="javascript:');
  });

  it('rend les URL du texte brut cliquables et retire la signature', () => {
    const html = plainTextToBrandedHtml('Bonjour,\n\nVoir https://activa-alertes.com/cases/A-1\n\n— activa-whistleblowing (message automatique)', APP, 'Sujet');
    expect(html).toContain('<a href="https://activa-alertes.com/cases/A-1"');
    expect(html).not.toContain('— activa-whistleblowing (message');
  });
});

describe('buildNotificationEmail (version HTML)', () => {
  it('contient le logo, le dossier et le bouton vers la fiche', () => {
    const { html } = buildNotificationEmail({
      event: 'new_report',
      group: 'supervisors',
      reason: 'always',
      appUrl: APP,
      facts: { reference: 'AACMR-26-10-0005', entity: 'ACTIVA Cameroun', country: 'Cameroun', category: 'Fraude', priority: 'high' } as never,
    });
    expect(html).toContain('activa-whistleblowing-logo.png');
    expect(html).toContain('href="https://activa-alertes.com/cases/AACMR-26-10-0005"');
    expect(html).toContain('Consulter le dossier');
    expect(html).toContain('Élevée');
  });
});

// === AMÉLIORATION AJOUTÉE (présentation de l'expéditeur) ===
describe('formatSender', () => {
  it('affiche le nom de l’application devant l’adresse configurée', () => {
    expect(formatSender('ACTIVA EthicAlert <alertes@activa-alertes.com>')).toBe('ACTIVA Whistleblowing <alertes@activa-alertes.com>');
    expect(formatSender('notifications@group-activa.com')).toBe('ACTIVA Whistleblowing <notifications@group-activa.com>');
  });
  it('utilise l’adresse par défaut si rien (ou rien de valide) n’est configuré', () => {
    expect(formatSender(undefined)).toBe('ACTIVA Whistleblowing <alertes@activa-alertes.com>');
    expect(formatSender('pas-une-adresse')).toBe('ACTIVA Whistleblowing <alertes@activa-alertes.com>');
  });
  it('respecte un nom imposé, sans caractères dangereux', () => {
    expect(formatSender('a@b.com', 'Alertes "ACTIVA"\r\n')).toBe('Alertes ACTIVA <a@b.com>');
  });
});

// === AMÉLIORATION AJOUTÉE (e-mail à l'enquêteur désigné) ===
import { buildInvestigatorAssignmentEmail } from './emailNotificationRules';
describe('buildInvestigatorAssignmentEmail', () => {
  const facts = { reference: 'AVGH-26-10-0002', entity: 'ACTIVA Vie Ghana', country: 'Ghana', category: 'Ressources humaines', priority: 'critical' } as never;
  it('salue l’enquêteur, donne le lien vers la fiche et la priorité', () => {
    const { subject, body, html } = buildInvestigatorAssignmentEmail({ facts, investigatorName: 'Awa Kouassi', appUrl: APP });
    expect(subject).toBe('Dossier attribué — AVGH-26-10-0002');
    expect(body).toContain('Bonjour Awa,');
    expect(body).toContain('https://activa-alertes.com/cases/AVGH-26-10-0002');
    expect(html).toContain('Bonjour Awa,');
    expect(html).toContain('href="https://activa-alertes.com/cases/AVGH-26-10-0002"');
    expect(html).toContain('Ouvrir le dossier');
    expect(html).toContain('Critique');
  });
  it('reste poli sans nom et échappe le contenu', () => {
    const { html } = buildInvestigatorAssignmentEmail({ facts: { ...(facts as object), entity: '<b>x</b>' } as never, appUrl: APP });
    expect(html).toContain('Bonjour, ce dossier');
    expect(html).not.toContain('<b>x</b>');
  });
});
