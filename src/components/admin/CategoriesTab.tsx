/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Huitième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx —
 * voir les PR précédentes (#90-#96) pour le contexte général et les étapes
 * déjà faites. Extraction de l'onglet "Catégories" (table CRUD + gestion
 * des sous-catégories) hors du composant monolithique AdminConfigView.tsx,
 * sans aucun changement de comportement.
 *
 * Code strictement déplacé, pas réécrit : mêmes state/handlers/JSX (table
 * + fenêtre de recherche + modale de gestion des sous-catégories + modale
 * Ajouter/Renommer) que les anciens blocs `{configTab === 'categories' &&
 * (...)}` et `{manageSubCategoriesId && (...)}`, plus la modale
 * `showCategoryModal`. `categoriesConfig`/`allAlertsForCategoryCounts` (lus
 * depuis storage.ts par AdminConfigView, même motif que les autres onglets
 * déjà extraits) et `activeUser` deviennent des props ; `flashBanner`
 * devient la prop `onSaved`. `slugify`, partagé par l'onglet Utilisateurs
 * pas encore extrait, reste défini dans AdminConfigView et est passé en
 * prop plutôt que dupliqué.
 */
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, Folder } from 'lucide-react';
import { Language, UserProfile, AlertRecord } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { CategoryDef } from '../../data/activaConfig';
import { storage } from '../../services/storage';

interface CategoriesTabProps {
  categoriesConfig: CategoryDef[];
  allAlertsForCategoryCounts: AlertRecord[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  slugify: (name: string) => string;
  lang?: Language;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({ categoriesConfig, allAlertsForCategoryCounts, activeUser, onSaved, slugify, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
  // --- Categories CRUD state ---
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);
  const [newSubCategoryInputs, setNewSubCategoryInputs] = useState<Record<string, string>>({});
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  const [categorySearch, setCategorySearch] = useState('');
  // === AMÉLIORATION AJOUTÉE (sous-catégories dans une fenêtre dédiée) ===
  // sur demande explicite de l'utilisateur ("le tableau est trop touffu" —
  // une première version dépliait la bande de puces directement dans le
  // tableau, jugée encore trop intrusive) : la gestion des sous-catégories
  // (ajout/retrait) s'ouvre désormais dans une fenêtre modale dédiée,
  // laissant chaque ligne du tableau strictement compacte en permanence.
  const [manageSubCategoriesId, setManageSubCategoriesId] = useState<string | null>(null);

  // --- Categories handlers ---
  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
  };
  const openAddCategory = () => { resetCategoryForm(); setShowCategoryModal(true); };
  const openEditCategory = (cat: CategoryDef) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    if (editingCategoryId) {
      storage.updateCategory(editingCategoryId, { name: categoryName.trim() }, activeUser);
      onSaved(t.cat_updated.replace('{name}', categoryName.trim()));
    } else {
      const id = `cat-${slugify(categoryName)}-${Date.now().toString(36)}`;
      storage.addCategory({ id, name: categoryName.trim(), subCategories: [] }, activeUser);
      onSaved(t.cat_added.replace('{name}', categoryName.trim()));
    }
    setShowCategoryModal(false);
  };
  const handleDeleteCategory = (cat: CategoryDef) => {
    storage.deleteCategory(cat.id, activeUser);
    setDeleteCategoryConfirmId(null);
    onSaved(t.cat_deleted.replace('{name}', cat.name));
  };
  // === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — table Catégories) ===
  const handleToggleCategoryActive = (cat: CategoryDef) => {
    storage.toggleCategoryActive(cat.id, activeUser);
    onSaved(((cat.active ?? true) ? t.cat_deactivated : t.cat_reactivated).replace('{name}', cat.name));
  };
  const handleAddSubCategory = (categoryId: string) => {
    const val = (newSubCategoryInputs[categoryId] || '').trim();
    if (!val) return;
    storage.addSubCategory(categoryId, val, activeUser);
    setNewSubCategoryInputs((prev) => ({ ...prev, [categoryId]: '' }));
  };
  const handleRemoveSubCategory = (categoryId: string, sub: string) => {
    storage.removeSubCategory(categoryId, sub, activeUser);
  };

  const filteredCategories = categoriesConfig.filter((cat) => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      cat.name.toLowerCase().includes(q) ||
      (cat.code ?? '').toLowerCase().includes(q) ||
      cat.subCategories.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Folder className="w-4 h-4 text-blue-700" />
            {t.cat_count_title.replace('{n}', String(categoriesConfig.length))}
          </h3>
          <button
            onClick={openAddCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> {t.cat_add}
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder={t.cat_search_ph}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white"
          />
        </div>

        {filteredCategories.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            {categoriesConfig.length === 0 ? t.cat_none : t.cat_no_match}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-bold">#</th>
                  <th className="py-2 pr-3 font-bold">{t.cat_col_name}</th>
                  <th className="py-2 pr-3 font-bold">{t.cat_col_code}</th>
                  <th className="py-2 pr-3 font-bold">{t.cat_col_subs}</th>
                  <th className="py-2 pr-3 font-bold">{t.desk_col_status}</th>
                  <th className="py-2 pr-3 font-bold">{t.cat_col_cases}</th>
                  <th className="py-2 pr-3 font-bold">{t.cat_col_created}</th>
                  <th className="py-2 pl-3 font-bold text-right">{t.cat_col_actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat, i) => {
                  const isActive = cat.active ?? true;
                  const caseCount = allAlertsForCategoryCounts.filter((a) => a.category === cat.name).length;
                  return (
                    <React.Fragment key={cat.id}>
                      <tr className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-3 text-slate-400 font-semibold">{i + 1}</td>
                        <td className="py-3 pr-3 font-bold text-[#0B2545]">{cat.name}</td>
                        <td className="py-3 pr-3 font-mono text-slate-500">{cat.code ?? '—'}</td>
                        <td className="py-3 pr-3 text-slate-600 max-w-xs">
                          {/* === AMÉLIORATION AJOUTÉE (sous-catégories dans une
                              fenêtre dédiée) === Remplace la liste complète des
                              sous-catégories par un simple compte, cliquable — le
                              détail s'ouvre dans une fenêtre modale dédiée (jamais
                              déplié dans le tableau lui-même), sur demande explicite
                              de l'utilisateur. */}
                          {cat.subCategories.length > 0 ? (
                            <button
                              onClick={() => setManageSubCategoriesId(cat.id)}
                              className="text-blue-700 hover:underline font-semibold"
                            >
                              {cat.subCategories.length} sous-catégorie{cat.subCategories.length > 1 ? 's' : ''}
                            </button>
                          ) : (
                            <button
                              onClick={() => setManageSubCategoriesId(cat.id)}
                              className="text-slate-400 hover:text-blue-700 hover:underline"
                            >
                              {t.cat_none_add}
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <button
                            onClick={() => handleToggleCategoryActive(cat)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10.5px] transition ${
                              isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                            title={isActive ? t.cat_click_deactivate : t.cat_click_reactivate}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {isActive ? t.gov_col_active : t.common_inactive}
                          </button>
                        </td>
                        <td className="py-3 pr-3 text-slate-700 font-semibold">{caseCount}</td>
                        <td className="py-3 pr-3 text-slate-500">
                          {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setManageSubCategoriesId(cat.id)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title={t.cat_manage_subs}>
                              <Folder className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEditCategory(cat)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title={t.cat_rename_short}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {deleteCategoryConfirmId === cat.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDeleteCategory(cat)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">{t.common_confirm}</button>
                                <button onClick={() => setDeleteCategoryConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">{t.btn_cancel}</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteCategoryConfirmId(cat.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title={t.common_delete}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="text-slate-400 mt-3">
              Affichage de {filteredCategories.length} sur {categoriesConfig.length} catégorie{categoriesConfig.length > 1 ? 's' : ''}.
            </p>
          </div>
        )}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (sous-catégories dans une fenêtre dédiée)
          === Fenêtre modale de gestion des sous-catégories d'une catégorie —
          sur demande explicite de l'utilisateur, remplace tout affichage
          dans le tableau lui-même (chaque ligne reste strictement
          compacte). Même gabarit que les modales Ajouter/Modifier catégorie
          ci-dessous. */}
      {manageSubCategoriesId && (() => {
        const cat = categoriesConfig.find((c) => c.id === manageSubCategoriesId);
        if (!cat) return null;
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-blue-700" />
                    {t.cat_col_subs}
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">{cat.name}</p>
                </div>
                <button onClick={() => setManageSubCategoriesId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cat.subCategories.length === 0 && <span className="text-slate-400 italic">{t.cat_no_subs}</span>}
                {cat.subCategories.map((sub, si) => (
                  <span key={si} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                    {sub}
                    <button onClick={() => handleRemoveSubCategory(cat.id, sub)} className="text-slate-400 hover:text-rose-600" title={t.cat_remove}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                <input
                  type="text"
                  value={newSubCategoryInputs[cat.id] || ''}
                  onChange={(e) => setNewSubCategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCategory(cat.id); } }}
                  placeholder={t.cat_new_sub_ph}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                  autoFocus
                />
                <button
                  onClick={() => handleAddSubCategory(cat.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold whitespace-nowrap"
                >
                  + Ajouter
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <button onClick={() => setManageSubCategoriesId(null)} className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {t.space_home_denied_close}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD/EDIT CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCategoryId ? t.cat_rename : t.cat_add}
              </h3>
              {!editingCategoryId && (
                <p className="text-slate-500 text-[11px] mt-0.5">{t.cat_subs_hint}</p>
              )}
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.cat_name_req}</label>
                <input type="text" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.cat_name_ph}) */ className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingCategoryId ? t.users_save : t.users_add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
