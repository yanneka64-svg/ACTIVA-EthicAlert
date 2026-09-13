/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Preuves" (mockup: groupe INVESTIGATION). Agrège
 * `AlertRecord.evidences` de tous les dossiers visibles par l'utilisateur —
 * données réelles déjà persistées par `AlertSubmissionFlow`/`InvestigationDesk`,
 * jamais fabriquées. Renvoie vers le dossier concerné en un clic.
 */
import React, { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Language, AlertRecord, UserProfile, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { DataTable, DataTableColumn } from './ui';

interface EvidenceRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

interface EvidenceRow {
  evidence: EvidenceFile;
  alert: AlertRecord;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const EvidenceRegistry: React.FC<EvidenceRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const isGlobalViewer =
    activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';

  const rows: EvidenceRow[] = alerts
    .filter((a) => isGlobalViewer || a.assignedInvestigators.includes(activeUser.id))
    .flatMap((alert) => (alert.evidences ?? []).map((evidence) => ({ evidence, alert })))
    .sort((a, b) => new Date(b.evidence.uploadedAt).getTime() - new Date(a.evidence.uploadedAt).getTime());

  const columns: DataTableColumn<EvidenceRow>[] = [
    {
      key: 'name',
      header: t.reg_col_name,
      render: (r) => <span className="font-semibold text-slate-900 break-all">{r.evidence.name}</span>,
    },
    {
      key: 'case',
      header: t.cp_col_case_id,
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.alert.trackingNumber}</span>,
    },
    {
      key: 'type',
      header: t.reg_col_type,
      render: (r) => <span className="text-[11px] text-slate-500">{r.evidence.type || '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'size',
      header: t.reg_col_size,
      render: (r) => formatSize(r.evidence.size),
      hideOnMobile: true,
    },
    {
      key: 'date',
      header: t.reg_col_date,
      render: (r) => new Date(r.evidence.uploadedAt).toLocaleDateString(lang),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-blue-700" />
          {t.reg_evidence_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_evidence_subtitle}</p>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.evidence.id}
        onRowClick={(r) => onOpenCase(r.alert.trackingNumber)}
        emptyTitle={t.reg_evidence_empty}
      />
    </div>
  );
};
