/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-cinquième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115/#116, les 5 modales et la vue liste (étapes suivantes)
 * pour les étapes précédentes. Extraction de l'en-tête de la fiche dossier
 * (fil d'Ariane, titre + badges + score de risque, menu Actions, ligne de
 * cartes d'informations) hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * Ne couvre PAS la barre d'onglets (voir CaseTabBar.tsx, extraite à part —
 * elle reste physiquement imbriquée dans la colonne gauche
 * d'InvestigationDesk.tsx, juste avant le switch de contenu par onglet,
 * qui lui reste en place), ni la colonne de droite ("Statut du dossier" /
 * "Informations complémentaires" / "Liens rapides") ni l'état vide
 * ("dossier introuvable") — hors du périmètre demandé.
 *
 * Tous les handlers (`handleSendToReview`, `handleResumeInvestigation`,
 * `handleArchiveAlert`) et setters d'état des modales restent possédés par
 * InvestigationDesk.tsx : passés en props tels quels.
 */
import React from 'react';
import {
  FolderOpen,
  ArrowUpCircle,
  Ban,
  ChevronDown,
  UserPlus,
  SlidersHorizontal,
  HelpCircle,
  ClipboardList,
  Eye,
  Search,
  CheckCircle2,
  RotateCcw,
  FolderArchive,
  Tag,
  Building2,
  Globe2,
  Calendar,
  Hourglass,
  UserCog,
} from 'lucide-react';
import { Language, AlertRecord, UserProfile, PriorityLevel, EvidenceFile } from '../../types';
import { CaseStatus } from '../../domain/caseTypes';
import { StatusBadge, Breadcrumb, nocaColor } from '../ui';
import { trData } from '../../i18n/dataLabels';
import { storage } from '../../services/storage';
import { computeSlaStatus } from '../../services/statusMapping';
import { userCan } from '../../services/authz';
import { formatCountryLabel } from '../../data/activaConfig';
import { getPriorityBadge } from './getPriorityBadge';

interface CaseDetailHeaderProps {
  t: Record<string, string>;
  lang: Language;
  activeUser: UserProfile;
  selectedAlert: AlertRecord;
  currentWorkflowStatus: CaseStatus | undefined;
  setViewMode: (v: 'list' | 'detail') => void;
  showActionsMenu: boolean;
  setShowActionsMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  setSelectedInvestigatorIds: (v: string[]) => void;
  setShowAssignModal: (v: boolean) => void;
  setDismissTargetStatus: (v: 'duplicate' | 'out_of_scope') => void;
  setDismissReason: (v: string) => void;
  setShowDismissModal: (v: boolean) => void;
  setEscalateReason: (v: string) => void;
  setEscalateOwnerId: (v: string) => void;
  setShowEscalateModal: (v: boolean) => void;
  setNewPriority: (v: PriorityLevel) => void;
  setShowPriorityModal: (v: boolean) => void;
  setShowRequestInfoModal: (v: boolean) => void;
  setReportDraft: (v: string) => void;
  setReportFile: (v: EvidenceFile | undefined) => void;
  setShowReportModal: (v: boolean) => void;
  handleSendToReview: () => void;
  handleResumeInvestigation: () => void;
  setShowCloseModal: (v: boolean) => void;
  setShowReopenModal: (v: boolean) => void;
  handleArchiveAlert: () => void;
}

export const CaseDetailHeader: React.FC<CaseDetailHeaderProps> = ({
  t,
  lang,
  activeUser,
  selectedAlert,
  currentWorkflowStatus,
  setViewMode,
  showActionsMenu,
  setShowActionsMenu,
  setSelectedInvestigatorIds,
  setShowAssignModal,
  setDismissTargetStatus,
  setDismissReason,
  setShowDismissModal,
  setEscalateReason,
  setEscalateOwnerId,
  setShowEscalateModal,
  setNewPriority,
  setShowPriorityModal,
  setShowRequestInfoModal,
  setReportDraft,
  setReportFile,
  setShowReportModal,
  handleSendToReview,
  handleResumeInvestigation,
  setShowCloseModal,
  setShowReopenModal,
  handleArchiveAlert,
}) => {
  return (
    <>
      <Breadcrumb
        items={[
          { label: t.breadcrumb_cases, onClick: () => setViewMode('list') },
          { label: selectedAlert.trackingNumber },
        ]}
      />

      {/* Title row: folder icon + tracking number + badges + Actions menu (top),
          description + risk gauge (below) — matches the reference mockup's
          two-line asymmetric header exactly. */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
            <FolderOpen className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl sm:text-2xl font-extrabold text-slate-900">
                {selectedAlert.trackingNumber}
              </h1>
              {getPriorityBadge(selectedAlert)}
              {/* === AMÉLIORATION AJOUTÉE (revue design) === libellé traduit (« CLOSED » s'affichait en anglais) */}
              <StatusBadge status={selectedAlert.status} label={(t[`case_badge_status_${selectedAlert.status}`] || selectedAlert.status.replace('_', ' ')).toUpperCase()} size="sm" />
              {/* === AMÉLIORATION AJOUTÉE (Visibilité de l'escalade —
                  impasse UX corrigée) === BUG PRÉEXISTANT CORRIGÉ,
                  identifié lors d'une analyse critique du frontend :
                  une fois escaladé, rien dans l'interface ne montrait
                  qu'un dossier l'était — le badge "INVESTIGATION"
                  restait affiché sans changement visible (l'escalade
                  était absorbée dans l'étape générique "En
                  investigation" de la timeline "STATUT DU DOSSIER",
                  jamais une étape à part). Ce badge n'apparaît que
                  tant que `workflowStatus` est ENCORE 'escalated'
                  (état courant, disparaît naturellement dès que le
                  dossier avance à l'étape suivante) — la carte
                  "Dossier escaladé" ci-dessous, elle, reste visible en
                  permanence comme trace historique. */}
              {currentWorkflowStatus === 'escalated' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-rose-200 text-rose-700 bg-rose-50">
                  <ArrowUpCircle className="w-3 h-3" />
                  {t.case_escalated_badge}
                </span>
              )}
              {/* === AMÉLIORATION AJOUTÉE (Classement sans suite —
                  Doublon / Hors périmètre) === Sans ce badge, un
                  dossier classé "Doublon"/"Hors périmètre" afficherait
                  seulement le badge générique "CLOSED" hérité du
                  statut legacy (syncLegacyStatus), indiscernable d'une
                  vraie clôture après investigation complète. */}
              {(currentWorkflowStatus === 'duplicate' || currentWorkflowStatus === 'out_of_scope') && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-300 text-slate-600 bg-slate-100">
                  <Ban className="w-3 h-3" />
                  {currentWorkflowStatus === 'duplicate' ? t.dismiss_reason_duplicate : t.dismiss_reason_out_of_scope}
                </span>
              )}
              {/* === AMÉLIORATION AJOUTÉE (Retours visuels 3) === BUG PRÉEXISTANT
                  CORRIGÉ, signalé par l'utilisateur (capture de référence) : le
                  score de risque était affiché dans une box flottante séparée à
                  droite ; l'utilisateur demande de le supprimer et d'afficher le
                  score sur la même ligne que le statut ("INVESTIGATION"). Même
                  donnée réelle qu'avant (riskEvaluation.totalScore/16, couleur
                  via nocaColor) — seul l'emplacement change. */}
              {(() => {
                const score = selectedAlert.riskEvaluation.totalScore;
                const tone = nocaColor(score);
                return (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${tone.border} ${tone.text} bg-white`}>
                    {t.case_risk_score} : {score}/16
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-slate-600 mt-1 line-clamp-1 max-w-xl">
              {selectedAlert.detailedDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5 shrink-0">
          {/* ACTIONS MENU (CDC 3.1.2 & 3.1.3: Attribution, Priorité, Clôture, Réouverture, Archivage) —
              every item below is the exact same button/handler as before, just grouped in one dropdown. */}
          <div className="relative">
            <button
              id="btn-case-actions-menu"
              onClick={() => setShowActionsMenu((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold shadow-sm transition"
            >
              <span>{t.case_actions}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 text-xs">
                {/* === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
                    Remplace la comparaison de rôle codée en dur par la
                    vraie permission `cases.assign` (domain/permissions.ts).
                    Corrige une incohérence réelle : `system_admin` n'a
                    volontairement AUCUNE permission liée aux dossiers
                    ("System Administrator ≠ Case Access", déjà appliqué
                    partout ailleurs via isGlobalCaseViewer/ROLE_PERMISSIONS)
                    mais pouvait jusqu'ici attribuer un dossier via ce
                    bouton codé en dur ; `darc_compliance`, qui a bien
                    `cases.assign`, ne le pouvait pas. */}
                {userCan(activeUser, 'cases.assign') && (
                  <button
                    id="btn-desk-assign"
                    onClick={() => {
                      setSelectedInvestigatorIds(selectedAlert.assignedInvestigators);
                      setShowAssignModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t.btn_assign_investigator}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Classement sans suite —
                    Doublon / Hors périmètre) === BUG PRÉEXISTANT
                    CORRIGÉ, identifié lors d'une analyse critique du
                    frontend : 'duplicate'/'out_of_scope' (CaseStatus,
                    domain/caseTypes.ts) étaient structurellement
                    atteignables depuis 'new' (ALLOWED_TRANSITIONS,
                    domain/workflow.ts) mais aucun écran ne le
                    proposait — un signalement manifestement doublon ou
                    hors périmètre devait passer par tout le circuit
                    d'investigation (allégations, mesures correctives)
                    avant de pouvoir être clôturé. Même garde que
                    "Attribuer" (cases.assign, décision d'opérateur) ;
                    réservé aux dossiers pas encore attribués (voir
                    handleDismissCase). */}
                {userCan(activeUser, 'cases.assign') && currentWorkflowStatus === 'new' && (
                  <button
                    id="btn-desk-dismiss"
                    onClick={() => {
                      setDismissTargetStatus('duplicate');
                      setDismissReason('');
                      setShowDismissModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <Ban className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t.btn_dismiss_case}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
                    Escalade manuelle (brief §14/§44). Gardée par
                    `cases.reassign` (comme l'attribution, l'escalade
                    change la responsabilité du dossier) — un
                    investigateur de base n'a pas cette permission, un
                    senior_investigator/functional_admin/darc_compliance
                    oui. N'apparaît que s'il existe au moins un
                    destinataire actif dans le registre d'escalade
                    admin-éditable (Gouvernance) — REMPLACE
                    `getGroupEscalationOwners`, limité à 2 rôles codés
                    en dur. */}
                {userCan(activeUser, 'cases.reassign') && storage.getEscalationRecipients().filter((r) => r.active).length > 0 && (
                  <button
                    id="btn-desk-escalate"
                    onClick={() => {
                      setEscalateReason('');
                      setEscalateOwnerId(storage.getEscalationRecipients().filter((r) => r.active)[0]?.id ?? '');
                      setShowEscalateModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{t.btn_escalate_case}</span>
                  </button>
                )}

                {(activeUser.role === 'functional_admin' || activeUser.role === 'system_admin') && (
                  <button
                    id="btn-desk-priority"
                    onClick={() => {
                      setNewPriority(selectedAlert.overridePriority || selectedAlert.riskEvaluation.priority);
                      setShowPriorityModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t.btn_change_priority}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Branchement du moteur de
                    workflow riche) === Rend réellement franchissables
                    les étapes "En attente d'informations" et "En revue"
                    de la timeline "STATUT DU DOSSIER" (jusqu'ici
                    toujours grisées — voir domain/workflow.ts,
                    storage.transitionStatus()). Visibles pendant la
                    phase active d'investigation uniquement. */}
                {currentWorkflowStatus === 'investigation' && (
                  <button
                    id="btn-desk-request-info"
                    onClick={() => {
                      setShowRequestInfoModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-purple-50 text-purple-700 font-semibold text-left"
                  >
                    {/* === AMÉLIORATION AJOUTÉE : `text-left` — le libellé de cet
                        item est le plus long du menu et passe seul sur 2 lignes ;
                        sans cette classe, le `text-align: center` par défaut des
                        `<button>` centrait la 2e ligne au lieu de l'aligner sous
                        la 1re comme tous les autres items du menu. */}
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.btn_request_info}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Rapport d'investigation
                    obligatoire avant l'envoi en revue) === Rédiger le
                    rapport est désormais un préalable réel : "Envoyer en
                    revue" ci-dessous n'apparaît que si un rapport (texte
                    et/ou fichier importé) est renseigné — jamais un
                    bouton visible mais bloqué. Libellé toujours
                    "Rédiger" : réécrire remplace le contenu précédent,
                    pas de distinction création/modification. */}
                {currentWorkflowStatus === 'investigation' && (
                  <button
                    id="btn-desk-write-report"
                    onClick={() => {
                      setReportDraft(selectedAlert.investigationReport ?? '');
                      setReportFile(selectedAlert.investigationReportFile);
                      setShowReportModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-teal-50 text-teal-700 font-semibold text-left"
                  >
                    <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.btn_write_report}</span>
                  </button>
                )}

                {currentWorkflowStatus === 'investigation' && (!!selectedAlert.investigationReport || !!selectedAlert.investigationReportFile) && (
                  <button
                    id="btn-desk-send-review"
                    onClick={() => {
                      handleSendToReview();
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.btn_send_review}</span>
                  </button>
                )}

                {(currentWorkflowStatus === 'pending_information' || currentWorkflowStatus === 'conclusion_pending' || currentWorkflowStatus === 'functional_review') && (
                  <button
                    id="btn-desk-resume-investigation"
                    onClick={() => {
                      handleResumeInvestigation();
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-blue-50 text-blue-700 font-semibold"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{t.btn_resume_investigation}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Fix — gate Clôturer par la
                    permission cases.close) === BUG PRÉEXISTANT CORRIGÉ :
                    ce bouton était visible pour tout compte pouvant
                    simplement ouvrir la fiche dossier (cases.edit), y
                    compris un enquêteur junior (role investigator) qui
                    n'a, selon domain/permissions.ts, PAS la permission
                    cases.close (réservée à senior_investigator/
                    functional_admin/darc_compliance/system_admin(*)) —
                    même garde que le bouton Attribuer/Réattribuer
                    (`canAssign`, cases.assign) déjà réel plus haut. */}
                {selectedAlert.status !== 'closed' && selectedAlert.status !== 'archived' && userCan(activeUser, 'cases.close') && (
                  <button
                    id="btn-desk-close"
                    onClick={() => {
                      setShowCloseModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.btn_close_case}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Fix — gate Réouvrir par la
                    permission cases.reopen) === BUG PRÉEXISTANT CORRIGÉ,
                    même nature que "Clôturer le dossier" ci-dessus : ce
                    bouton était visible pour tout compte ayant
                    simplement cases.edit, y compris un enquêteur junior,
                    qui n'a PAS cases.reopen (réservée à
                    functional_admin/darc_compliance/system_admin(*)). */}
                {selectedAlert.status === 'closed' && userCan(activeUser, 'cases.reopen') && (
                  <button
                    id="btn-desk-reopen"
                    onClick={() => {
                      setShowReopenModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.btn_reopen_case}</span>
                  </button>
                )}

                {/* === AMÉLIORATION AJOUTÉE (Fix — gate Archiver par la
                    permission cases.archive) === BUG PRÉEXISTANT
                    CORRIGÉ, même nature que "Clôturer"/"Rouvrir"
                    ci-dessus : ce bouton était visible pour tout compte
                    ayant simplement cases.edit. cases.archive est une
                    nouvelle permission dédiée (domain/permissions.ts),
                    réservée aux mêmes rôles que cases.reopen
                    (functional_admin/darc_compliance) — l'archivage
                    légal (conservation 10 ans) est une action au moins
                    aussi définitive qu'une réouverture. */}
                {selectedAlert.status === 'closed' && userCan(activeUser, 'cases.archive') && (
                  <button
                    onClick={() => {
                      handleArchiveAlert();
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>{t.btn_archive_case}</span>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — cartes d'info du
          dossier) === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur
          (capture de référence) : cette ligne d'info était une simple
          rangée de texte sans carte ("matching the mockup exactly" d'un
          choix antérieur, contredit par la nouvelle capture) — reprend
          désormais le même motif carte (icône + libellé + valeur) que la
          vignette "Score de risque" juste au-dessus. Même données, même
          grille, seule la présentation change. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <Tag className="w-4 h-4" />
          </span>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_category}</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.category}>{trData(selectedAlert.category, lang)}</div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <Building2 className="w-4 h-4" />
          </span>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_entity}</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.concernedEntity}>{selectedAlert.concernedEntity}</div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <Globe2 className="w-4 h-4" />
          </span>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_country}</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.country}>{formatCountryLabel(storage.getCountries(), selectedAlert.country)}</div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4" />
          </span>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_received}</div>
          <div className="font-bold text-slate-900 mt-0.5">
            {new Date(selectedAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
          </div>
        </div>
        {(() => {
          const slaStatus = computeSlaStatus(selectedAlert);
          const tone = slaStatus === 'overdue' ? 'rose' : slaStatus === 'at_risk' ? 'amber' : 'blue';
          const iconBoxClass = tone === 'rose' ? 'bg-rose-50 text-rose-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700';
          const valueClass = tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900';
          // === AMÉLIORATION AJOUTÉE (Retours visuels) === délai restant
          // réel (jamais fabriqué) : différence entre `targetCompletionDate`
          // (déjà réel) et l'instant présent, en jours pleins.
          const daysDelta = selectedAlert.targetCompletionDate
            ? Math.ceil((new Date(selectedAlert.targetCompletionDate).getTime() - Date.now()) / (24 * 3600 * 1000))
            : null;
          return (
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${iconBoxClass}`}>
                <Hourglass className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_sla_due}</div>
              <div className={`font-bold mt-0.5 ${valueClass}`}>
                {selectedAlert.targetCompletionDate
                  ? new Date(selectedAlert.targetCompletionDate).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')
                  : '—'}
              </div>
              {daysDelta !== null && (
                <div className={`text-[11px] font-semibold mt-0.5 ${valueClass}`}>
                  {daysDelta >= 0 ? t.desk_due_in_days.replace('{n}', String(daysDelta)) : `${t.case_info_late} (${Math.abs(daysDelta)} ${t.desk_days_short})`}
                </div>
              )}
            </div>
          );
        })()}
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
            <UserCog className="w-4 h-4" />
          </span>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_investigator}</div>
          <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.assignedInvestigatorNames.join(', ')}>
            {selectedAlert.assignedInvestigatorNames.length > 0 ? selectedAlert.assignedInvestigatorNames.join(', ') : t.case_info_unassigned}
          </div>
        </div>
      </div>
    </>
  );
};
