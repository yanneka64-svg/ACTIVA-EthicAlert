/**
 * === AMÉLIORATION AJOUTÉE (Phase 0 — design system foundation) ===
 * Shared empty-state placeholder (brief §49) — matches the app's existing
 * card conventions rather than a blank screen or a raw text line.
 */
import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon = Inbox, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
    <Icon className="w-8 h-8 text-slate-400 mb-3" />
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
