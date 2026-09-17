/**
 * === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — Boîte de réception /
 * À attribuer / En attente d'infos / Dossiers attribués) ===
 *
 * Sur retour utilisateur détaillé (captures de référence) : les 4 écrans
 * ci-dessus, jusqu'ici rendus par `InvestigationDesk` avec un simple
 * `initialFilter` + `hideTopBanner` (Refonte Opérateur, phases B-E), sont
 * remplacés par ce nouveau composant dédié — une vraie "boîte de
 * réception" avec cartes KPI réelles, sélection multiple par case à cocher,
 * barre d'actions groupées, filtres riches (pays/entité/nature/criticité/
 * sévérité/urgence/canal/sensibilité) et, pour la Boîte de réception, un
 * panneau liste + détail/attribution côte à côte.
 *
 * Rien n'est réinventé : le périmètre visible (`useVisibleAlerts`), le
 * moteur de compatibilité d'attribution (`computeCandidates`), la charge de
 * travail (`computeWorkload`) et le moteur de filtre pur
 * (`domain/advancedSearch.ts`, déjà utilisé par `AdvancedSearchView.tsx`)
 * sont réutilisés tels quels — aucune règle métier n'est dupliquée ou
 * réinventée pour cet écran. Les mutations (attribution, relance) suivent
 * exactement le même motif que les handlers déjà réels d'
 * `InvestigationDesk.tsx` (`handleAssignInvestigators`/
 * `handleSendInvestigatorMessage`) : `storage.saveAlert` + `storage.logAudit`
 * avec les mêmes types d'événement d'audit.
 *
 * Convention i18n : comme `AdvancedSearchView.tsx` (même précédent déjà
 * établi dans ce code pour un écran transverse de ce type), les libellés de
 * filtres/colonnes/actions restent des chaînes françaises en dur — seuls le
 * titre, le sous-titre et les états vides passent par `TRANSLATIONS`.
 */
import React, { useState } from 'react';
import {
  Inbox,
  ListChecks,
  HelpCircle,
  FolderCheck,
  FolderOpen,
  Clock,
  Search,
  RotateCcw,
  UserPlus,
  UserCog,
  Send,
  Building2,
  Lock,
  X,
  ArrowLeft,
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) ===
  Archive,
  // === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers
  // envoyés en revue) ===
  Eye,
} from 'lucide-react';
import { AlertRecord, Language, UserProfile, PriorityLevel, SeverityLevel, NocaThreshold, CaseMessage } from '../types';
import { ConfidentialityLevel } from '../domain/caseTypes';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { userCan } from '../services/authz';
import { formatCountryLabel } from '../data/activaConfig';
// === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
import { notifyAssignmentToInvestigators } from '../services/emailNotify';
import { computeCandidates, AssignmentCandidate } from '../domain/assignmentEngine';
import { computeWorkload } from '../domain/workloadCalc';
import { computeSlaStatus } from '../services/statusMapping';
import { searchAlerts, AdvancedSearchCriteria, effectivePriority } from '../domain/advancedSearch';
import { Button, KpiCard, PriorityBadge, DataTable, EmptyState } from './ui';
import type { DataTableColumn, KpiTone } from './ui';
// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === réutilise exactement
// le même balisage checkbox + charge de travail que la modale d'attribution
// d'InvestigationDesk.tsx (composant désormais exporté depuis ce fichier
// pour cette seule raison, aucun autre changement).
import { AssignCandidateRow } from './InvestigationDesk';

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace Enquêteur) ===
// 3 nouveaux modes purement additifs : `my_cases`/`to_process`/`in_progress`
// remplacent le rendu InvestigationDesk+initialFilter des écrans Enquêteur
// `inv_my_cases`/`inv_to_process`/`inv_in_progress` (mêmes règles de
// périmètre qu'avant — `useVisibleAlerts` limite déjà un enquêteur non
// global à ses propres dossiers, donc aucune notion d'attribution n'a de
// sens ici : pas de case à cocher, pas de bouton Attribuer). L'écran
// Enquêteur "En attente" (`inv_pending`) réutilise directement le mode
// `pending_info` existant (règle et action "Relancer" identiques), avec ses
// libellés surchargés via `titleOverride`/`subtitleOverride`/`emptyOverride`
// ci-dessous plutôt qu'un 5e mode dupliqué.
// === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === `closed`,
// juste en dessous de `assigned` ("Dossiers attribués") dans la barre
// latérale (StaffPortalLayout.tsx) : les dossiers attribués ET clôturés,
// en lecture seule (`rowAction: 'none'`, comme les 3 écrans Enquêteur
// "de travail" ci-dessus) — jamais de réattribution sur un dossier déjà
// clos.
// === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers envoyés
// en revue) === `review`, entre `assigned` et `closed` : dossiers dont le
// rapport d'investigation a été envoyé en revue (workflowStatus
// conclusion_pending/functional_review, InvestigationDesk.handleSendToReview)
// — en lecture seule ici aussi (`rowAction: 'none'`), la clôture réelle se
// fait sur la fiche dossier complète via `onOpenCase`, qui réutilise telle
// quelle la validation déjà existante (handleCloseAlert — au moins une
// mesure corrective documentée) plutôt que de la dupliquer.
export type OperatorDeskMode = 'inbox' | 'to_assign' | 'pending_info' | 'assigned' | 'review' | 'closed' | 'my_cases' | 'to_process' | 'in_progress' | 'inv_inbox';

interface OperatorCaseDeskProps {
  lang: Language;
  activeUser: UserProfile;
  mode: OperatorDeskMode;
  /** Navigue vers la fiche dossier complète (mécanisme déjà réel — /cases/:trackingNumber). */
  onOpenCase: (trackingNumber: string) => void;
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace
  // Enquêteur) === surcharges optionnelles du titre/sous-titre/état vide —
  // permet de réutiliser un mode existant (ex. `pending_info`) sous un
  // libellé différent (ex. "En attente" côté Enquêteur, clé
  // `sidebar_inv_pending` déjà réelle) sans dupliquer sa logique.
  titleOverride?: string;
  subtitleOverride?: string;
  emptyOverride?: string;
}

const CHANNEL_LABELS: Record<AlertRecord['channel'], string> = { web: 'Web', qr_code: 'QR Code', direct: 'Dépôt direct' };
const SEVERITY_LABELS: Record<SeverityLevel, string> = { mineure: 'Mineure', moderee: 'Modérée', majeure: 'Majeure', critique: 'Critique' };
const URGENCY_LABELS: Record<PriorityLevel, string> = { faible: 'Faible', elevee: 'Élevée', tres_elevee: 'Très élevée', critique: 'Critique' };
const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = { standard: 'Standard', restricted: 'Restreint', confidential: 'Confidentiel', highly_confidential: 'Très confidentiel' };
const NOCA_OPTIONS: NocaThreshold[] = ['NOCA 1', 'NOCA 2', 'NOCA 3', 'NOCA 4'];
const NOCA_TONE: Record<NocaThreshold, string> = {
  'NOCA 1': 'bg-slate-100 text-slate-700 border-slate-200',
  'NOCA 2': 'bg-amber-100 text-amber-800 border-amber-200',
  'NOCA 3': 'bg-orange-100 text-orange-800 border-orange-200',
  'NOCA 4': 'bg-rose-100 text-rose-800 border-rose-200',
};
const DEFAULT_FOLLOWUP_MESSAGE = "Merci de nous transmettre les informations complémentaires demandées afin que nous puissions poursuivre le traitement de votre signalement.";

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === même repli que
// `InvestigationDesk.getConfidentialityBadge` — rien pour standard/restreint
// (jamais alarmant par défaut), un badge discret sinon.
function ConfidentialityBadge({ level }: { level?: ConfidentialityLevel }) {
  const lvl = level ?? 'restricted';
  if (lvl === 'restricted' || lvl === 'standard') return null;
  const style = lvl === 'highly_confidential' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${style}`} title="Niveau de confidentialité du dossier">
      <Lock className="w-2.5 h-2.5" />
      {CONFIDENTIALITY_LABELS[lvl]}
    </span>
  );
}

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace Enquêteur) ===
// `rowAction` dit quelle action de ligne/groupée cet écran propose :
// 'assign'/'reassign' (gardées en plus par `cases.assign`, voir `canAssign`
// plus bas), 'followup' (relance — aucune permission dédiée, comme la
// messagerie déjà réelle d'InvestigationDesk), ou 'none' (les 3 écrans
// Enquêteur "de travail" — aucune notion d'attribution n'a de sens sur son
// propre périmètre déjà filtré par `useVisibleAlerts`) : ni case à cocher,
// ni colonne d'action, ni barre d'actions groupées.
type RowAction = 'assign' | 'reassign' | 'followup' | 'none';

interface ModeConfig {
  icon: React.ComponentType<{ className?: string }>;
  titleKey:
    | 'sidebar_op_inbox' | 'sidebar_op_assign' | 'sidebar_op_pending' | 'sidebar_op_processed' | 'sidebar_op_review' | 'sidebar_op_closed'
    | 'sidebar_inv_my_cases' | 'sidebar_inv_to_process' | 'sidebar_inv_in_progress' | 'sidebar_inv_inbox';
  subtitleKey:
    | 'ocd_inbox_subtitle' | 'ocd_to_assign_subtitle' | 'ocd_pending_info_subtitle' | 'ocd_assigned_subtitle' | 'ocd_review_subtitle' | 'ocd_closed_subtitle'
    | 'ocd_my_cases_subtitle' | 'ocd_to_process_subtitle' | 'ocd_in_progress_subtitle';
  emptyKey:
    | 'ocd_empty_inbox' | 'ocd_empty_to_assign' | 'ocd_empty_pending_info' | 'ocd_empty_assigned' | 'ocd_empty_review' | 'ocd_empty_closed'
    | 'ocd_empty_my_cases' | 'ocd_empty_to_process' | 'ocd_empty_in_progress';
  predicate: (a: AlertRecord) => boolean;
  rowAction: RowAction;
}

const MODE_CONFIG: Record<OperatorDeskMode, ModeConfig> = {
  inbox: {
    icon: Inbox,
    titleKey: 'sidebar_op_inbox',
    subtitleKey: 'ocd_inbox_subtitle',
    emptyKey: 'ocd_empty_inbox',
    predicate: (a) => a.status === 'new',
    rowAction: 'assign',
  },
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === "toutes les affaires
  // nouvelles et en cours" — même règle que l'ancien `excludeClosed`.
  to_assign: {
    icon: ListChecks,
    titleKey: 'sidebar_op_assign',
    subtitleKey: 'ocd_to_assign_subtitle',
    emptyKey: 'ocd_empty_to_assign',
    predicate: (a) => a.status !== 'corrective_action' && a.status !== 'closed' && a.status !== 'archived',
    rowAction: 'assign',
  },
  pending_info: {
    icon: HelpCircle,
    titleKey: 'sidebar_op_pending',
    subtitleKey: 'ocd_pending_info_subtitle',
    emptyKey: 'ocd_empty_pending_info',
    predicate: (a) => a.status === 'under_review',
    rowAction: 'followup',
  },
  // === AMÉLIORATION AJOUTÉE (Dossiers ouverts, ex-"Dossiers attribués") ===
  // Renommé sur demande explicite, maintenant que les dossiers clôturés ont
  // leur propre onglet dédié (`closed`, ci-dessous) : exclut désormais les
  // dossiers déjà clôturés, pour ne plus faire doublon avec ce nouvel
  // onglet — inverse exact de "non attribués" restreint aux dossiers
  // encore ouverts.
  assigned: {
    icon: FolderCheck,
    titleKey: 'sidebar_op_processed',
    subtitleKey: 'ocd_assigned_subtitle',
    emptyKey: 'ocd_empty_assigned',
    predicate: (a) => a.assignedInvestigators.length > 0 && a.status !== 'closed',
    rowAction: 'reassign',
  },
  // === AMÉLIORATION AJOUTÉE (Boîte de réception Opérateur — dossiers
  // envoyés en revue) === Se base sur `workflowStatus` (moteur riche,
  // InvestigationDesk.handleSendToReview) plutôt que sur le statut legacy
  // `corrective_action` : ce dernier est aussi atteint par l'ancien
  // mécanisme "Mesure corrective ajoutée", sans rapport avec un envoi en
  // revue — les deux ne doivent pas être confondus ici. Exclut closed/
  // archived explicitement : `handleCloseAlert` ne remet pas `workflowStatus`
  // à jour, donc un dossier clôturé depuis cet état y resterait sinon
  // indéfiniment visible.
  review: {
    icon: Eye,
    titleKey: 'sidebar_op_review',
    subtitleKey: 'ocd_review_subtitle',
    emptyKey: 'ocd_empty_review',
    predicate: (a) =>
      (a.workflowStatus === 'conclusion_pending' || a.workflowStatus === 'functional_review') &&
      a.status !== 'closed' &&
      a.status !== 'archived',
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === même
  // périmètre que `assigned` (dossiers réellement attribués), restreint aux
  // dossiers clôturés — jamais de réattribution possible sur ceux-ci
  // (`rowAction: 'none'`), colonnes dédiées ci-dessous (Réf./Nature/Pays/
  // Entité/Reçu le/Clôturé le/Résumé).
  closed: {
    icon: Archive,
    titleKey: 'sidebar_op_closed',
    subtitleKey: 'ocd_closed_subtitle',
    emptyKey: 'ocd_empty_closed',
    // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
    // périmètre) === Un dossier classé "Doublon"/"Hors périmètre"
    // (storage.transitionStatus) n'a par nature jamais d'investigateur
    // assigné — sans cette clause, il resterait invisible de cet onglet
    // (et de fait de toute l'interface Opérateur) une fois clôturé.
    predicate: (a) => a.status === 'closed' && (a.assignedInvestigators.length > 0 || a.workflowStatus === 'duplicate' || a.workflowStatus === 'out_of_scope'),
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — miroir Espace
  // Enquêteur) === 3 modes ci-dessous : mêmes règles exactes que les
  // anciens `initialFilter` d'App.tsx (`myCasesOnly`/`excludeClosed`/
  // `status`) — mais `myCasesOnly` lui-même n'a plus besoin d'être recalculé
  // ici : `useVisibleAlerts` restreint déjà un compte non global-viewer à
  // ses seuls dossiers assignés, donc le prédicat n'a besoin d'exprimer que
  // la nuance de statut propre à chaque écran.
  my_cases: {
    icon: FolderOpen,
    titleKey: 'sidebar_inv_my_cases',
    subtitleKey: 'ocd_my_cases_subtitle',
    emptyKey: 'ocd_empty_my_cases',
    predicate: () => true,
    rowAction: 'none',
  },
  // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
  // Nouvel onglet d'accueil de l'espace Enquêteur (`inv_dashboard`, voir
  // App.tsx) : même périmètre exact que `my_cases` ci-dessus (tous les
  // dossiers attribués à l'enquêteur connecté, `useVisibleAlerts` s'en
  // charge déjà) — seule la présentation change, avec le panneau liste +
  // détail/réponse côte à côte de la Boîte de réception Opérateur (voir
  // `mode === 'inbox' || mode === 'inv_inbox'` plus bas), sur demande
  // explicite de l'utilisateur ("appliquer les éléments de la boite de
  // réception opérateur excepté la première partie [les cartes KPI]").
  // Jamais de case à cocher ni de bouton Attribuer (`rowAction: 'none'`,
  // même raison que `my_cases`/`to_process`/`in_progress` : un enquêteur
  // n'a pas à s'auto-attribuer ses propres dossiers).
  inv_inbox: {
    icon: Inbox,
    titleKey: 'sidebar_inv_inbox',
    subtitleKey: 'ocd_my_cases_subtitle',
    emptyKey: 'ocd_empty_my_cases',
    predicate: () => true,
    rowAction: 'none',
  },
  to_process: {
    icon: ListChecks,
    titleKey: 'sidebar_inv_to_process',
    subtitleKey: 'ocd_to_process_subtitle',
    emptyKey: 'ocd_empty_to_process',
    predicate: (a) => a.status !== 'corrective_action' && a.status !== 'closed' && a.status !== 'archived',
    rowAction: 'none',
  },
  in_progress: {
    icon: Clock,
    titleKey: 'sidebar_inv_in_progress',
    subtitleKey: 'ocd_in_progress_subtitle',
    emptyKey: 'ocd_empty_in_progress',
    predicate: (a) => a.status === 'investigation',
    rowAction: 'none',
  },
};

export const OperatorCaseDesk: React.FC<OperatorCaseDeskProps> = ({ lang, activeUser, mode, onOpenCase, titleOverride, subtitleOverride, emptyOverride }) => {
  const t = TRANSLATIONS[lang];
  const cfg = MODE_CONFIG[mode];
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
  const displayTitle = titleOverride ?? t[cfg.titleKey];
  const displaySubtitle = subtitleOverride ?? t[cfg.subtitleKey];
  const displayEmpty = emptyOverride ?? t[cfg.emptyKey];
  // === AMÉLIORATION AJOUTÉE (Fix — gate Attribuer/Réattribuer par la
  // permission cases.assign) === même garde que le bouton "Attribuer"
  // d'InvestigationDesk (`userCan(activeUser, 'cases.assign')`,
  // InvestigationDesk.tsx ligne ~1533) — jusqu'ici absente de ce nouvel
  // écran, qui affichait Attribuer/Réattribuer à quiconque pouvait
  // simplement atteindre la page. `senior_investigator` a `cases.reassign`
  // mais délibérément pas `cases.assign` (domain/permissions.ts) : seuls
  // `functional_admin`/`darc_compliance`/`system_admin`(*) voient ce
  // bouton — cohérent avec le fait que `/operator/assign` est déjà gardé
  // par `PermissionGuard allowed={isGlobalViewer}` au niveau App.tsx.
  const canAssign = userCan(activeUser, 'cases.assign');

  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  React.useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // Filtres riches
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [nocaFilter, setNocaFilter] = useState<'all' | NocaThreshold>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | SeverityLevel>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | PriorityLevel>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | AlertRecord['channel']>('all');
  const [confidentialityFilter, setConfidentialityFilter] = useState<'all' | ConfidentialityLevel>('all');

  // Sélection multiple (cases à cocher + barre d'actions groupées)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Boîte de réception : panneau détail/attribution/réponse, à droite de la liste
  const [panelAlertId, setPanelAlertId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Modale d'attribution partagée (simple ou groupée)
  const [assignTargetIds, setAssignTargetIds] = useState<string[] | null>(null);
  const [assignSelectedInvestigatorIds, setAssignSelectedInvestigatorIds] = useState<string[]>([]);

  // Modale de relance partagée (En attente d'infos, simple ou groupée)
  const [followupTargetIds, setFollowupTargetIds] = useState<string[] | null>(null);
  const [followupText, setFollowupText] = useState('');

  const allUsers = storage.getUsers();
  const investigatorUsers = allUsers.filter((u) => userCan(u, 'cases.edit'));
  const entities = storage.getEntities();
  const categories = storage.getCategories();

  const baseVisible = useVisibleAlerts(alerts, activeUser);
  const modeAlerts = baseVisible.filter(cfg.predicate);
  const countries = Array.from(new Set(modeAlerts.map((a) => a.country).filter(Boolean))).sort();

  const criteria: AdvancedSearchCriteria = {
    keyword: search || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    noca: nocaFilter !== 'all' ? nocaFilter : undefined,
    severity: severityFilter !== 'all' ? severityFilter : undefined,
    priority: urgencyFilter !== 'all' ? urgencyFilter : undefined,
    channel: channelFilter !== 'all' ? channelFilter : undefined,
    confidentiality: confidentialityFilter !== 'all' ? confidentialityFilter : undefined,
  };
  let filteredAlerts = searchAlerts(modeAlerts, criteria);
  if (countryFilter !== 'all') filteredAlerts = filteredAlerts.filter((a) => a.country === countryFilter);
  if (entityFilter !== 'all') filteredAlerts = filteredAlerts.filter((a) => a.concernedEntity === entityFilter);
  filteredAlerts = [...filteredAlerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const hasActiveFilters = !!(search || countryFilter !== 'all' || entityFilter !== 'all' || categoryFilter !== 'all' || nocaFilter !== 'all' || severityFilter !== 'all' || urgencyFilter !== 'all' || channelFilter !== 'all' || confidentialityFilter !== 'all');
  const resetFilters = () => {
    setSearch('');
    setCountryFilter('all');
    setEntityFilter('all');
    setCategoryFilter('all');
    setNocaFilter('all');
    setSeverityFilter('all');
    setUrgencyFilter('all');
    setChannelFilter('all');
    setConfidentialityFilter('all');
  };

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === KPI réels, calculés
  // sur l'ensemble du panier (avant filtres d'affinage) — jamais un chiffre
  // inventé, toujours dérivé des mêmes dossiers que ceux listés ci-dessous.
  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const unassignedCount = modeAlerts.filter((a) => a.assignedInvestigators.length === 0).length;
  const urgentCount = modeAlerts.filter((a) => effectivePriority(a) === 'critique' || effectivePriority(a) === 'tres_elevee').length;
  const overdueCount = modeAlerts.filter((a) => computeSlaStatus(a) === 'overdue').length;
  const inProgressCount = modeAlerts.filter((a) => a.status === 'investigation').length;
  const waitingLongCount = modeAlerts.filter((a) => Date.now() - new Date(a.updatedAt).getTime() > 7 * 24 * 3600 * 1000).length;
  const receivedTodayCount = modeAlerts.filter((a) => isToday(a.createdAt)).length;

  // === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 2, cohérence design
  // system) === BUG PRÉEXISTANT CORRIGÉ : "Urgents / critiques" (même
  // libellé exact, même donnée `urgentCount`) était en ton `rose` dans 4
  // des modes ci-dessous et `amber` dans les 6 autres — dérive de
  // copier-coller sans raison fonctionnelle. Uniformisé sur `rose`,
  // cohérent avec le reste de l'application (rose = urgent/critique
  // partout ailleurs : StatusBadge, PriorityBadge, ConfirmDialog danger).
  const kpis: { value: number | string; label: string; tone: KpiTone }[] =
    mode === 'inbox'
      ? [
          { value: modeAlerts.length, label: 'Total à trier', tone: 'blue' },
          { value: unassignedCount, label: 'Non attribués', tone: 'amber' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
          { value: receivedTodayCount, label: 'Reçus aujourd’hui', tone: 'emerald' },
        ]
      : mode === 'to_assign'
      ? [
          { value: modeAlerts.length, label: 'Total à attribuer', tone: 'blue' },
          { value: unassignedCount, label: 'Non attribués', tone: 'amber' },
          { value: modeAlerts.filter((a) => a.status === 'under_review').length, label: "En attente d’infos", tone: 'purple' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'pending_info'
      ? [
          { value: modeAlerts.length, label: 'Total en attente', tone: 'purple' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: waitingLongCount, label: 'En attente > 7 jours', tone: 'orange' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'assigned'
      ? // === AMÉLIORATION AJOUTÉE (Dossiers ouverts) === "Clôturés"
        // retiré : `modeAlerts` exclut désormais les dossiers clôturés
        // (voir MODE_CONFIG.assigned.predicate), ce chiffre serait toujours
        // à 0 — remplacé par "Urgents / critiques", cohérent avec les
        // autres écrans "de travail".
        [
          { value: modeAlerts.length, label: 'Total ouverts', tone: 'blue' },
          { value: inProgressCount, label: 'En cours', tone: 'indigo' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'review'
      ? [
          { value: modeAlerts.length, label: 'Total en revue', tone: 'indigo' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: waitingLongCount, label: 'En attente > 7 jours', tone: 'orange' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'closed'
      ? [
          { value: modeAlerts.length, label: 'Total clôturés', tone: 'emerald' },
          { value: modeAlerts.filter((a) => a.closedAt && isToday(a.closedAt)).length, label: 'Clôturés aujourd’hui', tone: 'blue' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
          {
            value: (() => {
              const withDates = modeAlerts.filter((a) => a.closedAt);
              if (withDates.length === 0) return 0;
              const totalDays = withDates.reduce(
                (sum, a) => sum + (new Date(a.closedAt!).getTime() - new Date(a.createdAt).getTime()) / (24 * 3600 * 1000),
                0
              );
              return Math.round(totalDays / withDates.length);
            })(),
            label: 'Délai moyen (jours)',
            tone: 'indigo',
          },
        ]
      : mode === 'my_cases'
      ? [
          { value: modeAlerts.length, label: 'Total mes dossiers', tone: 'blue' },
          { value: inProgressCount, label: 'En cours', tone: 'indigo' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'to_process'
      ? [
          { value: modeAlerts.length, label: 'Total à traiter', tone: 'blue' },
          { value: modeAlerts.filter((a) => a.status === 'under_review').length, label: "En attente d’infos", tone: 'purple' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ]
      : mode === 'inv_inbox'
      ? // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
        // Cartes KPI conservées à l'identique de l'ancien écran "Tableau de
        // bord" Enquêteur (InvestigationDesk, mêmes 4 libellés/mêmes
        // formules — `alerts` non filtré, comme là-bas) sur demande
        // explicite de l'utilisateur ("conserver les bulles de la
        // précédente capture").
        [
          { value: alerts.length, label: t.portal_total_alerts, tone: 'neutral' },
          { value: alerts.filter((a) => a.status === 'new' || a.status === 'investigation').length, label: t.portal_pending, tone: 'blue' },
          { value: alerts.filter((a) => a.riskEvaluation.nocaThreshold === 'NOCA 3' || a.riskEvaluation.nocaThreshold === 'NOCA 4').length, label: t.portal_urgent, tone: 'rose' },
          { value: `${alerts.length > 0 ? Math.round((alerts.filter((a) => a.status === 'closed').length / alerts.length) * 100) : 0}%`, label: t.portal_closed_rate, tone: 'emerald' },
        ]
      : [
          { value: modeAlerts.length, label: 'Total en cours', tone: 'indigo' },
          { value: overdueCount, label: 'En retard (SLA)', tone: 'rose' },
          { value: waitingLongCount, label: 'Sans mise à jour > 7 jours', tone: 'orange' },
          { value: urgentCount, label: 'Urgents / critiques', tone: 'rose' },
        ];

  // Sélection multiple
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = filteredAlerts.map((a) => a.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === Candidats à
  // l'attribution GROUPÉE : réutilise `computeCandidates` (Phase 4) pour
  // CHAQUE dossier ciblé, puis n'affiche que les enquêteurs compatibles (ou
  // autorisés Groupe) avec TOUS les dossiers sélectionnés — jamais un
  // enquêteur proposé pour un dossier qu'il ne peut en réalité pas
  // recevoir. Pour une cible unique, résultat strictement identique à
  // `computeCandidates` seul.
  const computeIntersectedCandidates = (targets: AlertRecord[]): { compatible: AssignmentCandidate[]; groupAuthorized: AssignmentCandidate[] } => {
    if (targets.length === 0) return { compatible: [], groupAuthorized: [] };
    const workload = computeWorkload(investigatorUsers, alerts);
    const perAlert = targets.map((a) => computeCandidates(a, investigatorUsers, workload));
    const idsOf = (list: AssignmentCandidate[]) => new Set(list.map((c) => c.user.id));
    const compatibleSets = perAlert.map((p) => idsOf(p.compatible));
    const eitherSets = perAlert.map((p) => idsOf([...p.compatible, ...p.groupAuthorized]));
    const first = perAlert[0];
    const compatible = first.compatible.filter((c) => compatibleSets.every((s) => s.has(c.user.id)));
    const groupAuthorized = [...first.compatible, ...first.groupAuthorized].filter(
      (c) => !compatible.some((x) => x.user.id === c.user.id) && eitherSets.every((s) => s.has(c.user.id))
    );
    return { compatible, groupAuthorized };
  };

  const assignTargets = assignTargetIds ? alerts.filter((a) => assignTargetIds.includes(a.id)) : [];
  const assignCandidates = assignTargetIds ? computeIntersectedCandidates(assignTargets) : { compatible: [], groupAuthorized: [] };

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === même règle exacte
  // que `InvestigationDesk.handleAssignInvestigators`, appliquée à chaque
  // dossier ciblé (1 pour une action de ligne, N pour une action groupée).
  const handleConfirmAssign = () => {
    if (!assignTargetIds || assignSelectedInvestigatorIds.length === 0) return;
    const assignedNames = investigatorUsers.filter((u) => assignSelectedInvestigatorIds.includes(u.id)).map((u) => u.name);
    assignTargetIds.forEach((id) => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return;
      const updated: AlertRecord = {
        ...alert,
        assignedInvestigators: assignSelectedInvestigatorIds,
        assignedInvestigatorNames: assignedNames,
        status: alert.status === 'new' ? 'investigation' : alert.status,
        updatedAt: new Date().toISOString(),
      };
      storage.saveAlert(updated);
      storage.logAudit(
        'INVESTIGATOR_ASSIGNED',
        `Attribution du dossier ${alert.trackingNumber} à : ${assignedNames.join(', ') || 'Aucun'}.`,
        { id: alert.id, trackingNumber: alert.trackingNumber },
        activeUser
      );

      // === AMÉLIORATION AJOUTÉE (Notifications e-mail) === notifie
      // uniquement les enquêteurs NOUVELLEMENT attribués sur CE dossier
      // (la liste d'attribution est la même pour toute la sélection
      // groupée, mais "nouveau" se juge dossier par dossier, contre son
      // propre `assignedInvestigators` d'avant mutation).
      const previouslyAssigned = new Set(alert.assignedInvestigators);
      const newlyAssignedUsers = investigatorUsers.filter(
        (u) => assignSelectedInvestigatorIds.includes(u.id) && !previouslyAssigned.has(u.id)
      );
      if (newlyAssignedUsers.length > 0) {
        notifyAssignmentToInvestigators(newlyAssignedUsers, { id: alert.id, trackingNumber: alert.trackingNumber }, activeUser);
      }
    });
    setAssignTargetIds(null);
    setAssignSelectedInvestigatorIds([]);
    setSelectedIds(new Set());
  };

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === même motif que
  // `InvestigationDesk.handleSendInvestigatorMessage`, appliqué à chaque
  // dossier ciblé — un message de relance identique envoyé à chaque
  // lanceur d'alerte concerné.
  const handleConfirmFollowup = () => {
    if (!followupTargetIds) return;
    const content = followupText.trim() || DEFAULT_FOLLOWUP_MESSAGE;
    followupTargetIds.forEach((id) => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return;
      const msg: CaseMessage = {
        id: 'msg-' + Date.now() + '-' + id,
        sender: 'investigator',
        senderDisplayName: `DARC (${activeUser.name})`,
        content,
        createdAt: new Date().toISOString(),
      };
      storage.saveAlert({ ...alert, messages: [...alert.messages, msg], updatedAt: new Date().toISOString() });
      storage.logAudit(
        'MESSAGE_SENT',
        `Relance envoyée au lanceur d'alerte pour le dossier ${alert.trackingNumber}.`,
        { id: alert.id, trackingNumber: alert.trackingNumber },
        activeUser
      );
    });
    setFollowupTargetIds(null);
    setFollowupText('');
    setSelectedIds(new Set());
  };

  const panelAlert = panelAlertId ? alerts.find((a) => a.id === panelAlertId) ?? null : null;

  const handleQuickReply = () => {
    if (!panelAlert || !replyText.trim()) return;
    const msg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'investigator',
      senderDisplayName: `DARC (${activeUser.name})`,
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
    };
    storage.saveAlert({ ...panelAlert, messages: [...panelAlert.messages, msg], updatedAt: new Date().toISOString() });
    storage.logAudit(
      'MESSAGE_SENT',
      `Message sécurisé transmis au lanceur d'alerte pour le dossier ${panelAlert.trackingNumber}.`,
      { id: panelAlert.id, trackingNumber: panelAlert.trackingNumber },
      activeUser
    );
    setReplyText('');
  };

  const Icon = cfg.icon;
  const selectClass = 'px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 text-xs';

  const filterBar = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Référence, description, entité, lieu..."
          className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
        />
      </div>
      <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={selectClass}>
        <option value="all">Tous les pays</option>
        {countries.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className={selectClass}>
        <option value="all">Toutes les entités</option>
        {entities.map((e) => (
          <option key={e.id} value={e.name}>{e.flag} {e.name}</option>
        ))}
      </select>
      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — filtres allégés) ===
          Nature/Criticité/Sévérité/Urgence/Canal/Sensibilité retirés sur
          demande explicite de TOUS les écrans, y compris la Boîte de
          réception (précisé sur retour utilisateur suivant — un premier
          passage l'en avait exclue) : ne reste que Recherche + Pays +
          Entité, partout. Ces filtres restent des critères réels
          (`AdvancedSearchCriteria`, domain/advancedSearch.ts) : rien n'est
          supprimé côté logique, seuls ces contrôles disparaissent de
          l'écran. */}
      {hasActiveFilters && (
        <button onClick={resetFilters} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold">
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      )}
    </div>
  );

  const bulkBar = cfg.rowAction !== 'none' && selectedIds.size > 0 && (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs">
      <span className="font-semibold text-blue-900">{selectedIds.size} dossier(s) sélectionné(s)</span>
      <div className="flex items-center gap-2">
        {cfg.rowAction === 'assign' && canAssign && (
          <Button
            size="sm"
            icon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => { setAssignTargetIds(Array.from(selectedIds)); setAssignSelectedInvestigatorIds([]); }}
          >
            Attribuer
          </Button>
        )}
        {cfg.rowAction === 'reassign' && canAssign && (
          <Button
            size="sm"
            icon={<UserCog className="w-3.5 h-3.5" />}
            onClick={() => { setAssignTargetIds(Array.from(selectedIds)); setAssignSelectedInvestigatorIds([]); }}
          >
            Réattribuer
          </Button>
        )}
        {cfg.rowAction === 'followup' && (
          <Button
            size="sm"
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() => { setFollowupTargetIds(Array.from(selectedIds)); setFollowupText(''); }}
          >
            Relancer
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
          Désélectionner
        </Button>
      </div>
    </div>
  );

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === une action de ligne
  // n'a de sens que si l'écran en propose une ET (pour attribuer/réattribuer)
  // que le compte a réellement la permission `cases.assign` — sinon ni la
  // case à cocher ni la colonne d'action ne sont affichées (rien à faire
  // avec une sélection sans action possible).
  const canActOnRows = cfg.rowAction === 'followup' || ((cfg.rowAction === 'assign' || cfg.rowAction === 'reassign') && canAssign);

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === colonnes communes
  // aux écrans en tableau (À attribuer / En attente d'infos / Dossiers
  // attribués / Mes dossiers / À traiter / En cours) — la Boîte de
  // réception a sa propre liste + panneau plus bas. `select`/`action` sont
  // omises quand l'écran n'a réellement aucune action à proposer
  // (`canActOnRows`), voir `rowAction` ci-dessus.
  // === AMÉLIORATION AJOUTÉE (Opérateur — Dossiers clôturés) === colonnes
  // dédiées demandées explicitement (Réf./Nature/Pays/Entité/Reçu le/
  // Clôturé le/Résumé) — écran strictement en lecture (`rowAction: 'none'`),
  // aucune case à cocher ni colonne d'action, donc `canActOnRows` est
  // toujours faux ici (voir `cfg.rowAction` ci-dessus).
  const closedColumns: DataTableColumn<AlertRecord>[] = [
    {
      key: 'id',
      header: 'Réf.',
      render: (a) => (
        <div className="whitespace-nowrap">
          <span className="font-mono font-bold text-[#0B2545] block">{a.trackingNumber}</span>
          <ConfidentialityBadge level={a.confidentialityLevel} />
        </div>
      ),
    },
    { key: 'nature', header: 'Nature', render: (a) => <span className="truncate max-w-[160px] inline-block">{a.category}</span>, hideOnMobile: true },
    { key: 'country', header: 'Pays', render: (a) => a.country, hideOnMobile: true },
    {
      key: 'entity',
      header: 'Entité',
      render: (a) => (
        <span className="flex items-center gap-1 truncate max-w-[160px] text-slate-800">
          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
          {a.concernedEntity}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'received',
      header: 'Reçu le',
      render: (a) => new Date(a.createdAt).toLocaleDateString(dateLocale),
    },
    {
      key: 'closed',
      header: 'Clôturé le',
      render: (a) => (a.closedAt ? new Date(a.closedAt).toLocaleDateString(dateLocale) : '—'),
    },
    {
      key: 'summary',
      header: 'Résumé',
      render: (a) => (
        <span className="block max-w-xs truncate text-slate-600" title={a.closureSummary || a.detailedDescription}>
          {a.closureSummary || a.detailedDescription}
        </span>
      ),
    },
  ];

  const columns: DataTableColumn<AlertRecord>[] = mode === 'closed' ? closedColumns : [
    ...(canActOnRows
      ? [
          {
            key: 'select',
            header: '',
            render: (a: AlertRecord) => (
              <input
                type="checkbox"
                checked={selectedIds.has(a.id)}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onChange={() => toggleSelect(a.id)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            ),
          },
        ]
      : []),
    {
      key: 'id',
      header: 'N° Dossier',
      render: (a) => (
        <div className="whitespace-nowrap">
          <span className="font-mono font-bold text-[#0B2545] block">{a.trackingNumber}</span>
          <ConfidentialityBadge level={a.confidentialityLevel} />
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Pays / Entité',
      render: (a) => (
        <div className="max-w-[160px]">
          <span className="flex items-center gap-1 truncate text-slate-800">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            {a.concernedEntity}
          </span>
          <span className="text-[11px] text-slate-500">{formatCountryLabel(storage.getCountries(), a.country)}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: 'nature', header: 'Nature', render: (a) => <span className="truncate max-w-[160px] inline-block">{a.category}</span>, hideOnMobile: true },
    {
      key: 'noca',
      header: 'Criticité',
      render: (a) => (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${NOCA_TONE[a.riskEvaluation.nocaThreshold]}`}>
          {a.riskEvaluation.nocaThreshold}
        </span>
      ),
    },
    {
      key: 'urgency',
      header: 'Sévérité / Urgence',
      render: (a) => (
        <div className="space-y-1 whitespace-nowrap">
          <PriorityBadge priority={effectivePriority(a)} label={URGENCY_LABELS[effectivePriority(a)]} />
          {a.severity && <span className="block text-[10px] text-slate-500">{SEVERITY_LABELS[a.severity]}</span>}
        </div>
      ),
    },
    {
      key: 'received',
      header: 'Reçu le',
      render: (a) => new Date(a.createdAt).toLocaleDateString(dateLocale),
      hideOnMobile: true,
    },
    ...(canActOnRows
      ? [
          {
            key: 'action',
            header: '',
            render: (a: AlertRecord) => (
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (cfg.rowAction === 'followup') {
                    setFollowupTargetIds([a.id]);
                    setFollowupText('');
                  } else {
                    setAssignTargetIds([a.id]);
                    setAssignSelectedInvestigatorIds(a.assignedInvestigators);
                  }
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 whitespace-nowrap"
              >
                {cfg.rowAction === 'followup' ? (
                  <><Send className="w-3 h-3" /> Relancer</>
                ) : cfg.rowAction === 'reassign' ? (
                  <><UserCog className="w-3 h-3" /> Réattribuer</>
                ) : (
                  <><UserPlus className="w-3 h-3" /> Attribuer</>
                )}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-700" />
          {displayTitle}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{displaySubtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} value={k.value} label={k.label} tone={k.tone} />
        ))}
      </div>

      {filterBar}
      {bulkBar}

      {mode === 'inbox' || mode === 'inv_inbox' ? (
        // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — Boîte de
        // réception) === panneau liste + détail/attribution côte à côte :
        // la liste sélectionne (jamais ne navigue), le panneau de droite
        // permet de répondre au lanceur d'alerte et d'attribuer sans quitter
        // l'écran ; "Ouvrir le dossier complet" reste le seul lien vers la
        // === AMÉLIORATION AJOUTÉE (Espace Enquêteur — Boîte de réception) ===
        // `mode === 'inv_inbox'` réutilise ce même panneau tel quel : le
        // bouton "Attribuer" reste conditionné à `canAssign` (déjà faux pour
        // un enquêteur simple, `domain/permissions.ts`) et la case à cocher
        // à `canActOnRows` (déjà faux ici, `rowAction: 'none'`) — rien de
        // spécifique à ajouter pour ce nouveau mode.
        // fiche dossier entière (mêmes 9 onglets qu'avant, inchangés).
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                {canActOnRows && <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="rounded text-blue-600" />}
                {filteredAlerts.length} signalement(s)
              </label>
            </div>
            {filteredAlerts.length === 0 ? (
              <div className="p-4"><EmptyState title={displayEmpty} /></div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                {filteredAlerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setPanelAlertId(a.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-2.5 hover:bg-slate-50 transition ${panelAlertId === a.id ? 'bg-blue-50' : ''}`}
                  >
                    {canActOnRows && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(a.id)}
                        className="mt-1 rounded text-blue-600 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#0B2545] text-xs">{a.trackingNumber}</span>
                        <PriorityBadge priority={effectivePriority(a)} label={URGENCY_LABELS[effectivePriority(a)]} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{a.category} — {a.concernedEntity}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{new Date(a.createdAt).toLocaleDateString(dateLocale)} · {CHANNEL_LABELS[a.channel]}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            {!panelAlert ? (
              <EmptyState icon={Inbox} title="Sélectionnez un signalement pour le consulter" description="Le détail, la messagerie et l'attribution rapide s'affichent ici." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0B2545]">{panelAlert.trackingNumber}</span>
                      <ConfidentialityBadge level={panelAlert.confidentialityLevel} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{panelAlert.category} — {panelAlert.subCategory}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> {panelAlert.concernedEntity} ({formatCountryLabel(storage.getCountries(), panelAlert.country)})</p>
                  </div>
                  <button onClick={() => setPanelAlertId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={`px-2 py-0.5 rounded font-bold border ${NOCA_TONE[panelAlert.riskEvaluation.nocaThreshold]}`}>{panelAlert.riskEvaluation.nocaThreshold}</span>
                  <PriorityBadge priority={effectivePriority(panelAlert)} label={URGENCY_LABELS[effectivePriority(panelAlert)]} />
                  {panelAlert.severity && <span className="px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-700 border-slate-200">{SEVERITY_LABELS[panelAlert.severity]}</span>}
                  <span className="px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-700 border-slate-200">{CHANNEL_LABELS[panelAlert.channel]}</span>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100 line-clamp-4">{panelAlert.detailedDescription}</p>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-500">
                    {panelAlert.assignedInvestigatorNames.length > 0 ? `Attribué à : ${panelAlert.assignedInvestigatorNames.join(', ')}` : 'Non attribué'}
                  </span>
                  {canAssign && (
                    <Button
                      size="sm"
                      icon={<UserPlus className="w-3.5 h-3.5" />}
                      onClick={() => { setAssignTargetIds([panelAlert.id]); setAssignSelectedInvestigatorIds(panelAlert.assignedInvestigators); }}
                    >
                      Attribuer
                    </Button>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Répondre au lanceur d'alerte</label>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      placeholder="Message confidentiel..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                    <button onClick={handleQuickReply} disabled={!replyText.trim()} className="p-2.5 rounded-xl bg-brand text-white disabled:opacity-40 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => onOpenCase(panelAlert.trackingNumber)}
                  className="w-full text-center py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Ouvrir le dossier complet →
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          {canActOnRows && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="rounded text-blue-600" />
                Tout sélectionner
              </label>
            </div>
          )}
          <DataTable
            columns={columns}
            rows={filteredAlerts}
            getRowKey={(a) => a.id}
            // === AMÉLIORATION AJOUTÉE (Retours visuels — clic de ligne) ===
            // BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur : sur "À
            // attribuer" (`rowAction === 'assign'`), cliquer une ligne ne
            // doit RIEN ouvrir — seul le bouton "Attribuer" (colonne
            // dédiée, déjà réel) doit ouvrir la modale d'attribution.
            // "Dossiers attribués"/"En attente d'infos" (reassign/followup)
            // gardent le clic de ligne → fiche dossier complète, demandé
            // explicitement pour "Dossiers attribués" et vérifié en direct.
            onRowClick={cfg.rowAction === 'assign' ? undefined : (a) => onOpenCase(a.trackingNumber)}
            emptyTitle={displayEmpty}
          />
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === modale d'attribution partagée (simple ou groupée) */}
      {assignTargetIds && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAssignTargetIds(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Attribution de l'enquêteur</h3>
              <button onClick={() => setAssignTargetIds(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500">{assignTargetIds.length} dossier(s) sélectionné(s).</p>

            {assignCandidates.compatible.length === 0 && assignCandidates.groupAuthorized.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Aucun enquêteur compatible"
                description={
                  assignTargetIds.length > 1
                    ? "Les dossiers sélectionnés n'ont aucun enquêteur compatible en commun. Attribuez-les individuellement, ou affinez la sélection."
                    : "Aucun enquêteur ne remplit les conditions (périmètre, confidentialité, disponibilité, absence de conflit) pour ce dossier."
                }
              />
            ) : (
              <div className="space-y-3">
                {assignCandidates.compatible.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Enquêteurs compatibles (même périmètre)</p>
                    <div className="space-y-1.5">
                      {assignCandidates.compatible.map((c) => (
                        <AssignCandidateRow
                          key={c.user.id}
                          candidate={c}
                          checked={assignSelectedInvestigatorIds.includes(c.user.id)}
                          onToggle={(checked) => setAssignSelectedInvestigatorIds((prev) => (checked ? [...prev, c.user.id] : prev.filter((id) => id !== c.user.id)))}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {assignCandidates.groupAuthorized.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Autorisés Groupe</p>
                    <div className="space-y-1.5">
                      {assignCandidates.groupAuthorized.map((c) => (
                        <AssignCandidateRow
                          key={c.user.id}
                          candidate={c}
                          checked={assignSelectedInvestigatorIds.includes(c.user.id)}
                          onToggle={(checked) => setAssignSelectedInvestigatorIds((prev) => (checked ? [...prev, c.user.id] : prev.filter((id) => id !== c.user.id)))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setAssignTargetIds(null)}>Annuler</Button>
              <Button
                size="sm"
                disabled={assignSelectedInvestigatorIds.length === 0}
                onClick={handleConfirmAssign}
              >
                Confirmer l'attribution
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === modale de relance partagée (En attente d'infos) */}
      {followupTargetIds && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFollowupTargetIds(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Relancer la demande d'informations</h3>
              <button onClick={() => setFollowupTargetIds(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500">{followupTargetIds.length} dossier(s) — un message sera envoyé au lanceur d'alerte de chacun.</p>
            <textarea
              value={followupText}
              onChange={(e) => setFollowupText(e.target.value)}
              placeholder={DEFAULT_FOLLOWUP_MESSAGE}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setFollowupTargetIds(null)}>Annuler</Button>
              <Button size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleConfirmFollowup}>
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
