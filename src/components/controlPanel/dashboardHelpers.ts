/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Constantes, types et fonctions pures du Centre de Pilotage (rang de
 * priorité, palette, fenêtre de période, découpage de la tendance),
 * déplacés tels quels depuis ControlPanel.tsx pour être partagés avec ses
 * sous-composants. `CasesFilter` (auparavant local à ControlPanel.tsx) est
 * désormais exporté d'ici. Aucun changement de comportement.
 */
import type { AlertRecord, Language, PriorityLevel } from '../../types';
import type { TrendPoint } from '../ui';

export interface CasesFilter {
  status?: string;
  unassignedOnly?: boolean;
  overdueOnly?: boolean;
  trackingNumber?: string;
}

export const PRIORITY_RANK: Record<PriorityLevel, number> = { critique: 4, tres_elevee: 3, elevee: 2, faible: 1 };
export const CATEGORY_PALETTE = ['#2563eb', '#6366f1', '#f97316', '#9333ea', '#0891b2', '#f43f5e', '#10b981', '#64748b', '#eab308', '#14b8a6'];

export type PeriodKey = 'today' | '7d' | '30d' | 'custom' | 'year' | 'all_time';
export type TrendRange = '7d' | '30d' | '12m';

export function localeOf(lang: Language): string {
  return lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR';
}

// === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi annuel) ===
// `year` (nouveau) : filtre le Centre de Pilotage (KPIs, graphiques,
// tableau) sur une année civile complète, en alternative au sélecteur de
// plage personnalisée — jamais les deux en même temps (voir le handler
// du <select> Année ci-dessous). `all_time` (nouveau, valeur par défaut) :
// aucun filtre, tout l'historique — remplace l'ancien défaut '30d' qui ne
// filtrait en réalité jamais l'affichage (seul le delta d'une carte KPI
// l'utilisait), d'où le libellé "30 jours" trompeur retiré du bouton.
export function getPeriodWindow(period: PeriodKey, customStart: string, customEnd: string, selectedYear: number | null) {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      break;
    case 'custom':
      start = customStart ? new Date(customStart) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      end = customEnd ? new Date(customEnd) : now;
      break;
    case 'year': {
      const y = selectedYear ?? now.getFullYear();
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      break;
    }
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      break;
    case 'all_time':
    default:
      // Pas de borne réelle : couvre toute donnée existante sans exclure
      // les dossiers les plus anciens (voir `isScoped` plus bas, qui
      // n'applique ce filtre à l'affichage que pour 'custom'/'year').
      start = new Date(0);
      break;
  }
  const spanMs = Math.max(1, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - spanMs);
  return { start, end, prevStart, prevEnd };
}

export function inWindow(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// Real day/month bucketing of actual `createdAt` timestamps — no synthetic
// interpolation between buckets that have zero alerts.
export function buildTrend(alerts: AlertRecord[], range: TrendRange, lang: Language): TrendPoint[] {
  const now = new Date();
  const locale = localeOf(lang);
  if (range === '12m') {
    const points: TrendPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = alerts.filter((a) => {
        const ad = new Date(a.createdAt);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      }).length;
      points.push({ label: d.toLocaleDateString(locale, { month: 'short' }), value: count });
    }
    return points;
  }
  const days = range === '7d' ? 7 : 30;
  const labelEvery = Math.ceil(days / 6);
  const points: TrendPoint[] = [];
  for (let idx = 0; idx < days; idx++) {
    const i = days - 1 - idx;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const count = alerts.filter((a) => {
      const ad = new Date(a.createdAt);
      return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth() && ad.getDate() === d.getDate();
    }).length;
    const showLabel = idx % labelEvery === 0 || idx === days - 1;
    points.push({ label: showLabel ? d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : '', value: count });
  }
  return points;
}
