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

export const ACTIVA_COUNTRIES = [
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
  reputationRisk: 1 | 2 | 3 | 4
): RiskEvaluation {
  const totalScore = financialImpact + hierarchyLevel + recidivism + reputationRisk;
  let nocaThreshold: NocaThreshold = 'NOCA 1';
  let priority: PriorityLevel = 'faible';
  let expectedTreatment = 'Traitement standard';

  if (totalScore >= 14) {
    nocaThreshold = 'NOCA 4';
    priority = 'critique';
    expectedTreatment = 'Action immédiate (48h)';
  } else if (totalScore >= 11) {
    nocaThreshold = 'NOCA 3';
    priority = 'tres_elevee';
    expectedTreatment = 'Enquête urgente (7 jours)';
  } else if (totalScore >= 7) {
    nocaThreshold = 'NOCA 2';
    priority = 'elevee';
    expectedTreatment = 'Suivi renforcé (15 jours)';
  } else {
    nocaThreshold = 'NOCA 1';
    priority = 'faible';
    expectedTreatment = 'Traitement standard (30 jours)';
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

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-functional-admin',
    name: 'B. Y. Ekani (Point de Contact)',
    email: 'by.ekani@group-activa.com',
    role: 'functional_admin',
    roleTitle: 'Responsable Conformité & Référent Éthique Groupe',
    entity: 'ACTIVA Finance',
    country: 'Cameroun / Maurice',
  },
  {
    id: 'usr-investigator-1',
    name: 'Alain Kouassi (Investigateur DARC)',
    email: 'a.kouassi@group-activa.com',
    role: 'investigator',
    roleTitle: 'Auditeur Interne Senior',
    entity: 'ACTIVA Côte d’Ivoire',
    country: 'Côte d’Ivoire',
  },
  {
    id: 'usr-investigator-2',
    name: 'Chantal Ngo (Investigatrice DARC)',
    email: 'c.ngo@group-activa.com',
    role: 'investigator',
    roleTitle: 'Chargée d’Investigation Fraude & Éthique',
    entity: 'ACTIVA Assurances',
    country: 'Cameroun',
  },
  {
    id: 'usr-system-admin',
    name: 'David Mendy (Admin Système)',
    email: 'd.mendy@group-activa.com',
    role: 'system_admin',
    roleTitle: 'Administrateur Systèmes Sécurisés ATS',
    entity: 'Africa Technology Services (ATS)',
    country: 'Maurice',
  },
  {
    id: 'usr-auditor',
    name: 'Comité d’Audit (Consultation)',
    email: 'audit-board@group-activa.com',
    role: 'auditor',
    roleTitle: 'Membre du Comité d’Audit & Conseil d’Administration',
    entity: 'ACTIVA Finance',
    country: 'Maurice',
  },
];

export const INITIAL_ALERTS: AlertRecord[] = [
  {
    id: 'alt-001',
    trackingNumber: 'ACT-2026-0418',
    accessCodeHash: 'Activa2026!',
    channel: 'web',
    createdAt: '2026-09-08T10:14:00Z',
    updatedAt: '2026-09-11T14:30:00Z',
    targetCompletionDate: '2026-09-15T18:00:00Z',
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
    accessCodeHash: 'Secret2026!',
    channel: 'qr_code',
    createdAt: '2026-08-28T14:00:00Z',
    updatedAt: '2026-09-05T09:00:00Z',
    targetCompletionDate: '2026-09-28T18:00:00Z',
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
    accessCodeHash: 'Ghana2026!',
    channel: 'web',
    createdAt: '2026-07-15T08:30:00Z',
    updatedAt: '2026-08-01T11:00:00Z',
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
