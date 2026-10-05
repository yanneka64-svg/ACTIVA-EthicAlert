/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Quatrième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx —
 * voir les PR précédentes (#90, #91, #92) pour le contexte général et les
 * étapes déjà faites. Extraction de l'onglet "Entités et filiales" hors du
 * composant monolithique AdminConfigView.tsx, sans aucun changement de
 * comportement.
 *
 * Code strictement déplacé, pas réécrit : mêmes state/handlers/JSX (grille
 * CRUD + modale Ajouter/Modifier) que l'ancien bloc
 * `{configTab === 'entities' && (...)}` + la modale `showEntityModal` qui
 * lui était associée. `entities`/`countries` (lus depuis storage.ts par
 * AdminConfigView, qui alimente aussi d'autres onglets avec les mêmes
 * données) et `activeUser` deviennent des props ; `flashBanner` devient la
 * prop `onSaved`. `slugify` (partagé par 3 autres onglets non encore
 * extraits — recipients/categories/users) reste défini dans AdminConfigView
 * et est passé en prop plutôt que dupliqué.
 */
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) ===
import { AdminPageHeader, SearchField } from '../ui/AdminControls';
import { Language, UserProfile } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { EntityDef, CountryDef } from '../../data/activaConfig';
import { storage } from '../../services/storage';

interface EntitiesTabProps {
  entities: EntityDef[];
  countries: CountryDef[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  slugify: (name: string) => string;
  lang?: Language;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ entities, countries, activeUser, onSaved, slugify, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  // --- Entities CRUD state ---
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityCountry, setEntityCountry] = useState('');
  const [entityFlag, setEntityFlag] = useState('');
  // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
  // Code de numérotation des dossiers (préfixe du format XX-YY-MM-XXXX,
  // voir storage.generateCaseNumber) — éditable ici car c'est la DARC
  // Groupe, pas le code, qui fait autorité sur sa valeur officielle.
  const [entityCode, setEntityCode] = useState('');
  const [deleteEntityConfirmId, setDeleteEntityConfirmId] = useState<string | null>(null);

  // --- Entities handlers ---
  const resetEntityForm = () => {
    setEditingEntityId(null);
    setEntityName('');
    setEntityCountry('');
    setEntityFlag('');
    setEntityCode('');
  };
  const openAddEntity = () => { resetEntityForm(); setShowEntityModal(true); };
  const openEditEntity = (ent: EntityDef) => {
    setEditingEntityId(ent.id);
    setEntityName(ent.name);
    setEntityCountry(ent.country);
    setEntityFlag(ent.flag);
    setEntityCode(ent.code);
    setShowEntityModal(true);
  };
  const handleSaveEntity = (e: React.FormEvent) => {
    e.preventDefault();
    // === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
    // Validation stricte : le code alimente directement le numéro de
    // dossier officiel (storage.generateCaseNumber) — 2 à 6 lettres
    // majuscules uniquement, jamais vide.
    const normalizedCode = entityCode.trim().toUpperCase();
    if (!entityName.trim() || !entityCountry.trim() || !/^[A-Z]{2,6}$/.test(normalizedCode)) return;
    if (editingEntityId) {
      storage.updateEntity(editingEntityId, { name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️', code: normalizedCode }, activeUser);
      onSaved(t.ent_updated.replace('{name}', entityName.trim()));
    } else {
      const id = `ent-${slugify(entityName)}-${Date.now().toString(36)}`;
      storage.addEntity({ id, name: entityName.trim(), country: entityCountry.trim(), flag: entityFlag.trim() || '🏳️', code: normalizedCode }, activeUser);
      onSaved(t.ent_added.replace('{name}', entityName.trim()));
    }
    setShowEntityModal(false);
  };
  const handleDeleteEntity = (ent: EntityDef) => {
    storage.deleteEntity(ent.id, activeUser);
    setDeleteEntityConfirmId(null);
    onSaved(t.ent_deleted.replace('{name}', ent.name));
  };

  // === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) ===
  // Recherche (affichage seulement).
  const [entQuery, setEntQuery] = useState('');
  const eq = entQuery.trim().toLowerCase();
  const shownEntities = entities.filter((e) => !eq || [e.name, e.country, e.code].some((v) => (v ?? '').toLowerCase().includes(eq)));
  const countryCount = new Set(entities.map((e) => e.country)).size;

  return (
    <>
      {/* === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) ===
          en-tête avec icône, recherche, pays et code dossier
          mis en avant sur chaque carte. Mêmes actions (modifier, supprimer). */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5 text-xs">
        <AdminPageHeader
          icon={<Building2 />}
          tone="violet"
          title={t.ent_title.replace('{n}', String(entities.length))}
          subtitle={(t.ent_subtitle || '').replace('{n}', String(entities.length)).replace('{c}', String(countryCount))}
          actions={
            <>
              <SearchField id="entities-search" value={entQuery} onChange={setEntQuery} placeholder={t.ent_search_ph} />
              <button
                onClick={openAddEntity}
                className="activa-shine inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-md shadow-blue-600/25 transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> {t.ent_add}
              </button>
            </>
          }
        />
        {entities.length === 0 ? (
          <p className="text-slate-400 text-center py-8">{t.ent_none}</p>
        ) : shownEntities.length === 0 ? (
          <p className="text-slate-400 text-center py-8">{t.adm_no_result}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shownEntities.map((ent) => (
              <div
                key={ent.id}
                className="group flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_30px_-20px_rgb(76_29_149/0.45)]"
              >
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200/70 flex items-center justify-center shrink-0 font-mono font-bold text-[11px]">
                  {ent.flag}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] text-[#0B2545] truncate">{ent.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
                    <span className="truncate">{ent.country}</span>
                    <span className="text-slate-300">·</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#0B2545] text-white font-mono font-bold text-[10px] tracking-wide" title={t.ent_case_code}>{ent.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditEntity(ent)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600" title={t.btn_modify}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteEntityConfirmId === ent.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteEntity(ent)} className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px]">{t.common_confirm}</button>
                      <button onClick={() => setDeleteEntityConfirmId(null)} className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[10px]">{t.btn_cancel}</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteEntityConfirmId(ent.id)} className="p-2 rounded-xl hover:bg-rose-50 text-rose-600" title={t.common_delete}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD/EDIT ENTITY */}
      {showEntityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingEntityId ? t.ent_edit : t.ent_add}
              </h3>
            </div>
            <form onSubmit={handleSaveEntity} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ent_name_req}</label>
                <input type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)} /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.ent_name_ph}) */ className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ent_country_req}</label>
                <select value={entityCountry} onChange={(e) => setEntityCountry(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white" required>
                  <option value="">{t.ent_select_country}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ent_flag_emoji}</label>
                <input type="text" value={entityFlag} onChange={(e) => setEntityFlag(e.target.value)} placeholder="🇧🇯" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" maxLength={8} />
              </div>
              {/* === AMÉLIORATION AJOUTÉE (numérotation officielle des
                  dossiers) === code utilisé comme préfixe du numéro de
                  dossier officiel (ex. AARDC-26-09-0001). */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.ent_code_req}</label>
                <input
                  type="text"
                  value={entityCode}
                  onChange={(e) => setEntityCode(e.target.value.toUpperCase())}
                  /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.ent_code_ph}) */
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono uppercase"
                  maxLength={6}
                  pattern="[A-Za-z]{2,6}"
                  title={t.ent_code_title}
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">{t.ent_code_hint}</p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEntityModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingEntityId ? t.users_save : t.users_add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
