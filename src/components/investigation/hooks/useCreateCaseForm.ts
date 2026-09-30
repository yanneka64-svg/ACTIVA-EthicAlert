/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Modale « Créer un nouveau dossier » (3 étapes).
 *
 * État du formulaire et gestionnaire(s) déplacés TELS QUELS depuis
 * InvestigationDesk.tsx (mêmes `useState`, mêmes valeurs initiales, mêmes
 * corps de fonctions, mêmes noms). InvestigationDesk.tsx appelle ce hook à
 * chaque rendu et déstructure exactement les mêmes identifiants qu'avant :
 * les modales et sections qui les reçoivent en props sont inchangées.
 * `setSelectedAlertId`/`setViewMode` (état de la vue, resté dans
 * InvestigationDesk.tsx) et `t` sont passés en paramètres.
 */
import React, { useState } from 'react';
import { computeRiskEvaluation } from '../../../data/activaConfig';
import { generateSalt, hashPassword, generateAccessPassword } from '../../../services/crypto';
import { storage } from '../../../services/storage';
import { AlertRecord, UserProfile } from '../../../types';

export function useCreateCaseForm(activeUser: UserProfile, t: Record<string, string>, setSelectedAlertId: React.Dispatch<React.SetStateAction<string | null>>, setViewMode: React.Dispatch<React.SetStateAction<'list' | 'detail'>>) {
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  // Modale courte à 3 étapes (Informations/Classification/Validation),
  // réservée aux opérateurs (décision confirmée par l'utilisateur : pas de
  // questionnaire de risque complet ici — le dossier créé reçoit un niveau
  // par défaut NOCA 2, ajustable ensuite depuis l'onglet Allégations
  // existant, exactement comme pour tout autre dossier). Réutilise le
  // même mécanisme réel que le formulaire public
  // (AlertSubmissionFlow.tsx) pour tout ce qui doit rester honnête :
  // numéro de suivi, code d'accès salé/haché, évaluation de risque via la
  // vraie fonction `computeRiskEvaluation` (jamais un objet RiskEvaluation
  // inventé à la main), délai cible dérivé de la config SLA réelle.
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [createCaseStep, setCreateCaseStep] = useState<1 | 2 | 3>(1);
  const [newCaseObjet, setNewCaseObjet] = useState('');
  const [newCaseCountry, setNewCaseCountry] = useState('');
  const [newCaseEntity, setNewCaseEntity] = useState('');
  const [newCaseCategory, setNewCaseCategory] = useState('');
  const [newCaseSubCategory, setNewCaseSubCategory] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  // Construit un AlertRecord complet et honnête à partir de la saisie
  // courte de la modale — même mécanique que AlertSubmissionFlow.tsx
  // (numéro de suivi, code d'accès salé/haché, délai cible dérivé de la
  // config SLA réelle), avec un niveau de risque par défaut NOCA 2
  // (impact financier/niveau hiérarchique/récidive/réputation = 2 sur 4
  // chacun, via la vraie fonction `computeRiskEvaluation` — jamais un
  // score inventé à la main), à affiner ensuite depuis l'onglet
  // Allégations comme pour tout autre dossier.
  const handleCreateCase = async () => {
    if (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity || !newCaseCategory || !newCaseSubCategory) return;
    setIsCreatingCase(true);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `ACT-2026-${randomSuffix}`;
    const generatedPassword = generateAccessPassword();
    const accessCodeSalt = generateSalt();
    const accessCodeHash = await hashPassword(generatedPassword, accessCodeSalt);

    const slaConfig = storage.getSlaConfig();
    const riskEvaluation = computeRiskEvaluation(2, 2, 2, 2, slaConfig);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + slaConfig.noca2Days);

    const newRecord: AlertRecord = {
      id: 'alt-' + Date.now(),
      trackingNumber,
      accessCodeHash,
      accessCodeSalt,
      // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
      // 'direct' : dossier saisi directement par un opérateur (téléphone,
      // rencontre en personne...), distinct de 'web' (formulaire public
      // en ligne) et 'qr_code' — les 3 valeurs réelles du canal existant.
      channel: 'direct',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetCompletionDate: targetDate.toISOString(),
      confidentialityLevel: 'confidential',
      whistleblower: { isAnonymous: true, declarantType: 'Employé' },
      category: newCaseCategory,
      subCategory: newCaseSubCategory,
      detailedDescription: newCaseObjet.trim(),
      incidentDates: t.create_case_dates_unspecified,
      incidentLocation: newCaseEntity,
      concernedEntity: newCaseEntity,
      country: newCaseCountry,
      riskEvaluation,
      impactType: newCaseCategory,
      involvedPersons: [],
      witnesses: [],
      evidences: [],
      status: 'new',
      assignedInvestigators: [],
      assignedInvestigatorNames: [],
      internalNotes: [],
      messages: [
        {
          id: 'msg-init',
          sender: 'admin',
          senderDisplayName: `DARC (${activeUser.name})`,
          content: `Dossier créé par ${activeUser.name} sous la référence ${trackingNumber}. Classification provisoire : ${riskEvaluation.nocaThreshold} (${riskEvaluation.expectedTreatment}).`,
          createdAt: new Date().toISOString(),
        },
      ],
      correctiveMeasures: [],
    };

    storage.saveAlert(newRecord);
    storage.logAudit(
      'ALERT_SUBMITTED',
      `Nouveau dossier créé par un opérateur : ${trackingNumber} (${newRecord.category} - ${newRecord.concernedEntity}). Classification provisoire : ${riskEvaluation.nocaThreshold}.`,
      { id: newRecord.id, trackingNumber: newRecord.trackingNumber },
      activeUser
    );

    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 13 : miroir
    // de la création de dossier par le personnel) === Écriture miroir
    // best-effort vers le vrai backend — jamais attendue, jamais capable de
    // bloquer ou d'altérer la suite (déjà enregistrée localement juste
    // au-dessus, seule source de vérité pour cet écran). Import dynamique :
    // InvestigationDesk.tsx est déjà un gros chunk chargé à la demande —
    // jamais d'import statique d'un module touchant firebase/functions ici.
    // No-op silencieux tant que la Phase 4 n'est pas configurée — voir
    // services/caseCreationMirrorSync.ts.
    import('../../../services/caseCreationMirrorSync')
      .then(({ mirrorStaffCaseCreationToRealBackend }) =>
        mirrorStaffCaseCreationToRealBackend({
          category: newRecord.category,
          subcategory: newRecord.subCategory,
          country: newRecord.country,
          entity: newRecord.concernedEntity,
          description: newRecord.detailedDescription,
          reportingMode: newRecord.whistleblower.isAnonymous ? 'anonymous' : 'identified',
          confidentialityLevel: newRecord.confidentialityLevel,
        })
      )
      .then((result) => {
        if (result) storage.linkMirroredCase(newRecord.id, result.caseId, result.caseNumber);
      })
      .catch(() => {});

    setIsCreatingCase(false);
    setShowCreateCaseModal(false);
    setCreateCaseStep(1);
    setNewCaseObjet('');
    setNewCaseCountry('');
    setNewCaseEntity('');
    setNewCaseCategory('');
    setNewCaseSubCategory('');
    setSelectedAlertId(newRecord.id);
    setViewMode('detail');
  };

  return {
    showCreateCaseModal,
    setShowCreateCaseModal,
    createCaseStep,
    setCreateCaseStep,
    newCaseObjet,
    setNewCaseObjet,
    newCaseCountry,
    setNewCaseCountry,
    newCaseEntity,
    setNewCaseEntity,
    newCaseCategory,
    setNewCaseCategory,
    newCaseSubCategory,
    setNewCaseSubCategory,
    isCreatingCase,
    setIsCreatingCase,
    handleCreateCase,
  };
}
