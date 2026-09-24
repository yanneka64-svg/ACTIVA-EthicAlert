/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Quinzième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111 pour les
 * étapes précédentes. Extraction de la modale "Escalade vers la DARC
 * Groupe" hors du composant monolithique, sans aucun changement de
 * comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleEscalate` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/la persistance/les notifications) : passé en
 * prop tel quel.
 */
import React from 'react';
import { AlertRecord, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { canSeeAlertConfidentiality } from '../../services/authz';

interface EscalateModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  allUsers: UserProfile[];
  escalateOwnerId: string;
  setEscalateOwnerId: (v: string) => void;
  escalateReason: string;
  setEscalateReason: (v: string) => void;
  setShowEscalateModal: (v: boolean) => void;
  handleEscalate: () => void;
}

export const EscalateModal: React.FC<EscalateModalProps> = ({
  t,
  selectedAlert,
  allUsers,
  escalateOwnerId,
  setEscalateOwnerId,
  escalateReason,
  setEscalateReason,
  setShowEscalateModal,
  handleEscalate,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.btn_escalate_case}</h3>
        </div>

        <div>
          {/* === AMÉLIORATION AJOUTÉE (Registre des destinataires
              d'escalade et de routage) === Source désormais le registre
              admin-éditable (Gouvernance) au lieu de
              getGroupEscalationOwners (2 rôles codés en dur). Un
              destinataire sans compte lié, OU dont le compte lié n'a
              pas l'habilitation de confidentialité requise pour CE
              dossier (canSeeAlertConfidentiality — correctif
              confidentialité), reste sélectionnable — la mention
              "e-mail uniquement" évite toute ambiguïté sur ce qu'il
              recevra réellement (pas d'accès in-app fictif). */}
          <label className="block font-semibold text-slate-700 mb-1">{t.escalate_recipient_label} *</label>
          <select
            value={escalateOwnerId}
            onChange={(e) => setEscalateOwnerId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            required
          >
            {storage.getEscalationRecipients().filter((r) => r.active).map((r) => {
              const linkedUser = r.linkedUserId ? allUsers.find((u) => u.id === r.linkedUserId) : undefined;
              const willGetAccess = !!linkedUser && canSeeAlertConfidentiality(linkedUser, selectedAlert);
              return (
                <option key={r.id} value={r.id}>
                  {r.nom} — {r.fonction}{!willGetAccess ? ` (${t.escalate_recipient_email_only})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.inv_escalate_reason}</label>
          <textarea
            rows={3}
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            placeholder={t.inv_escalate_reason_ph}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowEscalateModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleEscalate}
            disabled={!escalateReason.trim() || !escalateOwnerId}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
          >
            {t.inv_escalate_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
