/**
 * === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
 *
 * Écran d'administration des notifications e-mail envoyées par le serveur :
 * pour chaque groupe (Superviseurs, DARC, Directeur Général Adjoint, DRH),
 * les comptes du portail prévenus (par rôle), les adresses supplémentaires,
 * et pour chaque événement les conditions d'envoi — « toujours » ou « le cas
 * échéant » (dossier critique, dossier RH, personne de rang Direction mise en
 * cause). Les réglages sont partagés par tous les postes et appliqués par le
 * serveur ; un e-mail d'essai vérifie le service d'envoi et les adresses.
 */
import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Save, Send, XCircle } from 'lucide-react';
// === AMÉLIORATION AJOUTÉE (écran aéré) ===
import { Briefcase, ChevronDown, FlaskConical, GitBranch, HeartHandshake, Plus, Search, ShieldCheck, Tags, Users, UserX } from 'lucide-react';
import { ChipListInput, PillToggle, SaveBar, SegmentedTabs, Switch } from '../ui/AdminControls';
import type { UserProfile } from '../../types';
import { storage } from '../../services/storage';
import {
  DEFAULT_INVESTIGATOR_KEYWORDS,
  DEFAULT_ROUTING,
  GROUP_LABEL,
  isValidEmail,
  parseContact,
  RECIPIENT_GROUP_IDS,
  resolveNotificationRecipients,
  routingPlan,
  ROUTING_CASES,
  type CaseNotificationFacts,
  type RoutingCase,
  type StaffRecipientCandidate,
  NOTIFIABLE_ROLES,
  NOTIFICATION_CONDITIONS,
  NOTIFICATION_EVENTS,
  type EmailNotificationSettings,
  type NotificationCondition,
  type NotificationEvent,
  type RecipientGroup,
} from '../../domain/emailNotificationRules';
import type { CasePriority, RoleId } from '../../domain/caseTypes';

// === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
const ROUTING_LABEL: Record<RoutingCase, string> = {
  none: 'Personne du dispositif n’est mise en cause',
  investigators: 'Un enquêteur est mis en cause',
  supervisors: 'Un superviseur est mis en cause',
  darc: 'La DARC est mise en cause',
  dga: 'Le DGA est mis en cause',
  drh: 'Le DRH est mis en cause',
};
const SHORT_GROUP: Record<string, string> = { supervisors: 'Superviseurs', darc: 'DARC', dga: 'DGA', drh: 'DRH' };
const splitList = (v: string) =>
  v
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
// === AMÉLIORATION AJOUTÉE (écran aéré) === une adresse par ligne
const splitLines = (v: string) =>
  v
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);

const EVENT_LABEL: Record<NotificationEvent, string> = {
  new_report: 'Nouveau signalement',
  assigned: 'Attribution à un enquêteur',
  escalated: 'Escalade',
  closed: 'Clôture',
  reopened: 'Réouverture',
};
const CONDITION_LABEL: Record<NotificationCondition, { label: string; hint: string }> = {
  always: { label: 'Toujours', hint: 'Chaque dossier' },
  critical: { label: 'Dossier critique', hint: 'Priorité très élevée ou critique' },
  hr: { label: 'Dossier RH', hint: 'Catégories RH ci-dessous, harcèlement, discrimination…' },
  senior_implicated: { label: 'Direction mise en cause', hint: 'Sous-directeur, directeur ou plus' },
};
const ROLE_LABEL: Record<string, string> = {
  functional_admin: 'Opérateurs (Admin fonctionnel)',
  senior_investigator: 'Responsables des investigations',
  darc_compliance: 'DARC / Conformité',
  executive: 'Direction générale',
  audit_committee: 'Comité d’audit',
  consultation: 'Consultation',
};
// === AMÉLIORATION AJOUTÉE (écran aéré) ===
const GROUP_ICON: Record<RecipientGroup['id'], React.ReactNode> = {
  supervisors: <Users className="w-4 h-4" />,
  darc: <ShieldCheck className="w-4 h-4" />,
  dga: <Briefcase className="w-4 h-4" />,
  drh: <HeartHandshake className="w-4 h-4" />,
};
const GROUP_HELP: Record<RecipientGroup['id'], string> = {
  supervisors: 'Comptes qui pilotent le traitement des dossiers, dans leur périmètre pays / entité.',
  darc: 'Direction Audit, Risques et Conformité : comptes DARC et boîte e-mail de la DARC.',
  dga: 'Prévenu le cas échéant : dossier critique ou personne de rang Direction mise en cause, et escalades.',
  drh: 'Prévenu le cas échéant : dossiers relevant des Ressources Humaines.',
};

type TestResult = { email: string; ok: boolean; error?: string };

export const EmailNotificationsTab: React.FC<{ activeUser: UserProfile }> = ({ activeUser }) => {
  const [settings, setSettings] = useState<EmailNotificationSettings>(() => storage.getEmailNotificationSettings());
  const [extraText, setExtraText] = useState<Record<string, string>>(() =>
    Object.fromEntries(storage.getEmailNotificationSettings().groups.map((g) => [g.id, g.extraEmails.join('\n')]))
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  // === AMÉLIORATION AJOUTÉE (acheminement) === simulation d'une alerte
  const [simPersons, setSimPersons] = useState([{ name: '', position: '' }]);
  const [simCategory, setSimCategory] = useState('');
  const [simPriority, setSimPriority] = useState<CasePriority>('high');
  const [keywordText, setKeywordText] = useState<Record<string, string>>(() => {
    const st = storage.getEmailNotificationSettings();
    return {
      investigators: (st.investigatorKeywords ?? DEFAULT_INVESTIGATOR_KEYWORDS).join(', '),
      ...Object.fromEntries(st.groups.map((g) => [g.id, (g.functionKeywords ?? []).join(', ')])),
    };
  });
  const [tests, setTests] = useState<Record<string, TestResult[] | string>>({});
  // === AMÉLIORATION AJOUTÉE (écran aéré) === onglet et groupe affichés
  const [tab, setTab] = useState<'routing' | 'groups' | 'hr'>('routing');
  const [selectedGroup, setSelectedGroup] = useState<RecipientGroup['id']>('supervisors');
  const savedSnapshot = useRef<string | null>(null);
  const categories = useMemo(() => storage.getCategories().map((c) => c.name), []);
  const staff = useMemo(() => storage.getUsers(), []);

  const updateGroup = (id: RecipientGroup['id'], change: (g: RecipientGroup) => RecipientGroup) =>
    setSettings((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? change(g) : g)) }));

  const toggleCondition = (g: RecipientGroup, ev: NotificationEvent, c: NotificationCondition) => {
    const current = g.events[ev] ?? [];
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    updateGroup(g.id, (x) => ({ ...x, events: { ...x.events, [ev]: next } }));
  };

  /** Réglages courants (adresses et fonctions saisies comprises). */
  const current = (): EmailNotificationSettings => ({
    ...settings,
    investigatorKeywords: splitList(keywordText.investigators ?? ''),
    groups: settings.groups.map((g) => ({
      ...g,
      // une ligne par destinataire : « adresse » ou « Prénom Nom <adresse> »
      extraEmails: (extraText[g.id] ?? '')
        .split(/\n|;/)
        .map((e) => e.trim())
        .filter(Boolean),
      functionKeywords: splitList(keywordText[g.id] ?? ''),
    })),
  });

  const invalidAddresses = current().groups.flatMap((g) => g.extraEmails.map((e) => parseContact(e).email).filter((e) => !isValidEmail(e)));

  // === AMÉLIORATION AJOUTÉE (acheminement) ===
  const routing = { ...DEFAULT_ROUTING, ...(settings.routing ?? {}) };
  const toggleRoute = (c: RoutingCase, g: RecipientGroup['id']) =>
    setSettings((s) => {
      const r = { ...DEFAULT_ROUTING, ...(s.routing ?? {}) };
      const list = r[c] ?? [];
      return { ...s, routing: { ...r, [c]: list.includes(g) ? list.filter((x) => x !== g) : [...list, g] } };
    });
  const staffCandidates: StaffRecipientCandidate[] = staff
    .filter((u) => u.email)
    .map((u) => ({
      uid: u.id,
      email: u.email,
      name: u.name,
      role: u.role as RoleId,
      active: u.active !== false,
      countries: u.countries ?? [],
      entities: u.entities ?? [],
    }));
  const simFacts: CaseNotificationFacts = {
    reference: 'SIMULATION',
    category: simCategory || categories[0] || '',
    entity: '',
    country: '',
    priority: simPriority,
    implicatedLevels: [],
    implicatedPersons: simPersons.filter((p) => p.name.trim() || p.position.trim()),
  };
  const simSettings = current();
  const simPlan = routingPlan(simSettings, simFacts, staffCandidates);
  const simRecipients = resolveNotificationRecipients({ event: 'new_report', facts: simFacts, settings: simSettings, staff: staffCandidates });

  // === AMÉLIORATION AJOUTÉE (écran aéré) === modifications non enregistrées
  const snapshot = JSON.stringify(simSettings);
  if (savedSnapshot.current === null) savedSnapshot.current = snapshot;
  const dirty = snapshot !== savedSnapshot.current;

  const save = () => {
    try {
      storage.updateEmailNotificationSettings(current(), activeUser);
      // l'état de référence est repris au prochain affichage (réglages normalisés)
      savedSnapshot.current = null;
      setSettings(storage.getEmailNotificationSettings());
      setMessage({ ok: true, text: 'Réglages enregistrés et partagés avec tous les postes.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    }
  };

  const sendTest = async (groupId: RecipientGroup['id']) => {
    setTesting(groupId);
    setTests((t) => ({ ...t, [groupId]: [] }));
    try {
      const [{ getPhase4Functions, isPhase4Configured }, { httpsCallable }] = await Promise.all([
        import('../../services/firebaseClient'),
        import('firebase/functions'),
      ]);
      if (!isPhase4Configured()) throw new Error('Serveur non configuré.');
      const fn = httpsCallable<{ groupId: string; settings: EmailNotificationSettings }, { results: TestResult[] }>(
        await getPhase4Functions(),
        'sendTestNotificationEmail'
      );
      const res = await fn({ groupId, settings: current() });
      setTests((t) => ({ ...t, [groupId]: res.data.results.length ? res.data.results : 'Aucun destinataire pour ce groupe.' }));
    } catch (e) {
      setTests((t) => ({ ...t, [groupId]: e instanceof Error ? e.message : 'Envoi impossible.' }));
    } finally {
      setTesting(null);
    }
  };

  // === AMÉLIORATION AJOUTÉE (écran aéré) === présentation en onglets : une
  // partie des réglages à la fois, un groupe de destinataires à la fois, des
  // pastilles cliquables à la place des grilles de cases à cocher, et la
  // simulation toujours visible sur le côté. Mêmes réglages, même logique.
  const selected = settings.groups.find((g) => g.id === selectedGroup) ?? settings.groups[0];
  const selectedAccounts = staff.filter((u) => u.active !== false && selected.roles.includes(u.role as RoleId) && u.email);
  const selectedExtra = splitLines(extraText[selected.id] ?? '');
  const selectedTest = tests[selected.id];
  const groupRecipientCount = (g: RecipientGroup) =>
    staff.filter((u) => u.active !== false && g.roles.includes(u.role as RoleId) && u.email).length + splitLines(extraText[g.id] ?? '').length;
  const setEventConditions = (g: RecipientGroup, ev: NotificationEvent, next: NotificationCondition[]) =>
    updateGroup(g.id, (x) => ({ ...x, events: { ...x.events, [ev]: next } }));
  const REASON_SHORT: Record<string, string> = { escalation: 'escalade', hr: 'dossier RH', critical: 'dossier critique', senior_implicated: 'Direction mise en cause' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 text-xs">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <Mail className="w-4.5 h-4.5" />
            </span>
            Notifications e-mail
          </h2>
          <p className="text-slate-500 mt-1.5 max-w-2xl">
            Qui est prévenu, et quand. Les e-mails ne contiennent jamais les faits, l’identité du déclarant ni le nom des personnes
            mises en cause.
          </p>
        </div>
        <SegmentedTabs<'routing' | 'groups' | 'hr'>
          idPrefix="notif-tab"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'routing', label: 'Acheminement', icon: <GitBranch className="w-3.5 h-3.5" /> },
            { key: 'groups', label: 'Destinataires', icon: <Users className="w-3.5 h-3.5" /> },
            { key: 'hr', label: 'Catégories RH', icon: <Tags className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      {message && (
        <div className={`px-3.5 py-2.5 rounded-xl border font-semibold activa-enter ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.text}
        </div>
      )}
      {invalidAddresses.length > 0 && (
        <div className="px-3.5 py-2.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 font-semibold">
          Adresse(s) invalide(s) : {invalidAddresses.join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 space-y-5" key={tab}>
          {tab === 'routing' && (
            <section className="activa-enter bg-white rounded-2xl border border-slate-200 shadow-sm" id="notif-routing">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Qui reçoit une nouvelle alerte ?</h3>
                <p className="text-slate-500 mt-0.5">Selon la personne mise en cause. Un niveau mis en cause n’est jamais prévenu.</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {ROUTING_CASES.map((c, i) => (
                  <li
                    key={c}
                    className={`activa-enter flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3.5 ${c === 'none' ? 'bg-gradient-to-r from-blue-50/70 to-transparent' : ''}`}
                    style={{ ['--d' as string]: `${i * 50}ms` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          c === 'none' ? 'bg-blue-600 text-white' : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}
                      >
                        {c === 'none' ? <ShieldCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </span>
                      <span className="font-semibold text-slate-800">{ROUTING_LABEL[c]}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {RECIPIENT_GROUP_IDS.map((g) =>
                        g === c ? (
                          <PillToggle key={g} selected={false} onToggle={() => undefined} disabled title="Un niveau mis en cause n’est jamais prévenu">
                            {SHORT_GROUP[g]} · mis en cause
                          </PillToggle>
                        ) : (
                          <PillToggle key={g} id={`route-${c}-${g}`} selected={(routing[c] ?? []).includes(g)} onToggle={() => toggleRoute(c, g)}>
                            {SHORT_GROUP[g]}
                          </PillToggle>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <details className="group border-t border-slate-100 px-5 py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    Comment le système reconnaît un enquêteur mis en cause
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-slate-500">
                    Par son nom (compte du portail), ou par l’une de ces fonctions citées dans l’alerte. Les fonctions des autres niveaux se
                    règlent dans l’onglet Destinataires.
                  </p>
                  <ChipListInput
                    id="notif-kw-investigators"
                    values={splitList(keywordText.investigators ?? '')}
                    onChange={(v) => setKeywordText((k) => ({ ...k, investigators: v.join(', ') }))}
                    placeholder="Ajouter une fonction…"
                  />
                </div>
              </details>
            </section>
          )}

          {tab === 'groups' && (
            <div className="space-y-4">
              <nav className="activa-enter grid grid-cols-2 md:grid-cols-4 gap-2" aria-label="Groupes de destinataires">
                {settings.groups.map((g) => {
                  const active = g.id === selected.id;
                  const n = groupRecipientCount(g);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      id={`notif-group-${g.id}`}
                      onClick={() => setSelectedGroup(g.id)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all duration-300 ${
                        active ? 'bg-white border-blue-300 ring-4 ring-blue-100/70 shadow-sm' : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {GROUP_ICON[g.id]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold truncate ${active ? 'text-blue-800' : 'text-slate-800'}`}>{SHORT_GROUP[g.id]}</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${g.enabled ? (n ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-300'}`} />
                          {!g.enabled ? 'Désactivé' : n ? `${n} destinataire${n > 1 ? 's' : ''}` : 'Aucun destinataire'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <section key={selected.id} className="activa-enter bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                <div className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{GROUP_LABEL[selected.id]}</h3>
                    <p className="text-slate-500 mt-0.5 max-w-xl">{GROUP_HELP[selected.id]}</p>
                  </div>
                  <Switch
                    id={`notif-enabled-${selected.id}`}
                    checked={selected.enabled}
                    onChange={(v) => updateGroup(selected.id, (x) => ({ ...x, enabled: v }))}
                    label={selected.enabled ? 'Activé' : 'Désactivé'}
                  />
                </div>

                <div className={`p-5 space-y-5 transition-opacity duration-300 ${selected.enabled ? '' : 'opacity-50'}`}>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-slate-800">Comptes du portail</span>
                      <span className="text-[11px] text-slate-500">
                        {selectedAccounts.length ? `${selectedAccounts.length} compte(s)` : 'Aucun compte'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {NOTIFIABLE_ROLES.map((r) => (
                        <PillToggle
                          key={r}
                          id={`notif-role-${selected.id}-${r}`}
                          selected={selected.roles.includes(r)}
                          onToggle={() =>
                            updateGroup(selected.id, (x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }))
                          }
                        >
                          {ROLE_LABEL[r] ?? r}
                        </PillToggle>
                      ))}
                    </div>
                    {selectedAccounts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {selectedAccounts.slice(0, 8).map((u) => (
                          <span key={u.id} className="inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
                              {u.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                            {u.name}
                          </span>
                        ))}
                        {selectedAccounts.length > 8 && <span className="text-[11px] text-slate-500 self-center">+{selectedAccounts.length - 8}</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`notif-emails-${selected.id}`} className="block font-bold text-slate-800 mb-1">
                      Adresses e-mail supplémentaires
                    </label>
                    <p className="text-slate-500 mb-2">« adresse » ou « Prénom Nom &lt;adresse&gt; » — Entrée pour ajouter.</p>
                    <ChipListInput
                      id={`notif-emails-${selected.id}`}
                      mono
                      splitOnComma={false}
                      values={selectedExtra}
                      onChange={(v) => setExtraText((t) => ({ ...t, [selected.id]: v.join('\n') }))}
                      isInvalid={(v) => !isValidEmail(parseContact(v).email)}
                      placeholder={selected.id === 'dga' ? 'Prénom Nom <dga@group-activa.com>' : selected.id === 'drh' ? 'Prénom Nom <drh@group-activa.com>' : 'adresse@group-activa.com'}
                    />
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 mb-2">Quand prévenir ce groupe</div>
                    <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      {NOTIFICATION_EVENTS.map((ev) => {
                        const conds = selected.events[ev] ?? [];
                        const always = conds.includes('always');
                        const mode: 'never' | 'always' | 'conditional' = conds.length === 0 ? 'never' : always ? 'always' : 'conditional';
                        const MODES: { key: typeof mode; label: string; on: string }[] = [
                          { key: 'never', label: 'Jamais', on: 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200' },
                          { key: 'always', label: 'Toujours', on: 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200' },
                          { key: 'conditional', label: 'Le cas échéant', on: 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-200' },
                        ];
                        return (
                          <li key={ev} className="px-3.5 py-2.5 hover:bg-slate-50/60 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="font-semibold text-slate-700">{EVENT_LABEL[ev]}</span>
                              <div role="radiogroup" aria-label={EVENT_LABEL[ev]} className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
                                {MODES.map((m) => (
                                  <button
                                    key={m.key}
                                    type="button"
                                    role="radio"
                                    id={`notif-${selected.id}-${ev}-${m.key}`}
                                    aria-checked={mode === m.key}
                                    onClick={() =>
                                      setEventConditions(
                                        selected,
                                        ev,
                                        m.key === 'never' ? [] : m.key === 'always' ? ['always'] : mode === 'conditional' ? conds : ['critical']
                                      )
                                    }
                                    className={`px-3 py-1 rounded-[10px] text-[11px] font-semibold transition-all duration-300 ${mode === m.key ? m.on : 'text-slate-500 hover:text-slate-800'}`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {mode === 'conditional' && (
                              <div className="activa-enter flex flex-wrap items-center gap-1.5 mt-2 sm:justify-end">
                                <span className="text-[11px] text-slate-500 mr-1">si :</span>
                                {NOTIFICATION_CONDITIONS.filter((c) => c !== 'always').map((c) => (
                                  <PillToggle
                                    key={c}
                                    id={`notif-${selected.id}-${ev}-${c}`}
                                    tone="violet"
                                    title={CONDITION_LABEL[c].hint}
                                    selected={conds.includes(c)}
                                    onToggle={() => {
                                      const next = conds.includes(c) ? conds.filter((x) => x !== c) : [...conds, c];
                                      setEventConditions(selected, ev, next);
                                    }}
                                  >
                                    {CONDITION_LABEL[c].label}
                                  </PillToggle>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-slate-500 mt-1.5">« Le cas échéant » : seulement pour les dossiers concernés (critique, RH, Direction mise en cause).</p>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer list-none flex items-center justify-between font-bold text-slate-800">
                      Reconnaître ce niveau dans une alerte
                      <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-slate-500">Fonctions qui, citées dans une alerte, désignent ce niveau comme mis en cause.</p>
                      <ChipListInput
                        id={`notif-kw-${selected.id}`}
                        values={splitList(keywordText[selected.id] ?? '')}
                        onChange={(v) => setKeywordText((k) => ({ ...k, [selected.id]: v.join(', ') }))}
                        placeholder="Ajouter une fonction…"
                      />
                    </div>
                  </details>
                </div>

                <div className="flex flex-wrap items-center gap-3 p-5 bg-slate-50/60 rounded-b-2xl">
                  <button
                    type="button"
                    id={`notif-test-${selected.id}`}
                    onClick={() => void sendTest(selected.id)}
                    disabled={testing !== null || invalidAddresses.length > 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {testing === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Envoyer un e-mail d’essai
                  </button>
                  {typeof selectedTest === 'string' && <span className="text-rose-700 font-semibold">{selectedTest}</span>}
                  {Array.isArray(selectedTest) && selectedTest.length > 0 && (
                    <ul className="w-full space-y-1">
                      {selectedTest.map((r) => (
                        <li key={r.email} className="flex items-start gap-1.5">
                          {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />}
                          <span className="font-mono">{r.email}</span>
                          <span className={r.ok ? 'text-emerald-700' : 'text-rose-700'}>{r.ok ? 'envoyé' : r.error}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'hr' && (
            <section className="activa-enter bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Catégories relevant des Ressources Humaines</h3>
                <p className="text-slate-500 mt-0.5">
                  Pour la condition « Dossier RH ». Harcèlement, discrimination et conditions de travail sont aussi reconnus.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <PillToggle
                    key={c}
                    selected={settings.hrCategories.includes(c)}
                    onToggle={() =>
                      setSettings((s) => ({
                        ...s,
                        hrCategories: s.hrCategories.includes(c) ? s.hrCategories.filter((x) => x !== c) : [...s.hrCategories, c],
                      }))
                    }
                  >
                    {c}
                  </PillToggle>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-4 activa-enter-x" id="notif-simulation" style={{ ['--d' as string]: '120ms' }}>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-br from-[#0B2545] to-[#134074] text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-sky-300" />
                Simulation
              </h3>
              <p className="text-[11px] text-blue-100/80 mt-0.5">À qui partirait une alerte ? Aucun e-mail n’est envoyé.</p>
            </div>
            <div className="p-4 space-y-2.5">
              {simPersons.map((p, i) => (
                <div key={i} className="grid grid-cols-1 gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <input
                    id={`sim-name-${i}`}
                    placeholder="Personne mise en cause (prénom nom)"
                    value={p.name}
                    onChange={(e) => setSimPersons((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                  <input
                    id={`sim-position-${i}`}
                    placeholder="ou sa fonction (Superviseur, DARC…)"
                    value={p.position}
                    onChange={(e) => setSimPersons((l) => l.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                </div>
              ))}
              {simPersons.length < 4 && (
                <button type="button" onClick={() => setSimPersons((l) => [...l, { name: '', position: '' }])} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Ajouter une personne
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <select id="sim-category" value={simCategory} onChange={(e) => setSimCategory(e.target.value)} className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 min-w-0">
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select id="sim-priority" value={simPriority} onChange={(e) => setSimPriority(e.target.value as CasePriority)} className="px-2 py-1.5 rounded-lg bg-white border border-slate-200">
                  <option value="low">Priorité faible</option>
                  <option value="high">Priorité élevée</option>
                  <option value="very_high">Priorité très élevée</option>
                  <option value="critical">Priorité critique</option>
                </select>
              </div>
            </div>
            <div className="px-4 pb-4" id="sim-result">
              <div className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-gradient-to-b from-white to-slate-50/60">
                <div className="text-[11px] text-slate-500">
                  Règle appliquée
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{ROUTING_LABEL[simPlan.routingCase]}</div>
                  {simPlan.implicated.length > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                      <UserX className="w-3 h-3" />
                      Écarté(s) : {simPlan.implicated.map((g) => (g === 'investigators' ? 'Enquêteurs' : SHORT_GROUP[g])).join(', ')}
                    </div>
                  )}
                </div>
                {simRecipients.length ? (
                  <ul className="space-y-1.5">
                    {simRecipients.map((r, i) => (
                      <li key={r.email} className="activa-enter flex items-center gap-2 min-w-0" style={{ ['--d' as string]: `${i * 60}ms` }}>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold shrink-0">{SHORT_GROUP[r.group]}</span>
                        <span className="font-mono text-[11px] text-slate-700 truncate">{r.email}</span>
                        {r.reason !== 'always' && <span className="text-[10px] text-slate-400 shrink-0">{REASON_SHORT[r.reason] ?? r.reason}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-amber-700 font-semibold">Aucun destinataire : ajoutez des adresses ou des comptes aux groupes concernés.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <SaveBar id="notif-save" dirty={dirty} onSave={save} disabled={invalidAddresses.length > 0} />
    </div>
  );
};
