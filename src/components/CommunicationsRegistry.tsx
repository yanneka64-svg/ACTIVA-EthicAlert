/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Communications" (mockup: groupe INVESTIGATION).
 * Agrège `AlertRecord.messages` de tous les dossiers visibles par
 * l'utilisateur — les mêmes messages réels échangés avec les lanceurs
 * d'alerte via `AlertTrackingView`/`InvestigationDesk`, jamais une donnée
 * séparée. Renvoie vers le dossier concerné en un clic.
 */
import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CaseMessage } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { isGlobalCaseViewer } from '../services/authz';
import { DataTable, DataTableColumn } from './ui';

interface CommunicationsRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

interface MessageRow {
  message: CaseMessage;
  alert: AlertRecord;
}

const SENDER_LABEL: Record<CaseMessage['sender'], string> = {
  whistleblower: 'Lanceur d’alerte',
  investigator: 'Investigateur',
  admin: 'Administrateur',
};

export const CommunicationsRegistry: React.FC<CommunicationsRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
  const isGlobalViewer = isGlobalCaseViewer(activeUser);

  const rows: MessageRow[] = alerts
    .filter((a) => isGlobalViewer || a.assignedInvestigators.includes(activeUser.id))
    .flatMap((alert) => (alert.messages ?? []).map((message) => ({ message, alert })))
    .sort((a, b) => new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime());

  const columns: DataTableColumn<MessageRow>[] = [
    {
      key: 'case',
      header: t.cp_col_case_id,
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.alert.trackingNumber}</span>,
    },
    {
      key: 'sender',
      header: t.reg_col_sender,
      render: (r) => <span className="font-semibold text-slate-900">{SENDER_LABEL[r.message.sender]}</span>,
    },
    {
      key: 'message',
      header: t.reg_col_message,
      render: (r) => <span className="text-slate-700 line-clamp-2">{r.message.content}</span>,
    },
    {
      key: 'date',
      header: t.reg_col_date,
      render: (r) => new Date(r.message.createdAt).toLocaleString(lang),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-700" />
          {t.reg_comms_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_comms_subtitle}</p>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.message.id}
        onRowClick={(r) => onOpenCase(r.alert.trackingNumber)}
        emptyTitle={t.reg_comms_empty}
      />
    </div>
  );
};
