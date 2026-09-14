import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  User, 
  Calendar, 
  FileText,
  Clock
} from 'lucide-react';
import { Language, AuditLogEntry, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';

interface AuditTrailViewProps {
  lang: Language;
  activeUser: UserProfile;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  lang,
  activeUser,
}) => {
  const t = TRANSLATIONS[lang];
  const logs = storage.getAuditLogs();

  const [searchFilter, setSearchFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');

  const filteredLogs = logs.filter((log) => {
    if (actionTypeFilter !== 'all' && log.actionType !== actionTypeFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchAuthor = log.authorName.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchRef = log.trackingNumber?.toLowerCase().includes(q);
      if (!matchAuthor && !matchDetails && !matchRef) return false;
    }
    return true;
  });

  const handleExportAuditCSV = () => {
    const headers = ['ID', 'Date_Heure', 'Auteur', 'Role', 'Action', 'Reference_Dossier', 'Details', 'IP_Securisee'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      `"${l.authorName}"`,
      `"${l.authorRole}"`,
      l.actionType,
      l.trackingNumber || 'N/A',
      `"${l.details.replace(/"/g, '""')}"`,
      l.ipAddress || 'Interne'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ACTIVA_Piste_Audit_AdHoc_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <History className="w-5 h-5 text-purple-700" />
              <h2 className="text-xl font-bold text-slate-900">
                Piste d’Audit Immuable & Traçabilité (CDC 3.1.5)
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Historisation intégrale des accès, modifications, consultations et décisions. Durée de conservation : 10 ans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              Registre d'audit intègre & scellé
            </span>

            <button
              onClick={handleExportAuditCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold transition shadow-xs"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export Audit Ad-Hoc</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Rechercher dans l'audit par auteur, référence, mot-clé..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
          >
            <option value="all">Tous types d'actions</option>
            <option value="ALERT_SUBMITTED">Création d'alerte</option>
            <option value="ALERT_ACCESSED">Consultation de dossier</option>
            <option value="ACCESS_DENIED">Accès refusé (échec authentification)</option>
            <option value="INVESTIGATOR_ASSIGNED">Attribution de gestionnaire</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="CASE_ESCALATED">Escalade vers la DARC Groupe</option>
            <option value="STATUS_CHANGED">Changement de statut</option>
            <option value="PRIORITY_MODIFIED">Modification de priorité</option>
            <option value="INTERNAL_NOTE_ADDED">Note interne ajoutée</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="MESSAGE_SENT">Message envoyé au lanceur d'alerte</option>
            <option value="CORRECTIVE_MEASURE_ADDED">Mesure corrective</option>
            <option value="ALERT_CLOSED">Clôture de dossier</option>
            <option value="ALERT_REOPENED">Réouverture de dossier</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="ALERT_ARCHIVED">Archivage légal</option>
            <option value="REPORT_GENERATED">Export de rapport</option>
            <option value="CONFIG_UPDATED">Configuration mise à jour</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="p-3.5 font-bold">Horodatage (UTC)</th>
                <th className="p-3.5 font-bold">Auteur & Rôle</th>
                <th className="p-3.5 font-bold">Action</th>
                <th className="p-3.5 font-bold">Dossier</th>
                <th className="p-3.5 font-bold">Détails de l'opération</th>
                <th className="p-3.5 font-bold">Passerelle IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Aucune entrée d'audit trouvée.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{log.authorName}</div>
                      <div className="text-[10px] text-slate-500">{log.authorRole}</div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                        {log.actionType}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-mono font-bold text-[#0B2545]">
                      {log.trackingNumber || '—'}
                    </td>
                    <td className="p-3.5 text-slate-700 max-w-md">
                      {log.details}
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                      {log.ipAddress || '197.234.219.82'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
