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
      header: 'Dossier',
      render: (a) => <span className="font-mono font-bold text-[#0B2545]">{a.trackingNumber}</span>,
    },
    {
      key: 'category',
      header: 'Catégorie',
      render: (a) => (
        <div>
          <div className="font-semibold text-slate-900 truncate max-w-[220px]">{a.category}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{a.subCategory}</div>
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Entité / Pays',
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
      header: 'Statut',
      render: (a) => <StatusBadge status={a.status as BadgeStatus} label={STATUS_LABELS[a.status]} size="sm" />,
    },
    {
      key: 'priority',
      header: 'Priorité',
      render: (a) => <PriorityBadge priority={a.riskEvaluation.priority} label={a.riskEvaluation.nocaThreshold} size="sm" />,
      hideOnMobile: true,
    },
    {
      key: 'date',
      header: 'Reçu le',
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
            Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
        <div>
          <label className={labelClass}>Mots-clés</label>
          <input
            type="text"
            value={criteria.keyword ?? ''}
            onChange={(e) => setField('keyword', e.target.value)}
            placeholder="Référence, description, entité, lieu..."
            className={selectClass}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Pays</label>
            <select value={criteria.countryId ?? ''} onChange={(e) => setField('countryId', e.target.value)} className={selectClass}>
              <option value="">Tous les pays</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Entité</label>
            <select value={criteria.entityId ?? ''} onChange={(e) => setField('entityId', e.target.value)} className={selectClass}>
              <option value="">Toutes les entités</option>
              {entities
                .filter((e) => !criteria.countryId || countries.find((c) => c.code === criteria.countryId)?.name === e.country)
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.flag} {e.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Catégorie</label>
            <select value={criteria.category ?? ''} onChange={(e) => setField('category', e.target.value)} className={selectClass}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Sous-catégorie</label>
            <select
              value={criteria.subCategory ?? ''}
              onChange={(e) => setField('subCategory', e.target.value)}
              disabled={!selectedCategory}
              className={`${selectClass} ${!selectedCategory ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">Toutes</option>
              {(selectedCategory?.subCategories ?? []).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Statut</label>
            <select value={criteria.status ?? ''} onChange={(e) => setField('status', e.target.value as AlertStatus)} className={selectClass}>
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Criticité (NOCA)</label>
            <select value={criteria.noca ?? ''} onChange={(e) => setField('noca', e.target.value as NocaThreshold)} className={selectClass}>
              <option value="">Toutes criticités</option>
              {NOCA_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Sévérité</label>
            <select value={criteria.severity ?? ''} onChange={(e) => setField('severity', e.target.value as SeverityLevel)} className={selectClass}>
              <option value="">Toutes sévérités</option>
              {(Object.keys(SEVERITY_LABELS) as SeverityLevel[]).map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Sensibilité</label>
            <select value={criteria.confidentiality ?? ''} onChange={(e) => setField('confidentiality', e.target.value as ConfidentialityLevel)} className={selectClass}>
              <option value="">Toutes sensibilités</option>
              {(Object.keys(CONFIDENTIALITY_LABELS) as ConfidentialityLevel[]).map((c) => (
                <option key={c} value={c}>{CONFIDENTIALITY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Canal</label>
            <select value={criteria.channel ?? ''} onChange={(e) => setField('channel', e.target.value as AlertRecord['channel'])} className={selectClass}>
              <option value="">Tous canaux</option>
              {(Object.keys(CHANNEL_LABELS) as AlertRecord['channel'][]).map((c) => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Date de début</label>
            <input type="date" value={criteria.dateFrom ?? ''} onChange={(e) => setField('dateFrom', e.target.value)} className={selectClass} />
          </div>

          <div>
            <label className={labelClass}>Date de fin</label>
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
