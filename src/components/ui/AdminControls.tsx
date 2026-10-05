/**
 * === AMÉLIORATION AJOUTÉE (écrans d'administration aérés) ===
 *
 * Petites briques d'interface communes aux écrans de réglages, pour
 * remplacer les grilles de cases à cocher par des contrôles plus lisibles :
 * - `SegmentedTabs` : onglets en pastilles (une partie des réglages à la fois) ;
 * - `PillToggle`    : pastille cliquable (sélectionnée / non sélectionnée) ;
 * - `Switch`        : interrupteur activé / désactivé ;
 * - `ChipListInput` : liste d'éléments (adresses, mots-clés) sous forme
 *   d'étiquettes supprimables + champ d'ajout (Entrée ou virgule) ;
 * - `SaveBar`       : barre d'enregistrement collante, avec indication des
 *   modifications non enregistrées.
 * Purement présentationnel : aucune logique métier.
 */
import React, { useState } from 'react';
import { Check, Plus, Save, X } from 'lucide-react';

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
}: {
  tabs: SegmentedTab<K>[];
  value: K;
  onChange: (k: K) => void;
  idPrefix: string;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-slate-100/80 border border-slate-200">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            id={`${idPrefix}-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
              active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            {tab.icon && <span className={active ? 'text-blue-600' : 'text-slate-400'}>{tab.icon}</span>}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export const PillToggle: React.FC<{
  id?: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
  tone?: 'blue' | 'amber' | 'emerald' | 'violet' | 'rose';
  children: React.ReactNode;
}> = ({ id, selected, onToggle, disabled, title, tone = 'blue', children }) => {
  const on: Record<string, string> = {
    blue: 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25',
    amber: 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/25',
    emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/25',
    violet: 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/25',
    rose: 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-600/25',
  };
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={selected}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all duration-300 disabled:cursor-not-allowed ${
        disabled
          ? 'bg-slate-50 border-dashed border-slate-200 text-slate-400'
          : selected
            ? on[tone]
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {selected && !disabled && <Check className="w-3 h-3" strokeWidth={3} />}
      {children}
    </button>
  );
};

export const Switch: React.FC<{ id?: string; checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }> = ({
  id,
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </span>
    {label && <span>{label}</span>}
  </button>
);

export const ChipListInput: React.FC<{
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  mono?: boolean;
  isInvalid?: (v: string) => boolean;
  /** Séparateurs acceptés à la saisie (par défaut : Entrée, virgule, point-virgule). */
  splitOnComma?: boolean;
}> = ({ id, values, onChange, placeholder, mono, isInvalid, splitOnComma = true }) => {
  const [draft, setDraft] = useState('');
  const commit = (raw: string) => {
    const parts = raw
      .split(splitOnComma ? /[\n;,]+/ : /[\n;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-300">
      {values.map((v) => {
        const bad = isInvalid?.(v);
        return (
          <span
            key={v}
            className={`group inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-[11px] font-medium border ${
              bad ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'
            } ${mono ? 'font-mono' : ''}`}
          >
            {v}
            <button
              type="button"
              aria-label={`Retirer ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}
      <div className="flex items-center gap-1 flex-1 min-w-[180px]">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (splitOnComma && e.key === ',') || e.key === ';') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[\n;,]/.test(text)) {
              e.preventDefault();
              commit(text);
            }
          }}
          className={`flex-1 min-w-0 px-2 py-1 text-xs bg-transparent outline-none placeholder:text-slate-400 ${mono ? 'font-mono' : ''}`}
        />
        {draft.trim() && (
          <button type="button" onClick={() => commit(draft)} className="p-1 rounded-md text-blue-600 hover:bg-blue-50" aria-label="Ajouter">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export const SaveBar: React.FC<{
  dirty: boolean;
  onSave: () => void;
  disabled?: boolean;
  saveLabel?: string;
  dirtyLabel?: string;
  cleanLabel?: string;
  id?: string;
  type?: 'button' | 'submit';
}> = ({ dirty, onSave, disabled, saveLabel = 'Enregistrer', dirtyLabel = 'Modifications non enregistrées', cleanLabel = 'Tout est enregistré', id, type = 'button' }) => (
  <div className="sticky bottom-3 z-20 flex justify-end pointer-events-none">
    <div
      className={`pointer-events-auto inline-flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-2xl border backdrop-blur bg-white/90 shadow-[0_14px_40px_-18px_rgb(15_23_42/0.45)] transition-all duration-500 ${
        dirty ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${dirty ? 'text-amber-700' : 'text-slate-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
        {dirty ? dirtyLabel : cleanLabel}
      </span>
      <button
        id={id}
        type={type}
        onClick={type === 'button' ? onSave : undefined}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white text-xs font-bold transition"
      >
        <Save className="w-3.5 h-3.5" />
        {saveLabel}
      </button>
    </div>
  </div>
);
