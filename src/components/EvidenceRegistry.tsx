/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Preuves" (mockup: groupe INVESTIGATION). Agrège
 * `AlertRecord.evidences` de tous les dossiers visibles par l'utilisateur —
 * données réelles déjà persistées par `AlertSubmissionFlow`/`InvestigationDesk`,
 * jamais fabriquées. Renvoie vers le dossier concerné en un clic.
 *
 * === AMÉLIORATION AJOUTÉE (Retours visuels — refonte "Preuves & pièces
 * jointes") ===
 * Sur retour utilisateur détaillé (capture de référence) : cet écran est
 * entièrement repensé — table riche (Nom du fichier/Référence du dossier/
 * Description/Source/Ajouté par/Date d'ajout/Taille/Actions), filtres par
 * dossier/personne/période, pagination. Les anciens onglets de filtre par
 * type de fichier (Documents/Images/Autres) sont retirés — remplacés par
 * les filtres ci-dessus, demandés explicitement. Les panneaux latéraux
 * "Bonnes pratiques"/"Espace de stockage" d'un premier passage ont ensuite
 * été retirés à leur tour, sur retour utilisateur suivant (2ᵉ capture de
 * référence) — le tableau reprend toute la largeur.
 *
 * Convention i18n : comme `AdvancedSearchView.tsx`/`OperatorCaseDesk.tsx`
 * (même précédent déjà établi dans ce code pour ce type d'écran) : seuls le
 * titre, le sous-titre et l'état vide passent par `TRANSLATIONS` (clés déjà
 * existantes) — les libellés de filtres/colonnes/panneaux, nouveaux pour
 * cette refonte, restent des chaînes françaises en dur.
 *
 * === AMÉLIORATION AJOUTÉE (Retours visuels — colonnes réelles) === Les
 * colonnes "Description"/"Ajouté par" viennent de 2 nouveaux champs
 * optionnels sur `EvidenceFile` (types.ts) — `uploadedBy` est renseigné dès
 * maintenant (InvestigationDesk.handleAddEvidenceFile, seul point de dépôt
 * côté staff), `description` ne l'est pas encore (aucun champ de saisie ne
 * la collecte à ce jour) : ni l'un ni l'autre n'est fabriqué pour un
 * document existant qui en est dépourvu — affiché honnêtement "—" (brief
 * §32). "Source" est dérivée du même champ (`uploadedBy` renseigné =
 * "Collecté" par un membre du staff), jamais un troisième champ inventé.
 * Télécharger/Aperçu utilisent le vrai `dataUrl` déjà stocké — désactivés,
 * jamais fantômes, pour les preuves de démonstration qui n'en ont pas.
 */
import React, { useEffect, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, File as FileIcon, Search, Download, Eye, ExternalLink } from 'lucide-react';
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
// Icône par type de fichier, dérivée du MIME type déjà réel
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

// Filtre "Date d'ajout" par fenêtre glissante — même motif que le filtre
// période déjà réel de ReportingDashboard.tsx.
type DateBucket = 'all' | '7d' | '30d' | '90d';
const DATE_BUCKET_DAYS: Record<Exclude<DateBucket, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const EvidenceRegistry: React.FC<EvidenceRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  // === AMÉLIORATION AJOUTÉE (Retours visuels — refonte "Preuves & pièces
  // jointes") === filtres par dossier/personne/période + recherche libre,
  // remplacent les anciens onglets par type de fichier.
  const [search, setSearch] = useState('');
  const [caseFilter, setCaseFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateBucket>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

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

  // Options de filtre dérivées des données réellement présentes — jamais
  // une liste fabriquée.
  const caseOptions = Array.from(new Set(allRows.map((r) => r.alert.trackingNumber))).sort();
  const personOptions = Array.from(new Set(allRows.map((r) => r.evidence.uploadedBy).filter((v): v is string => !!v))).sort();

  const rows = allRows.filter((r) => {
    if (caseFilter !== 'all' && r.alert.trackingNumber !== caseFilter) return false;
    if (personFilter !== 'all' && r.evidence.uploadedBy !== personFilter) return false;
    if (dateFilter !== 'all') {
      const days = DATE_BUCKET_DAYS[dateFilter];
      if (new Date(r.evidence.uploadedAt).getTime() < Date.now() - days * 24 * 3600 * 1000) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = r.evidence.name.toLowerCase().includes(q);
      const matchDesc = (r.evidence.description ?? '').toLowerCase().includes(q);
      const matchCase = r.alert.trackingNumber.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCase) return false;
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, caseFilter, personFilter, dateFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // === AMÉLIORATION AJOUTÉE (Retours visuels — refonte "Preuves & pièces
  // jointes") === Télécharger/Aperçu réutilisent le `dataUrl` déjà réel
  // (stocké en base64 à l'upload) — aucun des deux boutons n'agit quand ce
  // fichier de démonstration n'en a pas (jamais un bouton fantôme).
  const handleDownload = (r: EvidenceRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!r.evidence.dataUrl) return;
    const link = document.createElement('a');
    link.href = r.evidence.dataUrl;
    link.download = r.evidence.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleView = (r: EvidenceRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!r.evidence.dataUrl) return;
    window.open(r.evidence.dataUrl, '_blank', 'noopener,noreferrer');
  };

  const columns: DataTableColumn<EvidenceRow>[] = [
    {
      key: 'name',
      header: t.ev_col_file,
      render: (r) => (
        <span className="font-semibold text-slate-900 flex items-center gap-2 max-w-[200px]" title={r.evidence.name}>
          {iconOfBucket(bucketOfType(r.evidence.type))}
          <span className="truncate">{r.evidence.name}</span>
        </span>
      ),
    },
    {
      key: 'case',
      header: t.cp_col_case_id,
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.alert.trackingNumber}</span>,
    },
    {
      key: 'description',
      header: t.ev_col_desc,
      render: (r) => <span className="text-[11px] text-slate-600">{r.evidence.description ?? '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'source',
      header: t.ev_col_source,
      render: (r) => <span className="text-[11px] text-slate-500">{r.evidence.uploadedBy ? 'Collecté' : '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'uploadedBy',
      header: t.ev_col_added_by,
      render: (r) => <span className="text-[11px] text-slate-700">{r.evidence.uploadedBy ?? '—'}</span>,
    },
    {
      key: 'date',
      header: t.ev_col_date,
      render: (r) => {
        const d = new Date(r.evidence.uploadedAt);
        return (
          <span className="text-[11px] text-slate-600 whitespace-nowrap">
            {d.toLocaleDateString(lang)} {d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'size',
      header: t.ev_col_size,
      render: (r) => formatSize(r.evidence.size),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: t.cat_col_actions,
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleDownload(r, e)}
            disabled={!r.evidence.dataUrl}
            title={r.evidence.dataUrl ? t.common_download : t.ev_file_unavailable}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => handleView(r, e)}
            disabled={!r.evidence.dataUrl}
            title={r.evidence.dataUrl ? t.ev_preview : t.ev_file_unavailable}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenCase(r.alert.trackingNumber); }}
            title={t.ev_open_case}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
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

      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — capture de référence)
          === panneaux "Bonnes pratiques"/"Espace de stockage" retirés sur
          demande explicite — la grille à 2 colonnes qui leur faisait de la
          place disparaît avec eux, le tableau reprend toute la largeur. */}
      <div className="space-y-4">
          {/* === AMÉLIORATION AJOUTÉE (Retours visuels) === filtres dossier/personne/date */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.ev_search_ph}
                className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
              />
            </div>
            <select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 text-xs">
              <option value="all">{t.ev_all_cases}</option>
              {caseOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 text-xs">
              <option value="all">{t.ev_all_people}</option>
              {personOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateBucket)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 text-xs">
              <option value="all">{t.ev_all_dates}</option>
              <option value="7d">{t.ev_last_7}</option>
              <option value="30d">{t.ev_last_30}</option>
              <option value="90d">{t.ev_last_90}</option>
            </select>
          </div>

          {/* === AMÉLIORATION AJOUTÉE (correctif — colonne fantôme en bout de
              tableau) === BUG PRÉEXISTANT CORRIGÉ : `onRowClick` faisait
              ajouter par DataTable (générique) un chevron de fin de ligne en
              plus de la colonne "Actions" déjà propre à cet écran (dont le
              bouton "Ouvrir le dossier", ExternalLink, fait exactement la
              même chose) — un doublon visuel, sans en-tête, qui flottait
              après la dernière colonne réelle. Aucun autre écran de ce type
              (Tâches, Mesures correctives) ne cumule les deux ; ici, la
              colonne Actions suffit déjà à ouvrir le dossier. */}
          <DataTable
            columns={columns}
            rows={pagedRows}
            getRowKey={(r) => r.evidence.id}
            emptyTitle={t.reg_evidence_empty}
          />

          {/* === AMÉLIORATION AJOUTÉE (Retours visuels) === pagination réelle */}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
              <span>
                {t.ev_showing.replace('{from}', String((currentPage - 1) * pageSize + 1)).replace('{to}', String(Math.min(currentPage * pageSize, rows.length))).replace('{total}', String(rows.length))}
              </span>
              <div className="flex items-center gap-3">
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded-lg bg-white text-[11px]">
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{t.ev_per_page.replace('{n}', String(n))}</option>
                  ))}
                </select>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                    >
                      ‹
                    </button>
                    <span className="px-1 font-semibold text-slate-700">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
