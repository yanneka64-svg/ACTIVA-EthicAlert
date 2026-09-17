/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Cinquième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx —
 * voir les PR précédentes (#90-#93) pour le contexte général et les étapes
 * déjà faites. Extraction de l'onglet "Gouvernance" (registre des
 * destinataires d'escalade et de routage) hors du composant monolithique
 * AdminConfigView.tsx, sans aucun changement de comportement.
 *
 * Code strictement déplacé, pas réécrit : mêmes state/handlers/JSX (tableau
 * CRUD + modale Ajouter/Modifier) que l'ancien bloc
 * `{configTab === 'governance' && (...)}` + la modale `showRecipientModal`
 * qui lui était associée. `escalationRecipients`/`users` (lus depuis
 * storage.ts par AdminConfigView, qui alimente aussi d'autres onglets avec
 * les mêmes données) et `activeUser` deviennent des props ; `flashBanner`
 * devient la prop `onSaved`. `slugify`, partagé par 2 autres onglets pas
 * encore extraits (catégories/utilisateurs), reste défini dans
 * AdminConfigView et est passé en prop plutôt que dupliqué.
 */
import React, { useState } from 'react';
import { Mail, Plus, Pencil, Trash2 } from 'lucide-react';
import { UserProfile, EscalationRecipient } from '../../types';
import { storage } from '../../services/storage';

interface GovernanceRecipientsTabProps {
  escalationRecipients: EscalationRecipient[];
  users: UserProfile[];
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  slugify: (name: string) => string;
}

export const GovernanceRecipientsTab: React.FC<GovernanceRecipientsTabProps> = ({ escalationRecipients, users, activeUser, onSaved, slugify }) => {
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === --- Escalation Recipients CRUD state --- même motif que
  // les Entités d'AdminConfigView.
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [recipientIdentifiant, setRecipientIdentifiant] = useState('');
  const [recipientNom, setRecipientNom] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientFonction, setRecipientFonction] = useState('');
  const [recipientGrade, setRecipientGrade] = useState(1);
  const [recipientLinkedUserId, setRecipientLinkedUserId] = useState('');
  const [recipientActive, setRecipientActive] = useState(true);
  const [deleteRecipientConfirmId, setDeleteRecipientConfirmId] = useState<string | null>(null);

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === --- Escalation Recipients handlers --- même motif que
  // les Entités d'AdminConfigView.
  const resetRecipientForm = () => {
    setEditingRecipientId(null);
    setRecipientIdentifiant('');
    setRecipientNom('');
    setRecipientEmail('');
    setRecipientFonction('');
    setRecipientGrade(1);
    setRecipientLinkedUserId('');
    setRecipientActive(true);
  };
  const openAddRecipient = () => { resetRecipientForm(); setShowRecipientModal(true); };
  const openEditRecipient = (r: EscalationRecipient) => {
    setEditingRecipientId(r.id);
    setRecipientIdentifiant(r.identifiant);
    setRecipientNom(r.nom);
    setRecipientEmail(r.email);
    setRecipientFonction(r.fonction);
    setRecipientGrade(r.grade);
    setRecipientLinkedUserId(r.linkedUserId ?? '');
    setRecipientActive(r.active);
    setShowRecipientModal(true);
  };
  const handleSaveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientIdentifiant.trim() || !recipientNom.trim() || !recipientEmail.trim() || !recipientFonction.trim()) return;
    const payload = {
      identifiant: recipientIdentifiant.trim(),
      nom: recipientNom.trim(),
      email: recipientEmail.trim(),
      fonction: recipientFonction.trim(),
      grade: recipientGrade,
      linkedUserId: recipientLinkedUserId || undefined,
      active: recipientActive,
    };
    if (editingRecipientId) {
      storage.updateEscalationRecipient(editingRecipientId, payload, activeUser);
      onSaved(`Destinataire "${recipientNom.trim()}" mis à jour.`);
    } else {
      const id = `rec-${slugify(recipientNom)}-${Date.now().toString(36)}`;
      storage.addEscalationRecipient({ id, ...payload }, activeUser);
      onSaved(`Destinataire "${recipientNom.trim()}" ajouté.`);
    }
    setShowRecipientModal(false);
  };
  const handleDeleteRecipient = (r: EscalationRecipient) => {
    storage.deleteEscalationRecipient(r.id, activeUser);
    setDeleteRecipientConfirmId(null);
    onSaved(`Destinataire "${r.nom}" supprimé.`);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
        {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade
            et de routage) === Source réelle des destinataires proposés
            par "Escalader le dossier" (InvestigationDesk.tsx) et du
            dernier recours notifié quand le routage indépendant
            ne trouve aucune autorité interne (grade le plus
            élevé, actif) — REMPLACE le filtre par rôle codé en dur
            (senior_investigator/darc_compliance uniquement) qui
            existait avant. Un destinataire "Compte lié" obtient un
            accès in-app réel au dossier ; sans compte, seule une vraie
            notification e-mail est envoyée — jamais d'accès fictif. */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-700" />
                Registre des destinataires d'escalade et de routage ({escalationRecipients.length})
              </h4>
            </div>
            <button
              onClick={openAddRecipient}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un destinataire
            </button>
          </div>

          {escalationRecipients.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucun destinataire configuré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                    <th className="py-2 pr-3">Nom</th>
                    <th className="py-2 pr-3">Identifiant</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Fonction</th>
                    <th className="py-2 pr-3 text-right">Grade</th>
                    <th className="py-2 pr-3">Compte lié</th>
                    <th className="py-2 pr-3">Actif</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...escalationRecipients].sort((a, b) => b.grade - a.grade).map((r) => {
                    const linkedUser = r.linkedUserId ? users.find((u) => u.id === r.linkedUserId) : undefined;
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{r.nom}</td>
                        <td className="py-2 pr-3 text-slate-500 font-mono">{r.identifiant}</td>
                        <td className="py-2 pr-3 text-slate-600">{r.email}</td>
                        <td className="py-2 pr-3 text-slate-600">{r.fonction}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{r.grade}</td>
                        <td className="py-2 pr-3">
                          {linkedUser ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">{linkedUser.name}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">E-mail uniquement</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                            {r.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditRecipient(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Modifier">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {deleteRecipientConfirmId === r.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDeleteRecipient(r)} className="px-1.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">Confirmer</button>
                                <button onClick={() => setDeleteRecipientConfirmId(null)} className="px-1.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px]">Annuler</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteRecipientConfirmId(r.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600" title="Supprimer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* === AMÉLIORATION AJOUTÉE (carte "État des notifications e-mail"
            retirée de l'affichage, sur demande explicite) === Le suivi
            continue normalement en arrière-plan : chaque tentative d'envoi
            (nouveau signalement, attribution, escalade, repli de routage)
            reste journalisée dans la base (Audit Trail,
            EMAIL_NOTIFICATION_SENT/FAILED, services/emailNotify.ts) — rien
            n'est désactivé, seule cette carte de lecture n'est plus
            rendue ici. */}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et
          de routage) === MODAL: ADD/EDIT RECIPIENT — même structure que la
          modale Entité. */}
      {showRecipientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRecipientId ? 'Modifier le destinataire' : 'Ajouter un destinataire'}
              </h3>
            </div>
            <form onSubmit={handleSaveRecipient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nom *</label>
                  <input type="text" value={recipientNom} onChange={(e) => setRecipientNom(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Identifiant *</label>
                  <input type="text" value={recipientIdentifiant} onChange={(e) => setRecipientIdentifiant(e.target.value)} placeholder="Ex : GRP-DGA-001" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                  <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grade *</label>
                  <input
                    type="number"
                    min={1}
                    value={recipientGrade}
                    onChange={(e) => setRecipientGrade(Number(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Fonction *</label>
                  <input type="text" value={recipientFonction} onChange={(e) => setRecipientFonction(e.target.value)} placeholder="Ex : Directeur Général Adjoint Groupe" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Compte activa-whistleblowing lié (optionnel)</label>
                  <select value={recipientLinkedUserId} onChange={(e) => setRecipientLinkedUserId(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                    <option value="">Aucun — notification e-mail uniquement</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} — {u.roleTitle}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-700">
                    <input type="checkbox" checked={recipientActive} onChange={(e) => setRecipientActive(e.target.checked)} className="rounded border-slate-300" />
                    Actif
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowRecipientModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold">
                  {editingRecipientId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
