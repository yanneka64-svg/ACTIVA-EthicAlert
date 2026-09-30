/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Groupes de champs de l'export (« Champs à inclure »), déplacés tels
 * quels depuis ReportingDashboard.tsx pour être partagés entre ses
 * handlers d'export (restés dans ReportingDashboard.tsx) et la modale
 * ReportingExportModal.tsx. Aucun changement de comportement.
 */
import type { AlertRecord } from '../../types';

// === AMÉLIORATION AJOUTÉE (Repère visuel — Modale Exporter des données) ===
// "Champs à inclure" façon maquette : chaque groupe correspond à une ou
// plusieurs colonnes réelles déjà présentes dans l'export CSV existant
// (jamais une donnée fabriquée) — voir `handleExportCSV`, qui ne construit
// désormais que les colonnes dont le groupe est coché. L'identité du
// déclarant reste régie par la case "Générer un rapport 100% anonymisé"
// déjà existante, séparée de cette liste (elle a déjà son propre
// contrôle).
export type ExportFieldGroupKey = 'general' | 'status_dates' | 'geo' | 'persons' | 'corrective';
export interface ExportFieldGroup {
  key: ExportFieldGroupKey;
  label: string;
  columns: { header: string; value: (a: AlertRecord) => string | number }[];
}
export const EXPORT_FIELD_GROUPS: ExportFieldGroup[] = [
  {
    key: 'general',
    label: 'Informations générales',
    columns: [
      { header: 'Reference', value: (a) => a.trackingNumber },
      { header: 'Categorie', value: (a) => `"${a.category}"` },
      { header: 'Sous_Categorie', value: (a) => `"${a.subCategory}"` },
    ],
  },
  {
    key: 'status_dates',
    label: 'Statut et dates',
    columns: [
      { header: 'Date_Depot', value: (a) => a.createdAt.split('T')[0] },
      { header: 'Statut', value: (a) => a.status },
      { header: 'Criticite_NOCA', value: (a) => a.riskEvaluation.nocaThreshold },
      { header: 'Priorite', value: (a) => a.riskEvaluation.priority },
    ],
  },
  {
    key: 'geo',
    label: 'Pays / Entité',
    columns: [
      { header: 'Pays', value: (a) => `"${a.country}"` },
      { header: 'Entite', value: (a) => `"${a.concernedEntity}"` },
    ],
  },
  {
    key: 'persons',
    label: 'Personnes impliquées',
    columns: [{ header: 'Personnes_Impliquees_Nb', value: (a) => a.involvedPersons.length }],
  },
  {
    key: 'corrective',
    label: 'Mesures correctives',
    columns: [{ header: 'Mesures_Correctives_Nb', value: (a) => a.correctiveMeasures.length }],
  },
];
