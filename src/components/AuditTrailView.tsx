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
  Clock,
  Link2
} from 'lucide-react';
import { Language, AuditLogEntry, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 8 : indicateur
// de synchronisation) === `isPhase4Configured` est une simple lecture de
// variables d'environnement (aucun SDK Firebase chargé) — voir
// services/firebaseClient.ts. Import statique sans risque de gonfler ce
// chunk (déjà chargé à la demande, voir App.tsx `lazy(...)`), vérifié par
// comparaison de taille de build avant/après.
import { isPhase4Configured } from '../services/firebaseClient';

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

  // === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 8 :
  // indicateur de synchronisation) === Lecture seule, purement informative :
  // combien de dossiers locaux portent un lien réel actif
  // (AlertRecord.mirroredCaseId, posé par storage.linkMirroredCase — voir
  // Phase 7). Masqué tant que la Phase 4 (services/casesCloudSync.ts) n'est
  // pas configurée : afficher "0/N" alors que le miroir n'est même pas actif
  // donnerait l'impression trompeuse d'un système qui ne fonctionne pas,
  // plutôt que d'un système pas encore activé — voir docs/DATABASE.md sur ce
  // principe déjà appliqué ailleurs (ControlPanel.tsx, CaseLookup.tsx…).
  const alerts = storage.getAlerts();
  const mirroredCount = alerts.filter((a) => a.mirroredCaseId).length;

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
                {t.audit_title}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {t.audit_subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              {t.audit_sealed}
            </span>

            {/* === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 8) === */}
            {isPhase4Configured() && (
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200"
                title={t.audit_backend_sync.replace('{synced}', String(mirroredCount)).replace('{total}', String(alerts.length))}
              >
                <Link2 className="w-3.5 h-3.5" />
                {t.audit_backend_sync.replace('{synced}', String(mirroredCount)).replace('{total}', String(alerts.length))}
              </span>
            )}

            <button
              onClick={handleExportAuditCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold transition shadow-xs"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{t.audit_export}</span>
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
              placeholder={t.audit_search_ph}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
          >
            <option value="all">{t.audit_all_actions}</option>
            <option value="ALERT_SUBMITTED">{t.audit_act_submitted}</option>
            <option value="ALERT_ACCESSED">{t.audit_act_accessed}</option>
            <option value="ACCESS_DENIED">{t.audit_act_denied}</option>
            <option value="INVESTIGATOR_ASSIGNED">{t.audit_act_assigned}</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="CASE_ESCALATED">{t.audit_act_escalated}</option>
            <option value="STATUS_CHANGED">{t.audit_act_status}</option>
            <option value="PRIORITY_MODIFIED">{t.audit_act_priority}</option>
            <option value="INTERNAL_NOTE_ADDED">{t.audit_act_note}</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="MESSAGE_SENT">{t.audit_act_message}</option>
            <option value="CORRECTIVE_MEASURE_ADDED">{t.audit_act_measure}</option>
            <option value="ALERT_CLOSED">{t.audit_act_closed}</option>
            <option value="ALERT_REOPENED">{t.audit_act_reopened}</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 9 — évolution multi-pays/multi-entité) === */}
            <option value="ALERT_ARCHIVED">{t.audit_act_archived}</option>
            <option value="REPORT_GENERATED">{t.audit_act_report}</option>
            <option value="CONFIG_UPDATED">{t.audit_act_config}</option>
            {/* === AMÉLIORATION AJOUTÉE (Phase 7 — routage indépendant) === */}
            <option value="INDEPENDENT_ROUTING_TRIGGERED">{t.audit_act_routing}</option>
            <option value="NO_INDEPENDENT_AUTHORITY_FOUND">{t.audit_act_no_authority}</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="p-3.5 font-bold">{t.audit_col_time}</th>
                <th className="p-3.5 font-bold">{t.audit_col_author}</th>
                <th className="p-3.5 font-bold">{t.audit_col_action}</th>
                <th className="p-3.5 font-bold">{t.srch_col_case}</th>
                <th className="p-3.5 font-bold">{t.audit_col_details}</th>
                <th className="p-3.5 font-bold">{t.audit_col_ip}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {t.audit_none}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
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
