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
// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
// section) === plus aucune icône n'est rendue directement ici : chaque
// composant de src/components/operatorDesk/ importe les siennes (y compris
// celles de MODE_CONFIG, dans modeConfig.ts).
import { AlertRecord, Language, UserProfile, PriorityLevel, SeverityLevel, NocaThreshold, CaseMessage } from '../types';
import { ConfidentialityLevel } from '../domain/caseTypes';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
import { notifyAssignmentToInvestigators } from '../services/emailNotify';
import { computeCandidates, AssignmentCandidate } from '../domain/assignmentEngine';
import { computeWorkload } from '../domain/workloadCalc';
import { computeSlaStatus } from '../services/statusMapping';
import { searchAlerts, AdvancedSearchCriteria, effectivePriority } from '../domain/advancedSearch';
import { KpiCard } from './ui';
import type { KpiTone } from './ui';
// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
// section) === AssignCandidateRow (modale d'attribution), trData,
// formatCountryLabel, Button/DataTable/EmptyState/PriorityBadge sont
// désormais importés par les composants de src/components/operatorDesk/ qui
// les utilisent réellement.
// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
// section) === chaque bloc de rendu vit désormais dans son propre composant
// (src/components/operatorDesk/) ; ce fichier garde l'état, les filtres, les
// KPI et les handlers d'attribution/relance/réponse.
import { MODE_CONFIG } from './operatorDesk/modeConfig';
import type { OperatorDeskMode } from './operatorDesk/modeConfig';
import { OperatorFilterBar } from './operatorDesk/OperatorFilterBar';
import { OperatorBulkBar } from './operatorDesk/OperatorBulkBar';
import { OperatorCaseTable } from './operatorDesk/OperatorCaseTable';
import { OperatorInboxPanel } from './operatorDesk/OperatorInboxPanel';
import { OperatorAssignModal } from './operatorDesk/OperatorAssignModal';
import { OperatorFollowupModal } from './operatorDesk/OperatorFollowupModal';

// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
// section) === le type OperatorDeskMode (et l'historique de ses modes) vit
// désormais dans src/components/operatorDesk/modeConfig.ts ; réexporté ici
// pour que tout import existant depuis ce fichier reste valide.
export type { OperatorDeskMode } from './operatorDesk/modeConfig';

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
// CONFIDENTIALITY_LABELS : déplacé avec ConfidentialityBadge (seul utilisateur).
// === AMÉLIORATION AJOUTÉE (nettoyage du code mort) === SEVERITY_LABELS,
// URGENCY_LABELS et NOCA_OPTIONS retirés : plus lus nulle part depuis la
// simplification de la barre de filtres.
// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk) === NOCA_TONE déplacé
// dans src/components/operatorDesk/constants.ts (partagé tableau/panneau).
const DEFAULT_FOLLOWUP_MESSAGE = "Merci de nous transmettre les informations complémentaires demandées afin que nous puissions poursuivre le traitement de votre signalement.";

// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk) === ConfidentialityBadge
// déplacé tel quel dans src/components/operatorDesk/ConfidentialityBadge.tsx.

// === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
// section) === RowAction/ModeConfig/MODE_CONFIG déplacés tels quels dans
// src/components/operatorDesk/modeConfig.ts (importés ci-dessus).

export const OperatorCaseDesk: React.FC<OperatorCaseDeskProps> = ({ lang, activeUser, mode, onOpenCase, titleOverride, subtitleOverride, emptyOverride }) => {
  const t = TRANSLATIONS[lang];
  const cfg = MODE_CONFIG[mode];
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
  // === AMÉLIORATION AJOUTÉE : libellés traduits (les constantes FR de module restent le repli) ===
  const channelLabels: Record<AlertRecord['channel'], string> = { ...CHANNEL_LABELS, direct: t.op_channel_direct };
  const severityLabels: Record<SeverityLevel, string> = { mineure: t.op_sev_minor, moderee: t.op_sev_moderate, majeure: t.op_sev_major, critique: t.op_critical };
  const urgencyLabels: Record<PriorityLevel, string> = { faible: t.op_urg_low, elevee: t.op_urg_high, tres_elevee: t.op_urg_very_high, critique: t.op_critical };
  const defaultFollowupMessage = t.op_followup_default || DEFAULT_FOLLOWUP_MESSAGE;
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
          { value: modeAlerts.length, label: t.op_kpi_total_to_sort, tone: 'blue' },
          { value: unassignedCount, label: t.op_kpi_unassigned, tone: 'amber' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
          { value: receivedTodayCount, label: t.op_kpi_received_today, tone: 'emerald' },
        ]
      : mode === 'to_assign'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_to_assign, tone: 'blue' },
          { value: unassignedCount, label: t.op_kpi_unassigned, tone: 'amber' },
          { value: modeAlerts.filter((a) => a.status === 'under_review').length, label: t.op_kpi_awaiting_info, tone: 'purple' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
        ]
      : mode === 'pending_info'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_pending, tone: 'purple' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: waitingLongCount, label: t.op_kpi_waiting_7d, tone: 'orange' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
        ]
      : mode === 'assigned'
      ? // === AMÉLIORATION AJOUTÉE (Dossiers ouverts) === "Clôturés"
        // retiré : `modeAlerts` exclut désormais les dossiers clôturés
        // (voir MODE_CONFIG.assigned.predicate), ce chiffre serait toujours
        // à 0 — remplacé par "Urgents / critiques", cohérent avec les
        // autres écrans "de travail".
        [
          { value: modeAlerts.length, label: t.op_kpi_total_open, tone: 'blue' },
          { value: inProgressCount, label: t.op_kpi_in_progress, tone: 'indigo' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
        ]
      : mode === 'review'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_review, tone: 'indigo' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: waitingLongCount, label: t.op_kpi_waiting_7d, tone: 'orange' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
        ]
      : mode === 'closed'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_closed, tone: 'emerald' },
          { value: modeAlerts.filter((a) => a.closedAt && isToday(a.closedAt)).length, label: t.op_kpi_closed_today, tone: 'blue' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
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
            label: t.op_kpi_avg_days,
            tone: 'indigo',
          },
        ]
      : mode === 'my_cases'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_mine, tone: 'blue' },
          { value: inProgressCount, label: t.op_kpi_in_progress, tone: 'indigo' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
        ]
      : mode === 'to_process'
      ? [
          { value: modeAlerts.length, label: t.op_kpi_total_to_process, tone: 'blue' },
          { value: modeAlerts.filter((a) => a.status === 'under_review').length, label: t.op_kpi_awaiting_info, tone: 'purple' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
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
          { value: modeAlerts.length, label: t.op_kpi_total_in_progress, tone: 'indigo' },
          { value: overdueCount, label: t.op_kpi_overdue, tone: 'rose' },
          { value: waitingLongCount, label: t.op_kpi_no_update_7d, tone: 'orange' },
          { value: urgentCount, label: t.op_kpi_urgent, tone: 'rose' },
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
    const content = followupText.trim() || defaultFollowupMessage;
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
      // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
      if (alert.mirroredCaseId) {
        const mirroredCaseId = alert.mirroredCaseId;
        import('../services/caseMirrorSync')
          .then(({ mirrorAddCommunication }) => mirrorAddCommunication({ caseId: mirroredCaseId, content: msg.content }))
          .catch(() => {});
      }
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
    // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
    if (panelAlert.mirroredCaseId) {
      const mirroredCaseId = panelAlert.mirroredCaseId;
      import('../services/caseMirrorSync')
        .then(({ mirrorAddCommunication }) => mirrorAddCommunication({ caseId: mirroredCaseId, content: msg.content }))
        .catch(() => {});
    }
    setReplyText('');
  };

  const Icon = cfg.icon;
  // === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk) === `selectClass`
  // déplacé dans operatorDesk/OperatorFilterBar.tsx (seul utilisateur).

  const filterBar = (
    <OperatorFilterBar
      t={t}
      search={search}
      setSearch={setSearch}
      countryFilter={countryFilter}
      setCountryFilter={setCountryFilter}
      countries={countries}
      entityFilter={entityFilter}
      setEntityFilter={setEntityFilter}
      entities={entities}
      hasActiveFilters={hasActiveFilters}
      resetFilters={resetFilters}
    />
  );

  const bulkBar = cfg.rowAction !== 'none' && selectedIds.size > 0 && (
    <OperatorBulkBar
      t={t}
      cfg={cfg}
      canAssign={canAssign}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      setAssignTargetIds={setAssignTargetIds}
      setAssignSelectedInvestigatorIds={setAssignSelectedInvestigatorIds}
      setFollowupTargetIds={setFollowupTargetIds}
      setFollowupText={setFollowupText}
    />
  );

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === une action de ligne
  // n'a de sens que si l'écran en propose une ET (pour attribuer/réattribuer)
  // que le compte a réellement la permission `cases.assign` — sinon ni la
  // case à cocher ni la colonne d'action ne sont affichées (rien à faire
  // avec une sélection sans action possible).
  const canActOnRows = cfg.rowAction === 'followup' || ((cfg.rowAction === 'assign' || cfg.rowAction === 'reassign') && canAssign);

  // === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
  // section) === `closedColumns`/`columns` déplacées telles quelles dans
  // src/components/operatorDesk/OperatorCaseTable.tsx (seul utilisateur).

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
        <OperatorInboxPanel
          t={t}
          lang={lang}
          dateLocale={dateLocale}
          canActOnRows={canActOnRows}
          canAssign={canAssign}
          allPageSelected={allPageSelected}
          toggleSelectAll={toggleSelectAll}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          filteredAlerts={filteredAlerts}
          displayEmpty={displayEmpty}
          panelAlertId={panelAlertId}
          setPanelAlertId={setPanelAlertId}
          panelAlert={panelAlert}
          urgencyLabels={urgencyLabels}
          severityLabels={severityLabels}
          channelLabels={channelLabels}
          setAssignTargetIds={setAssignTargetIds}
          setAssignSelectedInvestigatorIds={setAssignSelectedInvestigatorIds}
          replyText={replyText}
          setReplyText={setReplyText}
          handleQuickReply={handleQuickReply}
          onOpenCase={onOpenCase}
        />
      ) : (
        <OperatorCaseTable
          t={t}
          lang={lang}
          dateLocale={dateLocale}
          mode={mode}
          cfg={cfg}
          canActOnRows={canActOnRows}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          allPageSelected={allPageSelected}
          toggleSelectAll={toggleSelectAll}
          setAssignTargetIds={setAssignTargetIds}
          setAssignSelectedInvestigatorIds={setAssignSelectedInvestigatorIds}
          setFollowupTargetIds={setFollowupTargetIds}
          setFollowupText={setFollowupText}
          urgencyLabels={urgencyLabels}
          severityLabels={severityLabels}
          filteredAlerts={filteredAlerts}
          onOpenCase={onOpenCase}
          displayEmpty={displayEmpty}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === modale d'attribution partagée (simple ou groupée) */}
      {assignTargetIds && (
        <OperatorAssignModal
          t={t}
          assignTargetIds={assignTargetIds}
          setAssignTargetIds={setAssignTargetIds}
          assignCandidates={assignCandidates}
          assignSelectedInvestigatorIds={assignSelectedInvestigatorIds}
          setAssignSelectedInvestigatorIds={setAssignSelectedInvestigatorIds}
          handleConfirmAssign={handleConfirmAssign}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === modale de relance partagée (En attente d'infos) */}
      {followupTargetIds && (
        <OperatorFollowupModal
          t={t}
          followupTargetIds={followupTargetIds}
          setFollowupTargetIds={setFollowupTargetIds}
          followupText={followupText}
          setFollowupText={setFollowupText}
          defaultFollowupMessage={defaultFollowupMessage}
          handleConfirmFollowup={handleConfirmFollowup}
        />
      )}
    </div>
  );
};
