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

// === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) ===
// Palette alignée sur le portail (bleu ACTIVA du site, fonds légèrement bleutés).
const BRAND = '#1449B0';
const BRAND_DEEP = '#0D357F';
const BRAND_LIGHT = '#2B63D6';
const BRAND_TINT = '#EEF3FC';
const PAGE_BG = '#EEF2F8';
const CARD_LINE = '#E3E8F2';

/** Tonalité d'une pastille (priorité, statut). */
export type EmailTone = 'neutral' | 'info' | 'success' | 'warning' | 'high' | 'danger';

const TONE: Record<EmailTone, { dot: string; text: string; bg: string; border: string }> = {
  neutral: { dot: '#64748B', text: '#334155', bg: '#F1F5F9', border: '#E2E8F0' },
  info: { dot: '#2B63D6', text: '#1449B0', bg: '#EEF3FC', border: '#D6E2F8' },
  success: { dot: '#16A34A', text: '#166534', bg: '#ECFDF3', border: '#C8EFD6' },
  warning: { dot: '#F59E0B', text: '#92400E', bg: '#FFFBEB', border: '#FDE9B8' },
  high: { dot: '#F97316', text: '#9A3412', bg: '#FFF4ED', border: '#FED7BF' },
  danger: { dot: '#EF4444', text: '#991B1B', bg: '#FEF2F2', border: '#FBD0D0' },
};

export interface BrandedEmailFact {
  label: string;
  value: string;
  // === AMÉLIORATION AJOUTÉE (refonte esthétique) === valeur affichée en pastille colorée.
  tone?: EmailTone;
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
  // === AMÉLIORATION AJOUTÉE (refonte esthétique) === bandeau bleu d'en-tête.
  /** Petite étiquette au-dessus du grand titre (ex. « Nouveau signalement »). */
  eyebrow?: string;
  /** Grand titre du bandeau (par défaut : `title`). */
  headline?: string;
  /** Phrase sous le grand titre. */
  subline?: string;
  /** Pastilles affichées dans le bandeau (ex. priorité). */
  badges?: { label: string; tone?: EmailTone }[];
  /** Ligne discrète « pourquoi je reçois cet e-mail ». */
  reason?: string;
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

// === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) ===
/** Pastille « point + libellé » compatible messageries (tableau, styles en ligne). */
function pillHtml(label: string, tone: EmailTone = 'neutral', onDark = false): string {
  const t = TONE[tone] ?? TONE.neutral;
  const bg = onDark ? '#FFFFFF' : t.bg;
  const border = onDark ? '#FFFFFF' : t.border;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;border-collapse:separate;"><tr><td bgcolor="${bg}" style="background:${bg};border:1px solid ${border};border-radius:999px;padding:5px 12px 5px 10px;font-family:${FONT};font-size:12.5px;line-height:1.2;font-weight:700;color:${t.text};white-space:nowrap;"><span style="color:${t.dot};font-size:13px;">&#9679;</span>&nbsp;${escapeHtml(label)}</td></tr></table>`;
}

/**
 * Gabarit HTML complet (document autonome).
 *
 * === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) ===
 * En-tête blanc avec le logo et la mention « Confidentiel », bandeau bleu
 * ACTIVA (étiquette d'événement, grand titre, pastille de priorité), fiche du
 * dossier en deux colonnes, bouton large, encadré de confidentialité bleuté,
 * pied de page clair. L'ancien gabarit reste disponible :
 * `renderBrandedEmailHtmlClassic`.
 */
export function renderBrandedEmailHtml(input: BrandedEmailInput): string {
  const base = normalizeAppUrl(input.appUrl);
  const logoUrl = `${base}${EMAIL_LOGO_PATH}`;
  const host = base.replace(/^https?:\/\//i, '');
  const headline = input.headline ?? input.title;

  const paragraphs = input.paragraphs
    .filter((p) => p !== undefined && p !== null)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};">${textToHtml(p)}</p>`
    )
    .join('');

  // Fiche du dossier : cases « libellé / valeur » deux par ligne (une seule sur téléphone).
  const factCell = (f: BrandedEmailFact | undefined, side: 'l' | 'r') =>
    f
      ? `<td class="aw-col" width="50%" valign="top" style="width:50%;padding:${side === 'l' ? '14px 10px 14px 18px' : '14px 18px 14px 10px'};vertical-align:top;">
<p style="margin:0 0 5px 0;font-family:${FONT};font-size:11px;line-height:1.3;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(f.label)}</p>
${f.tone ? pillHtml(f.value, f.tone) : `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.45;font-weight:600;color:${INK};">${escapeHtml(f.value)}</p>`}
</td>`
      : `<td class="aw-col" width="50%" style="width:50%;padding:0;">&nbsp;</td>`;
  const factRows: string[] = [];
  const list = input.facts ?? [];
  for (let i = 0; i < list.length; i += 2) {
    factRows.push(
      `<tr>${factCell(list[i], 'l')}${factCell(list[i + 1], 'r')}</tr>${i + 2 < list.length ? `<tr><td colspan="2" style="padding:0 18px;"><div style="height:1px;line-height:1px;font-size:0;background:${CARD_LINE};">&nbsp;</div></td></tr>` : ''}`
    );
  }
  const facts = list.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:1px solid ${CARD_LINE};border-radius:14px;margin:8px 0 24px 0;">
${factRows.join('\n')}
</table>`
    : '';

  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="aw-btn" style="margin:2px 0 12px 0;">
<tr><td align="center" bgcolor="${BRAND}" style="border-radius:12px;background:${BRAND};">
<a href="${escapeHtml(safeHref(input.cta.url))}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(input.cta.label)}&nbsp;&nbsp;&rarr;</a>
</td></tr>
</table>
<p style="margin:0 0 22px 0;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(safeHref(input.cta.url))}" style="color:${BRAND};word-break:break-all;">${escapeHtml(input.cta.url)}</a></p>`
    : '';

  const note = input.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${BRAND_TINT};border-radius:12px;margin:0 0 4px 0;">
<tr>
<td width="44" valign="top" style="width:44px;padding:14px 0 14px 16px;vertical-align:top;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="30" height="30" align="center" valign="middle" bgcolor="#FFFFFF" style="width:30px;height:30px;border-radius:999px;background:#FFFFFF;font-size:14px;line-height:30px;">&#128274;</td></tr></table>
</td>
<td valign="top" style="padding:14px 18px 14px 10px;vertical-align:top;font-family:${FONT};font-size:13px;line-height:1.55;color:#1E3A6E;"><strong style="color:${BRAND_DEEP};">Confidentialité.</strong> ${textToHtml(input.note)}</td>
</tr>
</table>`
    : '';

  const reason = input.reason
    ? `<p style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">${textToHtml(input.reason)}</p>`
    : '';

  const eyebrow = input.eyebrow
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;"><tr><td bgcolor="#2F62C9" style="background:#2F62C9;border:1px solid #4A78D4;border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:11px;line-height:1.2;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#FFFFFF;">${escapeHtml(input.eyebrow)}</td></tr></table>`
    : '';
  const subline = input.subline
    ? `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.55;color:#DCE6FB;">${escapeHtml(input.subline)}</p>`
    : '';
  const badges = input.badges?.length
    ? `<div style="margin:18px 0 0 0;">${input.badges.map((b) => pillHtml(b.label, b.tone, true)).join('&nbsp;&nbsp;')}</div>`
    : '';

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};">${escapeHtml(input.preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.title)}</title>
<style>
@media only screen and (max-width:520px){
  .aw-px{padding-left:20px !important;padding-right:20px !important;}
  .aw-h1{font-size:23px !important;}
  .aw-col{display:block !important;width:100% !important;box-sizing:border-box;padding:12px 16px !important;}
  .aw-btn{width:100% !important;}
  .aw-btn a{display:block !important;}
  .aw-tag{display:none !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${CARD_LINE};border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(13,53,127,.08);">
<tr><td class="aw-px" style="padding:22px 32px;background:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="vertical-align:middle;"><a href="${escapeHtml(safeHref(base))}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(logoUrl)}" width="200" height="${Math.round((200 * 174) / 1200)}" alt="activa.whistleblowing" style="display:block;border:0;outline:none;width:200px;max-width:100%;height:auto;"></a></td>
<td class="aw-tag" align="right" valign="middle" style="vertical-align:middle;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${MUTED};white-space:nowrap;">&#128274;&nbsp;Confidentiel</td>
</tr></table>
</td></tr>
<tr><td class="aw-px" bgcolor="${BRAND}" style="padding:30px 32px 30px 32px;background:${BRAND};background-image:linear-gradient(135deg,${BRAND_LIGHT} 0%,${BRAND} 52%,${BRAND_DEEP} 100%);">
${eyebrow}
<h1 class="aw-h1" style="margin:0;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:#FFFFFF;">${escapeHtml(headline)}</h1>
${subline}
${badges}
</td></tr>
<tr><td class="aw-px" style="padding:28px 32px 30px 32px;">
${paragraphs}
${facts}
${cta}
${note}
${reason}
</td></tr>
<tr><td class="aw-px" bgcolor="#F6F8FC" style="padding:20px 32px 24px 32px;background:#F6F8FC;border-top:1px solid ${CARD_LINE};">
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">Canal de gestion des alertes du Groupe ACTIVA &middot; message automatique, merci de ne pas répondre.</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;"><a href="${escapeHtml(safeHref(base))}" target="_blank" style="color:${BRAND};font-weight:700;text-decoration:none;">${escapeHtml(host)}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * === AMÉLIORATION AJOUTÉE (refonte esthétique des e-mails) ===
 * Gabarit d'origine, conservé à l'identique (non utilisé) : permet de revenir
 * en arrière en une ligne si besoin.
 */
export function renderBrandedEmailHtmlClassic(input: BrandedEmailInput): string {
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
