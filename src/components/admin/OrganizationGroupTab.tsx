/**
 * === AMÉLIORATION AJOUTÉE (Organisation du Groupe — pays et entités réunis) ===
 *
 * Proposition A choisie par l'utilisateur : un seul écran « Organisation du
 * Groupe » au lieu de deux (« Organisation » pour les pays, « Entités du
 * Groupe » pour les entités).
 * - à gauche : la liste des pays avec leur nombre d'entités ;
 * - à droite : le pays choisi, ses repères (entités, comptes rattachés) et ses
 *   entités avec leur code dossier et un exemple de numéro ;
 * - « Ajouter une entité » préremplit le pays choisi.
 *
 * Mêmes opérations et mêmes règles qu'avant (storage.add/update/deleteCountry,
 * add/update/deleteEntity ; code pays ≤ 4 lettres non modifiable ; code
 * dossier 2 à 6 lettres majuscules ; suppression d'un pays refusée tant qu'il
 * est utilisé). Les deux anciens écrans restent dans le code
 * (OrganizationCountriesTab, EntitiesTab).
 */
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Globe2, Building2, Users, ChevronRight, Hash } from 'lucide-react';
import { Language, UserProfile } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';
import { EntityDef, CountryDef } from '../../data/activaConfig';
import { storage } from '../../services/storage';
import { AdminPageHeader, SearchField } from '../ui/AdminControls';

interface OrganizationGroupTabProps {
  countries: CountryDef[];
  entities: EntityDef[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  slugify: (name: string) => string;
  lang?: Language;
}

export const OrganizationGroupTab: React.FC<OrganizationGroupTabProps> = ({ countries, entities, activeUser, onSaved, slugify, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  const [selectedCode, setSelectedCode] = useState<string>(countries[0]?.code ?? '');
  const [query, setQuery] = useState('');

  // --- Pays ---
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [editingCountryCode, setEditingCountryCode] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [countryFlag, setCountryFlag] = useState('');
  const [deleteCountryConfirm, setDeleteCountryConfirm] = useState(false);
  const [deleteCountryError, setDeleteCountryError] = useState('');

  // --- Entités ---
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityCountry, setEntityCountry] = useState('');
  const [entityFlag, setEntityFlag] = useState('');
  const [entityCode, setEntityCode] = useState('');
  const [deleteEntityConfirmId, setDeleteEntityConfirmId] = useState<string | null>(null);

  // Pays choisi toujours valide (ajout / suppression de pays).
  useEffect(() => {
    if (!countries.some((c) => c.code === selectedCode)) setSelectedCode(countries[0]?.code ?? '');
  }, [countries, selectedCode]);

  const q = query.trim().toLowerCase();
  const entitiesOf = (c: CountryDef) => entities.filter((e) => e.country === c.name);
  const entityMatches = (e: EntityDef) => !q || [e.name, e.code].some((v) => (v ?? '').toLowerCase().includes(q));
  const shownCountries = countries.filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || entitiesOf(c).some(entityMatches));
  // Pendant une recherche, le détail suit le premier pays trouvé si le pays
  // choisi n'en fait pas partie.
  const selected =
    (shownCountries.some((c) => c.code === selectedCode) ? countries.find((c) => c.code === selectedCode) : shownCountries[0]) ?? null;
  const selectedEntities = selected
    ? entitiesOf(selected).filter((e) => !q || selected.name.toLowerCase().includes(q) || selected.code.toLowerCase().includes(q) || entityMatches(e))
    : [];
  const users = storage.getUsers();
  const accountsIn = (c: CountryDef) => {
    const names = new Set(entitiesOf(c).map((e) => e.name));
    return users.filter((u) => u.country === c.name || names.has(u.entity) || (u.countries ?? []).includes(c.name) || (u.entities ?? []).some((n) => names.has(n))).length;
  };
  const yy = String(new Date().getFullYear()).slice(-2);
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');

  // --- Actions pays (mêmes règles que OrganizationCountriesTab) ---
  const openAddCountry = () => {
    setEditingCountryCode(null);
    setCountryCode('');
    setCountryName('');
    setCountryFlag('');
    setShowCountryModal(true);
  };
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
      setSelectedCode(code);
    }
    setShowCountryModal(false);
  };
  const handleDeleteCountry = (c: CountryDef) => {
    const result = storage.deleteCountry(c.code, activeUser);
    setDeleteCountryConfirm(false);
    if (result.allowed) {
      setDeleteCountryError('');
      onSaved(t.ctry_deleted.replace('{name}', c.name));
    } else {
      setDeleteCountryError(result.reason ?? t.ctry_delete_refused);
    }
  };

  // --- Actions entités (mêmes règles que EntitiesTab) ---
  const openAddEntity = (c: CountryDef | null) => {
    setEditingEntityId(null);
    setEntityName('');
    setEntityCountry(c?.name ?? '');
    setEntityFlag(c?.flag ?? '');
    setEntityCode('');
    setShowEntityModal(true);
  };
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

  const inputCls =
    'w-full px-3 py-2 border border-slate-200 rounded-xl bg-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5 text-xs">
        <AdminPageHeader
          icon={<Globe2 />}
          tone="violet"
          title={t.org_title}
          subtitle={t.org_subtitle.replace('{c}', String(countries.length)).replace('{n}', String(entities.length))}
          actions={
            <>
              <SearchField id="org-search" value={query} onChange={setQuery} placeholder={t.org_search_ph} />
              <button
                id="org-add-country"
                onClick={openAddCountry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> {t.ctry_add}
              </button>
            </>
          }
        />

        {deleteCountryError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start gap-2">
            <span>{deleteCountryError}</span>
            <button onClick={() => setDeleteCountryError('')} className="ml-auto text-rose-500 hover:text-rose-700 shrink-0" aria-label={t.btn_cancel}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {countries.length === 0 ? (
          <p className="text-slate-400 text-center py-8">{t.ctry_none}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
            {/* Liste des pays */}
            <nav aria-label={t.org_countries} className="rounded-2xl border border-slate-200 p-1.5 space-y-0.5 lg:sticky lg:top-4">
              {shownCountries.length === 0 && <p className="p-4 text-center text-slate-400">{t.adm_no_result}</p>}
              {shownCountries.map((c) => {
                const active = c.code === selected?.code;
                const n = entitiesOf(c).length;
                return (
                  <button
                    key={c.code}
                    id={`org-country-${c.code}`}
                    type="button"
                    onClick={() => {
                      setSelectedCode(c.code);
                      setDeleteCountryConfirm(false);
                      // Sur téléphone, le détail est sous la liste : on y descend.
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        requestAnimationFrame(() => document.getElementById('org-country-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                      }
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      active ? 'bg-violet-50 ring-1 ring-inset ring-violet-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-8 shrink-0 text-center px-1 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10.5px]">{c.code}</span>
                    <span className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${active ? 'text-violet-900' : 'text-[#0B2545]'}`}>{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 ${active ? 'text-violet-500 translate-x-0.5' : 'text-slate-300 group-hover:translate-x-0.5'}`} />
                  </button>
                );
              })}
            </nav>

            {/* Détail du pays choisi */}
            {selected && (
              <section id="org-country-detail" key={selected.code} className="activa-enter scroll-mt-4 rounded-2xl border border-slate-200 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-sm">{selected.code}</span>
                    <div className="min-w-0">
                      <h4 className="text-xl font-extrabold tracking-tight text-[#0B2545] truncate">{selected.name}</h4>
                      <p className="text-xs text-slate-500">{t.ctry_entity_count.replace('{n}', String(entitiesOf(selected).length))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="org-edit-country"
                      onClick={() => openEditCountry(selected)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> {t.org_edit_country}
                    </button>
                    {deleteCountryConfirm ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteCountry(selected)} className="px-2.5 py-2 rounded-xl bg-rose-600 text-white font-bold">{t.common_confirm}</button>
                        <button onClick={() => setDeleteCountryConfirm(false)} className="px-2.5 py-2 rounded-xl bg-slate-100 text-slate-700">{t.btn_cancel}</button>
                      </div>
                    ) : (
                      <button
                        id="org-delete-country"
                        onClick={() => setDeleteCountryConfirm(true)}
                        className="p-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50"
                        title={t.common_delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 my-4">
                  {[
                    { icon: <Building2 />, value: String(entitiesOf(selected).length), label: t.org_stat_entities },
                    { icon: <Users />, value: String(accountsIn(selected)), label: t.org_stat_accounts },
                    { icon: <Hash />, value: selected.code, label: t.org_stat_code },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <span className="text-slate-400 [&_svg]:w-4 [&_svg]:h-4">{s.icon}</span>
                      <div className="mt-1 text-xl font-extrabold text-[#0B2545] tabular-nums">{s.value}</div>
                      <div className="text-[11px] text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {selectedEntities.map((ent) => (
                    <div
                      key={ent.id}
                      className="group flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:border-violet-200 hover:shadow-[0_14px_30px_-22px_rgb(76_29_149/0.45)]"
                    >
                      <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200/70 flex items-center justify-center shrink-0">
                        <Building2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[13px] text-[#0B2545] truncate">{ent.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                          {t.ent_case_code}
                          <span className="px-1.5 py-0.5 rounded-md bg-[#0B2545] text-white font-mono font-bold text-[10px] tracking-wide">{ent.code}</span>
                          <span className="hidden sm:inline text-slate-300">·</span>
                          <span className="hidden sm:inline">
                            {t.org_example} <span className="font-mono text-slate-600">{`${ent.code}-${yy}-${mm}-0001`}</span>
                          </span>
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
                  {selectedEntities.length === 0 && <p className="py-4 text-center text-slate-400">{q ? t.adm_no_result : t.ent_none}</p>}
                  <button
                    id="org-add-entity"
                    type="button"
                    onClick={() => openAddEntity(selected)}
                    className="w-full p-3.5 rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 font-bold hover:bg-violet-100 hover:border-violet-300 transition"
                  >
                    + {t.org_add_entity_in.replace('{country}', selected.name)}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Fenêtre : ajouter / modifier un pays */}
      {showCountryModal && (
        <div className="activa-fade-in fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="activa-modal-in bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">{editingCountryCode ? t.ctry_edit : t.ctry_add}</h3>
            <form onSubmit={handleSaveCountry} className="space-y-3">
              <div>
                <label htmlFor="org-country-code" className="block font-semibold text-slate-700 mb-1">{t.ctry_code_req}</label>
                <input id="org-country-code" type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={4} disabled={!!editingCountryCode} className={`${inputCls} font-mono`} required />
                {editingCountryCode && <p className="text-[10px] text-slate-400 mt-1">{t.ctry_code_hint}</p>}
              </div>
              <div>
                <label htmlFor="org-country-name" className="block font-semibold text-slate-700 mb-1">{t.ctry_name_req}</label>
                <input id="org-country-name" type="text" value={countryName} onChange={(e) => setCountryName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label htmlFor="org-country-flag" className="block font-semibold text-slate-700 mb-1">{t.ent_flag_emoji}</label>
                <input id="org-country-flag" type="text" value={countryFlag} onChange={(e) => setCountryFlag(e.target.value)} placeholder="🇸🇳" className={inputCls} maxLength={8} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCountryModal(false)} className="px-3 py-2 text-slate-600 rounded-xl hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">{editingCountryCode ? t.users_save : t.users_add}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fenêtre : ajouter / modifier une entité */}
      {showEntityModal && (
        <div className="activa-fade-in fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="activa-modal-in bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">{editingEntityId ? t.ent_edit : t.ent_add}</h3>
            <form onSubmit={handleSaveEntity} className="space-y-3">
              <div>
                <label htmlFor="org-entity-name" className="block font-semibold text-slate-700 mb-1">{t.ent_name_req}</label>
                <input id="org-entity-name" type="text" value={entityName} onChange={(e) => setEntityName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label htmlFor="org-entity-country" className="block font-semibold text-slate-700 mb-1">{t.ent_country_req}</label>
                <select
                  id="org-entity-country"
                  value={entityCountry}
                  onChange={(e) => {
                    setEntityCountry(e.target.value);
                    const c = countries.find((x) => x.name === e.target.value);
                    if (c && !entityFlag) setEntityFlag(c.flag);
                  }}
                  className={inputCls}
                  required
                >
                  <option value="">{t.ent_select_country}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="org-entity-flag" className="block font-semibold text-slate-700 mb-1">{t.ent_flag_emoji}</label>
                <input id="org-entity-flag" type="text" value={entityFlag} onChange={(e) => setEntityFlag(e.target.value)} placeholder="🇧🇯" className={inputCls} maxLength={8} />
              </div>
              <div>
                <label htmlFor="org-entity-code" className="block font-semibold text-slate-700 mb-1">{t.ent_code_req}</label>
                <input
                  id="org-entity-code"
                  type="text"
                  value={entityCode}
                  onChange={(e) => setEntityCode(e.target.value.toUpperCase())}
                  className={`${inputCls} font-mono uppercase`}
                  maxLength={6}
                  pattern="[A-Za-z]{2,6}"
                  title={t.ent_code_title}
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">{t.ent_code_hint}</p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEntityModal(false)} className="px-3 py-2 text-slate-600 rounded-xl hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">{editingEntityId ? t.users_save : t.users_add}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
