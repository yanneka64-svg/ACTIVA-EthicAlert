/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Actions Correctives" (mockup: groupe REMEDIATION,
 * niveau supérieur à INVESTIGATION dans la maquette). Agrège
 * `AlertRecord.correctiveMeasures` de tous les dossiers visibles — les mêmes
 * mesures réelles documentées via l'onglet correctif d'InvestigationDesk
 * (resté inchangé), jamais une donnée séparée. Renvoie vers le dossier
 * concerné en un clic.
 *
 * === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des recommandations) ===
 * Sur retour utilisateur détaillé : même contenu (chaque mesure corrective
 * réelle reste une ligne), mais filtrable/regroupable par pays, entité,
 * niveau de sévérité, échéance et statut plutôt qu'affiché à plat sans
 * classement. La colonne "Échéance" distingue désormais l'échéance CIBLE
 * (`dueDate`, toujours affichée) de la date de clôture EFFECTIVE
 * (`closedAt`, nouveau champ additif — voir types.ts — renseignée
 * uniquement pour une mesure "Vérifiée").
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CorrectiveMeasure } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { DataTable, DataTableColumn } from './ui';

interface CorrectiveActionsRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

interface MeasureRow {
  measure: CorrectiveMeasure;
  alert: AlertRecord;
}

const MEASURE_STATUS_STYLE: Record<CorrectiveMeasure['status'], string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  implemented: 'bg-amber-100 text-amber-800 border-amber-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const CorrectiveActionsRegistry: React.FC<CorrectiveActionsRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des recommandations) ===
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const visibleAlerts = useVisibleAlerts(alerts, activeUser);
  const entities = storage.getEntities();
  const countries = Array.from(new Set(visibleAlerts.map((a) => a.country).filter(Boolean))).sort();

  const allRows: MeasureRow[] = visibleAlerts
    .flatMap((alert) => (alert.correctiveMeasures ?? []).map((measure) => ({ measure, alert })))
    .sort((a, b) => new Date(a.measure.dueDate).getTime() - new Date(b.measure.dueDate).getTime());

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des recommandations) ===
  const rows = allRows.filter((r) => {
    if (countryFilter !== 'all' && r.alert.country !== countryFilter) return false;
    if (entityFilter !== 'all' && r.alert.concernedEntity !== entityFilter) return false;
    if (severityFilter !== 'all' && (r.alert.severity ?? 'moderee') !== severityFilter) return false;
    if (statusFilter !== 'all' && r.measure.status !== statusFilter) return false;
    return true;
  });

  const columns: DataTableColumn<MeasureRow>[] = [
    {
      key: 'title',
      header: t.reg_col_title,
      render: (r) => <span className="font-semibold text-slate-900">{r.measure.title}</span>,
    },
    {
      key: 'case',
      header: t.cp_col_case_id,
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.alert.trackingNumber}</span>,
    },
    {
      key: 'country',
      header: t.reg_col_country,
      render: (r) => r.alert.country,
      hideOnMobile: true,
    },
    {
      key: 'entity',
      header: t.reg_col_entity,
      render: (r) => r.alert.concernedEntity,
      hideOnMobile: true,
    },
    {
      key: 'severity',
      header: t.reg_col_severity,
      render: (r) => (r.alert.severity ? t[`severity_${r.alert.severity}` as keyof typeof t] : '—'),
      hideOnMobile: true,
    },
    {
      key: 'owner',
      header: t.reg_col_owner,
      render: (r) => r.measure.responsiblePerson,
      hideOnMobile: true,
    },
    {
      key: 'due',
      // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des
      // recommandations) === échéance cible ET date de clôture
      // effective, jamais confondues.
      header: t.reg_col_due,
      render: (r) => (
        <div className="text-[11px]">
          <div className="text-slate-700">{t.reg_col_due_target} : {new Date(r.measure.dueDate).toLocaleDateString(lang)}</div>
          {r.measure.closedAt && (
            <div className="text-emerald-700 font-semibold mt-0.5">{t.reg_col_closed_at} : {new Date(r.measure.closedAt).toLocaleDateString(lang)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t.cp_col_status,
      render: (r) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${MEASURE_STATUS_STYLE[r.measure.status]}`}>
          {t[`corrective_status_${r.measure.status}` as keyof typeof t]}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-700" />
          {t.reg_recommendations_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_recommendations_subtitle}</p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des recommandations) === */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-xs">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700">
          <option value="all">{t.reg_filter_all_countries}</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700">
          <option value="all">{t.reg_filter_all_entities}</option>
          {entities.map((e) => <option key={e.id} value={e.name}>{e.flag} {e.name}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700">
          <option value="all">{t.reg_filter_all_severities}</option>
          <option value="mineure">{t.severity_mineure}</option>
          <option value="moderee">{t.severity_moderee}</option>
          <option value="majeure">{t.severity_majeure}</option>
          <option value="critique">{t.severity_critique}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700">
          <option value="all">{t.reg_filter_all_statuses}</option>
          <option value="planned">{t.corrective_status_planned}</option>
          <option value="in_progress">{t.corrective_status_in_progress}</option>
          <option value="implemented">{t.corrective_status_implemented}</option>
          <option value="verified">{t.corrective_status_verified}</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.measure.id}
        onRowClick={(r) => onOpenCase(r.alert.trackingNumber)}
        emptyTitle={t.reg_corrective_empty}
      />
    </div>
  );
};
