/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Constante partagée par le tableau et le panneau Boîte de réception.
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import { NocaThreshold } from '../../types';

export const NOCA_TONE: Record<NocaThreshold, string> = {
  'NOCA 1': 'bg-slate-100 text-slate-700 border-slate-200',
  'NOCA 2': 'bg-amber-100 text-amber-800 border-amber-200',
  'NOCA 3': 'bg-orange-100 text-orange-800 border-orange-200',
  'NOCA 4': 'bg-rose-100 text-rose-800 border-rose-200',
};
