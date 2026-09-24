/**
 * === AMÉLIORATION AJOUTÉE : traduction à l'affichage des données par défaut ===
 *
 * Les catégories, sous-catégories, types d'impact, pays et libellés de
 * traitement sont des DONNÉES (activaConfig.ts, stockées telles quelles dans
 * les dossiers), pas des textes d'interface : elles restent enregistrées en
 * français, sans aucune migration. Seul leur affichage est traduit ici.
 *
 * Toute valeur absente du dictionnaire (ex. catégorie créée par un
 * administrateur) est affichée telle que saisie — jamais inventée.
 */
import { Language } from '../types';
import { getCurrentLang } from './currentLang';

type Tr = { en: string; pt: string };

const DATA_LABELS: Record<string, Tr> = {
  // --- Catégories (ALERT_CATEGORIES) ---
  'Intégrité des affaires et relation client': { en: 'Business integrity and customer relations', pt: 'Integridade nos negócios e relação com o cliente' },
  'Fraude, Corruption et pots-de-vin': { en: 'Fraud, Corruption and bribery', pt: 'Fraude, Corrupção e subornos' },
  'Ressources Humaines et diversité': { en: 'Human Resources and diversity', pt: 'Recursos Humanos e diversidade' },
  'Environnement, Santé et Sécurité': { en: 'Environment, Health and Safety', pt: 'Ambiente, Saúde e Segurança' },
  'Autres manquements graves': { en: 'Other serious breaches', pt: 'Outros incumprimentos graves' },
  // --- Sous-catégories ---
  'Non-respect du code éthique': { en: 'Breach of the code of ethics', pt: 'Incumprimento do código de ética' },
  'Abus de position': { en: 'Abuse of position', pt: 'Abuso de posição' },
  'Cadeaux et avantages inappropriés et/ou non déclarés': { en: 'Inappropriate and/or undeclared gifts and benefits', pt: 'Presentes e vantagens inadequados e/ou não declarados' },
  'Détournement de fonds': { en: 'Embezzlement', pt: 'Desvio de fundos' },
  'Fraude sur les sinistres': { en: 'Claims fraud', pt: 'Fraude em sinistros' },
  'Corruption, pots-de-vin': { en: 'Corruption, bribery', pt: 'Corrupção, subornos' },
  "Conflits d'intérêts": { en: 'Conflicts of interest', pt: 'Conflitos de interesses' },
  'Harcèlement moral ou sexuel': { en: 'Psychological or sexual harassment', pt: 'Assédio moral ou sexual' },
  'Discrimination': { en: 'Discrimination', pt: 'Discriminação' },
  'Conditions de travail dangereuses': { en: 'Dangerous working conditions', pt: 'Condições de trabalho perigosas' },
  'Risques pour la sécurité': { en: 'Safety risks', pt: 'Riscos para a segurança' },
  "Atteintes à l'environnement": { en: 'Harm to the environment', pt: 'Danos ao ambiente' },
  'Violation des règles de cybersécurité': { en: 'Breach of cybersecurity rules', pt: 'Violação das regras de cibersegurança' },
  'Cette catégorie comprend toute allégation non mentionnée dans les autres rubriques': { en: 'This category covers any allegation not mentioned under the other headings', pt: 'Esta categoria abrange qualquer alegação não mencionada nas outras rubricas' },
  // --- Types d'impact (IMPACT_TYPES) ---
  'Financier direct': { en: 'Direct financial', pt: 'Financeiro direto' },
  'Juridique / Réglementaire (CIMA, régulateur local)': { en: 'Legal / Regulatory (CIMA, local regulator)', pt: 'Jurídico / Regulamentar (CIMA, regulador local)' },
  'Réputationnel et Image de marque': { en: 'Reputation and brand image', pt: 'Reputacional e imagem de marca' },
  'Opérationnel / Interruption d’activité': { en: 'Operational / Business interruption', pt: 'Operacional / Interrupção de atividade' },
  'Humain (santé, sécurité physique ou mentale)': { en: 'Human (health, physical or mental safety)', pt: 'Humano (saúde, segurança física ou mental)' },
  'Cybersécurité et Fuite de données clients': { en: 'Cybersecurity and customer data leak', pt: 'Cibersegurança e fuga de dados de clientes' },
  'Autre impact critique': { en: 'Other critical impact', pt: 'Outro impacto crítico' },
  // --- Pays (ACTIVA_COUNTRIES) ---
  'Cameroun': { en: 'Cameroon', pt: 'Camarões' },
  'RD Congo': { en: 'DR Congo', pt: 'RD Congo' },
  'Guinée': { en: 'Guinea', pt: 'Guiné' },
  'Côte d’Ivoire': { en: 'Côte d’Ivoire', pt: 'Costa do Marfim' },
  'Ghana': { en: 'Ghana', pt: 'Gana' },
  'Libéria': { en: 'Liberia', pt: 'Libéria' },
  'Sierra Leone': { en: 'Sierra Leone', pt: 'Serra Leoa' },
  'Maurice': { en: 'Mauritius', pt: 'Maurícia' },
  'France': { en: 'France', pt: 'França' },
  'Angola': { en: 'Angola', pt: 'Angola' },
  'Groupe ACTIVA': { en: 'ACTIVA Group', pt: 'Grupo ACTIVA' },
  'Toutes entités': { en: 'All entities', pt: 'Todas as entidades' },
  // --- Niveaux hiérarchiques / types de déclarant enregistrés ---
  'Employé': { en: 'Employee', pt: 'Colaborador' },
  'Cadre': { en: 'Manager', pt: 'Quadro' },
  'Sous-Directeur': { en: 'Deputy Director', pt: 'Subdiretor' },
  'Directeur+': { en: 'Director+', pt: 'Diretor+' },
  'Consultant': { en: 'Consultant', pt: 'Consultor' },
  'Prestataire': { en: 'Contractor', pt: 'Prestador' },
  'Client': { en: 'Client', pt: 'Cliente' },
  'Autre': { en: 'Other', pt: 'Outro' },
};

// Libellés de traitement produits par computeRiskEvaluation (activaConfig.ts).
const TREATMENT_PATTERNS: { re: RegExp; en: (n: string) => string; pt: (n: string) => string }[] = [
  { re: /^Action immédiate \(48h\)$/, en: () => 'Immediate action (48h)', pt: () => 'Ação imediata (48h)' },
  { re: /^Action immédiate \((\d+) jours\)$/, en: (n) => `Immediate action (${n} days)`, pt: (n) => `Ação imediata (${n} dias)` },
  { re: /^Enquête urgente \((\d+) jours\)$/, en: (n) => `Urgent investigation (${n} days)`, pt: (n) => `Investigação urgente (${n} dias)` },
  { re: /^Suivi renforcé \((\d+) jours\)$/, en: (n) => `Enhanced follow-up (${n} days)`, pt: (n) => `Acompanhamento reforçado (${n} dias)` },
  { re: /^Traitement standard \((\d+) jours\)$/, en: (n) => `Standard processing (${n} days)`, pt: (n) => `Tratamento padrão (${n} dias)` },
  { re: /^Traitement standard$/, en: () => 'Standard processing', pt: () => 'Tratamento padrão' },
];

/**
 * Traduit pour l'affichage une donnée par défaut connue ; renvoie la valeur
 * d'origine si elle est inconnue ou si la langue est le français.
 */
export function trData(value: string | undefined | null, lang: Language = getCurrentLang()): string {
  if (!value) return value ?? '';
  if (lang === 'fr') return value;
  const hit = DATA_LABELS[value];
  if (hit) return hit[lang];
  for (const p of TREATMENT_PATTERNS) {
    const m = value.match(p.re);
    if (m) return p[lang](m[1] ?? '');
  }
  return value;
}
