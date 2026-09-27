/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Badge de confidentialité (+ ses libellés de repli), partagé par le
 * tableau et le panneau Boîte de réception.
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import React from 'react';
import { Lock } from 'lucide-react';
import { Language } from '../../types';
import { ConfidentialityLevel } from '../../domain/caseTypes';
import { TRANSLATIONS } from '../../i18n/translations';

const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = { standard: 'Standard', restricted: 'Restreint', confidential: 'Confidentiel', highly_confidential: 'Très confidentiel' };

// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2) === même repli que
// `InvestigationDesk.getConfidentialityBadge` — rien pour standard/restreint
// (jamais alarmant par défaut), un badge discret sinon.
// === AMÉLIORATION AJOUTÉE : libellé traduit (lang optionnel, FR par défaut) ===
export function ConfidentialityBadge({ level, lang = 'fr' }: { level?: ConfidentialityLevel; lang?: Language }) {
  const tr = TRANSLATIONS[lang];
  const lvl = level ?? 'restricted';
  if (lvl === 'restricted' || lvl === 'standard') return null;
  const style = lvl === 'highly_confidential' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${style}`} title={tr.desk_confidentiality_level}>
      <Lock className="w-2.5 h-2.5" />
      {({ standard: tr.op_conf_standard, restricted: tr.op_conf_restricted, confidential: tr.desk_confidential, highly_confidential: tr.confidentiality_highly_confidential } as Record<ConfidentialityLevel, string>)[lvl] ?? CONFIDENTIALITY_LABELS[lvl]}
    </span>
  );
}
