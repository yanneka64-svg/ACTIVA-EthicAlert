/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Vue tableau (tous les modes sauf Boîte de réception) : définitions
 * des colonnes (colonnes dédiées pour « Dossiers clôturés ») + tableau.
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 * `canActOnRows` reste calculé dans OperatorCaseDesk.tsx (également
 * utilisé par le panneau Boîte de réception).
 */
import React from 'react';
import { Building2, Send, UserCog, UserPlus } from 'lucide-react';
import { AlertRecord, Language, PriorityLevel, SeverityLevel } from '../../types';
import { storage } from '../../services/storage';
import { formatCountryLabel } from '../../data/activaConfig';
import { effectivePriority } from '../../domain/advancedSearch';
import { PriorityBadge, DataTable } from '../ui';
import type { DataTableColumn } from '../ui';
import { trData } from '../../i18n/dataLabels';
import { ConfidentialityBadge } from './ConfidentialityBadge';
import { NOCA_TONE } from './constants';
import { ModeConfig, OperatorDeskMode } from './modeConfig';

interface OperatorCaseTableProps {
  t: Record<string, string>;
  lang: Language;
  dateLocale: string;
  mode: OperatorDeskMode;
  cfg: ModeConfig;
  canActOnRows: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  allPageSelected: boolean;
  toggleSelectAll: () => void;
  setAssignTargetIds: (v: string[] | null) => void;
  setAssignSelectedInvestigatorIds: React.Dispatch<React.SetStateAction<string[]>>;
  setFollowupTargetIds: (v: string[] | null) => void;
  setFollowupText: (v: string) => void;
  urgencyLabels: Record<PriorityLevel, string>;
  severityLabels: Record<SeverityLevel, string>;
  filteredAlerts: AlertRecord[];
  onOpenCase: (trackingNumber: string) => void;
  displayEmpty: string;
}

export const OperatorCaseTable: React.FC<OperatorCaseTableProps> = ({
  t,
  lang,
  dateLocale,
  mode,
  cfg,
  canActOnRows,
  selectedIds,
  toggleSelect,
  allPageSelected,
  toggleSelectAll,
  setAssignTargetIds,
  setAssignSelectedInvestigatorIds,
  setFollowupTargetIds,
  setFollowupText,
  urgencyLabels,
  severityLabels,
  filteredAlerts,
  onOpenCase,
  displayEmpty,
}) => {
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
      header: t.op_col_ref,
      render: (a) => (
        <div className="whitespace-nowrap">
          <span className="font-mono font-bold text-[#0B2545] block">{a.trackingNumber}</span>
          <ConfidentialityBadge level={a.confidentialityLevel} lang={lang} />
        </div>
      ),
    },
    { key: 'nature', header: t.op_col_nature, render: (a) => <span className="truncate max-w-[160px] inline-block">{trData(a.category, lang)}</span>, hideOnMobile: true },
    { key: 'country', header: t.op_col_country, render: (a) => a.country, hideOnMobile: true },
    {
      key: 'entity',
      header: t.op_col_entity,
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
      header: t.desk_col_received,
      render: (a) => new Date(a.createdAt).toLocaleDateString(dateLocale),
    },
    {
      key: 'closed',
      header: t.op_col_closed,
      render: (a) => (a.closedAt ? new Date(a.closedAt).toLocaleDateString(dateLocale) : '—'),
    },
    {
      key: 'summary',
      header: t.op_col_summary,
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
      header: t.cp_col_case_id,
      render: (a) => (
        <div className="whitespace-nowrap">
          <span className="font-mono font-bold text-[#0B2545] block">{a.trackingNumber}</span>
          <ConfidentialityBadge level={a.confidentialityLevel} lang={lang} />
        </div>
      ),
    },
    {
      key: 'entity',
      header: t.desk_col_country_entity,
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
    { key: 'nature', header: t.op_col_nature, render: (a) => <span className="truncate max-w-[160px] inline-block">{trData(a.category, lang)}</span>, hideOnMobile: true },
    {
      key: 'noca',
      header: t.op_col_criticality,
      render: (a) => (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${NOCA_TONE[a.riskEvaluation.nocaThreshold]}`}>
          {a.riskEvaluation.nocaThreshold}
        </span>
      ),
    },
    {
      key: 'urgency',
      header: t.op_col_sev_urg,
      render: (a) => (
        <div className="space-y-1 whitespace-nowrap">
          <PriorityBadge priority={effectivePriority(a)} label={urgencyLabels[effectivePriority(a)]} />
          {a.severity && <span className="block text-[10px] text-slate-500">{severityLabels[a.severity]}</span>}
        </div>
      ),
    },
    {
      key: 'received',
      header: t.desk_col_received,
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
                  <><Send className="w-3 h-3" /> {t.op_followup}</>
                ) : cfg.rowAction === 'reassign' ? (
                  <><UserCog className="w-3 h-3" /> {t.op_reassign}</>
                ) : (
                  <><UserPlus className="w-3 h-3" /> {t.op_assign}</>
                )}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      {canActOnRows && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="rounded text-blue-600" />
            {t.op_select_all}
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
        // === AMÉLIORATION AJOUTÉE (masquer le chevron redondant —
        // reassign/followup) === Ces deux modes cumulent déjà une
        // colonne d'action dédiée ("Réattribuer"/"Relancer") avec le
        // clic de ligne : le chevron générique juste après donnait
        // une impression de doublon visuel. Le clic de ligne reste
        // pleinement fonctionnel (`onRowClick` ci-dessus inchangé) —
        // seul l'indicateur visuel superflu disparaît.
        hideRowClickIndicator={cfg.rowAction === 'reassign' || cfg.rowAction === 'followup'}
        emptyTitle={displayEmpty}
      />
    </div>
  );
};
