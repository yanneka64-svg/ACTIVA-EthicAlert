/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés) ===
 * « … est en train d'écrire » : trois points animés (immobiles si
 * l'utilisateur a demandé moins d'animations).
 */
import React from 'react';

export const TypingIndicator: React.FC<{ label: string; tone?: 'light' | 'dark' }> = ({ label, tone = 'light' }) => (
  <div className="flex items-center gap-2 text-[11px] text-slate-500" role="status" aria-live="polite">
    <span className={`inline-flex items-center gap-1 px-3 py-2 rounded-2xl ${tone === 'light' ? 'bg-slate-100' : 'bg-slate-700'}`}>
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
        />
      ))}
    </span>
    <span className="italic">{label}</span>
  </div>
);
