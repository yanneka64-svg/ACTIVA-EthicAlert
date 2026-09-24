/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Troisième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx
 * (voir les PR précédentes pour le contexte général et les deux premières
 * étapes). Extraction de l'onglet "Organisation" (pays du Groupe) hors du
 * composant monolithique AdminConfigView.tsx, sans aucun changement de
 * comportement.
 *
 * Code strictement déplacé, pas réécrit : mêmes state/handlers/JSX (tableau
 * CRUD + modale Ajouter/Modifier) que l'ancien bloc
 * `{configTab === 'organization' && (...)}` + la modale `showCountryModal`
 * qui lui était associée. `countries`/`entities` (lus depuis storage.ts par
 * AdminConfigView, qui alimente aussi d'autres onglets avec les mêmes
 * données) et `activeUser` deviennent des props ; `flashBanner` devient la
 * prop `onSaved`, appelée exactement de la même façon.
 */
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Language, UserProfile } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { EntityDef, CountryDef } from '../../data/activaConfig';
import { storage } from '../../services/storage';

interface OrganizationCountriesTabProps {
  countries: CountryDef[];
  entities: EntityDef[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  lang?: Language;
}

export const OrganizationCountriesTab: React.FC<OrganizationCountriesTabProps> = ({ countries, entities, activeUser, onSaved, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // --- Countries CRUD state --- même motif que les Entités d'AdminConfigView.
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [editingCountryCode, setEditingCountryCode] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [countryFlag, setCountryFlag] = useState('');
  const [deleteCountryConfirmCode, setDeleteCountryConfirmCode] = useState<string | null>(null);
  const [deleteCountryError, setDeleteCountryError] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
  // --- Countries handlers ---
  const resetCountryForm = () => {
    setEditingCountryCode(null);
    setCountryCode('');
    setCountryName('');
    setCountryFlag('');
  };
  const openAddCountry = () => { resetCountryForm(); setShowCountryModal(true); };
  const openEditCountry = (c: CountryDef) => {
    setEditingCountryCode(c.code);
    setCountryCode(c.code);
    setCountryName(c.name);
    setCountryFlag(c.flag);
    setShowCountryModal(true);
  };
  const handleSaveCountry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryName.trim() || !countryCode.trim()) return;
    if (editingCountryCode) {
      storage.updateCountry(editingCountryCode, { name: countryName.trim(), flag: countryFlag.trim() || '🏳️' }, activeUser);
      onSaved(t.ctry_updated.replace('{name}', countryName.trim()));
    } else {
      const code = countryCode.trim().toUpperCase().slice(0, 4);
      if (countries.some((c) => c.code === code)) {
        alert(t.ctry_code_taken.replace('{code}', code));
        return;
      }
      storage.addCountry({ code, name: countryName.trim(), flag: countryFlag.trim() || '🏳️' }, activeUser);
      onSaved(t.ctry_added.replace('{name}', countryName.trim()));
    }
    setShowCountryModal(false);
  };
  const handleDeleteCountry = (c: CountryDef) => {
    const result = storage.deleteCountry(c.code, activeUser);
    setDeleteCountryConfirmCode(null);
    if (result.allowed) {
      setDeleteCountryError('');
      onSaved(t.ctry_deleted.replace('{name}', c.name));
    } else {
      setDeleteCountryError(result.reason ?? t.ctry_delete_refused);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {t.ctry_title.replace('{n}', String(countries.length))}
            </h3>
          </div>
          <button
            onClick={openAddCountry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> {t.ctry_add}
          </button>
        </div>

        {deleteCountryError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start gap-2">
            <span>{deleteCountryError}</span>
            <button onClick={() => setDeleteCountryError('')} className="ml-auto text-rose-500 hover:text-rose-700 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {countries.length === 0 ? (
          <p className="text-slate-400 text-center py-8">{t.ctry_none}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {countries.map((c) => {
              const entityCount = entities.filter((e) => e.country === c.name).length;
              return (
                <div key={c.code} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <span>{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{c.code} · {t.ctry_entity_count.replace('{n}', String(entityCount))}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditCountry(c)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title={t.btn_modify}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deleteCountryConfirmCode === c.code ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteCountry(c)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">{t.common_confirm}</button>
                        <button onClick={() => setDeleteCountryConfirmCode(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">{t.btn_cancel}</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteCountryConfirmCode(c.code)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title={t.common_delete}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 8 — évolution multi-pays/multi-entité) ===
          MODAL: ADD/EDIT COUNTRY */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCountryCode ? t.ctry_edit : t.ctry_add}
              </h3>
            </div>
            <form onSubmit={handleSaveCountry} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ctry_code_req}</label>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.ctry_code_ph}) */
                  maxLength={4}
                  disabled={!!editingCountryCode}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                {editingCountryCode && (
                  <p className="text-[10px] text-slate-400 mt-1">{t.ctry_code_hint}</p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ctry_name_req}</label>
                <input type="text" value={countryName} onChange={(e) => setCountryName(e.target.value)} /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.ctry_name_ph}) */ className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ent_flag_emoji}</label>
                <input type="text" value={countryFlag} onChange={(e) => setCountryFlag(e.target.value)} placeholder="🇸🇳" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" maxLength={8} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCountryModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingCountryCode ? t.users_save : t.users_add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
