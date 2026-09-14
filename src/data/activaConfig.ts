import { 
  AlertRecord, 
  AuditLogEntry, 
  RiskEvaluation, 
  UserProfile, 
  PriorityLevel, 
  NocaThreshold 
} from '../types';

export interface EntityDef {
  id: string;
  name: string;
  country: string;
  flag: string;
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

export const ACTIVA_ENTITIES: EntityDef[] = [
  { id: 'cm_assurances', name: 'ACTIVA Assurances', country: 'Cameroun', flag: '🇨🇲' },
  { id: 'cm_vie', name: 'ACTIVA Vie', country: 'Cameroun', flag: '🇨🇲' },
  { id: 'cd_assurances', name: 'ACTIVA Assurances RDC', country: 'RD Congo', flag: '🇨🇩' },
  { id: 'cd_vie', name: 'ACTIVA Vie RDC', country: 'RD Congo', flag: '🇨🇩' },
  { id: 'gn_ugar', name: 'UGAR ACTIVA', country: 'Guinée', flag: '🇬🇳' },
  { id: 'gn_vie', name: 'ACTIVA Vie Guinée', country: 'Guinée', flag: '🇬🇳' },
  { id: 'ci_activa', name: 'ACTIVA Côte d’Ivoire', country: 'Côte d’Ivoire', flag: '🇨🇮' },
  { id: 'gh_activa', name: 'ACTIVA International Ghana', country: 'Ghana', flag: '🇬🇭' },
  { id: 'lr_activa', name: 'ACTIVA International Liberia', country: 'Libéria', flag: '🇱🇷' },
  { id: 'sl_activa', name: 'ACTIVA International Sierra Leone', country: 'Sierra Leone', flag: '🇸🇱' },
  { id: 'mu_finance', name: 'ACTIVA Finance', country: 'Maurice', flag: '🇲🇺' },
  { id: 'mu_re', name: 'ACTIVA Ré', country: 'Maurice', flag: '🇲🇺' },
  { id: 'mu_ats', name: 'Africa Technology Services (ATS)', country: 'Maurice', flag: '🇲🇺' },
  { id: 'mu_fondation', name: 'Fondation ACTIVA', country: 'Maurice', flag: '🇲🇺' },
  { id: 'fr_europe', name: 'ACTIVA Europe', country: 'France', flag: '🇫🇷' },
  { id: 'ao_activa', name: 'ACTIVA Angola', country: 'Angola', flag: '🇦🇴' },
];

export interface CategoryDef {
  id: string;
  name: string;
  subCategories: string[];
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
export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-functional-admin',
    name: 'B. Y. Ekani (Point de Contact)',
    email: 'by.ekani@group-activa.com',
    role: 'functional_admin',
    roleTitle: 'Responsable Conformité & Référent Éthique Groupe',
    entity: 'ACTIVA Finance',
    country: 'Cameroun / Maurice',
    countries: [],
    entities: [],
    active: true,
  },
  {
    id: 'usr-investigator-1',
    name: 'Alain Kouassi (Investigateur DARC)',
    email: 'a.kouassi@group-activa.com',
    role: 'investigator',
    roleTitle: 'Auditeur Interne Senior',
    entity: 'ACTIVA Côte d’Ivoire',
    country: 'Côte d’Ivoire',
    countries: ['CI'],
    entities: ['ci_activa'],
    active: true,
  },
  {
    id: 'usr-investigator-2',
    name: 'Chantal Ngo (Investigatrice DARC)',
    email: 'c.ngo@group-activa.com',
    role: 'investigator',
    roleTitle: 'Chargée d’Investigation Fraude & Éthique',
    entity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countries: ['CM'],
    entities: ['cm_assurances'],
    active: true,
  },
  {
    id: 'usr-system-admin',
    name: 'David Mendy (Admin Système)',
    email: 'd.mendy@group-activa.com',
    role: 'system_admin',
    roleTitle: 'Administrateur Systèmes Sécurisés ATS',
    entity: 'Africa Technology Services (ATS)',
    country: 'Maurice',
    countries: ['MU'],
    entities: ['mu_ats'],
    active: true,
  },
  {
    id: 'usr-auditor',
    name: 'Comité d’Audit (Consultation)',
    email: 'audit-board@group-activa.com',
    // === AMÉLIORATION AJOUTÉE (Phase 12.3) === l'ancien rôle `auditor`
    // (5 valeurs) devient `consultation` dans le nouveau modèle RBAC à 10
    // rôles — même comportement (lecture seule, vision globale des
    // dossiers), voir src/services/authz.ts.
    role: 'consultation',
    roleTitle: 'Membre du Comité d’Audit & Conseil d’Administration',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    countries: [],
    entities: [],
    active: true,
  },
  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === 2 nouveaux comptes de
  // démonstration pour les 2 rôles réellement nouveaux (security_admin,
  // audit_committee), accessibles via le même sélecteur de profil que les
  // 5 comptes ci-dessus — purement additif.
  {
    id: 'usr-security-admin',
    name: 'Farid Haidara (Admin Sécurité)',
    email: 'f.haidara@group-activa.com',
    role: 'security_admin',
    roleTitle: 'Responsable Sécurité des Systèmes d’Information',
    entity: 'Africa Technology Services (ATS)',
    country: 'Maurice',
    countries: ['MU'],
    entities: ['mu_ats'],
    active: true,
  },
  {
    id: 'usr-audit-committee',
    name: 'Comité d’Audit Groupe',
    email: 'comite-audit@group-activa.com',
    role: 'audit_committee',
    roleTitle: 'Membre indépendant, Comité d’Audit du Conseil d’Administration',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    countries: [],
    entities: [],
    active: true,
  },
  // === AMÉLIORATION AJOUTÉE (Phase 1 — évolution multi-pays/multi-entité) ===
  // 3 nouveaux comptes de démonstration pour les 3 rôles qui n'en avaient
  // encore aucun (déjà définis dans RoleId/ROLE_PERMISSIONS depuis la
  // Phase 12 mais jamais sélectionnables sur l'écran de connexion) :
  // senior_investigator et darc_compliance à vision Groupe (périmètre
  // vide), servant de comptes "Enquêteur Groupe"/"DARC Groupe" pour la
  // future escalade (Phase 5) ; executive à vision agrégée uniquement.
  {
    id: 'usr-senior-investigator',
    name: 'Grace Mensah (Investigatrice Senior Groupe)',
    email: 'g.mensah@group-activa.com',
    role: 'senior_investigator',
    roleTitle: 'Investigatrice Senior — Enquêtes Groupe',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    countries: [],
    entities: [],
    active: true,
  },
  {
    id: 'usr-darc-compliance',
    name: 'DARC Groupe (Conformité)',
    email: 'darc-groupe@group-activa.com',
    role: 'darc_compliance',
    roleTitle: 'Direction Audit, Risques & Conformité — Groupe',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    countries: [],
    entities: [],
    active: true,
  },
  {
    id: 'usr-executive',
    name: 'Marc Fotso (Comité de Direction)',
    email: 'm.fotso@group-activa.com',
    role: 'executive',
    roleTitle: 'Membre du Comité de Direction Groupe',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
    countries: [],
    entities: [],
    active: true,
  },
];

export const INITIAL_ALERTS: AlertRecord[] = [
  {
    id: 'alt-001',
    trackingNumber: 'ACT-2026-0418',
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
    assignedInvestigators: ['usr-investigator-2'],
    assignedInvestigatorNames: ['Chantal Ngo (Investigatrice DARC)'],
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
    trackingNumber: 'ACT-2026-0391',
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
    assignedInvestigators: ['usr-investigator-1'],
    assignedInvestigatorNames: ['Alain Kouassi (Investigateur DARC)'],
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
    trackingNumber: 'ACT-2026-0210',
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
    assignedInvestigators: ['usr-functional-admin'],
    assignedInvestigatorNames: ['B. Y. Ekani (Point de Contact)'],
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
    trackingNumber: 'ACT-2026-0418',
    authorId: 'system',
    authorName: 'Système ACTIVA EthicAlert',
    authorRole: 'Système',
    actionType: 'ALERT_SUBMITTED',
    details: 'Signalement anonyme soumis pour ACTIVA Assurances (Cameroun). Classification automatique : NOCA 3 (Enquête urgente).',
    timestamp: '2026-09-08T10:14:00Z',
  },
  {
    id: 'aud-002',
    alertId: 'alt-001',
    trackingNumber: 'ACT-2026-0418',
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
    trackingNumber: 'ACT-2026-0418',
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
    trackingNumber: 'ACT-2026-0391',
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
    trackingNumber: 'ACT-2026-0210',
    authorId: 'usr-functional-admin',
    authorName: 'B. Y. Ekani (Point de Contact)',
    authorRole: 'functional_admin',
    actionType: 'ALERT_CLOSED',
    details: 'Clôture formelle du dossier avec notification au lanceur d\'alerte.',
    timestamp: '2026-08-01T11:00:00Z',
  },
];
