/**
 * === AMÉLIORATION AJOUTÉE (Phase 6 — Control Panel redesign) ===
 *
 * Lightweight, dependency-free SVG chart primitives for the Control Panel.
 * The brief's own ground rules say not to add a new heavy dependency
 * (charting library) unless a phase genuinely can't be done without one —
 * a trend line, a donut, and a bar chart are all well within plain SVG, so
 * no library is added here. These components render only what they are
 * given: they compute nothing and store nothing. The Control Panel is the
 * one place that turns real `storage.getAlerts()` data into this shape,
 * exactly like the existing `ReportingDashboard` CSS-bar pattern this
 * extends rather than replaces.
 */
import React, { useId } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface MiniLineChartProps {
  data: TrendPoint[];
  color?: string;
  height?: number;
}

// A simple line/area trend chart. Renders nothing but straight segments
// between the given points — no smoothing/interpolation that could imply
// data between real buckets that doesn't exist.
export const MiniLineChart: React.FC<MiniLineChartProps> = ({ data, color = '#2563eb', height = 140 }) => {
  const gradientId = useId();
  const width = 600;
  const padding = 20;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - padding - (d.value / max) * (height - padding * 2),
    label: d.label,
    value: d.value,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastX = points[points.length - 1]?.x ?? padding;
  const areaPath = `${linePath} L${lastX.toFixed(1)},${height - padding} L${padding},${height - padding} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 0 && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        {points.length > 1 && (
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
        ))}
      </svg>
      {/* === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, contraste) ===
          BUG PRÉEXISTANT CORRIGÉ, mesuré via axe-core : text-slate-400 à
          cette taille ne passe pas le seuil WCAG AA (2.63:1, minimum
          4.5:1) — text-slate-500 y remédie. */}
      <div className="flex justify-between mt-1 px-0.5">
        {data.map((d, i) => (
          <span key={i} className="text-[9px] text-slate-500 font-medium">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface MiniDonutChartProps {
  data: DonutSlice[];
  size?: number;
  centerValue?: string | number;
  centerLabel?: string;
}

export const MiniDonutChart: React.FC<MiniDonutChartProps> = ({ data, size = 132, centerValue, centerLabel }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 15;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
      <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        <circle r={radius} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {total > 0 &&
          data
            .filter((d) => d.value > 0)
            .map((d, i) => {
              const dash = (d.value / total) * circumference;
              const el = (
                <circle
                  key={i}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={16}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsetAcc}
                />
              );
              offsetAcc += dash;
              return el;
            })}
      </g>
      {centerValue !== undefined && (
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.19} fontWeight={800} fill="#0f172a">
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.075} fill="#64748b">
          {centerLabel}
        </text>
      )}
    </svg>
  );
};

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
}

// === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord, "Top 5 pays" /
// "Top 5 catégories") ===
// Liste de barres HORIZONTALES (étiquette à gauche, barre proportionnelle,
// valeur à droite) — étend le fichier plutôt que de le modifier, même
// principe que MiniLineChart/MiniDonutChart/MiniBarChart ci-dessus.
// Réutilise le motif CSS déjà existant dans ReportingDashboard.tsx
// (`bg-slate-100 rounded-full` + barre colorée en `width: X%`) sous forme
// de composant partagé, plutôt que de le dupliquer une troisième fois.
export interface HBarDatum {
  label: string;
  value: number;
  color?: string;
}

interface MiniHBarListProps {
  data: HBarDatum[];
  color?: string;
}

export const MiniHBarList: React.FC<MiniHBarListProps> = ({ data, color = '#2563eb' }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span className="w-20 sm:w-24 shrink-0 text-[11px] font-semibold text-slate-600 truncate">{d.label}</span>
          <span className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <span
              className="block h-2 rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color }}
            />
          </span>
          <span className="w-5 shrink-0 text-right text-[11px] font-extrabold text-slate-800">{d.value}</span>
        </li>
      ))}
    </ul>
  );
};

export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, height = 140 }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 sm:gap-4" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0">
          <span className="text-[11px] font-extrabold text-slate-700">{d.value}</span>
          <div
            className="w-full max-w-[38px] rounded-t-md transition-all"
            style={{ height: Math.max(4, (d.value / max) * (height - 40)), backgroundColor: d.color }}
          />
          <span className="text-[9px] text-slate-500 text-center leading-tight truncate w-full">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
