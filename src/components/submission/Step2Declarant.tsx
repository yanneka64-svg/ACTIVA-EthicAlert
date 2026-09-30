/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertSubmissionFlow — extraction par
 * étape) ===
 *
 * Étape 2 — informations sur le lanceur d'alerte (facultatives).
 *
 * Code strictement déplacé depuis AlertSubmissionFlow.tsx, pas réécrit —
 * aucun changement de comportement. Tout l'état du formulaire (brouillon
 * auto-sauvegardé, validations, soumission) reste possédé par
 * AlertSubmissionFlow.tsx et est passé en props tel quel.
 */
import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Language, WhistleblowerInfo } from '../../types';
import { EntityDef, ACTIVA_COUNTRIES } from '../../data/activaConfig';
import { Button } from '../ui';
import { trData } from '../../i18n/dataLabels';

interface Step2DeclarantProps {
  t: Record<string, string>;
  lang: Language;
  entities: EntityDef[];
  declarantFirstName: string;
  setDeclarantFirstName: (v: string) => void;
  declarantLastName: string;
  setDeclarantLastName: (v: string) => void;
  declarantJob: string;
  setDeclarantJob: (v: string) => void;
  declarantDept: string;
  setDeclarantDept: (v: string) => void;
  declarantType: WhistleblowerInfo['declarantType'];
  setDeclarantType: (v: WhistleblowerInfo['declarantType']) => void;
  declarantEntity: string;
  setDeclarantEntity: (v: string) => void;
  declarantCountry: string;
  setDeclarantCountry: (v: string) => void;
  declarantEmail: string;
  setDeclarantEmail: (v: string) => void;
  declarantPhone: string;
  setDeclarantPhone: (v: string) => void;
  setCurrentStep: (v: number) => void;
  handleSaveAndExit: () => void;
}

export const Step2Declarant: React.FC<Step2DeclarantProps> = ({
  t,
  lang,
  entities,
  declarantFirstName,
  setDeclarantFirstName,
  declarantLastName,
  setDeclarantLastName,
  declarantJob,
  setDeclarantJob,
  declarantDept,
  setDeclarantDept,
  declarantType,
  setDeclarantType,
  declarantEntity,
  setDeclarantEntity,
  declarantCountry,
  setDeclarantCountry,
  declarantEmail,
  setDeclarantEmail,
  declarantPhone,
  setDeclarantPhone,
  setCurrentStep,
  handleSaveAndExit,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{t.wizard_step_of.replace('{n}', '2')}</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{t.wizard_step2_title_optional}</h2>
        <p className="text-sm text-slate-600 mt-1">{t.wizard_step2_hint}</p>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (organisation du formulaire —
          sections visuelles) === Sur demande explicite : les
          champs regroupés en deux sections (Identité /
          Coordonnées & contexte) au lieu d'une seule grille
          indifférenciée, même convention que l'étape 3
          ci-dessous — aucun champ, aucune logique modifié.
          Le bandeau "Vous pouvez rester anonyme..." qui
          suivait la grille est retiré : il répétait mot pour
          mot `wizard_step2_hint` déjà affiché juste sous le
          titre de l'étape. */}
      <div className="space-y-4">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.sub_identity}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-declarant-firstname" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_first_name}</label>
            <input
              id="input-declarant-firstname"
              type="text"
              value={declarantFirstName}
              onChange={(e) => setDeclarantFirstName(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_first_name}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="input-declarant-lastname" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_last_name}</label>
            <input
              id="input-declarant-lastname"
              type="text"
              value={declarantLastName}
              onChange={(e) => setDeclarantLastName(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_last_name}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="input-declarant-job" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_job_title}</label>
            <input
              id="input-declarant-job"
              type="text"
              value={declarantJob}
              onChange={(e) => setDeclarantJob(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_job}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="input-declarant-dept" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_department}</label>
            <input
              id="input-declarant-dept"
              type="text"
              value={declarantDept}
              onChange={(e) => setDeclarantDept(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_dept}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="input-declarant-type" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_declarant_type}</label>
            <select
              id="input-declarant-type"
              value={declarantType}
              onChange={(e: any) => setDeclarantType(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="Employé">{t.sub_type_employee}</option>
              <option value="Consultant">{t.sub_type_consultant}</option>
              <option value="Prestataire">{t.sub_type_supplier}</option>
              <option value="Client">{t.sub_type_client}</option>
              <option value="Autre">{t.sub_type_other}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.sub_contact_context}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-declarant-entity" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_entity}</label>
            <select
              id="input-declarant-entity"
              value={declarantEntity}
              onChange={(e) => setDeclarantEntity(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              {entities.map((ent) => (
                <option key={ent.id} value={ent.name}>
                  {ent.flag} {ent.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="input-declarant-country" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_country}</label>
            <select
              id="input-declarant-country"
              value={declarantCountry}
              onChange={(e) => setDeclarantCountry(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">—</option>
              {ACTIVA_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.flag} {trData(c.name, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="input-declarant-email" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_email}</label>
            <input
              id="input-declarant-email"
              type="email"
              value={declarantEmail}
              onChange={(e) => setDeclarantEmail(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_email}) */
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="input-declarant-phone" className="block text-xs font-semibold text-slate-700 mb-1">{t.label_phone}</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-600 shrink-0">
                {ACTIVA_COUNTRIES.find((c) => c.name === declarantCountry)?.flag || '🌍'}
              </span>
              <input
                id="input-declarant-phone"
                type="tel"
                value={declarantPhone}
                onChange={(e) => setDeclarantPhone(e.target.value)}
                /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.sub_ph_phone}) */
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-3 pt-4">
        <Button type="button" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(1)}>
          <span>{t.common_previous}</span>
        </Button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" id="btn-save-and-exit" onClick={handleSaveAndExit}>
            {t.btn_save_and_exit}
          </Button>
          <Button type="button" id="btn-step2-next" onClick={() => setCurrentStep(3)}>
            <span>{t.common_next}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
