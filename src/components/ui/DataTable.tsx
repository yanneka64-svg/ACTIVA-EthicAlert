/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 *
 * Generic responsive data table (brief §21/§43): a real `<table>` on
 * desktop, a stacked card list on small screens (no horizontal table
 * overflow on mobile). Rows are clickable as a whole (brief §21's "tables
 * must navigate to case details").
 *
 * Deliberately generic (`columns` + `getRowKey`) rather than case-specific,
 * so Phase 6 (case list), Phase 5 (investigator workload table), and any
 * admin list (Phase 7) all share one implementation instead of three
 * near-duplicate tables.
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  // Hidden on the mobile card view when true — for dense/secondary columns.
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyDescription?: string;
}

export function DataTable<T>({ columns, rows, getRowKey, onRowClick, emptyTitle, emptyDescription }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              {/* === AMÉLIORATION AJOUTÉE (alignement des tableaux) === BUG
                  PRÉEXISTANT CORRIGÉ : un en-tête plus long que les autres
                  (ex. "Clôturé le") passait sur 2 lignes alors que ses
                  voisins restaient sur 1, désalignant toute la ligne d'en-
                  têtes. `whitespace-nowrap` + `align-middle` explicite sur
                  chaque cellule d'en-tête, pour toutes les tables de
                  l'application (composant générique) — la colonne
                  contenante défile déjà horizontalement au besoin
                  (`overflow-x-auto` sur le conteneur). */}
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 text-left align-middle font-bold text-slate-600 uppercase tracking-wide text-[10px] whitespace-nowrap">
                  {col.header}
                </th>
              ))}
              {onRowClick && <th className="px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
              >
                {/* === AMÉLIORATION AJOUTÉE (bien ranger les données —
                    lignes de tableau) === BUG PRÉEXISTANT CORRIGÉ, même
                    cause que le correctif d'alignement des en-têtes
                    ci-dessus (déjà `whitespace-nowrap`) : une cellule au
                    contenu plus long qu'une autre (ex. libellé de catégorie)
                    passait sur 2-4 lignes alors que ses voisines restaient
                    sur 1, rendant la hauteur de chaque ligne irrégulière et
                    le tableau visuellement désordonné. `whitespace-nowrap`
                    uniformise toutes les cellules sur une seule ligne — le
                    conteneur défile déjà horizontalement au besoin
                    (`overflow-x-auto` ci-dessus), pour toutes les tables de
                    l'application (composant générique). */}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 align-middle whitespace-nowrap">
                    {col.render(row)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="px-2 py-3 text-slate-300">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-1.5 ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col) => (
                <div key={col.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 font-semibold shrink-0">{col.header}</span>
                  <span className="text-slate-800 text-right">{col.render(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
