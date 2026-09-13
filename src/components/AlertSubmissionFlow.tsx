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
  Eye,
  EyeOff
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
  ACTIVA_ENTITIES, 
  ALERT_CATEGORIES, 
  IMPACT_TYPES, 
  computeRiskEvaluation 
} from '../data/activaConfig';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE : hachage salé côté client du mot de passe de suivi (jamais stocké en clair) ===
import { generateSalt, hashPassword } from '../services/crypto';

interface AlertSubmissionFlowProps {
  lang: Language;
  onSuccessNavigateToTrack: (trackingNumber: string) => void;
  onCancel: () => void;
}

export const AlertSubmissionFlow: React.FC<AlertSubmissionFlowProps> = ({
  lang,
  onSuccessNavigateToTrack,
  onCancel,
}) => {
  const t = TRANSLATIONS[lang];

  // Auto-save draft loading
  const savedDraft = storage.getDraft();

  // Step control (1 to 5)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // 1. Whistleblower identity
  const [isAnonymous, setIsAnonymous] = useState<boolean>(
    savedDraft ? savedDraft.isAnonymous : true
  );
  const [declarantName, setDeclarantName] = useState(savedDraft?.declarantName || '');
  const [declarantJob, setDeclarantJob] = useState(savedDraft?.declarantJob || '');
  const [declarantDept, setDeclarantDept] = useState(savedDraft?.declarantDept || '');
  const [declarantType, setDeclarantType] = useState<WhistleblowerInfo['declarantType']>(
    savedDraft?.declarantType || 'Employé'
  );
  const [declarantEntity, setDeclarantEntity] = useState(
    savedDraft?.declarantEntity || ACTIVA_ENTITIES[0].name
  );
  const [declarantEmail, setDeclarantEmail] = useState(savedDraft?.declarantEmail || '');
  const [declarantPhone, setDeclarantPhone] = useState(savedDraft?.declarantPhone || '');

  // 2. Incident & Category
  const [selectedCategory, setSelectedCategory] = useState<string>(
    savedDraft?.selectedCategory || ALERT_CATEGORIES[1].name // default to Fraude
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(
    savedDraft?.selectedSubCategory || ALERT_CATEGORIES[1].subCategories[0]
  );
  const [customViolation, setCustomViolation] = useState(savedDraft?.customViolation || '');
  const [detailedDescription, setDetailedDescription] = useState(
    savedDraft?.detailedDescription || ''
  );
  const [incidentDates, setIncidentDates] = useState(savedDraft?.incidentDates || '');
  const [incidentLocation, setIncidentLocation] = useState(savedDraft?.incidentLocation || '');
  const [concernedEntity, setConcernedEntity] = useState(
    savedDraft?.concernedEntity || ACTIVA_ENTITIES[0].name
  );
  const [customEntityInput, setCustomEntityInput] = useState('');

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

  // 5. Password & Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Submission result
  const [submittedAlert, setSubmittedAlert] = useState<AlertRecord | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Update subcategories when category changes
  const currentCategoryDef = ALERT_CATEGORIES.find(c => c.name === selectedCategory);
  useEffect(() => {
    if (currentCategoryDef && !currentCategoryDef.subCategories.includes(selectedSubCategory)) {
      setSelectedSubCategory(currentCategoryDef.subCategories[0] || '');
    }
  }, [selectedCategory]);

  // Real-time risk evaluation calculation
  const liveRisk = computeRiskEvaluation(finFactor, hierFactor, recidFactor, reputFactor);

  // Auto-save form changes
  useEffect(() => {
    if (submittedAlert) return;
    const timer = setTimeout(() => {
      storage.saveDraft({
        isAnonymous,
        declarantName,
        declarantJob,
        declarantDept,
        declarantType,
        declarantEntity,
        declarantEmail,
        declarantPhone,
        selectedCategory,
        selectedSubCategory,
        customViolation,
        detailedDescription,
        incidentDates,
        incidentLocation,
        concernedEntity,
        involvedPersons,
        witnesses,
        impactType,
        estimatedImpactValue,
        finFactor,
        hierFactor,
        recidFactor,
        reputFactor,
      });
      setSaveStatus('Brouillon sauvegardé');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isAnonymous, declarantName, declarantJob, declarantDept, declarantType,
    declarantEntity, declarantEmail, declarantPhone, selectedCategory,
    selectedSubCategory, customViolation, detailedDescription, incidentDates,
    incidentLocation, concernedEntity, involvedPersons, witnesses,
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

  // Submit Alert Handler
  // === AMÉLIORATION AJOUTÉE : handler asynchrone pour permettre le hachage salé du mot de passe ===
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!detailedDescription.trim()) {
      setErrorMsg('Veuillez fournir une description détaillée des faits constatés.');
      setCurrentStep(2);
      return;
    }

    if (!incidentDates.trim()) {
      setErrorMsg('Veuillez préciser la date ou la période des faits.');
      setCurrentStep(2);
      return;
    }

    if (!incidentLocation.trim()) {
      setErrorMsg('Veuillez préciser le lieu des faits.');
      setCurrentStep(2);
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Le mot de passe de sécurisation doit comporter au moins 6 caractères.');
      setCurrentStep(5);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);

    // Generate unique tracking number (e.g. ACT-2026-XXXX)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `ACT-2026-${randomSuffix}`;

    // === AMÉLIORATION AJOUTÉE : le mot de passe n'est jamais stocké en clair ===
    const accessCodeSalt = generateSalt();
    const accessCodeHash = await hashPassword(password, accessCodeSalt);

    // Concerned entity & country
    const matchedEntity = ACTIVA_ENTITIES.find(e => e.name === concernedEntity);
    const country = matchedEntity ? matchedEntity.country : 'Groupe ACTIVA';

    // Target completion date based on SLA
    let daysToAdd = 30;
    if (liveRisk.nocaThreshold === 'NOCA 4') daysToAdd = 2; // 48h
    else if (liveRisk.nocaThreshold === 'NOCA 3') daysToAdd = 7;
    else if (liveRisk.nocaThreshold === 'NOCA 2') daysToAdd = 15;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);

    const newRecord: AlertRecord = {
      id: 'alt-' + Date.now(),
      trackingNumber,
      accessCodeHash,
      accessCodeSalt,
      channel: 'web',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetCompletionDate: targetDate.toISOString(),
      whistleblower: {
        isAnonymous,
        fullName: isAnonymous ? undefined : declarantName,
        jobTitle: isAnonymous ? undefined : declarantJob,
        department: isAnonymous ? undefined : declarantDept,
        declarantType,
        entity: isAnonymous ? undefined : declarantEntity,
        email: isAnonymous ? undefined : declarantEmail,
        phone: isAnonymous ? undefined : declarantPhone,
      },
      category: selectedCategory,
      subCategory: selectedSubCategory,
      customViolationType: customViolation || undefined,
      detailedDescription,
      incidentDates,
      incidentLocation,
      concernedEntity: customEntityInput.trim() || concernedEntity,
      country,
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
        role: 'whistleblower',
        roleTitle: isAnonymous ? 'Déclarant Anonyme' : 'Déclarant Identifié',
        entity: newRecord.concernedEntity,
        country: newRecord.country,
      }
    );

    // Clear draft
    storage.clearDraft();
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

  // SUCCESS ACKNOWLEDGMENT VIEW
  if (submittedAlert) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-[#0B2545] p-6 sm:p-8 text-white text-center relative">
            <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              {t.ack_title}
            </h2>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">
              Votre dossier a été transmis de manière sécurisée et chiffrée à la Direction d’Audit, des Risques et de la Conformité (DARC) du Groupe ACTIVA.
            </p>
          </div>

          {/* Key Reference Box */}
          <div className="p-6 sm:p-8 bg-amber-50/60 border-b border-amber-200/80">
            <div className="max-w-md mx-auto bg-white p-5 rounded-xl border-2 border-amber-400 shadow-sm text-center">
              <div className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">
                {t.ack_tracking_num}
              </div>
              <div className="text-3xl font-mono font-extrabold text-[#0B2545] mb-3 select-all">
                {submittedAlert.trackingNumber}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  id="btn-copy-tracking"
                  onClick={() => copyToClipboard(submittedAlert.trackingNumber)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedTracking ? 'Copié !' : 'Copier le numéro'}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-left text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date de dépôt :</span>
                  <span className="font-medium text-slate-800">
                    {new Date(submittedAlert.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode de signalement :</span>
                  <span className="font-semibold text-emerald-700">
                    {submittedAlert.whistleblower.isAnonymous ? '100% Anonyme' : 'Confidentiel (Identifié)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Classification automatique :</span>
                  <span className="font-bold text-amber-700">
                    {submittedAlert.riskEvaluation.nocaThreshold} ({submittedAlert.riskEvaluation.priority.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Délai indicatif DARC :</span>
                  <span className="font-medium text-slate-800">
                    {submittedAlert.riskEvaluation.expectedTreatment}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Conservez précieusement vos identifiants :</strong>
                <p className="mt-0.5 text-blue-800">
                  Pour vous reconnecter et consulter les réponses de la DARC sans révéler votre identité, vous aurez besoin de votre numéro <span className="font-mono font-bold">{submittedAlert.trackingNumber}</span> et du mot de passe que vous venez de définir.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-6 sm:p-8 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              id="btn-print-receipt"
              onClick={handlePrintReceipt}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs shadow-sm transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              {t.btn_download_ack}
            </button>

            <button
              id="btn-go-to-tracking"
              onClick={() => onSuccessNavigateToTrack(submittedAlert.trackingNumber)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-semibold text-xs shadow transition"
            >
              <span>{t.btn_go_to_tracking}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header card with ACTIVA guarantee */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Plateforme conforme aux standards internationaux de lutte contre la fraude</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Formulaire de Signalement Éthique ACTIVA
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Les signalements sont traités en toute indépendance et stricte confidentialité par la DARC Groupe ACTIVA.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {saveStatus && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Save className="w-3.5 h-3.5" />
                {saveStatus}
              </span>
            )}
            <button
              id="btn-cancel-alert"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              Annuler
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mt-6 grid grid-cols-5 gap-2 text-center text-xs">
          {[
            { num: 1, label: 'Identité' },
            { num: 2, label: 'Faits' },
            { num: 3, label: 'Personnes' },
            { num: 4, label: 'Preuves & Risque' },
            { num: 5, label: 'Sécurité' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`p-2 rounded-lg border transition ${
                currentStep === s.num
                  ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                  : currentStep > s.num
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold">Étape {s.num}</div>
              <div className="text-[11px] truncate hidden sm:block">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
        {/* STEP 1: IDENTITY & CONFIDENTIALITY */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                {t.step_1_identity}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Conformément aux exigences (CDC 3.1.1), le signalement anonyme est activé par défaut.
              </p>
            </div>

            {/* Toggle Anonymous / Identified */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label 
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  isAnonymous 
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="whistleblower_mode"
                  checked={isAnonymous}
                  onChange={() => setIsAnonymous(true)}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <UserX className="w-4 h-4 text-emerald-700" />
                    {t.choice_anonymous}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {t.anonymous_note}
                  </p>
                </div>
              </label>

              <label 
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  !isAnonymous 
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="whistleblower_mode"
                  checked={!isAnonymous}
                  onChange={() => setIsAnonymous(false)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    {t.choice_identified}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Vos coordonnées restent strictement confidentielles et ne sont visibles que par l'équipe d'investigation DARC.
                  </p>
                </div>
              </label>
            </div>

            {/* Optional identified fields if not anonymous */}
            {!isAnonymous && (
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-fadeIn">
                <div className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
                  Informations du lanceur d’alerte (CDC 3.1.1)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_fullname} *
                    </label>
                    <input
                      type="text"
                      value={declarantName}
                      onChange={(e) => setDeclarantName(e.target.value)}
                      placeholder="Ex: Jean Dupont"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_declarant_type}
                    </label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_job_title}
                    </label>
                    <input
                      type="text"
                      value={declarantJob}
                      onChange={(e) => setDeclarantJob(e.target.value)}
                      placeholder="Ex: Auditeur interne, Chef de section..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_department}
                    </label>
                    <input
                      type="text"
                      value={declarantDept}
                      onChange={(e) => setDeclarantDept(e.target.value)}
                      placeholder="Ex: Sinistres, Comptabilité, IT..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_email} *
                    </label>
                    <input
                      type="email"
                      value={declarantEmail}
                      onChange={(e) => setDeclarantEmail(e.target.value)}
                      placeholder="votre.email@group-activa.com"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t.label_phone}
                    </label>
                    <input
                      type="tel"
                      value={declarantPhone}
                      onChange={(e) => setDeclarantPhone(e.target.value)}
                      placeholder="+237 ... ou +225 ..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="button"
                id="btn-step1-next"
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
              >
                <span>Étape suivante : Faits & Catégorie</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FACTS & CATEGORY */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                {t.step_2_facts}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Spécifiez la nature du manquement et décrivez précisément les éléments constatés.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.label_category} *
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                >
                  {ALERT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* SubCategory */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.label_subcategory} *
                </label>
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
            </div>

            {/* Custom Violation note if "Autres manquements graves" */}
            {selectedCategory.includes('Autres') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.label_custom_violation}
                </label>
                <input
                  type="text"
                  value={customViolation}
                  onChange={(e) => setCustomViolation(e.target.value)}
                  placeholder="Explicitez le type spécifique de manquement constaté"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Entity concerned (16 subsidiaries of 10 countries from CDC 1.0) */}
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
                  {ACTIVA_ENTITIES.map((ent) => (
                    <option key={ent.id} value={ent.name}>
                      {ent.flag} {ent.name} ({ent.country})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Autre entité (si non listée)
                </label>
                <input
                  type="text"
                  value={customEntityInput}
                  onChange={(e) => setCustomEntityInput(e.target.value)}
                  placeholder="Possibilité d'ajouter une entité (CDC 3.1.1)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Incident Dates & Location */}
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
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Règle CDC : pas de date future autorisée.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.label_location} *
                </label>
                <input
                  type="text"
                  value={incidentLocation}
                  onChange={(e) => setIncidentLocation(e.target.value)}
                  placeholder="Ex: Siège Douala, Agence Plateau Abidjan, Entrepôt..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.label_description} *
              </label>
              <textarea
                rows={5}
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                placeholder={t.desc_placeholder}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>

              <button
                type="button"
                id="btn-step2-next"
                onClick={() => {
                  if (!detailedDescription.trim() || !incidentDates.trim() || !incidentLocation.trim()) {
                    setErrorMsg('Veuillez renseigner la description, la date et le lieu des faits.');
                    return;
                  }
                  setErrorMsg('');
                  setCurrentStep(3);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
              >
                <span>Étape suivante : Personnes & Témoins</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PERSONS INVOLVED & WITNESSES (CDC 3.1.1 - C & D) */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t.step_3_persons}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Renseignez les personnes concernées et les témoins éventuels (optionnel mais utile à l'enquête).
              </p>
            </div>

            {/* Implicated persons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  C. Personnes impliquées / mises en cause
                </span>
                <button
                  type="button"
                  id="btn-add-involved"
                  onClick={addInvolvedPerson}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une personne</span>
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

            {/* Witnesses */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  D. Témoins éventuels
                </span>
                <button
                  type="button"
                  id="btn-add-witness"
                  onClick={addWitness}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un témoin</span>
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
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-semibold shadow transition"
              >
                <span>Étape suivante : Preuves & Risque</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: EVIDENCE & RISK MATRIX (ANNEXE 9) */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-700" />
                {t.step_4_evidence}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Téléversez vos pièces justificatives et évaluez l'impact selon la matrice officielle DARC.
              </p>
            </div>

            {/* Evidence file uploader */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Preuves documentaires (PDF, bordereaux, captures d'écran, photos)
              </label>
              
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center transition bg-slate-50/50">
                <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {t.drag_drop_evidence}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t.max_file_note}
                </p>
                <input
                  type="file"
                  id="evidence-file-input"
                  multiple
                  onChange={handleFileUpload}
                  className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              {/* Uploaded files list */}
              {evidences.length > 0 && (
                <div className="mt-3 space-y-2">
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
                        <span className="text-slate-400 text-[11px]">
                          ({Math.round(f.size / 1024)} Ko)
                        </span>
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
            </div>

            {/* Impact type & value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type d'impact principal
                </label>
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
            </div>

            {/* OFFICIAL DARC RISK MATRIX (ANNEXE 9) */}
            <div className="p-5 rounded-2xl bg-[#0B2545]/5 border border-[#134074]/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-700" />
                    {t.matrix_title}
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Application stricte des 4 critères d'évaluation du Cahier des Charges (Annexe 9).
                  </p>
                </div>
                {/* Live NOCA Badge */}
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Score : {liveRisk.totalScore}/16</span>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${
                    liveRisk.nocaThreshold === 'NOCA 4'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : liveRisk.nocaThreshold === 'NOCA 3'
                      ? 'bg-orange-100 text-orange-800 border border-orange-300'
                      : liveRisk.nocaThreshold === 'NOCA 2'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {liveRisk.nocaThreshold} - {liveRisk.priority.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* 1. Financial Impact */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    1. Impact financier
                  </label>
                  <select
                    value={finFactor}
                    onChange={(e: any) => setFinFactor(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Faible (01) : &lt; 5 000 Euro</option>
                    <option value={2}>Élevé (02) : 5 000 - 10 000 Euro</option>
                    <option value={3}>Très élevé (03) : 10 000 - 20 000 Euro</option>
                    <option value={4}>Critique (04) : &gt; 20 000 Euro</option>
                  </select>
                </div>

                {/* 2. Hierarchy Level */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    2. Niveau hiérarchique
                  </label>
                  <select
                    value={hierFactor}
                    onChange={(e: any) => setHierFactor(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Faible (01) : Employé</option>
                    <option value={2}>Élevé (02) : Cadre</option>
                    <option value={3}>Très élevé (03) : Sous Directeur</option>
                    <option value={4}>Critique (04) : Directeur</option>
                  </select>
                </div>

                {/* 3. Recidivism */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    3. Récidive
                  </label>
                  <select
                    value={recidFactor}
                    onChange={(e: any) => setRecidFactor(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Faible (01) : Aucune</option>
                    <option value={2}>Élevé (02) : Possible</option>
                    <option value={3}>Très élevé (03) : Confirmée</option>
                    <option value={4}>Critique (04) : Confirmée (Majeure)</option>
                  </select>
                </div>

                {/* 4. Reputation Risk */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    4. Risque pour la réputation
                  </label>
                  <select
                    value={reputFactor}
                    onChange={(e: any) => setReputFactor(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Faible (01) : Négligeable</option>
                    <option value={2}>Élevé (02) : Modéré</option>
                    <option value={3}>Très élevé (03) : Élevé</option>
                    <option value={4}>Critique (04) : Élevé / Médiatique</option>
                  </select>
                </div>
              </div>

              {/* Traitement attendu selon Annexe 9 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-700">Traitement attendu DARC :</span>{' '}
                  <span className="text-[#0B2545] font-bold">{liveRisk.expectedTreatment}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {liveRisk.totalScore <= 6 && 'Seuil NOCA 1 (Score 4-6)'}
                  {liveRisk.totalScore >= 7 && liveRisk.totalScore <= 10 && 'Seuil NOCA 2 (Score 7-10)'}
                  {liveRisk.totalScore >= 11 && liveRisk.totalScore <= 13 && 'Seuil NOCA 3 (Score 11-13)'}
                  {liveRisk.totalScore >= 14 && 'Seuil NOCA 4 (Score 14-16)'}
                </span>
              </div>
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
                <span>Étape finale : Sécurisation de l'accès</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SECURITY & SUBMISSION */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-600" />
                {t.step_5_security}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t.pwd_security_note}
              </p>
            </div>

            {/* Password input */}
            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-4">
              <div className="font-semibold text-slate-800 text-xs">
                Création du code de sécurité personnel pour le suivi anonyme (CDC 3.1.1 & 3.2.1)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.label_password} *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.label_password_confirm} *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez le mot de passe"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Summary preview before transmission */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Récapitulatif avant transmission sécurisée
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-500">Mode :</span>{' '}
                  <strong className="text-slate-800">{isAnonymous ? 'Anonyme' : `Identifié (${declarantName})`}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Entité :</span>{' '}
                  <strong className="text-slate-800">{customEntityInput || concernedEntity}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Catégorie :</span>{' '}
                  <strong className="text-slate-800">{selectedCategory}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Score & Gravité :</span>{' '}
                  <strong className="text-amber-700">{liveRisk.nocaThreshold} ({liveRisk.priority.toUpperCase()})</strong>
                </div>
                <div>
                  <span className="text-slate-500">Pièces justificatives :</span>{' '}
                  <strong className="text-slate-800">{evidences.length} fichier(s)</strong>
                </div>
                <div>
                  <span className="text-slate-500">Personnes impliquées :</span>{' '}
                  <strong className="text-slate-800">{involvedPersons.length} personne(s)</strong>
                </div>
              </div>
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
                <span>{isSubmitting ? 'Sécurisation en cours…' : t.btn_submit_alert}</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
