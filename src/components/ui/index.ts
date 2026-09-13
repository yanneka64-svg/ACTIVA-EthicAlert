// === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
// Barrel export for the shared UI primitives introduced in this phase.
export { StatusBadge } from './StatusBadge';
export type { BadgeStatus } from './StatusBadge';
export { PriorityBadge, nocaColor } from './PriorityBadge';
export { KpiCard } from './KpiCard';
export type { KpiTone } from './KpiCard';
export { EmptyState } from './EmptyState';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable } from './DataTable';
export type { DataTableColumn } from './DataTable';
export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbItem } from './Breadcrumb';

// === AMÉLIORATION AJOUTÉE (Phase 6 — Control Panel redesign) ===
export { MiniLineChart, MiniDonutChart, MiniBarChart } from './Charts';
export type { TrendPoint, DonutSlice, BarDatum } from './Charts';

// === AMÉLIORATION AJOUTÉE (Phase 13 — vrai logo ACTIVA) ===
export { ActivaLogo } from './ActivaLogo';
