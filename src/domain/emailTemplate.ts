/**
 * === AMÉLIORATION AJOUTÉE (e-mails à l'image du portail) ===
 *
 * Demande de l'utilisateur : les e-mails d'alerte doivent porter le logo du
 * site d'alerte et le lien du portail, et « tout doit bien s'afficher ».
 *
 * Gabarit HTML commun à tous les e-mails envoyés (notifications, e-mail
 * d'essai, ancienne voie `notifyEmail`). Le texte brut reste envoyé en
 * parallèle (version `text` de Resend) pour les messageries qui n'affichent
 * pas le HTML.
 *
 * Contraintes des messageries (Gmail, Outlook, mobiles) respectées :
 * - mise en page en tableaux, styles en ligne, aucune feuille externe ;
 * - logo en PNG hébergé sur le portail (adresse absolue https), jamais en SVG ;
 * - bouton « à l'épreuve d'Outlook » (cellule colorée + lien) et lien en clair
 *   en dessous ;
 * - largeur maximale 600 px, lisible sur téléphone ;
 * - toutes les valeurs sont échappées (aucun HTML injecté depuis un dossier).
 *
 * Module pur (aucune dépendance) : utilisé par les Cloud Functions et testé
 * dans `emailTemplate.test.ts`.
 */

export const EMAIL_LOGO_PATH = '/brand/activa-whistleblowing-logo.png';
/** Proportions du fichier logo (1200 × 174). */
const LOGO_WIDTH = 230;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 174) / 1200);

const NAVY = '#0B2545';
const BLUE = '#1D4ED8';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SOFT = '#F1F5F9';
const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

export interface BrandedEmailFact {
  label: string;
  value: string;
}

export interface BrandedEmailInput {
  /** Adresse du portail (ex. https://activa-alertes.com), sans « / » final obligatoire. */
  appUrl: string;
  /** Titre affiché sous le logo. */
  title: string;
  /** Texte d'aperçu (affiché par la messagerie à côté du sujet). */
  preheader?: string;
  /** Paragraphes d'introduction (texte brut). */
  paragraphs: string[];
  /** Tableau « libellé / valeur » (dossier, entité, catégorie…). */
  facts?: BrandedEmailFact[];
  /** Bouton principal. */
  cta?: { label: string; url: string };
  /** Mention en petits caractères sous le bouton. */
  note?: string;
}

/** Échappe le texte pour l'insérer dans du HTML. */
export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Adresse du portail sans « / » final. */
export function normalizeAppUrl(appUrl: string): string {
  return String(appUrl || '').trim().replace(/\/+$/, '');
}

/** N'accepte que des liens https (ou http local) : jamais de `javascript:`. */
function safeHref(url: string): string {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? u : '#';
}

/** Rend un paragraphe de texte brut : URL cliquables, retours à la ligne conservés. */
function textToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m) => `<a href="${m}" style="color:${BLUE};text-decoration:underline;">${m}</a>`)
    .replace(/\n/g, '<br>');
}

/** Gabarit HTML complet (document autonome). */
export function renderBrandedEmailHtml(input: BrandedEmailInput): string {
  const base = normalizeAppUrl(input.appUrl);
  const logoUrl = `${base}${EMAIL_LOGO_PATH}`;
  const host = base.replace(/^https?:\/\//i, '');
  const paragraphs = input.paragraphs
    .filter((p) => p !== undefined && p !== null)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">${textToHtml(p)}</p>`
    )
    .join('');
  const facts = input.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${SOFT};border:1px solid ${LINE};border-radius:12px;margin:6px 0 22px 0;">
${input.facts
  .map(
    (f, i) => `<tr>
<td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}font-family:${FONT};font-size:13px;color:${MUTED};width:38%;vertical-align:top;">${escapeHtml(f.label)}</td>
<td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}font-family:${FONT};font-size:14px;color:${INK};font-weight:600;vertical-align:top;">${escapeHtml(f.value)}</td>
</tr>`
  )
  .join('\n')}
</table>`
    : '';
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px 0;">
<tr><td align="center" bgcolor="${BLUE}" style="border-radius:10px;background:${BLUE};">
<a href="${escapeHtml(safeHref(input.cta.url))}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(input.cta.label)}</a>
</td></tr>
</table>
<p style="margin:0 0 18px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(safeHref(input.cta.url))}" style="color:${BLUE};word-break:break-all;">${escapeHtml(input.cta.url)}</a></p>`
    : '';
  const note = input.note
    ? `<p style="margin:0;padding:12px 14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;font-family:${FONT};font-size:12.5px;line-height:1.5;color:#78350F;">${textToHtml(input.note)}</p>`
    : '';
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${SOFT};">${escapeHtml(input.preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SOFT};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
<tr><td style="height:5px;line-height:5px;font-size:0;background:${NAVY};">&nbsp;</td></tr>
<tr><td style="padding:26px 32px 18px 32px;border-bottom:1px solid ${LINE};">
<a href="${escapeHtml(safeHref(base))}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(logoUrl)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="activa.whistleblowing" style="display:block;border:0;outline:none;width:${LOGO_WIDTH}px;max-width:100%;height:auto;"></a>
<p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:${MUTED};">Canal de gestion des alertes du Groupe ACTIVA</p>
</td></tr>
<tr><td style="padding:26px 32px 28px 32px;">
<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:700;color:${NAVY};">${escapeHtml(input.title)}</h1>
${paragraphs}
${facts}
${cta}
${note}
</td></tr>
<tr><td style="padding:18px 32px 22px 32px;background:${NAVY};">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#CBD5E1;">activa-whistleblowing — message automatique, merci de ne pas répondre.</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;"><a href="${escapeHtml(safeHref(base))}" target="_blank" style="color:#ffffff;text-decoration:underline;">${escapeHtml(host)}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Habille un message en texte brut (ancienne voie `notifyEmail`, contenu déjà
 * validé) : chaque bloc séparé par une ligne vide devient un paragraphe, les
 * URL deviennent cliquables. La signature finale « — activa-whistleblowing… »
 * est retirée (le pied de page la remplace).
 */
export function plainTextToBrandedHtml(text: string, appUrl: string, title: string): string {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter((b) => !/^—\s*activa-whistleblowing/i.test(b));
  return renderBrandedEmailHtml({ appUrl, title, preheader: blocks[1] ?? blocks[0], paragraphs: blocks });
}
