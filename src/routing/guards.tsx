/**
 * === AMÉLIORATION AJOUTÉE (Phase 12.2 — route guards) ===
 *
 * Named, reusable guard components (brief section 31: PublicRoute /
 * AuthenticatedRoute / PermissionRoute). Per the brief's own section 31,
 * these are a UX convenience only — "le frontend n'est jamais considéré
 * comme la frontière de sécurité" — the real authority for this app's one
 * genuinely live backend path is `firestore.rules` (see docs/SECURITY.md);
 * everything else here is a local demo model with no server to enforce
 * anything, so these guards exist to give a correct, honest UX (never a
 * dead end, never a false sense of security) rather than to claim real
 * protection.
 *
 * `PermissionGuard` currently takes a plain `allowed: boolean` rather than
 * a `Permission` string from `domain/permissions.ts`: the live app still
 * runs on `UserProfile`/`UserRole` (src/types.ts) at this point in the
 * migration (Phase 12.2), not yet the richer `AppUser`/`RoleId` model
 * (Phase 12.3 rewires every call site to pass a real `can(...)` result
 * here instead of an ad hoc role check — this component's signature does
 * not need to change when that happens).
 */
import React from 'react';
import { ShieldOff, LogIn } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE : messages d'accès traduits (FR/EN/PT, FR par défaut) ===
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

/**
 * Marks a screen as intentionally public — no check performed. Exists so
 * every route in the tree is explicitly classified (public vs.
 * authenticated vs. permission-gated) rather than "protected by omission",
 * per the brief's "deny by default" principle: an engineer adding a new
 * screen must consciously pick a guard, including this one.
 */
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

interface AuthenticatedRouteProps {
  isAuthenticated: boolean;
  onGoToLogin: () => void;
  children: React.ReactNode;
  lang?: Language;
}

/**
 * Gates every internal/staff screen behind a session having been started
 * (brief section 13: "l'authentification répond 'Qui êtes-vous ?'").
 * Redirect-on-render rather than a silent blank screen, and the message is
 * explicit that this is a demo session gate, never a claim of real
 * server-verified authentication.
 */
export const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({ isAuthenticated, onGoToLogin, children, lang = 'fr' }) => {
  if (isAuthenticated) return <>{children}</>;
  const t = TRANSLATIONS[lang];
  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4 text-blue-600">
        <LogIn className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{t.guard_login_required}</h2>
      <p className="text-xs text-slate-600 mt-2">
        {t.guard_login_required_body}
      </p>
      <button
        onClick={onGoToLogin}
        className="mt-5 px-4 py-2 rounded-xl bg-[#0B2545] text-white text-xs font-bold hover:bg-[#0B2545]/90 transition"
      >
        {t.guard_go_to_login}
      </button>
    </div>
  );
};

interface PermissionGuardProps {
  allowed: boolean;
  label: string;
  children: React.ReactNode;
  lang?: Language;
}

/**
 * Gates a screen behind an authorization check ("qu'avez-vous le droit de
 * voir ou de faire ?", section 13) — distinct from `AuthenticatedRoute`'s
 * identity check. Extracted from App.tsx's original inline
 * `renderAccessDenied` (Phase 5) so every screen shares one implementation
 * instead of re-deriving the same "access denied" card.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ allowed, label, children, lang = 'fr' }) => {
  if (allowed) return <>{children}</>;
  const t = TRANSLATIONS[lang];
  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
        <ShieldOff className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{t.guard_access_restricted}</h2>
      <p className="text-xs text-slate-600 mt-2">
        {t.guard_access_restricted_body.replace('{label}', label)}
      </p>
    </div>
  );
};
