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
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Save, Send, XCircle } from 'lucide-react';
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

  const save = () => {
    try {
      storage.updateEmailNotificationSettings(current(), activeUser);
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-700" />
            Notifications e-mail
          </h2>
          <p className="text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Envoyées automatiquement par le serveur. Chaque e-mail ne contient que le numéro du dossier, l’entité, la catégorie,
            la priorité et un lien vers le portail — jamais la description des faits, l’identité du déclarant ni le nom des
            personnes mises en cause. Une personne mise en cause et l’auteur de l’action ne sont jamais prévenus.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={invalidAddresses.length > 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-50 text-white font-bold shrink-0"
        >
          <Save className="w-4 h-4" />
          Enregistrer
        </button>
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-lg border font-semibold ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.text}
        </div>
      )}
      {invalidAddresses.length > 0 && (
        <div className="px-3 py-2 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 font-semibold">
          Adresse(s) invalide(s) : {invalidAddresses.join(', ')}
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) === */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3" id="notif-routing">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Acheminement automatique des alertes</h3>
          <p className="text-slate-500 mt-0.5 max-w-3xl">
            Chaque nouvelle alerte est envoyée automatiquement selon la personne mise en cause. Si plusieurs niveaux sont mis en
            cause, la règle du niveau le plus élevé s’applique. Un niveau mis en cause n’est jamais prévenu, et un compte du
            portail nommé dans l’alerte est automatiquement écarté du dossier.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[520px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-semibold py-2 pr-3">Situation</th>
                {RECIPIENT_GROUP_IDS.map((g) => (
                  <th key={g} className="font-semibold py-2 px-2 text-center">{SHORT_GROUP[g]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROUTING_CASES.map((c) => (
                <tr key={c} className={`border-t border-slate-100 ${c === 'none' ? 'bg-blue-50/40' : ''}`}>
                  <td className="py-2 pr-3 font-medium text-slate-700">{ROUTING_LABEL[c]}</td>
                  {RECIPIENT_GROUP_IDS.map((g) => (
                    <td key={g} className="text-center py-2 px-2">
                      {g === c ? (
                        <span className="text-[10px] text-slate-400" title="Un niveau mis en cause n’est jamais prévenu">—</span>
                      ) : (
                        <input
                          type="checkbox"
                          id={`route-${c}-${g}`}
                          aria-label={`${ROUTING_LABEL[c]} → ${SHORT_GROUP[g]}`}
                          checked={(routing[c] ?? []).includes(g)}
                          onChange={() => toggleRoute(c, g)}
                          className="w-4 h-4 accent-blue-600"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <label className="block">
            <span className="block font-semibold text-slate-700 mb-1">Fonctions qui désignent un enquêteur</span>
            <input
              id="notif-kw-investigators"
              value={keywordText.investigators ?? ''}
              onChange={(e) => setKeywordText((k) => ({ ...k, investigators: e.target.value }))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
            />
          </label>
          <p className="text-slate-500 self-end">
            Un niveau est considéré mis en cause si l’alerte nomme l’un de ses membres (prénom et nom), ou cite l’une de ses
            fonctions (réglées dans chaque groupe ci-dessous).
          </p>
        </div>
      </section>

      <section className="bg-slate-900 text-slate-100 rounded-2xl p-5 space-y-3" id="notif-simulation">
        <div>
          <h3 className="text-sm font-bold text-white">Simulation : à qui partirait une alerte ?</h3>
          <p className="text-slate-400 mt-0.5">Essayez les réglages ci-dessus avant de les enregistrer — aucun e-mail n’est envoyé.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            {simPersons.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input
                  id={`sim-name-${i}`}
                  placeholder="Personne mise en cause (prénom nom)"
                  value={p.name}
                  onChange={(e) => setSimPersons((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500"
                />
                <input
                  id={`sim-position-${i}`}
                  placeholder="Fonction (ex. Superviseur, DARC…)"
                  value={p.position}
                  onChange={(e) => setSimPersons((l) => l.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            ))}
            {simPersons.length < 4 && (
              <button type="button" onClick={() => setSimPersons((l) => [...l, { name: '', position: '' }])} className="text-blue-300 hover:text-blue-200 font-semibold">
                + Ajouter une personne mise en cause
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select id="sim-category" value={simCategory} onChange={(e) => setSimCategory(e.target.value)} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select id="sim-priority" value={simPriority} onChange={(e) => setSimPriority(e.target.value as CasePriority)} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                <option value="low">Priorité faible</option>
                <option value="high">Priorité élevée</option>
                <option value="very_high">Priorité très élevée</option>
                <option value="critical">Priorité critique</option>
              </select>
            </div>
          </div>
          <div className="space-y-2" id="sim-result">
            <div className="text-slate-300">
              Règle appliquée : <span className="font-bold text-white">{ROUTING_LABEL[simPlan.routingCase]}</span>
              {simPlan.implicated.length > 0 && (
                <span className="text-amber-300"> — écarté(s) : {simPlan.implicated.map((g) => (g === 'investigators' ? 'Enquêteurs' : SHORT_GROUP[g])).join(', ')}</span>
              )}
            </div>
            {simRecipients.length ? (
              <ul className="space-y-1">
                {simRecipients.map((r) => (
                  <li key={r.email} className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] font-bold">{SHORT_GROUP[r.group]}</span>
                    <span className="font-mono">{r.email}</span>
                    {r.reason !== 'always' && <span className="text-slate-400">({r.reason === 'escalation' ? 'escalade' : r.reason === 'hr' ? 'dossier RH' : r.reason === 'critical' ? 'dossier critique' : 'Direction mise en cause'})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-300">Aucun destinataire : renseignez des adresses ou des comptes dans les groupes concernés.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {settings.groups.map((g) => {
          const accounts = staff.filter((u) => u.active !== false && g.roles.includes(u.role as RoleId) && u.email);
          const test = tests[g.id];
          return (
            <section key={g.id} className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${g.enabled ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{GROUP_LABEL[g.id]}</h3>
                  <p className="text-slate-500 mt-0.5">{GROUP_HELP[g.id]}</p>
                </div>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`notif-enabled-${g.id}`}
                    checked={g.enabled}
                    onChange={(e) => updateGroup(g.id, (x) => ({ ...x, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Activé
                </label>
              </div>

              <div>
                <div className="font-semibold text-slate-700 mb-1.5">Comptes du portail prévenus</div>
                <div className="flex flex-wrap gap-1.5">
                  {NOTIFIABLE_ROLES.map((r) => (
                    <label
                      key={r}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer ${
                        g.roles.includes(r) ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={g.roles.includes(r)}
                        onChange={() =>
                          updateGroup(g.id, (x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }))
                        }
                      />
                      {ROLE_LABEL[r] ?? r}
                    </label>
                  ))}
                </div>
                <p className="text-slate-500 mt-1.5">
                  {accounts.length
                    ? `${accounts.length} compte(s) actuellement : ${accounts.map((u) => u.name).slice(0, 6).join(', ')}${accounts.length > 6 ? '…' : ''}`
                    : 'Aucun compte avec ces rôles pour l’instant.'}
                </p>
              </div>

              <div>
                <label htmlFor={`notif-emails-${g.id}`} className="block font-semibold text-slate-700 mb-1">
                  Adresses supplémentaires{' '}
                  <span className="font-normal text-slate-500">(une par ligne : « Prénom Nom &lt;adresse&gt; » ou « adresse »)</span>
                </label>
                <textarea
                  id={`notif-emails-${g.id}`}
                  rows={2}
                  value={extraText[g.id] ?? ''}
                  onChange={(e) => setExtraText((t) => ({ ...t, [g.id]: e.target.value }))}
                  placeholder={g.id === 'dga' ? 'Prénom Nom <dga@group-activa.com>' : g.id === 'drh' ? 'Prénom Nom <drh@group-activa.com>' : g.id === 'darc' ? 'darc@group-activa.com' : ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {/* === AMÉLIORATION AJOUTÉE (acheminement) === */}
              <div>
                <label htmlFor={`notif-kw-${g.id}`} className="block font-semibold text-slate-700 mb-1">
                  Fonctions qui désignent ce niveau <span className="font-normal text-slate-500">(séparées par des virgules)</span>
                </label>
                <input
                  id={`notif-kw-${g.id}`}
                  value={keywordText[g.id] ?? ''}
                  onChange={(e) => setKeywordText((k) => ({ ...k, [g.id]: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="text-left font-semibold py-1.5 pr-2">Événement</th>
                      {NOTIFICATION_CONDITIONS.map((c) => (
                        <th key={c} className="font-semibold py-1.5 px-1 text-center" title={CONDITION_LABEL[c].hint}>
                          {CONDITION_LABEL[c].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIFICATION_EVENTS.map((ev) => (
                      <tr key={ev} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 font-medium text-slate-700 whitespace-nowrap">{EVENT_LABEL[ev]}</td>
                        {NOTIFICATION_CONDITIONS.map((c) => (
                          <td key={c} className="text-center py-1.5 px-1">
                            <input
                              type="checkbox"
                              id={`notif-${g.id}-${ev}-${c}`}
                              aria-label={`${GROUP_LABEL[g.id]} — ${EVENT_LABEL[ev]} — ${CONDITION_LABEL[c].label}`}
                              checked={(g.events[ev] ?? []).includes(c)}
                              onChange={() => toggleCondition(g, ev, c)}
                              className="w-4 h-4 accent-blue-600"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  id={`notif-test-${g.id}`}
                  onClick={() => void sendTest(g.id)}
                  disabled={testing !== null || invalidAddresses.length > 0}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-50"
                >
                  {testing === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Envoyer un e-mail d’essai
                </button>
                {typeof test === 'string' && <span className="mt-3 text-rose-700 font-semibold">{test}</span>}
              </div>
              {Array.isArray(test) && test.length > 0 && (
                <ul className="space-y-1">
                  {test.map((r) => (
                    <li key={r.email} className="flex items-start gap-1.5">
                      {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />}
                      <span className="font-mono">{r.email}</span>
                      <span className={r.ok ? 'text-emerald-700' : 'text-rose-700'}>{r.ok ? 'envoyé' : r.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Catégories relevant des Ressources Humaines</h3>
        <p className="text-slate-500">
          Utilisées par la condition « Dossier RH ». Les dossiers mentionnant le harcèlement, la discrimination ou les conditions de
          travail sont aussi reconnus.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <label
              key={c}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer ${
                settings.hrCategories.includes(c) ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={settings.hrCategories.includes(c)}
                onChange={() =>
                  setSettings((s) => ({
                    ...s,
                    hrCategories: s.hrCategories.includes(c) ? s.hrCategories.filter((x) => x !== c) : [...s.hrCategories, c],
                  }))
                }
              />
              {c}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
};
