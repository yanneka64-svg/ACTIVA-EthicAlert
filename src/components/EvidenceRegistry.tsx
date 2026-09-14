/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Preuves" (mockup: groupe INVESTIGATION). Agrège
 * `AlertRecord.evidences` de tous les dossiers visibles par l'utilisateur —
 * données réelles déjà persistées par `AlertSubmissionFlow`/`InvestigationDesk`,
 * jamais fabriquées. Renvoie vers le dossier concerné en un clic.
 *
 * === AMÉLIORATION AJOUTÉE (Repère visuel — Preuves & Pièces jointes) ===
 * Ajout des onglets de filtre par type de fichier (Toutes/Documents/
 * Images/Autres) et d'une icône par type, façon maquette. Choix délibéré à
 * signaler, même raisonnement que pour l'écran Tâches (voir
 * TasksRegistry.tsx) : le bouton "+ Ajouter un fichier" de la maquette
 * n'est PAS ajouté ici — verser une preuve exige de choisir un dossier, et
 * ce sélecteur n'existe pas sur cet écran transverse ; l'ajout réel reste
 * pleinement fonctionnel depuis l'onglet "Preuves" d'un dossier ouvert
 * (InvestigationDesk, inchangé). Aucun bouton non fonctionnel ajouté
 * (brief §32).
 */
import React, { useEffect, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { Language, AlertRecord, UserProfile, EvidenceFile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
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

// === AMÉLIORATION AJOUTÉE (Repère visuel — Preuves & Pièces jointes) ===
// Classement en 3 catégories façon maquette, dérivé du MIME type déjà réel
// (`EvidenceFile.type`) — jamais un champ fabriqué.
type EvidenceBucket = 'documents' | 'images' | 'autres';
function bucketOfType(mime: string): EvidenceBucket {
  if (mime.startsWith('image/')) return 'images';
  if (
    mime.startsWith('application/pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.startsWith('text/')
  ) {
    return 'documents';
  }
  return 'autres';
}
function iconOfBucket(bucket: EvidenceBucket) {
  if (bucket === 'images') return <ImageIcon className="w-4 h-4 text-purple-500 shrink-0" />;
  if (bucket === 'documents') return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
  return <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />;
}

export const EvidenceRegistry: React.FC<EvidenceRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Preuves & Pièces jointes) ===
  const [bucketFilter, setBucketFilter] = useState<EvidenceBucket | 'all'>('all');

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // Remplace le filtre dupliqué (rôle assigné) par le hook partagé, qui
  // applique en plus le périmètre pays/entité et la confidentialité — voir
  // src/hooks/useVisibleAlerts.ts.
  const visibleAlerts = useVisibleAlerts(alerts, activeUser);

  const allRows: EvidenceRow[] = visibleAlerts
    .flatMap((alert) => (alert.evidences ?? []).map((evidence) => ({ evidence, alert })))
    .sort((a, b) => new Date(b.evidence.uploadedAt).getTime() - new Date(a.evidence.uploadedAt).getTime());

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Preuves & Pièces jointes) ===
  const bucketCounts: Record<EvidenceBucket | 'all', number> = {
    all: allRows.length,
    documents: allRows.filter((r) => bucketOfType(r.evidence.type) === 'documents').length,
    images: allRows.filter((r) => bucketOfType(r.evidence.type) === 'images').length,
    autres: allRows.filter((r) => bucketOfType(r.evidence.type) === 'autres').length,
  };
  const rows = bucketFilter === 'all' ? allRows : allRows.filter((r) => bucketOfType(r.evidence.type) === bucketFilter);

  const columns: DataTableColumn<EvidenceRow>[] = [
    {
      key: 'name',
      header: t.reg_col_name,
      render: (r) => (
        <span className="font-semibold text-slate-900 break-all flex items-center gap-2">
          {iconOfBucket(bucketOfType(r.evidence.type))}
          {r.evidence.name}
        </span>
      ),
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
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-blue-700" />
          {t.reg_evidence_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_evidence_subtitle}</p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Preuves & Pièces jointes) === */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {(
          [
            ['all', t.db_bucket_tous],
            ['documents', t.evidence_bucket_documents],
            ['images', t.evidence_bucket_images],
            ['autres', t.evidence_bucket_autres],
          ] as [EvidenceBucket | 'all', string][]
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
        getRowKey={(r) => r.evidence.id}
        onRowClick={(r) => onOpenCase(r.alert.trackingNumber)}
        emptyTitle={t.reg_evidence_empty}
      />
    </div>
  );
};
