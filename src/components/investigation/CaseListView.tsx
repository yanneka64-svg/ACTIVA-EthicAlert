/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-quatrième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115/#116 et les 5 modales de l'étape suivante pour les étapes
 * précédentes. Extraction de la vue liste complète (bandeau de synthèse,
 * barre de filtres — variante simplifiée et variante complète —, onglets
 * par panier de statut, tableau des dossiers et pagination) hors du
 * composant monolithique, sans aucun changement de comportement. Code
 * strictement déplacé, pas réécrit — y compris `getConfidentialityBadge`,
 * qui n'était utilisée que par cette vue.
 *
 * Le bandeau de routage confidentiel (`hasConfidentialRoutingExclusion`,
 * juste avant cette vue dans le rendu) reste dans InvestigationDesk.tsx :
 * il est visible en mode liste ET en mode détail, donc n'appartient pas à
 * "la vue liste" au sens strict.
 */
import React from 'react';
import { ShieldAlert, Search, Lock, Plus, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Language, AlertRecord, UserProfile } from '../../types';
import { EntityDef } from '../../data/activaConfig';
import { AlertStatusBucket } from '../../domain/alertStatusBuckets';
import { trData } from '../../i18n/dataLabels';
import { storage } from '../../services/storage';
import { StatusBadge, DataTable } from '../ui';
import type { DataTableColumn } from '../ui';
import { getPriorityBadge } from './getPriorityBadge';

interface CaseListViewProps {
  t: Record<string, string>;
  lang: Language;
  activeUser: UserProfile;
  hideTopBanner: boolean;
  simplifiedFilters: boolean;
  hideStatusTabsBar: boolean;
  hasConfidentialRoutingExclusion: boolean;
  alerts: AlertRecord[];
  isGlobalViewer: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  entityFilter: string;
  setEntityFilter: (v: string) => void;
  entities: EntityDef[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  nocaFilter: string;
  setNocaFilter: (v: string) => void;
  unassignedOnlyFilter: boolean;
  setUnassignedOnlyFilter: (v: boolean) => void;
  overdueOnlyFilter: boolean;
  setOverdueOnlyFilter: (v: boolean) => void;
  bucketFilter: AlertStatusBucket | 'all';
  setBucketFilter: (v: AlertStatusBucket | 'all') => void;
  bucketTabCounts: Record<AlertStatusBucket | 'all', number>;
  setShowCreateCaseModal: (v: boolean) => void;
  visibleAlerts: AlertRecord[];
  pagedAlerts: AlertRecord[];
  currentPage: number;
  setCurrentPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  setSelectedAlertId: (v: string) => void;
  setViewMode: (v: 'list' | 'detail') => void;
}

export const CaseListView: React.FC<CaseListViewProps> = ({
  t,
  lang,
  activeUser,
  hideTopBanner,
  simplifiedFilters,
  hideStatusTabsBar,
  hasConfidentialRoutingExclusion,
  alerts,
  isGlobalViewer,
  searchQuery,
  setSearchQuery,
  entityFilter,
  setEntityFilter,
  entities,
  statusFilter,
  setStatusFilter,
  nocaFilter,
  setNocaFilter,
  unassignedOnlyFilter,
  setUnassignedOnlyFilter,
  overdueOnlyFilter,
  setOverdueOnlyFilter,
  bucketFilter,
  setBucketFilter,
  bucketTabCounts,
  setShowCreateCaseModal,
  visibleAlerts,
  pagedAlerts,
  currentPage,
  setCurrentPage,
  totalPages,
  setSelectedAlertId,
  setViewMode,
}) => {
  // === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
  // N'affiche rien pour `restricted` (le niveau par défaut, non sensible) —
  // seuls `confidential`/`highly_confidential` méritent une indication
  // visuelle, pour ne pas surcharger chaque carte d'un badge sans valeur
  // ajoutée. Le fait qu'on l'affiche du tout signifie que cet utilisateur y
  // est déjà habilité — visibleAlerts (ci-dessus) a déjà écarté tout
  // dossier hors de son plafond.
  const getConfidentialityBadge = (alert: AlertRecord) => {
    const level = alert.confidentialityLevel ?? 'restricted';
    if (level === 'restricted') return null;
    const style =
      level === 'highly_confidential'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    const label = level === 'highly_confidential' ? t.confidentiality_highly_confidential : t.desk_confidential;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${style}`} title={t.desk_confidentiality_level}>
        <Lock className="w-2.5 h-2.5" />
        {label}
      </span>
    );
  };

  return (
    <>
      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — fiche dossier sans
          bandeau ni barre de filtres) === BUG PRÉEXISTANT CORRIGÉ,
          signalé par l'utilisateur (capture de référence) : ce bandeau
          s'affichait aussi en mode détail (`viewMode === 'detail'`, ex. un
          lien profond `/cases/:trackingNumber` depuis "Dossiers
          attribués") alors qu'il n'a de sens qu'au-dessus d'une LISTE.
          Le composant appelant ne monte cette vue que si `viewMode ===
          'list'` — `hideTopBanner` reste géré ici. */}
      {!hideTopBanner && (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-blue-700" />
              <h2 className="text-xl font-bold text-slate-900">
                {t.portal_title}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {isGlobalViewer
                ? t.desk_scope_global
                : t.desk_scope_restricted.replace('{name}', activeUser.name)}
            </p>
          </div>

          {/* User role info tag */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block">{activeUser.name}</span>
              <span className="text-[11px] text-slate-500">{activeUser.roleTitle}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-800 font-bold text-xs">
              {activeUser.name.charAt(0)}
            </div>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xl font-extrabold text-[#0B2545]">{alerts.length}</div>
            <div className="text-[11px] text-slate-500">{t.portal_total_alerts}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="text-xl font-extrabold text-blue-800">
              {alerts.filter(a => a.status === 'new' || a.status === 'investigation').length}
            </div>
            <div className="text-[11px] text-blue-700">{t.portal_pending}</div>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <div className="text-xl font-extrabold text-rose-800">
              {alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 3' || a.riskEvaluation.nocaThreshold === 'NOCA 4').length}
            </div>
            <div className="text-[11px] text-rose-700">{t.portal_urgent}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="text-xl font-extrabold text-emerald-800">
              {alerts.length > 0 ? Math.round((alerts.filter(a => a.status === 'closed').length / alerts.length) * 100) : 0}%
            </div>
            <div className="text-[11px] text-emerald-700">{t.portal_closed_rate}</div>
          </div>
        </div>
      </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — routage indépendant) ===
          Bandeau neutre : jamais de nombre, jamais de nom, jamais de motif —
          uniquement une mention générique de l'existence du mécanisme, pour
          ne révéler à aucun utilisateur exclu qu'un dossier précis le
          concerne. Visible quel que soit viewMode (liste ou détail), sur
          toutes les routes /operator/ et /investigator/ qui réutilisent cet
          écran — l'occurrence pour le mode détail reste dans
          InvestigationDesk.tsx (cette vue ne monte qu'en mode liste). */}
      {hasConfidentialRoutingExclusion && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{t.desk_confidential_routing_note}</span>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — fiche dossier sans
          bandeau ni barre de filtres) === même correction que le bandeau
          ci-dessus (BUG PRÉEXISTANT CORRIGÉ) : cette barre de filtres n'a de
          sens qu'au-dessus d'une LISTE — elle s'affichait aussi en mode
          détail.
          === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Dossiers",
          même correction que côté Opérateur ; puis écran "Tableau de bord"
          Enquêteur, captures de référence) === BUG PRÉEXISTANT CORRIGÉ,
          signalé par l'utilisateur : ces écrans gardaient encore la barre
          de filtres complète (Statut/Entité/Criticité NOCA + 2 cases à
          cocher) alors que les écrans Opérateur sœurs (À attribuer, En
          attente d'infos, Dossiers attribués) avaient déjà été allégés à
          Recherche + Entité (pas de "Pays" ici : cet écran n'a jamais eu ce
          filtre, contrairement à `OperatorCaseDesk`). Gouverné par
          `simplifiedFilters`, indépendant de `hideTopBanner` (le Tableau de
          bord Enquêteur garde son bandeau tout en simplifiant cette barre).
          Les états (statusFilter/nocaFilter/les 2 cases) restent inchangés
          dans le code — seuls leurs contrôles disparaissent de cette
          variante. */}
      {simplifiedFilters && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">{t.desk_all_entities}</option>
          {entities.map(e => (
            <option key={e.id} value={e.name}>{e.flag} {e.name}</option>
          ))}
        </select>
        {(entityFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => { setEntityFilter('all'); setSearchQuery(''); }}
            className="text-blue-700 hover:underline font-semibold"
          >
            {t.desk_reset_filters}
          </button>
        )}
      </div>
      )}
      {!simplifiedFilters && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">{t.report_filter_status_all}</option>
          <option value="new">{t.desk_status_new}</option>
          <option value="investigation">{t.case_status_investigation}</option>
          <option value="corrective_action">{t.desk_status_corrective}</option>
          <option value="closed">{t.desk_status_closed}</option>
          <option value="reopened">{t.desk_status_reopened}</option>
          <option value="archived">{t.desk_status_archived}</option>
        </select>

        {/* Entity Filter */}
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">{t.desk_all_entities}</option>
          {entities.map(e => (
            <option key={e.id} value={e.name}>{e.flag} {e.name}</option>
          ))}
        </select>

        {/* NOCA Criticality filter */}
        <select
          value={nocaFilter}
          onChange={(e) => setNocaFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">{t.desk_all_noca}</option>
          <option value="NOCA 4">{t.desk_noca4}</option>
          <option value="NOCA 3">{t.desk_noca3}</option>
          <option value="NOCA 2">{t.desk_noca2}</option>
          <option value="NOCA 1">{t.desk_noca1}</option>
        </select>

        {/* === AMÉLIORATION AJOUTÉE (Phase 5) === Control-Panel-driven filters */}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 cursor-pointer">
          <input type="checkbox" checked={unassignedOnlyFilter} onChange={(e) => setUnassignedOnlyFilter(e.target.checked)} className="accent-blue-600" />
          {t.desk_unassigned_only}
        </label>
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 cursor-pointer">
          <input type="checkbox" checked={overdueOnlyFilter} onChange={(e) => setOverdueOnlyFilter(e.target.checked)} className="accent-rose-600" />
          {t.desk_overdue_only}
        </label>

        {(statusFilter !== 'all' || entityFilter !== 'all' || nocaFilter !== 'all' || searchQuery || unassignedOnlyFilter || overdueOnlyFilter) && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setEntityFilter('all');
              setNocaFilter('all');
              setSearchQuery('');
              setUnassignedOnlyFilter(false);
              setOverdueOnlyFilter(false);
            }}
            className="text-blue-700 hover:underline font-semibold"
          >
            {t.desk_reset_filters}
          </button>
        )}
      </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — liste et détail séparés) ===
          A real dedicated list screen and a real dedicated full-width detail
          screen, shown one at a time via viewMode — replacing the previous
          always-both split-pane. Same data, same filters, same handlers. */}
      <div className="space-y-3">
        {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
            Onglets de filtre par panier de statut + bouton "+ Nouveau",
            façon maquette. Les filtres détaillés existants (recherche,
            statut précis, entité, NOCA, non-attribués, en retard) restent
            inchangés dans le bloc "Filtre bar" juste au-dessus — rien
            n'est retiré, ce nouveau raccourci s'ajoute simplement.
            === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Tableau de
            bord" Enquêteur, capture de référence) === BUG PRÉEXISTANT
            CORRIGÉ, signalé par l'utilisateur : masquable via
            `hideStatusTabsBar` — un Tableau de bord a déjà ses propres
            cartes KPI juste au-dessus, cette rangée y fait doublon. */}
        {!hideStatusTabsBar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['all', t.db_bucket_tous],
                ['a_traiter', t.db_bucket_a_traiter],
                ['en_cours', t.db_bucket_en_cours],
                ['en_attente', t.db_bucket_en_attente],
                ['clotures', t.db_bucket_clotures],
                ['rejetes', t.db_bucket_rejetes],
              ] as [AlertStatusBucket | 'all', string][]
            ).map(([bucket, label]) => (
              <button
                key={bucket}
                onClick={() => setBucketFilter(bucket)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition border ${
                  bucketFilter === bucket
                    ? 'bg-[#0B2545] text-white border-[#0B2545]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {label} ({bucketTabCounts[bucket]})
              </button>
            ))}
          </div>
          {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau
              dossier) === ouvre désormais la vraie modale de création
              (voir plus bas) plutôt que de renvoyer vers le formulaire
              public. `onCreateNewCase` reste une prop déclarée (câblée
              par tous les appelants existants dans App.tsx) mais n'est
              plus utilisée ici — conservée pour un éventuel appelant
              futur qui préférerait rediriger plutôt qu'ouvrir la
              modale. */}
          <button
            onClick={() => setShowCreateCaseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> {t.db_new_case_button}
          </button>
        </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider">
              {t.desk_cases_count.replace('{n}', String(visibleAlerts.length))}
            </span>
            <span className="text-[11px] text-slate-500">
              {isGlobalViewer ? t.desk_all_subsidiaries : t.desk_assigned}
            </span>
          </div>

          <div className="p-4">
            <DataTable
              columns={
                [
                  {
                    key: 'id',
                    header: t.cp_col_case_id,
                    render: (alert) => (
                      <span className="font-mono font-bold text-[#0B2545] flex items-center gap-1.5">
                        {alert.trackingNumber}
                        {getConfidentialityBadge(alert)}
                      </span>
                    ),
                  },
                  {
                    key: 'object',
                    header: t.desk_col_subject,
                    render: (alert) => <span className="line-clamp-1 max-w-[220px]">{alert.detailedDescription}</span>,
                    hideOnMobile: true,
                  },
                  {
                    key: 'country_entity',
                    header: t.desk_col_country_entity,
                    render: (alert) => (
                      <span className="flex items-center gap-1 truncate max-w-[160px]">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        {alert.concernedEntity}
                      </span>
                    ),
                    hideOnMobile: true,
                  },
                  { key: 'category', header: t.desk_col_category, render: (alert) => trData(alert.category, lang) },
                  {
                    key: 'status',
                    header: t.desk_col_status,
                    render: (alert) => (
                      <StatusBadge
                        status={alert.status === 'corrective_action' ? 'closed' : (alert.status as any)}
                        label={t[`status_${alert.status}` as keyof typeof t] ?? alert.status}
                        size="sm"
                      />
                    ),
                  },
                  { key: 'priority', header: t.desk_col_priority, render: (alert) => getPriorityBadge(alert) },
                  {
                    key: 'received',
                    header: t.desk_col_received,
                    render: (alert) => new Date(alert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'),
                    hideOnMobile: true,
                  },
                ] as DataTableColumn<AlertRecord>[]
              }
              rows={pagedAlerts}
              getRowKey={(alert) => alert.id}
              onRowClick={(alert) => {
                setSelectedAlertId(alert.id);
                setViewMode('detail');
                storage.logAudit(
                  'ALERT_ACCESSED',
                  `Consultation de la fiche dossier ${alert.trackingNumber} par ${activeUser.name}.`,
                  { id: alert.id, trackingNumber: alert.trackingNumber },
                  activeUser
                );
              }}
              emptyTitle={t.desk_no_match}
            />
          </div>

          {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === */}
          {visibleAlerts.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-[11px] text-slate-500">
              <span>{t.desk_results_count.replace('{n}', String(visibleAlerts.length))}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-300">…</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg font-bold ${
                          p === currentPage ? 'bg-[#0B2545] text-white' : 'border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
