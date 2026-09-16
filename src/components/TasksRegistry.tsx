/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Tâches" (mockup: groupe INVESTIGATION), à
 * l'origine un registre à plat des tâches de tous les dossiers.
 *
 * === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des investigations) ===
 * Sur retour utilisateur détaillé : cet écran devient un tableau de bord de
 * suivi des INVESTIGATIONS elles-mêmes (une ligne par dossier, plus par
 * tâche) — taux d'avancement, statut, dernier commentaire interne, mesures
 * correctives associées, plus une vue agrégée "taux de clôture par pays".
 * Nom de fichier et de composant conservés (`TasksRegistry`) pour ne pas
 * casser les imports existants — seul le contenu change, comme documenté
 * dans le brief de refonte.
 *
 * Le "taux d'avancement" n'est pas un champ saisi : faute de valeur fiable
 * et unique dans le modèle actuel, il est ESTIMÉ (jamais présenté comme une
 * mesure exacte, libellé "Avancement (estimé)") — en priorité depuis le
 * ratio de tâches internes terminées (`AlertRecord.tasks`) quand ce dossier
 * en a, sinon depuis la position du dossier dans le cycle de vie
 * (Nouveau → Clôturé). Les tâches individuelles restent consultables dans
 * l'onglet "Tâches" du dossier lui-même (InvestigationDesk, inchangé) —
 * rien n'est supprimé, ce registre change seulement de niveau d'agrégation.
 */
import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Language, AlertRecord, UserProfile, AlertStatus } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { DataTable, DataTableColumn, MiniHBarList, HBarDatum } from './ui';
import { AlertStatusBucket, getAlertStatusBucket } from '../domain/alertStatusBuckets';
import { formatCountryLabel } from '../data/activaConfig';

interface TasksRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des investigations) ===
// Position de chaque statut réel dans le cycle de vie (0-100), utilisée
// UNIQUEMENT en repli pour un dossier sans tâche interne enregistrée —
// jamais présentée comme plus précise qu'une estimation par étape.
const STAGE_PROGRESS: Record<AlertStatus, number> = {
  new: 10,
  under_review: 35,
  investigation: 60,
  reopened: 50,
  corrective_action: 85,
  closed: 100,
  archived: 100,
};

function estimateProgress(alert: AlertRecord): number {
  const tasks = alert.tasks ?? [];
  if (tasks.length > 0) {
    const done = tasks.filter((t) => t.status === 'completed').length;
    return Math.round((done / tasks.length) * 100);
  }
  return STAGE_PROGRESS[alert.status];
}

export const TasksRegistry: React.FC<TasksRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  const [bucketFilter, setBucketFilter] = useState<AlertStatusBucket | 'all'>('all');

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  const visibleAlerts = useVisibleAlerts(alerts, activeUser);

  const bucketCounts: Record<AlertStatusBucket | 'all', number> = {
    all: visibleAlerts.length,
    a_traiter: visibleAlerts.filter((a) => getAlertStatusBucket(a.status) === 'a_traiter').length,
    en_cours: visibleAlerts.filter((a) => getAlertStatusBucket(a.status) === 'en_cours').length,
    en_attente: visibleAlerts.filter((a) => getAlertStatusBucket(a.status) === 'en_attente').length,
    clotures: visibleAlerts.filter((a) => getAlertStatusBucket(a.status) === 'clotures').length,
    rejetes: 0,
  };
  const rows = bucketFilter === 'all' ? visibleAlerts : visibleAlerts.filter((a) => getAlertStatusBucket(a.status) === bucketFilter);

  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === taux de clôture par
  // pays — calculé depuis le champ `country` déjà réel de chaque dossier
  // (libellé d'affichage existant, pas `countryId` — cohérent avec le
  // reste de l'app qui affiche ce même champ partout ailleurs).
  const closureByCountry: HBarDatum[] = Object.entries(
    visibleAlerts.reduce<Record<string, { total: number; closed: number }>>((acc, a) => {
      const key = a.country || '—';
      acc[key] = acc[key] ?? { total: 0, closed: 0 };
      acc[key].total += 1;
      if (a.status === 'closed' || a.status === 'archived') acc[key].closed += 1;
      return acc;
    }, {})
  )
    .map(([country, { total, closed }]) => ({ label: country, value: total > 0 ? Math.round((closed / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const columns: DataTableColumn<AlertRecord>[] = [
    {
      key: 'tracking',
      header: t.cp_col_case_id,
      render: (a) => <span className="font-mono text-[11px] font-bold text-slate-900">{a.trackingNumber}</span>,
    },
    {
      key: 'country',
      header: t.reg_col_country,
      render: (a) => <span className="text-slate-700">{formatCountryLabel(storage.getCountries(), a.country)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: t.cp_col_status,
      render: (a) => <span className="text-slate-700">{t[`status_${a.status}` as keyof typeof t] ?? a.status}</span>,
    },
    {
      key: 'progress',
      header: t.reg_col_progress,
      render: (a) => {
        const pct = estimateProgress(a);
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <span
                className={`block h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-[11px] font-bold text-slate-700 w-9 text-right">{pct}%</span>
          </div>
        );
      },
    },
    {
      key: 'comment',
      header: t.reg_col_comment,
      render: (a) => {
        const latest = [...a.internalNotes].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
        return latest ? (
          <span className="text-[11px] text-slate-600 line-clamp-2">{latest.content}</span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">{t.reg_col_comment_empty}</span>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'corrective',
      header: t.reg_col_corrective_short,
      render: (a) => {
        const measures = a.correctiveMeasures ?? [];
        if (measures.length === 0) return <span className="text-[11px] text-slate-400">—</span>;
        const verified = measures.filter((m) => m.status === 'verified').length;
        return (
          <span className="text-[11px] font-semibold text-slate-700">
            {measures.length} ({verified} {t.reg_col_corrective_verified})
          </span>
        );
      },
      hideOnMobile: true,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-700" />
          {t.reg_investigations_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_investigations_subtitle}</p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === taux de clôture par pays */}
      {closureByCountry.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">{t.reg_closure_rate_by_country}</p>
          <MiniHBarList data={closureByCountry} color="#16a34a" />
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {(
          [
            ['all', t.db_bucket_tous],
            ['a_traiter', t.db_bucket_a_traiter],
            ['en_cours', t.db_bucket_en_cours],
            ['en_attente', t.db_bucket_en_attente],
            ['clotures', t.db_bucket_clotures],
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
            {label} ({bucketCounts[bucket]})
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => a.id}
        onRowClick={(a) => onOpenCase(a.trackingNumber)}
        emptyTitle={t.reg_tasks_empty}
      />
    </div>
  );
};
