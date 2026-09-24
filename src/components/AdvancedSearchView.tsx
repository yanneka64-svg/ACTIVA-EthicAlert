/**
 * === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
 *
 * Nouvel écran transverse "Recherche avancée" (maquette de référence,
 * écran 9 — jusqu'ici /operator/search et /investigator/search
 * réouvraient simplement l'écran Dossiers avec sa barre de recherche
 * mot-clé existante, sans formulaire multicritère dédié).
 *
 * Filtre toujours `useVisibleAlerts` (jamais storage.getAlerts() brut) —
 * la recherche avancée ne doit jamais devenir un moyen de contourner le
 * périmètre RBAC/pays/entité/confidentialité/routage indépendant déjà
 * appliqué partout ailleurs dans l'application. Résultats affichés avec
 * le même `DataTable` générique que les autres registres transverses
 * (Communications/Preuves/Tâches) ; un clic renvoie vers le dossier
 * concerné via `onOpenCase`, exactement le même mécanisme.
 */
import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { AlertRecord, AlertStatus, Language, NocaThreshold, SeverityLevel, UserProfile } from '../types';
import { ConfidentialityLevel } from '../domain/caseTypes';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { AdvancedSearchCriteria, hasActiveCriteria, searchAlerts } from '../domain/advancedSearch';
import { DataTable, DataTableColumn, PriorityBadge, StatusBadge, BadgeStatus } from './ui';
import { formatCountryLabel } from '../data/activaConfig';

interface AdvancedSearchViewProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

const CHANNEL_LABELS: Record<AlertRecord['channel'], string> = {
  web: 'Web',
  qr_code: 'QR Code',
  direct: 'Direct',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  new: 'Nouveau',
  under_review: 'En revue',
  investigation: 'En investigation',
  corrective_action: 'Mesures correctives',
  closed: 'Clôturé',
  archived: 'Archivé',
  reopened: 'Rouvert',
};

const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  mineure: 'Mineure',
  moderee: 'Modérée',
  majeure: 'Majeure',
  critique: 'Critique',
};

const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  standard: 'Standard',
  restricted: 'Restreint',
  confidential: 'Confidentiel',
  highly_confidential: 'Très confidentiel',
};

const NOCA_OPTIONS: NocaThreshold[] = ['NOCA 1', 'NOCA 2', 'NOCA 3', 'NOCA 4'];

const EMPTY_CRITERIA: AdvancedSearchCriteria = {};

export const AdvancedSearchView: React.FC<AdvancedSearchViewProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE : libellés traduits (les constantes FR de module restent le repli) ===
  const statusLabels: Record<AlertStatus, string> = { ...STATUS_LABELS, new: t.srch_status_new, under_review: t.case_status_review, investigation: t.case_status_investigation, corrective_action: t.desk_status_corrective, closed: t.srch_status_closed, archived: t.srch_status_archived, reopened: t.srch_status_reopened };
  const severityLabels: Record<SeverityLevel, string> = { ...SEVERITY_LABELS, mineure: t.op_sev_minor, moderee: t.op_sev_moderate, majeure: t.op_sev_major, critique: t.op_critical };
  const confidentialityLabels: Record<ConfidentialityLevel, string> = { ...CONFIDENTIALITY_LABELS, standard: t.op_conf_standard, restricted: t.op_conf_restricted, confidential: t.desk_confidential, highly_confidential: t.confidentiality_highly_confidential };
  const channelLabels: Record<AlertRecord['channel'], string> = { ...CHANNEL_LABELS, direct: t.srch_channel_direct };
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>(EMPTY_CRITERIA);

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const countries = storage.getCountries();
  const entities = storage.getEntities();
  const categories = storage.getCategories();
  const selectedCategory = categories.find((c) => c.name === criteria.category);

  const visibleAlerts = useVisibleAlerts(alerts, activeUser);
  const results = searchAlerts(visibleAlerts, criteria);

  const setField = <K extends keyof AdvancedSearchCriteria>(key: K, value: AdvancedSearchCriteria[K]) => {
    setCriteria((prev) => {
      const next = { ...prev, [key]: value || undefined };
      // Une sous-catégorie n'a de sens que pour la catégorie choisie — la
      // vider évite un filtre orphelin invisible si on change de catégorie.
      if (key === 'category') next.subCategory = undefined;
      return next;
    });
  };

  const columns: DataTableColumn<AlertRecord>[] = [
    {
      key: 'ref',
      header: t.srch_col_case,
      render: (a) => <span className="font-mono font-bold text-[#0B2545]">{a.trackingNumber}</span>,
    },
    {
      key: 'category',
      header: t.desk_col_category,
      render: (a) => (
        <div>
          <div className="font-semibold text-slate-900 truncate max-w-[220px]">{a.category}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{a.subCategory}</div>
        </div>
      ),
    },
    {
      key: 'entity',
      header: t.srch_col_entity_country,
      render: (a) => (
        <div>
          <div className="text-slate-800">{a.concernedEntity}</div>
          <div className="text-[11px] text-slate-500">{formatCountryLabel(storage.getCountries(), a.country)}</div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: t.desk_col_status,
      render: (a) => <StatusBadge status={a.status as BadgeStatus} label={statusLabels[a.status]} size="sm" />,
    },
    {
      key: 'priority',
      header: t.desk_col_priority,
      render: (a) => <PriorityBadge priority={a.riskEvaluation.priority} label={a.riskEvaluation.nocaThreshold} size="sm" />,
      hideOnMobile: true,
    },
    {
      key: 'date',
      header: t.desk_col_received,
      render: (a) => new Date(a.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'),
      hideOnMobile: true,
    },
  ];

  const selectClass = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700';
  const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase mb-1';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-700" />
            {t.search_advanced_title}
          </h2>
          <p className="text-xs text-slate-600 mt-1">{t.search_advanced_subtitle}</p>
        </div>
        {hasActiveCriteria(criteria) && (
          <button
            onClick={() => setCriteria(EMPTY_CRITERIA)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.op_reset}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
        <div>
          <label className={labelClass}>{t.srch_keywords}</label>
          <input
            type="text"
            value={criteria.keyword ?? ''}
            onChange={(e) => setField('keyword', e.target.value)}
            placeholder={t.op_search_ph}
            className={selectClass}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>{t.op_col_country}</label>
            <select value={criteria.countryId ?? ''} onChange={(e) => setField('countryId', e.target.value)} className={selectClass}>
              <option value="">{t.op_all_countries}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.op_col_entity}</label>
            <select value={criteria.entityId ?? ''} onChange={(e) => setField('entityId', e.target.value)} className={selectClass}>
              <option value="">{t.report_filter_entity_all}</option>
              {entities
                .filter((e) => !criteria.countryId || countries.find((c) => c.code === criteria.countryId)?.name === e.country)
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.flag} {e.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.desk_col_category}</label>
            <select value={criteria.category ?? ''} onChange={(e) => setField('category', e.target.value)} className={selectClass}>
              <option value="">{t.srch_all_categories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_subcategory}</label>
            <select
              value={criteria.subCategory ?? ''}
              onChange={(e) => setField('subCategory', e.target.value)}
              disabled={!selectedCategory}
              className={`${selectClass} ${!selectedCategory ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">{t.srch_all_f}</option>
              {(selectedCategory?.subCategories ?? []).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.desk_col_status}</label>
            <select value={criteria.status ?? ''} onChange={(e) => setField('status', e.target.value as AlertStatus)} className={selectClass}>
              <option value="">{t.report_filter_status_all}</option>
              {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_noca}</label>
            <select value={criteria.noca ?? ''} onChange={(e) => setField('noca', e.target.value as NocaThreshold)} className={selectClass}>
              <option value="">{t.srch_all_noca}</option>
              {NOCA_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_severity}</label>
            <select value={criteria.severity ?? ''} onChange={(e) => setField('severity', e.target.value as SeverityLevel)} className={selectClass}>
              <option value="">{t.srch_all_severities}</option>
              {(Object.keys(SEVERITY_LABELS) as SeverityLevel[]).map((s) => (
                <option key={s} value={s}>{severityLabels[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_sensitivity}</label>
            <select value={criteria.confidentiality ?? ''} onChange={(e) => setField('confidentiality', e.target.value as ConfidentialityLevel)} className={selectClass}>
              <option value="">{t.srch_all_sensitivities}</option>
              {(Object.keys(CONFIDENTIALITY_LABELS) as ConfidentialityLevel[]).map((c) => (
                <option key={c} value={c}>{confidentialityLabels[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_channel}</label>
            <select value={criteria.channel ?? ''} onChange={(e) => setField('channel', e.target.value as AlertRecord['channel'])} className={selectClass}>
              <option value="">{t.srch_all_channels}</option>
              {(Object.keys(CHANNEL_LABELS) as AlertRecord['channel'][]).map((c) => (
                <option key={c} value={c}>{channelLabels[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t.srch_start_date}</label>
            <input type="date" value={criteria.dateFrom ?? ''} onChange={(e) => setField('dateFrom', e.target.value)} className={selectClass} />
          </div>

          <div>
            <label className={labelClass}>{t.srch_end_date}</label>
            <input type="date" value={criteria.dateTo ?? ''} onChange={(e) => setField('dateTo', e.target.value)} className={selectClass} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-600">
          {results.length} résultat{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={results}
        getRowKey={(a) => a.id}
        onRowClick={(a) => onOpenCase(a.trackingNumber)}
        emptyTitle={hasActiveCriteria(criteria) ? t.search_advanced_empty_filtered : t.search_advanced_empty}
      />
    </div>
  );
};
