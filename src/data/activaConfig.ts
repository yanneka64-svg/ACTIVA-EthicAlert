import {
  AlertRecord,
  AuditLogEntry,
  RiskEvaluation,
  UserProfile,
  PriorityLevel,
  NocaThreshold,
  UserRole,
  EscalationRecipient
} from '../types';

// === AMÉLIORATION AJOUTÉE : code officiel de numérotation des dossiers ===
// `code` est le préfixe utilisé dans le numéro de dossier officiel Groupe
// (format XX-YY-MM-XXXX, ex. AARDC-26-09-0001 — voir
// storage.generateCaseNumber ci-dessous). Les 13 codes des entités listées
// ci-dessous sont ceux fournis par la DARC Groupe ; les 3 entités restantes
// (Fondation ACTIVA, ACTIVA Europe, ACTIVA Angola) n'étaient pas couvertes
// par cette liste et reçoivent un code générique à 4 lettres, modifiable
// dans Administration (AdminConfigView, onglet Entités).
export interface EntityDef {
  id: string;
  name: string;
  country: string;
  flag: string;
  code: string;
}

// === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
// Single source of truth for the NOCA→target-treatment-delay mapping,
// previously hardcoded in three separate places (computeRiskEvaluation's
// expectedTreatment text below, AlertSubmissionFlow's targetCompletionDate
// calculation, and AdminConfigView's static display). storage.ts seeds its
// mutable, persisted copy from this constant — same seed-then-mutate
// pattern already used for Entities/Categories/Users.
export interface SlaConfig {
  noca1Days: number; // Faible
  noca2Days: number; // Élevée
  noca3Days: number; // Très élevée
  noca4Days: number; // Critique
}

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  noca1Days: 30,
  noca2Days: 15,
  noca3Days: 7,
  noca4Days: 2,
};

// === AMÉLIORATION AJOUTÉE (Phase 1 — routage indépendant) ===
// Hiérarchie PAR RÔLE (pas par utilisateur individuel — aucune "ligne
// hiérarchique" nominative n'est modélisée dans ce système, voir le plan).
// Même motif seed-then-mutate que SlaConfig/DEFAULT_SLA_CONFIG ci-dessus :
// storage.ts seed sa copie mutable/persistée depuis cette constante,
// éditable en administration (AdminConfigView.tsx, onglet "Gouvernance",
// Phase 5), jamais codée en dur dans le moteur de routage lui-même
// (src/domain/independentRouting.ts, Phase 3).
//
// Chaque rôle a une valeur DISTINCTE (jamais d'ex-æquo entre deux rôles
// pouvant réellement traiter un dossier, sinon la recherche "niveau
// strictement supérieur" échouerait silencieusement). Vérifié contre
// ROLE_PERMISSIONS (domain/permissions.ts) : un investigator mis en cause
// trouve un senior_investigator au-dessus ; un senior_investigator mis en
// cause trouve functional_admin/darc_compliance ; darc_compliance (le rôle
// opérationnel le plus élevé) mis en cause ne trouve légitimement AUCUNE
// autorité indépendante — cas NO_INDEPENDENT_AUTHORITY_FOUND prévu par
// conception, pas un bug. Les rôles au niveau 7 (executive/consultation/
// audit_committee) n'ont ni cases.edit ni cases.assign et ne sont donc
// jamais éligibles comme cible de routage, quel que soit leur niveau —
// confirme le §63 "privilège technique ≠ autorité d'investigation".
export type HierarchyLevels = Record<UserRole, number>;

export const DEFAULT_HIERARCHY_LEVELS: HierarchyLevels = {
  reporter: 1,
  investigator: 3,
  senior_investigator: 4,
  functional_admin: 5,
  system_admin: 5,
  security_admin: 5,
  darc_compliance: 6,
  executive: 7,
  consultation: 7,
  audit_committee: 7,
};

// === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
// Type nommé, même motif que EntityDef/CategoryDef ci-dessous — jusqu'ici
// ACTIVA_COUNTRIES n'avait qu'un type inféré. Purement déclaratif : ne
// change ni la forme ni les valeurs du tableau existant.
export interface CountryDef {
  code: string;
  name: string;
  flag: string;
}

export const ACTIVA_COUNTRIES: CountryDef[] = [
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'CD', name: 'RD Congo', flag: '🇨🇩' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳' },
  { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'LR', name: 'Libéria', flag: '🇱🇷' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
  { code: 'MU', name: 'Maurice', flag: '🇲🇺' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
];

// === AMÉLIORATION AJOUTÉE (drapeaux devant le nom des pays, partout où il
// s'affiche) === Recherche par NOM (c'est ce que les dossiers/comptes
// stockent, jamais le code) dans la liste réelle passée en argument — pas
// uniquement ACTIVA_COUNTRIES en dur, pour rester correct même si un
// administrateur a ajouté un pays personnalisé (Administration → Pays).
// Retourne '' (jamais une exception) si le nom est absent/inconnu — un
// affichage sans drapeau plutôt qu'un plantage.
export function getCountryFlag(countries: CountryDef[], name: string | undefined): string {
  if (!name) return '';
  return countries.find((c) => c.name === name)?.flag ?? '';
}

// Nom de pays préfixé de son drapeau ("🇨🇲 Cameroun"), sans espace parasite
// quand le nom est absent/inconnu (ex. "Groupe ACTIVA", un libellé Groupe et
// non un vrai pays) — à utiliser plutôt que de composer `${getCountryFlag(...)} ${name}`
// soi-même à chaque site d'affichage.
export function formatCountryLabel(countries: CountryDef[], name: string | undefined): string {
  const flag = getCountryFlag(countries, name);
  return flag ? `${flag} ${name}` : name ?? '';
}

export const ACTIVA_ENTITIES: EntityDef[] = [
  { id: 'cm_assurances', name: 'ACTIVA Assurances', country: 'Cameroun', flag: '🇨🇲', code: 'AACMR' },
  { id: 'cm_vie', name: 'ACTIVA Vie', country: 'Cameroun', flag: '🇨🇲', code: 'AVCMR' },
  { id: 'cd_assurances', name: 'ACTIVA Assurances RDC', country: 'RD Congo', flag: '🇨🇩', code: 'AARDC' },
  { id: 'cd_vie', name: 'ACTIVA Vie RDC', country: 'RD Congo', flag: '🇨🇩', code: 'AVRDC' },
  { id: 'gn_ugar', name: 'UGAR ACTIVA', country: 'Guinée', flag: '🇬🇳', code: 'UGAR' },
  { id: 'gn_vie', name: 'ACTIVA Vie Guinée', country: 'Guinée', flag: '🇬🇳', code: 'AVGU' },
  { id: 'ci_activa', name: 'ACTIVA Côte d’Ivoire', country: 'Côte d’Ivoire', flag: '🇨🇮', code: 'AACIV' },
  { id: 'gh_activa', name: 'ACTIVA International Ghana', country: 'Ghana', flag: '🇬🇭', code: 'AIIG' },
  { id: 'lr_activa', name: 'ACTIVA International Liberia', country: 'Libéria', flag: '🇱🇷', code: 'AIIL' },
  { id: 'sl_activa', name: 'ACTIVA International Sierra Leone', country: 'Sierra Leone', flag: '🇸🇱', code: 'AISL' },
  { id: 'mu_finance', name: 'ACTIVA Finance', country: 'Maurice', flag: '🇲🇺', code: 'AF' },
  { id: 'mu_re', name: 'ACTIVA Ré', country: 'Maurice', flag: '🇲🇺', code: 'AREA' },
  { id: 'mu_ats', name: 'Africa Technology Services (ATS)', country: 'Maurice', flag: '🇲🇺', code: 'ATS' },
  // Entités hors liste officielle DARC — code générique, à ajuster en Administration si besoin.
  { id: 'mu_fondation', name: 'Fondation ACTIVA', country: 'Maurice', flag: '🇲🇺', code: 'AFON' },
  { id: 'fr_europe', name: 'ACTIVA Europe', country: 'France', flag: '🇫🇷', code: 'AEUR' },
  { id: 'ao_activa', name: 'ACTIVA Angola', country: 'Angola', flag: '🇦🇴', code: 'AANG' },
];

export interface CategoryDef {
  id: string;
  name: string;
  subCategories: string[];
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  // 3 champs additifs, jamais renseignés pour les catégories déjà semées
  // via `ALERT_CATEGORIES` ci-dessous (backfill réel dans storage.ts, pas
  // ici) :
  // - `code` : identifiant court stable (ex. "CAT-001"), calculé une seule
  //   fois depuis la position réelle dans la liste, jamais réinventé à
  //   chaque rendu (sinon une suppression déciderait les codes suivants).
  // - `active` : bascule Actif/Inactif (défaut `true` si absent — aucune
  //   catégorie existante ne doit apparaître comme désactivée sans action
  //   explicite d'un admin).
  // - `createdAt` : ISO réel, posé uniquement à la création. Les
  //   catégories déjà présentes avant cet ajout n'ont pas de date de
  //   création réelle connue — laissé `undefined` plutôt que d'en
  //   fabriquer une (affiché "—" côté UI, jamais une date inventée).
  code?: string;
  active?: boolean;
  createdAt?: string;
}

export const ALERT_CATEGORIES: CategoryDef[] = [
  {
    id: 'business_integrity',
    name: 'Intégrité des affaires et relation client',
    subCategories: [
      'Non-respect du code éthique',
      'Abus de position',
      'Cadeaux et avantages inappropriés et/ou non déclarés',
    ],
  },
  {
    id: 'fraud_corruption',
    name: 'Fraude, Corruption et pots-de-vin',
    subCategories: [
      'Détournement de fonds',
      'Fraude sur les sinistres',
      'Corruption, pots-de-vin',
      'Conflits d\'intérêts',
    ],
  },
  {
    id: 'hr_diversity',
    name: 'Ressources Humaines et diversité',
    subCategories: [
      'Harcèlement moral ou sexuel',
      'Discrimination',
    ],
  },
  {
    id: 'ehs_security',
    name: 'Environnement, Santé et Sécurité',
    subCategories: [
      'Conditions de travail dangereuses',
      'Risques pour la sécurité',
      'Atteintes à l\'environnement',
      'Violation des règles de cybersécurité',
    ],
  },
  {
    id: 'other_breaches',
    name: 'Autres manquements graves',
    subCategories: [
      'Cette catégorie comprend toute allégation non mentionnée dans les autres rubriques',
    ],
  },
];

export const IMPACT_TYPES = [
  'Financier direct',
  'Juridique / Réglementaire (CIMA, régulateur local)',
  'Réputationnel et Image de marque',
  'Opérationnel / Interruption d’activité',
  'Humain (santé, sécurité physique ou mentale)',
  'Cybersécurité et Fuite de données clients',
  'Autre impact critique',
];

export function computeRiskEvaluation(
  financialImpact: 1 | 2 | 3 | 4,
  hierarchyLevel: 1 | 2 | 3 | 4,
  recidivism: 1 | 2 | 3 | 4,
  reputationRisk: 1 | 2 | 3 | 4,
  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
  // Optional, defaults to DEFAULT_SLA_CONFIG so every existing call site
  // (this function's signature was previously 4 required args) keeps
  // behaving exactly as before. Callers that care about admin-edited
  // thresholds (AlertSubmissionFlow) pass storage.getSlaConfig().
  slaConfig: SlaConfig = DEFAULT_SLA_CONFIG
): RiskEvaluation {
  const totalScore = financialImpact + hierarchyLevel + recidivism + reputationRisk;
  let nocaThreshold: NocaThreshold = 'NOCA 1';
  let priority: PriorityLevel = 'faible';
  let expectedTreatment = 'Traitement standard';

  if (totalScore >= 14) {
    nocaThreshold = 'NOCA 4';
    priority = 'critique';
    expectedTreatment = slaConfig.noca4Days <= 2 ? 'Action immédiate (48h)' : `Action immédiate (${slaConfig.noca4Days} jours)`;
  } else if (totalScore >= 11) {
    nocaThreshold = 'NOCA 3';
    priority = 'tres_elevee';
    expectedTreatment = `Enquête urgente (${slaConfig.noca3Days} jours)`;
  } else if (totalScore >= 7) {
    nocaThreshold = 'NOCA 2';
    priority = 'elevee';
    expectedTreatment = `Suivi renforcé (${slaConfig.noca2Days} jours)`;
  } else {
    nocaThreshold = 'NOCA 1';
    priority = 'faible';
    expectedTreatment = `Traitement standard (${slaConfig.noca1Days} jours)`;
  }

  return {
    financialImpact,
    hierarchyLevel,
    recidivism,
    reputationRisk,
    totalScore,
    nocaThreshold,
    priority,
    expectedTreatment,
  };
}

// === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
// `countries`/`entities` ci-dessous sont le PÉRIMÈTRE d'habilitation réel
// (nouveaux champs additifs sur UserProfile) — les champs `entity`/
// `country` existants restent inchangés, simple libellé d'affichage. Un
// tableau vide signifie "vision Groupe" (aucune restriction), réservé aux
// rôles déjà à vision globale (voir GLOBAL_VISIBILITY_ROLES dans
// domain/permissions.ts). `active: true` pour tous les comptes existants —
// aucun ne devient silencieusement indisponible pour le moteur
// d'attribution (Phase 4).
// === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de démonstration ===
// Les 9 comptes fictifs précédemment définis ici (noms/emails inventés pour
// la démonstration) ont été retirés sur demande explicite — l'application
// ne doit plus embarquer d'identités fictives. Un navigateur neuf démarre
// désormais avec un unique compte réel (voir `emergencyAdminSeed()` dans
// storage.ts) ; tous les autres comptes sont créés par un administrateur
// via Administration → Utilisateurs, avec de vraies adresses.
export const INITIAL_USERS: UserProfile[] = [];

// === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
// routage) === Les 2 premiers sont liés à un compte EthicAlert déjà réel
// ci-dessus (usr-senior-investigator/usr-darc-compliance) — l'escalade ou
// le routage vers eux leur donne un accès in-app réel au dossier. Les 2
// derniers (RH, DGA Groupe) n'ont volontairement PAS de compte : ils sont
// notifiés par e-mail uniquement, jamais un accès fictif au dossier.
export const INITIAL_ESCALATION_RECIPIENTS: EscalationRecipient[] = [
  // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de démonstration ===
  // `linkedUserId` retiré (comptes fictifs correspondants supprimés de
  // INITIAL_USERS) — ces 2 entrées basculent en "e-mail uniquement", même
  // comportement que rec-003/rec-004 ci-dessous, jusqu'à ce qu'un
  // administrateur les relie à un vrai compte via Administration.
  {
    id: 'rec-001',
    identifiant: 'GRP-INV-001',
    nom: 'Grace Mensah',
    email: 'g.mensah@group-activa.com',
    fonction: 'Responsable des Investigations Groupe',
    grade: 3,
    active: true,
  },
  {
    id: 'rec-002',
    identifiant: 'GRP-DARC-001',
    nom: 'DARC Groupe',
    email: 'darc-groupe@group-activa.com',
    fonction: 'Directeur Audit, Risques et Conformité Groupe',
    grade: 4,
    active: true,
  },
  {
    id: 'rec-003',
    identifiant: 'GRP-RH-001',
    nom: 'Aïssatou Diallo',
    email: 'a.diallo@group-activa.com',
    fonction: 'Directeur des Ressources Humaines',
    grade: 4,
    active: true,
  },
  {
    id: 'rec-004',
    identifiant: 'GRP-DGA-001',
    nom: 'Jean-Paul Nguema',
    email: 'jp.nguema@group-activa.com',
    fonction: 'Directeur Général Adjoint Groupe',
    grade: 5,
    active: true,
  },
];

export const INITIAL_ALERTS: AlertRecord[] = [
  {
    id: 'alt-001',
    trackingNumber: 'AACMR-26-09-0001',
    // === AMÉLIORATION AJOUTÉE : mot de passe démo stocké sous forme de hash salé (jamais en clair) ===
    accessCodeHash: '963328f618f6d7b271122d80c93eec1d37d84d3956ed115f185f34179ab2d306',
    accessCodeSalt: 'a1b2c3d4e5f60718',
    channel: 'web',
    createdAt: '2026-09-08T10:14:00Z',
    updatedAt: '2026-09-11T14:30:00Z',
    targetCompletionDate: '2026-09-15T18:00:00Z',
    // === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
    // Fraude/corruption impliquant un tiers externe : niveau le plus
    // sensible — seuls senior_investigator/functional_admin/darc_compliance
    // y ont accès (voir domain/permissions.ts ROLE_MAX_CONFIDENTIALITY).
    confidentialityLevel: 'highly_confidential',
    whistleblower: {
      isAnonymous: true,
      declarantType: 'Employé',
      entity: 'ACTIVA Assurances',
    },
    category: 'Fraude, Corruption et pots-de-vin',
    subCategory: 'Fraude sur les sinistres',
    detailedDescription: 'Soupçon de validation complaisante de règlements de sinistres automobiles corporels avec un cabinet d\'expertise externe non agréé.',
    incidentDates: '2026-08-14 au 2026-08-28',
    incidentLocation: 'Direction Sinistres - Siège Douala',
    concernedEntity: 'ACTIVA Assurances',
    country: 'Cameroun',
    // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
    countryId: 'CM',
    entityId: 'cm_assurances',
    riskEvaluation: {
      financialImpact: 3,
      hierarchyLevel: 3,
      recidivism: 2,
      reputationRisk: 3,
      totalScore: 11,
      nocaThreshold: 'NOCA 3',
      priority: 'tres_elevee',
      expectedTreatment: 'Enquête urgente (7 jours)',
    },
    impactType: 'Financier direct',
    estimatedImpactValue: '18 500 €',
    involvedPersons: [
      {
        id: 'inv-1',
        name: 'Confidentiel (Sous-Directeur Règlement)',
        position: 'Sous-Directeur Règlement Sinistres',
        hierarchyRole: 'Sous-Directeur',
      },
    ],
    witnesses: [
      {
        id: 'wit-1',
        name: 'Gestionnaire de sinistre junior',
        position: 'Rédacteur Sinistre',
        hierarchyRole: 'Employé',
      },
    ],
    evidences: [
      {
        id: 'ev-1',
        name: 'Bordereau_reglement_litigieux.pdf',
        size: 428000,
        type: 'application/pdf',
        uploadedAt: '2026-09-08T10:14:00Z',
      },
    ],
    status: 'investigation',
    // === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de démonstration ===
    // Compte fictif assigné retiré (voir INITIAL_USERS) — dossier de
    // démonstration désormais non assigné, un état déjà pleinement
    // supporté par l'application.
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [
      {
        id: 'not-1',
        authorId: 'usr-investigator-2',
        authorName: 'Chantal Ngo',
        authorRole: 'Investigatrice DARC',
        content: 'Première vérification des extractions informatiques SAP/Assurance effectuée : 3 dossiers de sinistres présentent des coordonnées bancaires similaires à celles du cabinet tiers.',
        createdAt: '2026-09-09T16:20:00Z',
        isPrivate: true,
      },
    ],
    messages: [
      {
        id: 'msg-1',
        sender: 'whistleblower',
        senderDisplayName: 'Lanceur d’alerte (Anonyme)',
        content: 'J\'ai ajouté la référence des 2 autres dossiers suspects sur le système dans les pièces jointes.',
        createdAt: '2026-09-10T09:12:00Z',
      },
      {
        id: 'msg-2',
        sender: 'investigator',
        senderDisplayName: 'DARC Groupe ACTIVA',
        content: 'Bien reçu. Nos équipes d\'audit analysent ces documents sous strict sceau de confidentialité. Votre identité demeure entièrement protégée.',
        createdAt: '2026-09-10T11:45:00Z',
      },
    ],
    correctiveMeasures: [
      {
        id: 'cm-1',
        title: 'Suspension préventive des droits de validation automatique sur les sinistres > 5M FCFA',
        description: 'Double validation requise au niveau du Directeur Technique et du Contrôle de Gestion.',
        responsiblePerson: 'Directeur Technique Sinistres',
        dueDate: '2026-09-20',
        status: 'in_progress',
        documentedBy: 'Chantal Ngo',
        documentedAt: '2026-09-11T14:30:00Z',
      },
    ],
  },
  {
    id: 'alt-002',
    trackingNumber: 'AACIV-26-08-0001',
    // === AMÉLIORATION AJOUTÉE : mot de passe démo stocké sous forme de hash salé (jamais en clair) ===
    accessCodeHash: '01f405bc3bd87150bdfa4fc5c2c9a1e71566fcd4e82fe3706a95b0ffe3e2b144',
    accessCodeSalt: '2b7e151628aed2a6',
    channel: 'qr_code',
    createdAt: '2026-08-28T14:00:00Z',
    updatedAt: '2026-09-05T09:00:00Z',
    targetCompletionDate: '2026-09-28T18:00:00Z',
    // === AMÉLIORATION AJOUTÉE (Phase 12.5) === RH/harcèlement, lanceur
    // d'alerte identifié : sensible mais accessible aux investigateurs de
    // base (plafond `confidential`, pas `highly_confidential`).
    confidentialityLevel: 'confidential',
    whistleblower: {
      isAnonymous: false,
      fullName: 'Jean-Marc D.',
      jobTitle: 'Chargé de Clientèle Entreprises',
      department: 'Commercial Grands Comptes',
      declarantType: 'Employé',
      entity: 'ACTIVA Côte d’Ivoire',
      email: 'j.marcd@group-activa.ci',
    },
    category: 'Ressources Humaines et diversité',
    subCategory: 'Harcèlement moral ou sexuel',
    detailedDescription: 'Comportements répétés d\'intimidation, dénigrement public systématique en réunion d\'équipe et menaces explicites sur les évaluations annuelles.',
    incidentDates: 'Juin - Août 2026',
    incidentLocation: 'Immeuble ACTIVA Plateau, Abidjan',
    concernedEntity: 'ACTIVA Côte d’Ivoire',
    country: 'Côte d’Ivoire',
    // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
    countryId: 'CI',
    entityId: 'ci_activa',
    riskEvaluation: {
      financialImpact: 1,
      hierarchyLevel: 2,
      recidivism: 3,
      reputationRisk: 2,
      totalScore: 8,
      nocaThreshold: 'NOCA 2',
      priority: 'elevee',
      expectedTreatment: 'Suivi renforcé (15 jours)',
    },
    impactType: 'Humain (santé, sécurité physique ou mentale)',
    estimatedImpactValue: 'Dégradation climat social / RPS',
    involvedPersons: [
      {
        id: 'inv-2',
        name: 'Responsable Département Commercial',
        position: 'Chef de Département',
        hierarchyRole: 'Cadre',
      },
    ],
    witnesses: [],
    evidences: [],
    status: 'corrective_action',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [
      {
        id: 'not-2',
        authorId: 'usr-investigator-1',
        authorName: 'Alain Kouassi',
        authorRole: 'Investigateur DARC',
        content: 'Entretiens individuels menés avec 4 collaborateurs du département. Climat de tension avéré.',
        createdAt: '2026-09-02T10:00:00Z',
        isPrivate: true,
      },
    ],
    messages: [],
    correctiveMeasures: [
      {
        id: 'cm-2',
        title: 'Recadrage managérial formel et médiation RH',
        description: 'Entretien tripartite DRH Groupe, rappel de la Charte Éthique ACTIVA et suivi mensuel du climat.',
        responsiblePerson: 'DRH Groupe & Direction Filiale',
        dueDate: '2026-09-30',
        status: 'implemented',
        documentedBy: 'Alain Kouassi',
        documentedAt: '2026-09-05T09:00:00Z',
      },
    ],
  },
  {
    id: 'alt-003',
    trackingNumber: 'AIIG-26-07-0001',
    // === AMÉLIORATION AJOUTÉE : mot de passe démo stocké sous forme de hash salé (jamais en clair) ===
    accessCodeHash: '7fe7057524f3c5eb830295658e64aea1b718abc7dc6483da6d11ec1e0a8a5d8e',
    accessCodeSalt: '9c0e2f3a4b5d6e7f',
    channel: 'web',
    createdAt: '2026-07-15T08:30:00Z',
    updatedAt: '2026-08-01T11:00:00Z',
    // === AMÉLIORATION AJOUTÉE (Phase 12.5) === volontairement sans valeur
    // ici (dossier clôturé, faible priorité) — démontre le comportement de
    // repli : traité comme `restricted`, visible par tout le monde,
    // exactement comme avant cette phase pour les dossiers déjà existants.
    whistleblower: {
      isAnonymous: true,
      declarantType: 'Prestataire',
      entity: 'ACTIVA International Ghana',
    },
    category: 'Intégrité des affaires et relation client',
    subCategory: 'Cadeaux et avantages inappropriés et/ou non déclarés',
    detailedDescription: 'Tentative d\'octroi de commissions occultes lors du renouvellement du contrat de gardiennage et sécurité.',
    incidentDates: 'Juillet 2026',
    incidentLocation: 'Accra Branch Office',
    concernedEntity: 'ACTIVA International Ghana',
    country: 'Ghana',
    // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
    countryId: 'GH',
    entityId: 'gh_activa',
    riskEvaluation: {
      financialImpact: 1,
      hierarchyLevel: 1,
      recidivism: 1,
      reputationRisk: 2,
      totalScore: 5,
      nocaThreshold: 'NOCA 1',
      priority: 'faible',
      expectedTreatment: 'Traitement standard (30 jours)',
    },
    impactType: 'Réglementaire',
    involvedPersons: [],
    witnesses: [],
    evidences: [],
    status: 'closed',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    closedAt: '2026-08-01T11:00:00Z',
    closedBy: 'B. Y. Ekani',
    closureSummary: 'Investigation clôturée après audit des appels d\'offres. Clause anti-corruption renforcée dans tous les contrats prestataires.',
    closureMessageToWhistleblower: 'L\'enquête a été menée avec succès. Les mesures préventives et contractuelles ont été mises en œuvre conformément au Code Éthique ACTIVA.',
    internalNotes: [],
    messages: [],
    correctiveMeasures: [
      {
        id: 'cm-3',
        title: 'Mise à jour des clauses anti-corruption dans les contrats prestataires',
        description: 'Signature systématique de la Charte Fournisseurs Responsables ACTIVA.',
        responsiblePerson: 'Responsable Achats & Logistique Ghana',
        dueDate: '2026-08-15',
        status: 'implemented',
        documentedBy: 'B. Y. Ekani',
        documentedAt: '2026-07-29T16:00:00Z',
      },
    ],
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-001',
    alertId: 'alt-001',
    trackingNumber: 'AACMR-26-09-0001',
    authorId: 'system',
    authorName: 'Système activa-whistleblowing',
    authorRole: 'Système',
    actionType: 'ALERT_SUBMITTED',
    details: 'Signalement anonyme soumis pour ACTIVA Assurances (Cameroun). Classification automatique : NOCA 3 (Enquête urgente).',
    timestamp: '2026-09-08T10:14:00Z',
  },
  {
    id: 'aud-002',
    alertId: 'alt-001',
    trackingNumber: 'AACMR-26-09-0001',
    authorId: 'usr-functional-admin',
    authorName: 'B. Y. Ekani (Point de Contact)',
    authorRole: 'functional_admin',
    actionType: 'INVESTIGATOR_ASSIGNED',
    details: 'Attribution du dossier à Chantal Ngo (Investigatrice DARC). Délai de traitement fixé au 15/09/2026.',
    timestamp: '2026-09-08T11:05:00Z',
  },
  {
    id: 'aud-003',
    alertId: 'alt-001',
    trackingNumber: 'AACMR-26-09-0001',
    authorId: 'usr-investigator-2',
    authorName: 'Chantal Ngo',
    authorRole: 'investigator',
    actionType: 'INTERNAL_NOTE_ADDED',
    details: 'Ajout d\'une note interne d\'analyse financière.',
    timestamp: '2026-09-09T16:20:00Z',
  },
  {
    id: 'aud-004',
    alertId: 'alt-002',
    trackingNumber: 'AACIV-26-08-0001',
    authorId: 'usr-investigator-1',
    authorName: 'Alain Kouassi',
    authorRole: 'investigator',
    actionType: 'CORRECTIVE_MEASURE_ADDED',
    details: 'Documentation des mesures correctives RH obligatoires.',
    timestamp: '2026-09-05T09:00:00Z',
  },
  {
    id: 'aud-005',
    alertId: 'alt-003',
    trackingNumber: 'AIIG-26-07-0001',
    authorId: 'usr-functional-admin',
    authorName: 'B. Y. Ekani (Point de Contact)',
    authorRole: 'functional_admin',
    actionType: 'ALERT_CLOSED',
    details: 'Clôture formelle du dossier avec notification au lanceur d\'alerte.',
    timestamp: '2026-08-01T11:00:00Z',
  },
];
