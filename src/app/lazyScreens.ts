/**
 * === AMÉLIORATION AJOUTÉE (Refactor App.tsx — extraction par section) ===
 *
 * Déclarations `React.lazy` des écrans staff, déplacées telles quelles
 * depuis App.tsx (seuls les chemins d'import relatifs changent,
 * `./components/…` → `../components/…`). Toujours déclarées une seule fois
 * au niveau module — même identité de composant à chaque rendu, mêmes
 * chunks générés par Vite, même moment de chargement.
 */
import { lazy } from 'react';

// === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, découpage de code) ===
// Les écrans ci-dessous ne sont jamais nécessaires à un visiteur public
// (lanceur d'alerte anonyme, page d'accueil, dépôt/suivi de signalement) —
// seul un compte staff authentifié les atteint. Chargés à la demande
// (`React.lazy`) plutôt qu'inclus dans le bundle initial : InvestigationDesk
// à lui seul fait plus de 4 600 lignes (voir l'audit frontend), chargé
// jusqu'ici même pour un lanceur d'alerte qui ne le verra jamais. Chaque
// point de montage est enveloppé dans un `<Suspense>` (voir plus bas) —
// aucun changement de comportement, seul le MOMENT du chargement change.
export const InvestigationDesk = lazy(() => import('../components/InvestigationDesk').then((m) => ({ default: m.InvestigationDesk })));
// === AMÉLIORATION AJOUTÉE (Refonte Opérateur v2 — Boîte de réception /
// À attribuer / En attente d'infos / Dossiers attribués) === remplace le
// rendu InvestigationDesk+initialFilter des 4 onglets ci-dessous par ce
// nouvel écran dédié (KPI réels, sélection multiple, filtres riches,
// panneau liste + détail pour la Boîte de réception) — voir le fichier
// pour le détail. La fiche dossier complète (InvestigationDesk, inchangée)
// reste accessible en un clic via `onOpenCase`/`navigateToCases`.
export const OperatorCaseDesk = lazy(() => import('../components/OperatorCaseDesk').then((m) => ({ default: m.OperatorCaseDesk })));
export const ControlPanel = lazy(() => import('../components/ControlPanel').then((m) => ({ default: m.ControlPanel })));
export const ReportingDashboard = lazy(() => import('../components/ReportingDashboard').then((m) => ({ default: m.ReportingDashboard })));
export const ExecutiveDashboard = lazy(() => import('../components/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboard })));
export const AuditTrailView = lazy(() => import('../components/AuditTrailView').then((m) => ({ default: m.AuditTrailView })));
export const AdminConfigView = lazy(() => import('../components/AdminConfigView').then((m) => ({ default: m.AdminConfigView })));
export const CaseLookup = lazy(() => import('../components/CaseLookup').then((m) => ({ default: m.CaseLookup })));
// === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le sélecteur en
// barre latérale) ===
export const StaffSpaceHome = lazy(() => import('../components/StaffSpaceHome').then((m) => ({ default: m.StaffSpaceHome })));
// === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
// 4 écrans transverses réels (Tâches / Preuves / Communications / Actions
// correctives), agrégeant des données déjà existantes sur `AlertRecord` —
// voir chaque fichier pour le détail.
export const TasksRegistry = lazy(() => import('../components/TasksRegistry').then((m) => ({ default: m.TasksRegistry })));
export const EvidenceRegistry = lazy(() => import('../components/EvidenceRegistry').then((m) => ({ default: m.EvidenceRegistry })));
export const CommunicationsRegistry = lazy(() => import('../components/CommunicationsRegistry').then((m) => ({ default: m.CommunicationsRegistry })));
export const CorrectiveActionsRegistry = lazy(() => import('../components/CorrectiveActionsRegistry').then((m) => ({ default: m.CorrectiveActionsRegistry })));
// === AMÉLIORATION AJOUTÉE (Recherche avancée dédiée) ===
// === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
export const EmailNotificationsTab = lazy(() => import('../components/admin/EmailNotificationsTab').then((m) => ({ default: m.EmailNotificationsTab })));
export const AdvancedSearchView = lazy(() => import('../components/AdvancedSearchView').then((m) => ({ default: m.AdvancedSearchView })));
// === AMÉLIORATION AJOUTÉE (Phase 12.4 — connexion interne dédiée) ===
export const StaffLoginView = lazy(() => import('../components/StaffLoginView').then((m) => ({ default: m.StaffLoginView })));
