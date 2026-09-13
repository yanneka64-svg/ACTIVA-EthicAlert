/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Actions Correctives" (mockup: groupe REMEDIATION,
 * niveau supérieur à INVESTIGATION dans la maquette). Agrège
 * `AlertRecord.correctiveMeasures` de tous les dossiers visibles — les mêmes
 * mesures réelles documentées via l'onglet correctif d'InvestigationDesk
 * (resté inchangé), jamais une donnée séparée. Renvoie vers le dossier
 * concerné en un clic.
 */
import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CorrectiveMeasure } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
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

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const isGlobalViewer =
    activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';

  const rows: MeasureRow[] = alerts
    .filter((a) => isGlobalViewer || a.assignedInvestigators.includes(activeUser.id))
    .flatMap((alert) => (alert.correctiveMeasures ?? []).map((measure) => ({ measure, alert })))
    .sort((a, b) => new Date(a.measure.dueDate).getTime() - new Date(b.measure.dueDate).getTime());

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
      key: 'owner',
      header: t.reg_col_owner,
      render: (r) => r.measure.responsiblePerson,
      hideOnMobile: true,
    },
    {
      key: 'due',
      header: t.reg_col_due,
      render: (r) => new Date(r.measure.dueDate).toLocaleDateString(lang),
    },
    {
      key: 'status',
      header: t.cp_col_status,
      render: (r) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${MEASURE_STATUS_STYLE[r.measure.status]}`}>
          {r.measure.status}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-700" />
          {t.reg_corrective_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_corrective_subtitle}</p>
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
