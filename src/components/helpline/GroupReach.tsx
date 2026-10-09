/**
 * === AMÉLIORATION AJOUTÉE (ligne d'assistance ouverte à tout le Groupe) ===
 *
 * Retenu : `GroupCountriesTicker` (proposition A). Propositions pour montrer, sur la page « Ligne d'assistance », que la
 * plateforme est disponible pour l'ensemble des filiales du Groupe :
 * - `GroupCountriesTicker` : bande de pays qui défilent en continu (drapeau
 *   stylisé + nom) sous le carrousel des canaux ;
 * - `GroupReachCard` : carte « Toutes les filiales du Groupe » ajoutée au
 *   carrousel (pays, nombre de filiales, mêmes canaux partout) ;
 * - `CountrySlide` : une carte par pays (drapeau, filiales du pays, canaux).
 *
 * Les pays et filiales viennent de la liste du Groupe (activaConfig). Les
 * drapeaux sont dessinés (bandes de couleurs simplifiées) : les émojis de
 * drapeaux ne s'affichent pas sous Windows.
 */
import React from 'react';
import { Building2, Globe2, Mail, MessageCircle } from 'lucide-react';
import { ACTIVA_COUNTRIES, ACTIVA_ENTITIES } from '../../data/activaConfig';
import { trData } from '../../i18n/dataLabels';
import type { Language } from '../../types';

/** Couleurs simplifiées des drapeaux (bandes), sens 'v' vertical ou 'h' horizontal. */
const FLAG_STRIPES: Record<string, { dir: 'v' | 'h'; colors: string[]; bg?: string }> = {
  CM: { dir: 'v', colors: ['#007A5E', '#CE1126', '#FCD116'] },
  CD: { dir: 'h', colors: ['#007FFF'], bg: 'linear-gradient(150deg, #007FFF 0 36%, #F7D618 36% 41%, #CE1021 41% 59%, #F7D618 59% 64%, #007FFF 64%)' },
  GN: { dir: 'v', colors: ['#CE1126', '#FCD116', '#009460'] },
  CI: { dir: 'v', colors: ['#F77F00', '#FFFFFF', '#009E60'] },
  GH: { dir: 'h', colors: ['#CE1126', '#FCD116', '#006B3F'] },
  LR: { dir: 'h', colors: ['#BF0A30'], bg: 'linear-gradient(#002868, #002868) 0 0 / 42% 56% no-repeat, repeating-linear-gradient(180deg, #BF0A30 0 18.2%, #FFFFFF 18.2% 36.4%)' },
  SL: { dir: 'h', colors: ['#1EB53A', '#FFFFFF', '#0072C6'] },
  MU: { dir: 'h', colors: ['#EA2839', '#1A206D', '#FFD500', '#00A551'] },
  FR: { dir: 'v', colors: ['#0055A4', '#FFFFFF', '#EF4135'] },
  AO: { dir: 'h', colors: ['#CC092F', '#000000'] },
};

// === AMÉLIORATION AJOUTÉE (étoiles des drapeaux) === sur demande explicite
// (étoile du Cameroun absente) : étoile dessinée par-dessus les bandes pour
// les drapeaux qui en portent une (position en % du drapeau, taille en % de
// sa hauteur).
const FLAG_STARS: Record<string, { color: string; x: number; y: number; size: number }> = {
  CM: { color: '#FCD116', x: 50, y: 50, size: 46 },
  GH: { color: '#000000', x: 50, y: 50, size: 34 },
  CD: { color: '#F7D618', x: 18, y: 24, size: 36 },
  LR: { color: '#FFFFFF', x: 21, y: 28, size: 34 },
};

function FlagStar({ code }: { code: string }) {
  const star = FLAG_STARS[code];
  if (!star) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${star.x}%`, top: `${star.y}%`, height: `${star.size}%`, aspectRatio: '1' }}
    >
      <polygon fill={star.color} points="12,1.5 14.6,9 22.5,9 16.1,13.8 18.5,21.5 12,16.8 5.5,21.5 7.9,13.8 1.5,9 9.4,9" />
    </svg>
  );
}

// === AMÉLIORATION AJOUTÉE (emblème de l'Angola) === sur demande explicite :
// demi-roue dentée, machette et étoile jaunes, simplifiées pour rester
// lisibles en petit.
function AngolaEmblem() {
  return (
    <svg viewBox="0 0 24 24" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ height: '78%', aspectRatio: '1' }}>
      <g fill="none" stroke="#FFCB00" strokeLinecap="butt">
        <path d="M5.3 9.9 A7 7 0 1 0 16.9 7" strokeWidth="2.4" />
        <path d="M3.4 9.3 A9 9 0 1 0 18.3 5.6" strokeWidth="1.8" strokeDasharray="1.5 1.3" />
        <path d="M6.5 17.5 L17.5 6.5" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <polygon fill="#FFCB00" points="8.8,5.6 9.6,8 12.1,8 10.1,9.5 10.8,11.9 8.8,10.4 6.8,11.9 7.5,9.5 5.5,8 8,8" />
    </svg>
  );
}

export function FlagMark({ code, className = 'w-7 h-5' }: { code: string; className?: string }) {
  const f = FLAG_STRIPES[code];
  if (!f) return <span className={`${className} rounded-[4px] bg-slate-200`} aria-hidden="true" />;
  const step = 100 / f.colors.length;
  const stops = f.colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ');
  return (
    <span
      aria-hidden="true"
      className={`${className} relative inline-block shrink-0 overflow-hidden rounded-[4px] ring-1 ring-black/10 shadow-sm`}
      style={{ background: f.bg ?? `linear-gradient(${f.dir === 'v' ? '90deg' : '180deg'}, ${stops})` }}
    >
      <FlagStar code={code} />
      {code === 'AO' && <AngolaEmblem />}
    </span>
  );
}

export interface GroupCountry {
  code: string;
  name: string;
  entities: string[];
}

export function groupCountries(lang?: Language): GroupCountry[] {
  return ACTIVA_COUNTRIES.map((c) => ({
    code: c.code,
    name: trData(c.name, lang),
    entities: ACTIVA_ENTITIES.filter((e) => e.country === c.name).map((e) => e.name),
  }));
}

/* ------------------------------------------------------------------ */
/* Proposition A — bande de pays qui défilent                          */
/* ------------------------------------------------------------------ */
export function GroupCountriesTicker({ label, lang }: { label: string; lang?: Language }) {
  const countries = groupCountries(lang);
  const row = [...countries, ...countries];
  return (
    <div className="mt-6">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#C9DAF8]">
        <Globe2 className="w-3.5 h-3.5" strokeWidth={2} />
        {label}
      </p>
      <div className="relative mt-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="activa-ticker flex w-max gap-2.5 py-1 hover:[animation-play-state:paused]">
          {row.map((c, i) => (
            <span
              key={`${c.code}-${i}`}
              aria-hidden={i >= countries.length}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20 backdrop-blur"
            >
              <FlagMark code={c.code} className="w-5 h-3.5" />
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition B — carte « Toutes les filiales du Groupe »             */
/* ------------------------------------------------------------------ */
export function GroupReachCard({ title, subtitle }: { title: string; subtitle: string }) {
  const countries = groupCountries();
  const entityCount = ACTIVA_ENTITIES.length;
  return (
    <div className="h-full bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-7 sm:p-9 flex flex-col">
      {/* === AMÉLIORATION AJOUTÉE (texte simplifié) === sur demande explicite :
          sans titre, l'en-tête se réduit à l'icône et la phrase principale ;
          la pastille « pays · filiales » et le pied « WhatsApp · E-mail »
          restent dans le code, masqués. */}
      <div className={`${title ? 'flex' : 'hidden'} items-center justify-between gap-3 flex-wrap`}>
        <span className="inline-flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]">
            <Globe2 className="w-5 h-5" strokeWidth={1.8} />
          </span>
          <span className="text-[15px] font-extrabold text-[#0B2545]">{title}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF3FC] px-2.5 py-1 text-[11px] font-bold text-[#1449B0]">
          {countries.length} pays · {entityCount} filiales
        </span>
      </div>
      <p className={`${title ? 'mt-6' : 'flex items-center gap-3'} text-[22px] sm:text-[26px] font-extrabold tracking-tight leading-tight text-[#0B2545]`}>
        {!title && (
          <span className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-[#2B5FC8] to-[#0F3C93] text-white flex items-center justify-center shadow-[0_10px_22px_-10px_rgb(20_73_176/0.95)]">
            <Globe2 className="w-5 h-5" strokeWidth={1.8} />
          </span>
        )}
        {subtitle}
      </p>
      <div className={`${title ? 'mt-5' : 'mt-7'} grid grid-cols-2 gap-x-4 gap-y-3`}>
        {countries.map((c) => (
          <span key={c.code} className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-700">
            <FlagMark code={c.code} className="w-6 h-4" />
            {c.name}
          </span>
        ))}
      </div>
      <div className={`${title ? 'flex' : 'hidden'} mt-auto pt-6 items-center gap-4 text-[12.5px] text-slate-500`}>
        <span className="inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-[#1449B0]" strokeWidth={2} />WhatsApp</span>
        <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#1449B0]" strokeWidth={2} />E-mail</span>
        <span className="text-slate-400">· mêmes canaux partout</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition C — une carte par pays                                  */
/* ------------------------------------------------------------------ */
export function CountrySlide({ country, openLabel, onWhatsApp, onEmail }: { country: GroupCountry; openLabel: string; onWhatsApp: string; onEmail: string }) {
  return (
    <div className="h-full bg-white rounded-[28px] border border-slate-200/90 shadow-[0_40px_80px_-36px_rgb(3_16_48/0.85)] p-7 sm:p-9 flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center gap-3">
          <FlagMark code={country.code} className="w-11 h-8 rounded-md" />
          <span className="text-[24px] font-extrabold tracking-tight text-[#0B2545]">{country.name}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          <span className="activa-live-dot w-2 h-2 rounded-full bg-emerald-500" />
          {openLabel}
        </span>
      </div>
      <ul className="mt-6 space-y-2">
        {country.entities.map((e) => (
          <li key={e} className="flex items-center gap-2 text-[14px] font-semibold text-slate-700">
            <Building2 className="w-4 h-4 text-[#1449B0] shrink-0" strokeWidth={1.9} />
            {e}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7 grid grid-cols-2 gap-2.5">
        <a href={onWhatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#2B5FC8] to-[#1449B0] text-white text-sm font-bold shadow-lg shadow-[#1449B0]/30">
          <MessageCircle className="w-4 h-4" strokeWidth={2} />
          WhatsApp
        </a>
        <a href={onEmail} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold">
          <Mail className="w-4 h-4" strokeWidth={1.9} />
          E-mail
        </a>
      </div>
    </div>
  );
}
