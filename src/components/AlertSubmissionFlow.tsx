import React, { useState, useEffect } from 'react';
// === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
// étape) === les icônes de chaque étape sont désormais importées par leur
// composant respectif (src/components/submission/*). Seule l'icône du
// bandeau d'erreur, resté ici, est encore utilisée dans ce fichier.
import { AlertTriangle } from 'lucide-react';
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
  computeRiskEvaluation
} from '../data/activaConfig';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4) ===
import { mirrorSubmissionToRealBackend } from '../services/casesCloudSync';
// === AMÉLIORATION AJOUTÉE : hachage salé côté client du mot de passe de suivi (jamais stocké en clair) ===
// === AMÉLIORATION AJOUTÉE (Phase 26) === generateAccessPassword génère
// désormais le mot de passe lui-même (voir plus bas) ; hashPassword/generateSalt
// continuent de le saler et le hacher exactement comme avant.
import { generateSalt, hashPassword, generateAccessPassword } from '../services/crypto';
// === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
import { isGlobalCaseViewer } from '../services/authz';
import { notifyNewAlertToOperators } from '../services/emailNotify';
// === AMÉLIORATION AJOUTÉE : données par défaut (catégories, pays…) traduites à l'affichage ===
import { trData } from '../i18n/dataLabels';
// === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
// étape) === chaque bloc de rendu de l'assistant vit désormais dans son
// propre composant ; ce fichier garde tout l'état, le brouillon
// auto-sauvegardé, les validations et la soumission.
import { ConfidentialityGate } from './submission/ConfidentialityGate';
import { WizardSidebar } from './submission/WizardSidebar';
import { AcknowledgmentStep } from './submission/AcknowledgmentStep';
import { Step1ReportType } from './submission/Step1ReportType';
import { Step2Declarant } from './submission/Step2Declarant';
import { Step3Incident } from './submission/Step3Incident';
import { Step4Evidence } from './submission/Step4Evidence';
import { Step5Review } from './submission/Step5Review';

interface AlertSubmissionFlowProps {
  lang: Language;
  onSuccessNavigateToTrack: (trackingNumber: string) => void;
  onCancel: () => void;
}

// === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
// étape) === `CATEGORY_VISUALS`/`getCategoryVisual` déplacés tels quels dans
// src/components/submission/Step1ReportType.tsx (seule utilisatrice).

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
  // === AMÉLIORATION AJOUTÉE (sauvegarde silencieuse du brouillon) === Sur
  // demande explicite : l'enregistrement automatique du brouillon reste
  // réel (storage.saveDraft), mais ne s'affiche plus à l'écran — plus de
  // badge "Brouillon sauvegardé" dans la barre latérale.
  useEffect(() => {
    if (submittedAlert) return;
    const timer = setTimeout(() => {
      storage.saveDraft(buildDraftObject());
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

  // === AMÉLIORATION AJOUTÉE (nettoyage du code mort) === `todayStr`
  // (plafond "pas de date future", CDC 3.1.1) retiré : il n'était plus lu
  // depuis que la date de l'incident est un champ texte libre ; la règle
  // reste rappelée à l'utilisateur sous le champ (t.no_future_dates_warning).

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
      setErrorMsg(t.err_missing_description);
      setCurrentStep(3);
      return;
    }

    if (!incidentDates.trim()) {
      setErrorMsg(t.err_missing_date);
      setCurrentStep(3);
      return;
    }

    if (!incidentLocation.trim()) {
      setErrorMsg(t.err_missing_location);
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
          // === AMÉLIORATION AJOUTÉE : premier message rédigé dans la langue du déclarant ===
          content: t.sub_auto_first_message.replace('{tracking}', trackingNumber).replace('{level}', liveRisk.nocaThreshold).replace('{treatment}', trData(liveRisk.expectedTreatment, lang)),
          createdAt: new Date().toISOString(),
        }
      ],
      correctiveMeasures: [],
    };

    // Save to storage
    storage.saveAlert(newRecord);

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4, puis
    // Phase 7 : lien dossier local ↔ dossier réel) ===
    // Écriture miroir best-effort vers le vrai backend (Case/Firestore/
    // Cloud Functions) — jamais attendue, jamais capable de bloquer ou
    // d'altérer la suite de la soumission (déjà enregistrée localement
    // juste au-dessus, seule source de vérité pour cet écran). No-op
    // silencieux tant que les Cloud Functions ne sont pas déployées — voir
    // services/casesCloudSync.ts. En cas de succès, persiste l'identifiant
    // réel renvoyé sur l'AlertRecord local (storage.linkMirroredCase) —
    // préalable à toute future mise en miroir des mutations ultérieures.
    mirrorSubmissionToRealBackend({
      category: newRecord.category,
      subcategory: newRecord.subCategory,
      country: newRecord.country,
      entity: newRecord.concernedEntity,
      description: newRecord.detailedDescription,
      reportingMode: isAnonymous ? 'anonymous' : 'identified',
      confidentialityLevel: newRecord.confidentialityLevel,
      // === AMÉLIORATION AJOUTÉE (revue PR #139) === mêmes identifiants de
      // suivi pour le dossier local et le dossier réel.
      accessCode: generatedPassword,
      externalReference: trackingNumber,
    }).then((result) => {
      if (result) storage.linkMirroredCase(newRecord.id, result.caseId, result.caseNumber);
    }).catch(() => {});

    storage.logAudit(
      'ALERT_SUBMITTED',
      `Nouvelle alerte enregistrée : ${trackingNumber} (${newRecord.category} - ${newRecord.concernedEntity}). Classification : ${liveRisk.nocaThreshold}. Mode : ${isAnonymous ? 'Anonyme' : 'Identifié'}.`,
      { id: newRecord.id, trackingNumber: newRecord.trackingNumber },
      {
        id: 'whistleblower-anonymous',
        name: isAnonymous ? 'Lanceur d’alerte (Anonyme)' : (declarantName || 'Lanceur d’alerte'),
        email: isAnonymous ? 'anonyme@declare.activa' : declarantEmail,
        username: 'whistleblower-anonymous',
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
      <ConfidentialityGate
        t={t}
        lang={lang}
        onCancel={onCancel}
        setConfidentialityConfirmed={setConfidentialityConfirmed}
      />
    );
  }

  // === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
  // étape) === `wizardSteps`/`displayStep` déplacés dans
  // src/components/submission/WizardSidebar.tsx, `notProvided` dans
  // Step5Review.tsx (seuls utilisateurs respectifs).

  return (
    // === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) === classe
    // `activa-form` : styles et animations propres au formulaire (index.css).
    <div className="activa-form max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <div className="activa-enter lg:sticky lg:top-6" style={{ '--d': '0ms' } as React.CSSProperties}>
        <WizardSidebar
          t={t}
          currentStep={currentStep}
          submittedAlert={submittedAlert}
          setCurrentStep={setCurrentStep}
        />
        </div>

        {/* Main content */}
        <div className="activa-enter" style={{ '--d': '120ms' } as React.CSSProperties}>
          {errorMsg && (
            <div className="activa-enter mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* === AMÉLIORATION AJOUTÉE (formulaire — design modernisé) ===
              carte à ombre douce et fine barre de progression en haut,
              qui avance à chaque étape (6 étapes au total). */}
          <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_40px_-20px_rgb(15_23_42/0.18)] p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-slate-100" aria-hidden="true">
              <div
                className="h-full rounded-r-full bg-gradient-to-r from-blue-600 to-sky-400 transition-[width] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
                style={{ width: `${((submittedAlert ? 6 : currentStep) / 6) * 100}%` }}
              />
            </div>
            {submittedAlert ? (
              /* STEP 6: ACKNOWLEDGMENT */
              <AcknowledgmentStep
                t={t}
                submittedAlert={submittedAlert}
                password={password}
                copiedTracking={copiedTracking}
                copyToClipboard={copyToClipboard}
                handlePrintReceipt={handlePrintReceipt}
                onSuccessNavigateToTrack={onSuccessNavigateToTrack}
              />
            ) : (
              <form onSubmit={handleSubmit} className="activa-caret-blink space-y-6">
                {/* STEP 1: REPORT TYPE */}
                {currentStep === 1 && (
                  <Step1ReportType
                    t={t}
                    lang={lang}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    onCancel={onCancel}
                    setCurrentStep={setCurrentStep}
                  />
                )}

                {/* STEP 2: WHISTLEBLOWER INFORMATION (OPTIONAL) */}
                {currentStep === 2 && (
                  <Step2Declarant
                    t={t}
                    lang={lang}
                    entities={entities}
                    declarantFirstName={declarantFirstName}
                    setDeclarantFirstName={setDeclarantFirstName}
                    declarantLastName={declarantLastName}
                    setDeclarantLastName={setDeclarantLastName}
                    declarantJob={declarantJob}
                    setDeclarantJob={setDeclarantJob}
                    declarantDept={declarantDept}
                    setDeclarantDept={setDeclarantDept}
                    declarantType={declarantType}
                    setDeclarantType={setDeclarantType}
                    declarantEntity={declarantEntity}
                    setDeclarantEntity={setDeclarantEntity}
                    declarantCountry={declarantCountry}
                    setDeclarantCountry={setDeclarantCountry}
                    declarantEmail={declarantEmail}
                    setDeclarantEmail={setDeclarantEmail}
                    declarantPhone={declarantPhone}
                    setDeclarantPhone={setDeclarantPhone}
                    setCurrentStep={setCurrentStep}
                    handleSaveAndExit={handleSaveAndExit}
                  />
                )}

                {/* STEP 3: INCIDENT INFORMATION */}
                {currentStep === 3 && (
                  <Step3Incident
                    t={t}
                    lang={lang}
                    entities={entities}
                    incidentDates={incidentDates}
                    setIncidentDates={setIncidentDates}
                    incidentLocation={incidentLocation}
                    setIncidentLocation={setIncidentLocation}
                    concernedEntity={concernedEntity}
                    setConcernedEntity={setConcernedEntity}
                    customEntityInput={customEntityInput}
                    setCustomEntityInput={setCustomEntityInput}
                    involvedPersons={involvedPersons}
                    addInvolvedPerson={addInvolvedPerson}
                    updateInvolvedPerson={updateInvolvedPerson}
                    removeInvolvedPerson={removeInvolvedPerson}
                    witnesses={witnesses}
                    addWitness={addWitness}
                    updateWitness={updateWitness}
                    removeWitness={removeWitness}
                    detailedDescription={detailedDescription}
                    setDetailedDescription={setDetailedDescription}
                    selectedSubCategory={selectedSubCategory}
                    setSelectedSubCategory={setSelectedSubCategory}
                    currentCategoryDef={currentCategoryDef}
                    impactType={impactType}
                    setImpactType={setImpactType}
                    selectedCategory={selectedCategory}
                    customViolation={customViolation}
                    setCustomViolation={setCustomViolation}
                    estimatedImpactValue={estimatedImpactValue}
                    setEstimatedImpactValue={setEstimatedImpactValue}
                    isOngoing={isOngoing}
                    setIsOngoing={setIsOngoing}
                    setErrorMsg={setErrorMsg}
                    setCurrentStep={setCurrentStep}
                  />
                )}

                {/* STEP 4: ATTACHMENTS (OPTIONAL) */}
                {currentStep === 4 && (
                  <Step4Evidence
                    t={t}
                    evidences={evidences}
                    handleFileUpload={handleFileUpload}
                    removeEvidence={removeEvidence}
                    setCurrentStep={setCurrentStep}
                  />
                )}

                {/* STEP 5: REVIEW & CONFIRMATION */}
                {currentStep === 5 && (
                  <Step5Review
                    t={t}
                    lang={lang}
                    selectedCategory={selectedCategory}
                    declarantName={declarantName}
                    declarantJob={declarantJob}
                    declarantDept={declarantDept}
                    declarantCountry={declarantCountry}
                    isAnonymous={isAnonymous}
                    declarantEntity={declarantEntity}
                    declarantEmail={declarantEmail}
                    declarantPhone={declarantPhone}
                    incidentDates={incidentDates}
                    incidentLocation={incidentLocation}
                    involvedPersons={involvedPersons}
                    witnesses={witnesses}
                    selectedSubCategory={selectedSubCategory}
                    impactType={impactType}
                    isOngoing={isOngoing}
                    detailedDescription={detailedDescription}
                    liveRisk={liveRisk}
                    evidences={evidences}
                    isSubmitting={isSubmitting}
                    setCurrentStep={setCurrentStep}
                  />
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
