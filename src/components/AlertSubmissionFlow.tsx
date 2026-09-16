import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  UserX,
  UserCheck,
  AlertTriangle,
  FileUp,
  Trash2,
  Plus,
  CheckCircle2,
  Download,
  Copy,
  Calendar,
  Building2,
  Info,
  Save,
  ArrowRight,
  ArrowLeft,
  // === AMÉLIORATION AJOUTÉE (Phase 26 — icônes du formulaire en 6 étapes) ===
  Briefcase,
  Coins,
  Users,
  Leaf,
  MoreHorizontal,
  Search,
  Clock,
  User,
  Paperclip,
  Pencil,
  // === AMÉLIORATION AJOUTÉE (Phase 33 — modale de confidentialité) ===
  X,
} from 'lucide-react';
import {
  Language,
  AlertRecord,
  InvolvedPerson,
  Witness,
  EvidenceFile,
  WhistleblowerInfo
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import {
  IMPACT_TYPES,
  ACTIVA_COUNTRIES,
  computeRiskEvaluation
} from '../data/activaConfig';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE : hachage salé côté client du mot de passe de suivi (jamais stocké en clair) ===
// === AMÉLIORATION AJOUTÉE (Phase 26) === generateAccessPassword génère
// désormais le mot de passe lui-même (voir plus bas) ; hashPassword/generateSalt
// continuent de le saler et le hacher exactement comme avant.
import { generateSalt, hashPassword, generateAccessPassword } from '../services/crypto';
// === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
import { isGlobalCaseViewer } from '../services/authz';
import { notifyNewAlertToOperators } from '../services/emailNotify';

interface AlertSubmissionFlowProps {
  lang: Language;
  onSuccessNavigateToTrack: (trackingNumber: string) => void;
  onCancel: () => void;
}

// === AMÉLIORATION AJOUTÉE (Phase 26 — visuel des cartes de catégorie, maquette
// de référence) === Association icône/couleur par mot-clé plutôt que par index
// figé, pour rester cohérent même si un administrateur renomme/ajoute une
// catégorie (Phase 7 — catégories éditables) : une catégorie inconnue retombe
// simplement sur l'icône/couleur par défaut au lieu de planter.
const CATEGORY_VISUALS: { match: RegExp; icon: React.ComponentType<{ className?: string }>; bg: string; text: string }[] = [
  { match: /fraude|corruption/i, icon: Coins, bg: 'bg-rose-50', text: 'text-rose-600' },
  { match: /ressources humaines|diversit/i, icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { match: /environnement|sant[ée]|s[ée]curit[ée]/i, icon: Leaf, bg: 'bg-green-50', text: 'text-green-600' },
  { match: /autres/i, icon: MoreHorizontal, bg: 'bg-slate-100', text: 'text-slate-600' },
];
function getCategoryVisual(name: string) {
  const found = CATEGORY_VISUALS.find((v) => v.match.test(name));
  return found || { icon: Briefcase, bg: 'bg-blue-50', text: 'text-blue-600' };
}

export const AlertSubmissionFlow: React.FC<AlertSubmissionFlowProps> = ({
  lang,
  onSuccessNavigateToTrack,
  onCancel,
}) => {
  const t = TRANSLATIONS[lang];

  // Auto-save draft loading
  const savedDraft = storage.getDraft();
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) === real,
  // editable entity/category lists instead of the static activaConfig
  // imports, so a category or entity an admin adds/renames/removes shows
  // up (or disappears) here too — the actual reporting form, not just the
  // admin screen's own display.
  const entities = storage.getEntities();
  const categories = storage.getCategories();
  // === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) === real,
  // admin-editable NOCA→delay thresholds instead of hardcoded 30/15/7/2 days.
  const slaConfig = storage.getSlaConfig();

  // Step control (1 to 5 = form, 6 = acknowledgment)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Phase 33 — modale de confidentialité avant le
  // formulaire) === Affichée systématiquement à l'ouverture du formulaire de
  // signalement (quel que soit le point d'entrée — accueil, FAQ, écran de
  // suivi...), tant que l'utilisateur n'a pas cliqué sur "J'ai compris et je
  // souhaite poursuivre". "Annuler" ramène à l'écran précédent via `onCancel`,
  // déjà utilisé ailleurs dans ce composant.
  const [confidentialityConfirmed, setConfidentialityConfirmed] = useState(false);

  // 1. Whistleblower identity
  // === AMÉLIORATION AJOUTÉE (Phase 26) === isAnonymous n'est plus choisi via
  // un bouton radio explicite (retiré de la maquette de référence) : il est
  // désormais dérivé automatiquement du fait que le déclarant ait renseigné
  // ou non des informations d'identification — la capacité de rester
  // anonyme OU de s'identifier est intégralement conservée, seul le geste
  // UI pour l'exprimer change (remplir les champs optionnels, ou les
  // laisser vides).
  const [isAnonymous, setIsAnonymous] = useState<boolean>(
    savedDraft ? savedDraft.isAnonymous : true
  );
  const initialNameParts = (savedDraft?.declarantName || '').trim().split(/\s+/);
  const [declarantFirstName, setDeclarantFirstName] = useState(
    savedDraft?.declarantFirstName ?? (initialNameParts[0] || '')
  );
  const [declarantLastName, setDeclarantLastName] = useState(
    savedDraft?.declarantLastName ?? (initialNameParts.slice(1).join(' ') || '')
  );
  const [declarantName, setDeclarantName] = useState(savedDraft?.declarantName || '');
  const [declarantJob, setDeclarantJob] = useState(savedDraft?.declarantJob || '');
  const [declarantDept, setDeclarantDept] = useState(savedDraft?.declarantDept || '');
  const [declarantType, setDeclarantType] = useState<WhistleblowerInfo['declarantType']>(
    savedDraft?.declarantType || 'Employé'
  );
  const [declarantEntity, setDeclarantEntity] = useState(
    savedDraft?.declarantEntity || entities[0].name
  );
  // === AMÉLIORATION AJOUTÉE (Phase 26 — champ additif « Pays ») ===
  const [declarantCountry, setDeclarantCountry] = useState(savedDraft?.declarantCountry || '');
  const [declarantEmail, setDeclarantEmail] = useState(savedDraft?.declarantEmail || '');
  const [declarantPhone, setDeclarantPhone] = useState(savedDraft?.declarantPhone || '');

  // Recompose the single fullName field from the two visual inputs (Prénom/
  // Nom) — the record's data model keeps a single string, unchanged.
  useEffect(() => {
    setDeclarantName(`${declarantFirstName} ${declarantLastName}`.trim());
  }, [declarantFirstName, declarantLastName]);

  // Derive anonymity automatically from whether any identifying field is filled.
  useEffect(() => {
    const hasIdentity =
      declarantFirstName.trim() !== '' || declarantLastName.trim() !== '' || declarantEmail.trim() !== '';
    setIsAnonymous(!hasIdentity);
  }, [declarantFirstName, declarantLastName, declarantEmail]);

  // 2. Incident & Category
  // === AMÉLIORATION AJOUTÉE (Phase 26) === la catégorie par défaut suit
  // désormais l'ordre de la maquette de référence (la 1ère carte,
  // « Intégrité des affaires… », est présélectionnée) au lieu de la 2e.
  const [selectedCategory, setSelectedCategory] = useState<string>(
    savedDraft?.selectedCategory || categories[0].name
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(
    savedDraft?.selectedSubCategory || categories[0].subCategories[0]
  );
  const [customViolation, setCustomViolation] = useState(savedDraft?.customViolation || '');
  const [detailedDescription, setDetailedDescription] = useState(
    savedDraft?.detailedDescription || ''
  );
  const [incidentDates, setIncidentDates] = useState(savedDraft?.incidentDates || '');
  const [incidentLocation, setIncidentLocation] = useState(savedDraft?.incidentLocation || '');
  const [concernedEntity, setConcernedEntity] = useState(
    savedDraft?.concernedEntity || entities[0].name
  );
  const [customEntityInput, setCustomEntityInput] = useState('');
  // === AMÉLIORATION AJOUTÉE (Phase 26 — champ additif « situation en cours ») ===
  const [isOngoing, setIsOngoing] = useState<boolean>(savedDraft?.isOngoing || false);

  // 3. Implicated & Witnesses
  const [involvedPersons, setInvolvedPersons] = useState<InvolvedPerson[]>(
    savedDraft?.involvedPersons || []
  );
  const [witnesses, setWitnesses] = useState<Witness[]>(
    savedDraft?.witnesses || []
  );

  // 4. Evidence & Impact & Risk Matrix (Annexe 9)
  const [evidences, setEvidences] = useState<EvidenceFile[]>(
    savedDraft?.evidences || []
  );
  const [impactType, setImpactType] = useState(savedDraft?.impactType || IMPACT_TYPES[0]);
  const [customImpact, setCustomImpact] = useState('');
  const [estimatedImpactValue, setEstimatedImpactValue] = useState(
    savedDraft?.estimatedImpactValue || ''
  );

  // Risk matrix factors (Annexe 9)
  const [finFactor, setFinFactor] = useState<1 | 2 | 3 | 4>(savedDraft?.finFactor || 2);
  const [hierFactor, setHierFactor] = useState<1 | 2 | 3 | 4>(savedDraft?.hierFactor || 2);
  const [recidFactor, setRecidFactor] = useState<1 | 2 | 3 | 4>(savedDraft?.recidFactor || 1);
  const [reputFactor, setReputFactor] = useState<1 | 2 | 3 | 4>(savedDraft?.reputFactor || 2);

  // 5. Security
  // === AMÉLIORATION AJOUTÉE (Phase 26) === `password` ne provient plus d'une
  // saisie manuelle : il est généré automatiquement à la soumission (voir
  // handleSubmit) et affiché sur l'écran d'accusé de réception, exactement
  // comme le numéro de suivi. Le hachage salé (generateSalt/hashPassword)
  // continue de s'appliquer à ce mot de passe sans aucun changement.
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Submission result
  const [submittedAlert, setSubmittedAlert] = useState<AlertRecord | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Update subcategories when category changes
  const currentCategoryDef = categories.find(c => c.name === selectedCategory);
  useEffect(() => {
    if (currentCategoryDef && !currentCategoryDef.subCategories.includes(selectedSubCategory)) {
      setSelectedSubCategory(currentCategoryDef.subCategories[0] || '');
    }
  }, [selectedCategory]);

  // Real-time risk evaluation calculation
  const liveRisk = computeRiskEvaluation(finFactor, hierFactor, recidFactor, reputFactor, slaConfig);

  // === AMÉLIORATION AJOUTÉE (Phase 26) === factorisé pour être réutilisé à la
  // fois par la sauvegarde automatique (debounce ci-dessous) et par le
  // nouveau bouton « Enregistrer et quitter » de l'étape 2.
  const buildDraftObject = () => ({
    isAnonymous,
    declarantName,
    declarantFirstName,
    declarantLastName,
    declarantJob,
    declarantDept,
    declarantType,
    declarantEntity,
    declarantCountry,
    declarantEmail,
    declarantPhone,
    selectedCategory,
    selectedSubCategory,
    customViolation,
    detailedDescription,
    incidentDates,
    incidentLocation,
    concernedEntity,
    isOngoing,
    involvedPersons,
    witnesses,
    impactType,
    estimatedImpactValue,
    finFactor,
    hierFactor,
    recidFactor,
    reputFactor,
  });

  // Auto-save form changes
  useEffect(() => {
    if (submittedAlert) return;
    const timer = setTimeout(() => {
      storage.saveDraft(buildDraftObject());
      setSaveStatus(lang === 'en' ? 'Draft saved' : lang === 'pt' ? 'Rascunho salvo' : 'Brouillon sauvegardé');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isAnonymous, declarantName, declarantFirstName, declarantLastName, declarantJob, declarantDept, declarantType,
    declarantEntity, declarantCountry, declarantEmail, declarantPhone, selectedCategory,
    selectedSubCategory, customViolation, detailedDescription, incidentDates,
    incidentLocation, concernedEntity, isOngoing, involvedPersons, witnesses,
    impactType, estimatedImpactValue, finFactor, hierFactor, recidFactor, reputFactor,
    submittedAlert
  ]);

  // Today date limit (no future dates as mandated in CDC 3.1.1)
  const todayStr = new Date().toISOString().split('T')[0];

  // Involved person handlers
  const addInvolvedPerson = () => {
    setInvolvedPersons([
      ...involvedPersons,
      {
        id: 'inv-' + Date.now(),
        name: '',
        position: '',
        hierarchyRole: 'Cadre',
      },
    ]);
  };

  const updateInvolvedPerson = (id: string, field: keyof InvolvedPerson, val: any) => {
    setInvolvedPersons(involvedPersons.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const removeInvolvedPerson = (id: string) => {
    setInvolvedPersons(involvedPersons.filter(p => p.id !== id));
  };

  // Witness handlers
  const addWitness = () => {
    setWitnesses([
      ...witnesses,
      {
        id: 'wit-' + Date.now(),
        name: '',
        position: '',
        hierarchyRole: 'Employé',
      },
    ]);
  };

  const updateWitness = (id: string, field: keyof Witness, val: any) => {
    setWitnesses(witnesses.map(w => w.id === id ? { ...w, [field]: val } : w));
  };

  const removeWitness = (id: string) => {
    setWitnesses(witnesses.filter(w => w.id !== id));
  };

  // Evidence file upload handler (simulated client-side storage via dataUrl)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: EvidenceFile[] = [];
    Array.from(files).forEach((file: File) => {
      newFiles.push({
        id: 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: file.name,
        size: file.size,
        type: file.type || 'document',
        uploadedAt: new Date().toISOString(),
      });
    });

    setEvidences([...evidences, ...newFiles]);
  };

  const removeEvidence = (id: string) => {
    setEvidences(evidences.filter(f => f.id !== id));
  };

  // Save the current draft immediately and leave the wizard (Phase 26 —
  // "Enregistrer et quitter", matches the reference mockup's step 2 footer).
  const handleSaveAndExit = () => {
    storage.saveDraft(buildDraftObject());
    onCancel();
  };

  // Submit Alert Handler
  // === AMÉLIORATION AJOUTÉE : handler asynchrone pour permettre le hachage salé du mot de passe ===
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!detailedDescription.trim()) {
      setErrorMsg('Veuillez fournir une description détaillée des faits constatés.');
      setCurrentStep(3);
      return;
    }

    if (!incidentDates.trim()) {
      setErrorMsg('Veuillez préciser la date ou la période des faits.');
      setCurrentStep(3);
      return;
    }

    if (!incidentLocation.trim()) {
      setErrorMsg('Veuillez préciser le lieu des faits.');
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);

    // Concerned entity & country
    const matchedEntity = entities.find(e => e.name === concernedEntity);
    const country = matchedEntity ? matchedEntity.country : 'Groupe ACTIVA';

    // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
    // Remplace l'ancien suffixe aléatoire ACT-2026-XXXX (Phase 26) par le
    // schéma officiel Groupe fourni par la DARC : XX(code entité)-
    // YY(année)-MM(mois)-XXXX(n° séquentiel, remis à 0001 chaque début de
    // mois, par entité). `matchedEntity` provient toujours du menu
    // déroulant (jamais du champ libre "Autre entité"), donc son `code`
    // est toujours celui de EntityDef — jamais deviné ici.
    const trackingNumber = storage.generateCaseNumber(matchedEntity?.code ?? 'GRP');

    // === AMÉLIORATION AJOUTÉE (Phase 26) === le mot de passe d'accès est
    // désormais généré automatiquement (conforme à la maquette de référence,
    // qui l'affiche déjà tout formé sur l'écran d'accusé de réception, au
    // même titre que le numéro de suivi) au lieu d'être saisi/confirmé
    // manuellement. Il n'est jamais stocké en clair : le salage et le
    // hachage ci-dessous sont strictement identiques à avant.
    const generatedPassword = generateAccessPassword();
    const accessCodeSalt = generateSalt();
    const accessCodeHash = await hashPassword(generatedPassword, accessCodeSalt);

    // Target completion date based on SLA — === AMÉLIORATION AJOUTÉE (Phase 7)
    // === now reads the real, admin-editable thresholds instead of hardcoded
    // 30/15/7/2 days (defaults to the exact same values when unedited).
    let daysToAdd = slaConfig.noca1Days;
    if (liveRisk.nocaThreshold === 'NOCA 4') daysToAdd = slaConfig.noca4Days;
    else if (liveRisk.nocaThreshold === 'NOCA 3') daysToAdd = slaConfig.noca3Days;
    else if (liveRisk.nocaThreshold === 'NOCA 2') daysToAdd = slaConfig.noca2Days;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);

    // === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
    // Dérivé du niveau de risque NOCA déjà calculé (jamais une valeur
    // inventée séparément) : plus le risque est élevé, plus le dossier est
    // classé sensible — cohérent avec domain/permissions.ts
    // ROLE_MAX_CONFIDENTIALITY (seuls les rôles habilités le verront).
    const confidentialityLevel: AlertRecord['confidentialityLevel'] =
      liveRisk.nocaThreshold === 'NOCA 4' || liveRisk.nocaThreshold === 'NOCA 3'
        ? 'highly_confidential'
        : liveRisk.nocaThreshold === 'NOCA 2'
        ? 'confidential'
        : 'restricted';

    const newRecord: AlertRecord = {
      id: 'alt-' + Date.now(),
      trackingNumber,
      accessCodeHash,
      accessCodeSalt,
      channel: 'web',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetCompletionDate: targetDate.toISOString(),
      confidentialityLevel,
      whistleblower: {
        isAnonymous,
        fullName: isAnonymous ? undefined : declarantName,
        jobTitle: isAnonymous ? undefined : declarantJob,
        department: isAnonymous ? undefined : declarantDept,
        declarantType,
        entity: isAnonymous ? undefined : declarantEntity,
        email: isAnonymous ? undefined : declarantEmail,
        phone: isAnonymous ? undefined : declarantPhone,
        declarantCountry: isAnonymous ? undefined : declarantCountry,
      },
      category: selectedCategory,
      subCategory: selectedSubCategory,
      customViolationType: customViolation || undefined,
      detailedDescription,
      incidentDates,
      incidentLocation,
      concernedEntity: customEntityInput.trim() || concernedEntity,
      country,
      isOngoing,
      riskEvaluation: liveRisk,
      impactType: customImpact.trim() || impactType,
      estimatedImpactValue: estimatedImpactValue || undefined,
      involvedPersons,
      witnesses,
      evidences,
      status: 'new',
      assignedInvestigators: [],
      assignedInvestigatorNames: [],
      internalNotes: [],
      messages: [
        {
          id: 'msg-init',
          sender: 'admin',
          senderDisplayName: 'DARC Groupe ACTIVA',
          content: `Votre signalement a été reçu sous la référence ${trackingNumber}. Il est actuellement classé au niveau ${liveRisk.nocaThreshold} (${liveRisk.expectedTreatment}). Vous pouvez utiliser cette messagerie sécurisée pour échanger avec la DARC.`,
          createdAt: new Date().toISOString(),
        }
      ],
      correctiveMeasures: [],
    };

    // Save to storage
    storage.saveAlert(newRecord);
    storage.logAudit(
      'ALERT_SUBMITTED',
      `Nouvelle alerte enregistrée : ${trackingNumber} (${newRecord.category} - ${newRecord.concernedEntity}). Classification : ${liveRisk.nocaThreshold}. Mode : ${isAnonymous ? 'Anonyme' : 'Identifié'}.`,
      { id: newRecord.id, trackingNumber: newRecord.trackingNumber },
      {
        id: 'whistleblower-anonymous',
        name: isAnonymous ? 'Lanceur d’alerte (Anonyme)' : (declarantName || 'Lanceur d’alerte'),
        email: isAnonymous ? 'anonyme@declare.activa' : declarantEmail,
        role: 'reporter',
        roleTitle: isAnonymous ? 'Déclarant Anonyme' : 'Déclarant Identifié',
        entity: newRecord.concernedEntity,
        country: newRecord.country,
      }
    );

    // === AMÉLIORATION AJOUTÉE (Notifications e-mail) === Boîte de
    // réception : notifie chaque compte Opérateur (vision globale — ce
    // sont eux qui voient la Boîte de réception) qu'un nouveau signalement
    // attend le tri. Best-effort, ne bloque jamais la suite de la
    // soumission (déjà enregistrée juste au-dessus) — chaque tentative est
    // journalisée dans l'Audit Trail par emailNotify.ts lui-même.
    const operators = storage.getUsers().filter(isGlobalCaseViewer);
    notifyNewAlertToOperators(operators, { id: newRecord.id, trackingNumber: newRecord.trackingNumber });

    // Clear draft
    storage.clearDraft();
    setPassword(generatedPassword);
    setSubmittedAlert(newRecord);
    setIsSubmitting(false);
  };

  // Formal Acknowledgment Print/Download Simulation
  const handlePrintReceipt = () => {
    window.print();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2500);
  };

  // === AMÉLIORATION AJOUTÉE (Phase 33 — modale de confidentialité avant le
  // formulaire de signalement, conforme à la maquette fournie) ===
  if (!confidentialityConfirmed) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.confidentiality_gate_cancel}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-500 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* === AMÉLIORATION AJOUTÉE (Phase 35 — photo fournie par
              l'utilisateur, icône bouclier + cadenas déjà intégrée à
              l'image) === Remplace la photo générique + l'icône dessinée en
              CSS (Phase 34) par la photo exacte de la maquette (main sur
              clavier, icône déjà incrustée dans l'image), servie depuis
              public/brand/confidentiality-gate-bg.jpg. */}
          <div className="relative hidden md:flex items-center justify-center min-h-[460px] overflow-hidden">
            <img
              src="/brand/confidentiality-gate-bg.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-left"
            />
          </div>

          <div className="p-8 sm:p-12 flex flex-col justify-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] leading-tight">
              {t.confidentiality_gate_title}
            </h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {t.confidentiality_gate_body1_pre}
              <span className="font-bold text-slate-900">{t.confidentiality_gate_body1_bold}</span>
              {t.confidentiality_gate_body1_post}
            </p>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {t.confidentiality_gate_body2_pre}
              <span className="font-bold text-slate-900">{t.confidentiality_gate_body2_bold}</span>
              {t.confidentiality_gate_body2_post}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
              >
                {t.confidentiality_gate_cancel}
              </button>
              <button
                type="button"
                id="confidentiality-gate-confirm"
                onClick={() => setConfidentialityConfirmed(true)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition"
              >
                {t.confidentiality_gate_confirm}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === AMÉLIORATION AJOUTÉE (Phase 26 — sidebar de navigation en 6 étapes,
  // fidèle à la maquette de référence) ===
  const wizardSteps = [
    { num: 1, title: t.wizard_step1_title, desc: t.wizard_step1_desc },
    { num: 2, title: t.wizard_step2_title_optional, desc: t.wizard_step2_desc },
    { num: 3, title: t.wizard_step3_title, desc: t.wizard_step3_desc },
    { num: 4, title: t.wizard_step4_title_optional, desc: t.wizard_step4_desc },
    { num: 5, title: t.wizard_step5_title, desc: t.wizard_step5_desc },
    { num: 6, title: t.wizard_step6_title, desc: t.wizard_step6_desc },
  ];
  const displayStep = submittedAlert ? 6 : currentStep;
  const notProvided = <span className="text-slate-400 italic">{t.review_not_provided}</span>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">{t.wizard_sidebar_title}</h2>
              {saveStatus && (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 shrink-0">
                  <Save className="w-3 h-3" />
                  {saveStatus}
                </span>
              )}
            </div>
            <ol className="space-y-1">
              {wizardSteps.map((s) => {
                const status = displayStep > s.num ? 'done' : displayStep === s.num ? 'active' : 'pending';
                return (
                  <li key={s.num}>
                    <button
                      type="button"
                      onClick={() => !submittedAlert && setCurrentStep(s.num)}
                      disabled={!!submittedAlert}
                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition ${
                        status === 'active' ? 'bg-blue-50' : submittedAlert ? '' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          status === 'done'
                            ? 'bg-emerald-500 text-white'
                            : status === 'active'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {status === 'done' ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                      </span>
                      <span>
                        <span className={`block text-sm font-semibold ${status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
                          {s.title}
                        </span>
                        <span className="block text-[11px] text-slate-500">{s.desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-slate-900">{t.sidebar_confidentiality_title}</div>
              <p className="text-xs text-slate-600 mt-1">{t.sidebar_confidentiality_desc}</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div>
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            {submittedAlert ? (
              /* STEP 6: ACKNOWLEDGMENT */
              <div className="space-y-8 text-center animate-fadeIn">
                <div>
                  <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.ack_success_title}</h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto">{t.ack_success_desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">{t.ack_tracking_num}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-mono font-extrabold text-[#0B2545] select-all truncate">
                        {submittedAlert.trackingNumber}
                      </span>
                      <button
                        type="button"
                        id="btn-copy-tracking"
                        onClick={() => copyToClipboard(submittedAlert.trackingNumber)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">{t.ack_password_label}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-mono font-extrabold text-[#0B2545] select-all truncate">
                        {password}
                      </span>
                      <button
                        type="button"
                        id="btn-copy-password"
                        onClick={() => copyToClipboard(password)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {copiedTracking && (
                  <p className="text-xs text-emerald-600 font-semibold -mt-4">{t.btn_copy_password} ✓</p>
                )}

                <div className="max-w-xl mx-auto p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3 text-left">
                  <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  <p>{t.ack_credentials_note}</p>
                </div>

                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">{t.ack_next_heading}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{t.ack_next_track_title}</div>
                        <div className="text-xs text-slate-500">{t.ack_next_track_desc}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{t.ack_next_anon_title}</div>
                        <div className="text-xs text-slate-500">{t.ack_next_anon_desc}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{t.ack_next_informed_title}</div>
                        <div className="text-xs text-slate-500">{t.ack_next_informed_desc}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    id="btn-print-receipt"
                    onClick={handlePrintReceipt}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <Download className="w-4 h-4" />
                    {t.btn_download_ack}
                  </button>

                  <button
                    type="button"
                    id="btn-go-to-tracking"
                    onClick={() => onSuccessNavigateToTrack(submittedAlert.trackingNumber)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-semibold text-xs shadow transition"
                  >
                    <span>{t.btn_go_to_tracking}</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* STEP 1: REPORT TYPE */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Étape 1 sur 6</span>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step1_title}</h2>
                      <p className="text-sm text-slate-600 mt-1">{t.wizard_step1_hint}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:[&>label:last-child:nth-child(odd)]:col-span-2">
                      {categories.map((cat) => {
                        const visual = getCategoryVisual(cat.name);
                        const Icon = visual.icon;
                        const active = selectedCategory === cat.name;
                        return (
                          <label
                            key={cat.id}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                              active ? 'border-blue-500 bg-blue-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="alert_category"
                              className="sr-only"
                              checked={active}
                              onChange={() => setSelectedCategory(cat.name)}
                            />
                            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${visual.bg} ${visual.text}`}>
                              <Icon className="w-5 h-5" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-bold text-slate-900 text-sm">{cat.name}</span>
                              <span className="block text-xs text-slate-500 mt-1">{cat.subCategories.join(', ')}.</span>
                            </span>
                            <span
                              className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                active ? 'border-blue-600' : 'border-slate-300'
                              }`}
                            >
                              {active && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold">{t.choice_anonymous}</strong>
                        <p className="mt-0.5 text-blue-800">{t.wizard_step2_hint}</p>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        id="btn-step1-next"
                        onClick={() => setCurrentStep(2)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
                      >
                        <span>Suivant</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: WHISTLEBLOWER INFORMATION (OPTIONAL) */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Étape 2 sur 6</span>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step2_title_optional}</h2>
                      <p className="text-sm text-slate-600 mt-1">{t.wizard_step2_hint}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_first_name}</label>
                        <input
                          type="text"
                          value={declarantFirstName}
                          onChange={(e) => setDeclarantFirstName(e.target.value)}
                          placeholder="Ex: Jean"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_last_name}</label>
                        <input
                          type="text"
                          value={declarantLastName}
                          onChange={(e) => setDeclarantLastName(e.target.value)}
                          placeholder="Ex: Dupont"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_job_title}</label>
                        <input
                          type="text"
                          value={declarantJob}
                          onChange={(e) => setDeclarantJob(e.target.value)}
                          placeholder="Ex: Auditeur interne, Chef de section..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_department}</label>
                        <input
                          type="text"
                          value={declarantDept}
                          onChange={(e) => setDeclarantDept(e.target.value)}
                          placeholder="Ex: Sinistres, Comptabilité, IT..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_declarant_type}</label>
                        <select
                          value={declarantType}
                          onChange={(e: any) => setDeclarantType(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="Employé">Employé(e) du Groupe ACTIVA</option>
                          <option value="Consultant">Consultant(e)</option>
                          <option value="Prestataire">Prestataire / Fournisseur</option>
                          <option value="Client">Client / Partenaire assuré</option>
                          <option value="Autre">Autre tiers</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_entity}</label>
                        <select
                          value={declarantEntity}
                          onChange={(e) => setDeclarantEntity(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          {entities.map((ent) => (
                            <option key={ent.id} value={ent.name}>
                              {ent.flag} {ent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_country}</label>
                        <select
                          value={declarantCountry}
                          onChange={(e) => setDeclarantCountry(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="">—</option>
                          {ACTIVA_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.name}>
                              {c.flag} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_email}</label>
                        <input
                          type="email"
                          value={declarantEmail}
                          onChange={(e) => setDeclarantEmail(e.target.value)}
                          placeholder="votre.email@group-activa.com"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_phone}</label>
                        <div className="flex gap-2">
                          <span className="flex items-center px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-600 shrink-0">
                            {ACTIVA_COUNTRIES.find((c) => c.name === declarantCountry)?.flag || '🌍'}
                          </span>
                          <input
                            type="tel"
                            value={declarantPhone}
                            onChange={(e) => setDeclarantPhone(e.target.value)}
                            placeholder="+237 ... ou +225 ..."
                            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <p>{t.wizard_step2_hint}</p>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          id="btn-save-and-exit"
                          onClick={handleSaveAndExit}
                          className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                        >
                          {t.btn_save_and_exit}
                        </button>
                        <button
                          type="button"
                          id="btn-step2-next"
                          onClick={() => setCurrentStep(3)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
                        >
                          <span>Suivant</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: INCIDENT INFORMATION */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Étape 3 sur 6</span>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step3_title}</h2>
                      <p className="text-sm text-slate-600 mt-1">{t.wizard_step3_desc}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {t.label_dates} *
                        </label>
                        <input
                          type="text"
                          value={incidentDates}
                          onChange={(e) => setIncidentDates(e.target.value)}
                          placeholder="Ex: Du 10 au 25 août 2026, ou Date précise"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">{t.no_future_dates_warning}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_location} *</label>
                        <input
                          type="text"
                          value={incidentLocation}
                          onChange={(e) => setIncidentLocation(e.target.value)}
                          placeholder="Ex: Siège Douala, Agence Plateau Abidjan, Entrepôt..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-blue-700" />
                          {t.label_entity} *
                        </label>
                        <select
                          value={concernedEntity}
                          onChange={(e) => setConcernedEntity(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                        >
                          {entities.map((ent) => (
                            <option key={ent.id} value={ent.name}>
                              {ent.flag} {ent.name} ({ent.country})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Autre entité (si non listée)</label>
                        <input
                          type="text"
                          value={customEntityInput}
                          onChange={(e) => setCustomEntityInput(e.target.value)}
                          placeholder="Possibilité d'ajouter une entité (CDC 3.1.1)"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Personnes impliquées — liste dynamique conservée (Phase 26 : relocalisée ici) */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {t.label_involved_persons_optional}
                        </span>
                        <button
                          type="button"
                          id="btn-add-involved"
                          onClick={addInvolvedPerson}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.btn_add_involved}</span>
                        </button>
                      </div>

                      {involvedPersons.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          Aucune personne enregistrée. Cliquez ci-dessus pour ajouter une personne impliquée.
                        </div>
                      ) : (
                        involvedPersons.map((p, idx) => (
                          <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">Personne #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeInvolvedPerson(p.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Nom / Prénom</label>
                                <input
                                  type="text"
                                  value={p.name}
                                  onChange={(e) => updateInvolvedPerson(p.id, 'name', e.target.value)}
                                  placeholder="Nom de la personne"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Poste / Fonction</label>
                                <input
                                  type="text"
                                  value={p.position}
                                  onChange={(e) => updateInvolvedPerson(p.id, 'position', e.target.value)}
                                  placeholder="Poste occupé"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Rôle hiérarchique</label>
                                <select
                                  value={p.hierarchyRole}
                                  onChange={(e: any) => updateInvolvedPerson(p.id, 'hierarchyRole', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                >
                                  <option value="Employé">Employé</option>
                                  <option value="Cadre">Cadre</option>
                                  <option value="Sous-Directeur">Sous-Directeur</option>
                                  <option value="Directeur+">Directeur+</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Témoins éventuels — liste dynamique conservée */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Témoins éventuels (optionnel)</span>
                        <button
                          type="button"
                          id="btn-add-witness"
                          onClick={addWitness}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.btn_add_witness}</span>
                        </button>
                      </div>

                      {witnesses.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          Aucun témoin renseigné.
                        </div>
                      ) : (
                        witnesses.map((w, idx) => (
                          <div key={w.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">Témoin #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeWitness(w.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Nom / Prénom</label>
                                <input
                                  type="text"
                                  value={w.name}
                                  onChange={(e) => updateWitness(w.id, 'name', e.target.value)}
                                  placeholder="Nom du témoin"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Poste</label>
                                <input
                                  type="text"
                                  value={w.position}
                                  onChange={(e) => updateWitness(w.id, 'position', e.target.value)}
                                  placeholder="Poste occupé"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Rôle hiérarchique</label>
                                <select
                                  value={w.hierarchyRole}
                                  onChange={(e: any) => updateWitness(w.id, 'hierarchyRole', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                >
                                  <option value="Employé">Employé</option>
                                  <option value="Cadre">Cadre</option>
                                  <option value="Sous-Directeur">Sous-Directeur</option>
                                  <option value="Directeur+">Directeur+</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_description} *</label>
                      <textarea
                        rows={5}
                        value={detailedDescription}
                        onChange={(e) => setDetailedDescription(e.target.value)}
                        placeholder={t.desc_placeholder}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_incident_category} *</label>
                        <select
                          value={selectedSubCategory}
                          onChange={(e) => setSelectedSubCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          {currentCategoryDef?.subCategories.map((sub, idx) => (
                            <option key={idx} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_impact_potential}</label>
                        <select
                          value={impactType}
                          onChange={(e) => setImpactType(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          {IMPACT_TYPES.map((imp, idx) => (
                            <option key={idx} value={imp}>
                              {imp}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedCategory.includes('Autres') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">{t.label_custom_violation}</label>
                        <input
                          type="text"
                          value={customViolation}
                          onChange={(e) => setCustomViolation(e.target.value)}
                          placeholder="Explicitez le type spécifique de manquement constaté"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Impact financier ou préjudice estimé
                      </label>
                      <input
                        type="text"
                        value={estimatedImpactValue}
                        onChange={(e) => setEstimatedImpactValue(e.target.value)}
                        placeholder="Ex: 15 000 €, 10M FCFA, Perte d'agrément..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>

                    {/* Toggle « situation en cours » — nouveau champ additif (Phase 26) */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{t.label_situation_ongoing}</div>
                        <div className="text-[11px] text-slate-500">{t.label_situation_ongoing_desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOngoing}
                        id="toggle-situation-ongoing"
                        onClick={() => setIsOngoing(!isOngoing)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ${
                          isOngoing ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            isOngoing ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* === AMÉLIORATION AJOUTÉE : matrice de risque DARC (Annexe
                        9) retirée de l'affichage sur demande explicite —
                        cette classification automatique reste calculée
                        (`liveRisk`, mêmes facteurs par défaut qu'avant :
                        finFactor/hierFactor/reputFactor=2, recidFactor=1) et
                        enregistrée avec le signalement (riskEvaluation),
                        exactement comme avant ; seule son exposition et son
                        édition interactive au lanceur d'alerte disparaissent
                        du formulaire public. La classification reste
                        ajustable ensuite par le personnel habilité via
                        "Modifier la priorité / Délais" (InvestigationDesk.tsx). */}

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>

                      <button
                        type="button"
                        id="btn-step3-next"
                        onClick={() => {
                          if (!detailedDescription.trim() || !incidentDates.trim() || !incidentLocation.trim()) {
                            setErrorMsg('Veuillez renseigner la description, la date et le lieu des faits.');
                            return;
                          }
                          setErrorMsg('');
                          setCurrentStep(4);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
                      >
                        <span>Suivant</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: ATTACHMENTS (OPTIONAL) */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Étape 4 sur 6</span>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step4_title_optional}</h2>
                      <p className="text-sm text-slate-600 mt-1">{t.wizard_step4_hint}</p>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition bg-slate-50/50">
                      <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">{t.drag_drop_evidence}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{t.max_file_note}</p>
                      <input
                        type="file"
                        id="evidence-file-input"
                        multiple
                        onChange={handleFileUpload}
                        className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {t.evidence_files_added} ({evidences.length})
                      </span>
                      {evidences.length === 0 && (
                        <span className="text-[11px] text-slate-500">{t.evidence_no_files}</span>
                      )}
                    </div>

                    {evidences.length > 0 && (
                      <div className="space-y-2">
                        {evidences.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                                {f.type.split('/')[1] || 'Doc'}
                              </span>
                              <span className="font-medium text-slate-800 truncate">{f.name}</span>
                              <span className="text-slate-400 text-[11px]">({Math.round(f.size / 1024)} Ko)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEvidence(f.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>{t.evidence_tips_optional_note}</span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <div className="font-semibold text-slate-800 mb-1">{t.evidence_tips_title}</div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        <li>{t.evidence_tip_1}</li>
                        <li>{t.evidence_tip_2}</li>
                        <li>{t.evidence_tip_3}</li>
                      </ul>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>

                      <button
                        type="button"
                        id="btn-step4-next"
                        onClick={() => setCurrentStep(5)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
                      >
                        <span>Suivant</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: REVIEW & CONFIRMATION */}
                {currentStep === 5 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Étape 5 sur 6</span>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step5_title}</h2>
                      <p className="text-sm text-slate-600 mt-1">{t.wizard_step5_hint}</p>
                    </div>

                    {/* Type de signalement */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                          {t.wizard_step1_title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          {t.btn_modify}
                        </button>
                      </div>
                      <div className="p-4 text-xs">
                        <span className="text-slate-500">{t.label_category}</span>
                        <div className="font-medium text-slate-800 mt-0.5">{selectedCategory}</div>
                      </div>
                    </div>

                    {/* Informations sur le lanceur d'alerte */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <User className="w-4 h-4 text-blue-600" />
                          {t.wizard_step2_title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          {t.btn_modify}
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">{t.label_first_name} / {t.label_last_name}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantName || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_job_title}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantJob || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_department}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantDept || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_country}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantCountry || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_entity}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{isAnonymous ? notProvided : declarantEntity}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_email}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantEmail || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_phone}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{declarantPhone || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Mode</span>
                          <div className="font-medium text-slate-800 mt-0.5">
                            {isAnonymous ? t.choice_anonymous : t.choice_identified}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informations sur l'incident */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <AlertTriangle className="w-4 h-4 text-blue-600" />
                          {t.wizard_step3_title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          {t.btn_modify}
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">{t.label_dates}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{incidentDates || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_location}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{incidentLocation || notProvided}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_involved_persons_optional}</span>
                          <div className="font-medium text-slate-800 mt-0.5">
                            {involvedPersons.length > 0 || witnesses.length > 0
                              ? `${involvedPersons.length + witnesses.length} personne(s)`
                              : notProvided}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_incident_category}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{selectedSubCategory}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_impact_potential}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{impactType}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">{t.label_situation_ongoing}</span>
                          <div className="font-medium text-slate-800 mt-0.5">{isOngoing ? 'Oui' : 'Non'}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500">{t.label_description}</span>
                          <div className="font-medium text-slate-800 mt-0.5 line-clamp-3">
                            {detailedDescription || notProvided}
                          </div>
                        </div>
                        <div className="sm:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-slate-500">Classification automatique</span>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                              liveRisk.nocaThreshold === 'NOCA 4'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : liveRisk.nocaThreshold === 'NOCA 3'
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : liveRisk.nocaThreshold === 'NOCA 2'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {liveRisk.nocaThreshold} - {liveRisk.priority.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pièces jointes */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Paperclip className="w-4 h-4 text-blue-600" />
                          {t.wizard_step4_title_optional}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(4)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          {t.btn_modify}
                        </button>
                      </div>
                      <div className="p-4 text-xs">
                        {evidences.length === 0 ? (
                          <span className="text-slate-400 italic">{t.evidence_no_files}</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {evidences.map((f) => (
                              <span key={f.id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                                {f.name} ({Math.round(f.size / 1024)} Ko)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>{t.review_submit_note}</span>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>

                      <button
                        type="submit"
                        id="btn-submit-final"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSubmitting ? 'Sécurisation en cours…' : t.btn_send_report}</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
