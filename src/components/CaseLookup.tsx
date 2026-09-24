/**
 * ACTIVA Hotline — Phase 4: Case ID Lookup (real Firebase Auth + Firestore)
 *
 * A deliberately narrow tool, honest about what actually works on the
 * Spark plan (see docs/FIREBASE-SETUP.md): real staff sign-in against the
 * project's real Firebase Auth, then a single-document `getDoc` of one
 * known Case ID against the real, deployed `firestore.rules` — no list
 * query, no Cloud Function, because neither is available right now. Search
 * by the human-readable Case Number was tried and confirmed rejected by
 * the deployed rules (any query — even an equality filter — is subject to
 * the same "list provability" constraint as an unfiltered list; only a
 * direct document-id `get` bypasses it), so this deliberately asks for the
 * internal Case ID instead of pretending a nicer search works.
 *
 * This is entirely separate from, and has zero effect on, the Phase 1
 * localStorage-based demo portal (InvestigationDesk etc.) — it uses its
 * own real Firebase Auth session via services/firebaseClient.ts.
 */

import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, FirestoreError, getDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Building2,
  Calendar,
  KeyRound,
  Lock,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';

import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { getPhase4Firebase, isPhase4Configured } from '../services/firebaseClient';
import { Case } from '../domain/caseTypes';
import { CASE_STATUS_LABELS } from '../domain/workflow';
import { ACTIVA_COUNTRIES, formatCountryLabel } from '../data/activaConfig';

interface CaseLookupProps {
  lang: Language;
}

interface StaffClaims {
  role?: string;
  countries?: string[];
  entities?: string[];
  legacyRole?: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-200',
  very_high: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const CaseLookup: React.FC<CaseLookupProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const configured = isPhase4Configured();

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [claims, setClaims] = useState<StaffClaims | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [caseIdInput, setCaseIdInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<(Case & { id: string }) | null>(null);
  const [searchError, setSearchError] = useState<'not_found' | 'access_denied' | 'generic' | ''>('');
  const [searchErrorDetail, setSearchErrorDetail] = useState('');

  useEffect(() => {
    if (!configured) {
      setAuthLoading(false);
      return;
    }
    const { auth } = getPhase4Firebase();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const tokenResult = await u.getIdTokenResult();
          setClaims(tokenResult.claims as StaffClaims);
        } catch {
          setClaims(null);
        }
      } else {
        setClaims(null);
      }
      setAuthLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const { auth } = getPhase4Firebase();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (err) {
      setLoginError(t.fb_lookup_login_error);
      // eslint-disable-next-line no-console
      console.warn('Phase 4 sign-in failed', err);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    const { auth } = getPhase4Firebase();
    await signOut(auth);
    setSearchResult(null);
    setSearchError('');
    setCaseIdInput('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const caseId = caseIdInput.trim();
    if (!caseId) return;

    setSearching(true);
    setSearchError('');
    setSearchErrorDetail('');
    setSearchResult(null);

    try {
      const { db } = getPhase4Firebase();
      const snap = await getDoc(doc(db, 'cases', caseId));
      // === AMÉLIORATION AJOUTÉE : correction après vérification directe (Node/REST) ===
      // Verified live against the real project: because `firestore.rules`
      // evaluates `resource.data.*` unconditionally (isNotImplicated, isInScope,
      // ...), a genuinely non-existent case id ALSO throws `permission-denied`
      // for every role tested (including global-visibility ones) — Firestore
      // never lets a denied read fall through to a clean "not found" here. The
      // `!snap.exists()` branch below is therefore effectively unreachable
      // today; it's kept as a defensive fallback (harmless, and correct) in
      // case a future rules change ever makes existence distinguishable again.
      // The `fb_lookup_access_denied` copy is deliberately worded to never
      // assert that a case exists — see its definition in translations.ts.
      if (!snap.exists()) {
        setSearchError('not_found');
      } else {
        setSearchResult({ id: snap.id, ...(snap.data() as Case) });
      }
    } catch (err) {
      const fsErr = err as FirestoreError;
      if (fsErr.code === 'permission-denied') {
        setSearchError('access_denied');
      } else {
        setSearchError('generic');
        setSearchErrorDetail(fsErr.message || String(err));
      }
    } finally {
      setSearching(false);
    }
  };

  if (!configured) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{t.fb_lookup_not_configured_title}</h2>
        <p className="text-xs text-slate-600 mt-2">{t.fb_lookup_not_configured_body}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-blue-700" />
          <h2 className="text-xl font-bold text-slate-900">{t.fb_lookup_title}</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 uppercase">
            Beta
          </span>
        </div>
        <p className="text-xs text-slate-600">{t.fb_lookup_subtitle}</p>
      </div>

      {authLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-xs text-slate-500">
          {t.fb_lookup_loading}
        </div>
      ) : !user ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-md mx-auto">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-xl bg-[#0B2545] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{t.fb_lookup_login_title}</h3>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="activa-caret-blink space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.fb_lookup_login_email}</label>
              <input
                type="email"
                id="fb-lookup-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@group-activa.com"
                required
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.fb_lookup_login_password}</label>
              <input
                type="password"
                id="fb-lookup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              id="fb-lookup-login-submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-60 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{loggingIn ? t.fb_lookup_login_pending : t.fb_lookup_login_button}</span>
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Signed-in banner */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserCircle2 className="w-8 h-8 text-blue-700" />
              <div>
                <div className="text-xs font-bold text-slate-900">{user.email}</div>
                <div className="text-[11px] text-slate-500">
                  {t.fb_lookup_signed_in_as}{' '}
                  <span className="font-semibold text-slate-700">{claims?.role || '—'}</span>
                  {claims?.countries && claims.countries.length > 0 && ` · ${claims.countries.join(', ')}`}
                  {claims?.entities && claims.entities.length > 0 && ` · ${claims.entities.join(', ')}`}
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.fb_lookup_sign_out}
            </button>
          </div>

          {/* Search form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              {t.fb_lookup_search_label}
            </label>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                id="fb-lookup-caseid-input"
                value={caseIdInput}
                onChange={(e) => setCaseIdInput(e.target.value)}
                placeholder={t.fb_lookup_search_placeholder}
                className="flex-1 px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                id="fb-lookup-search-submit"
                disabled={searching || !caseIdInput.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow transition"
              >
                <Search className="w-4 h-4" />
                {searching ? t.fb_lookup_searching : t.fb_lookup_search_button}
              </button>
            </form>
            <p className="text-[11px] text-slate-500 mt-2">{t.fb_lookup_search_hint}</p>
          </div>

          {/* Result / errors */}
          {searchError === 'not_found' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
              {t.fb_lookup_not_found}
            </div>
          )}
          {searchError === 'access_denied' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              {t.fb_lookup_access_denied}
            </div>
          )}
          {searchError === 'generic' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {t.fb_lookup_error_generic}
              </div>
              {searchErrorDetail && <div className="mt-1 text-[11px] text-rose-700 font-mono">{searchErrorDetail}</div>}
            </div>
          )}

          {searchResult && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-[#0B2545] p-5 text-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-lg font-extrabold">{searchResult.caseNumber}</div>
                  <div className="text-[11px] text-slate-300">{searchResult.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 border border-white/20">
                    {CASE_STATUS_LABELS[searchResult.status]?.[lang === 'en' ? 'en' : 'fr'] || searchResult.status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${PRIORITY_BADGE[searchResult.priority] || PRIORITY_BADGE.low}`}>
                    {searchResult.priority.toUpperCase()} · {searchResult.riskScore}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block">{t.fb_lookup_field_category}</span>
                    <span className="font-semibold text-slate-800">{searchResult.category}</span>
                    {searchResult.subcategory && (
                      <div className="text-[11px] text-slate-500">{searchResult.subcategory}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {t.fb_lookup_field_location}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {searchResult.entity} ({formatCountryLabel(ACTIVA_COUNTRIES, searchResult.country)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {t.fb_lookup_field_received}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {new Date(searchResult.receivedAt).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.fb_lookup_field_confidentiality}</span>
                    <span className="font-semibold text-slate-800">{searchResult.confidentialityLevel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.fb_lookup_field_assignee}</span>
                    <span className="font-mono text-[11px] text-slate-800">{searchResult.assignee || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.fb_lookup_field_reporting_mode}</span>
                    <span className="font-semibold text-slate-800">{searchResult.reportingMode}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">{t.fb_lookup_field_description}</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {searchResult.description}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{t.fb_lookup_subcollections_note}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
