import React from 'react';
import {
  ShieldCheck,
  Shield,
  Briefcase,
  Search,
  ArrowRight,
  Info,
  Lock,
  User,
} from 'lucide-react';
import { Language, UserProfile } from '../types';
import { storage } from '../services/storage';
import { isGlobalCaseViewer, userCan } from '../services/authz';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';

interface StaffWelcomeHomeProps {
  lang: Language;
  activeUser: UserProfile;
  onSelectSpace: (space: 'operator' | 'investigator' | 'admin', targetTab?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onOpenCase?: (trackingNumber: string) => void;
}

export const StaffWelcomeHome: React.FC<StaffWelcomeHomeProps> = ({
  lang,
  activeUser,
  onSelectSpace,
}) => {
  const [alerts, setAlerts] = React.useState(storage.getAlerts());

  React.useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const visibleAlerts = useVisibleAlerts(alerts, activeUser);

  // Détection du profil : Enquêteur / Investigateur vs Opérateur
  // Pour les investigateurs (role: 'investigator' ou 'senior_investigator'),
  // seul le bouton "Espace Enquêteur" s'affiche conformément à la demande de l'utilisateur.
  const isInvestigatorProfile =
    activeUser.role === 'investigator' ||
    activeUser.role === 'senior_investigator' ||
    (!userCan(activeUser, 'cases.assign') && !isGlobalCaseViewer(activeUser));

  const canAccessOperator = !isInvestigatorProfile && (userCan(activeUser, 'cases.assign') || isGlobalCaseViewer(activeUser));

  // Civilité et nom d'affichage formatés selon l'image
  const rawName = activeUser.name || 'B. Y. Ekani';
  const cleanName = rawName.replace(/\s*\(.*?\)/i, '').trim();
  const civility = lang === 'en' ? 'Mr.' : 'M.';
  const displayName = cleanName ? `${civility} ${cleanName}` : 'M. B. Y. Ekani';

  // Informations de session active affichées en bas à droite
  const sessionRole = activeUser.roleTitle || (isInvestigatorProfile ? 'Enquêteur Référent' : 'Responsable Conformité & Référent Éthique Groupe');
  const sessionCountry = activeUser.country || 'Cameroun / Maurice';
  const sessionInfoText = `${cleanName || 'B. Y. Ekani'} • ${sessionRole} • ${sessionCountry}.`;

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 sm:px-6 animate-fadeIn">
      {/* Conteneur principal bicolore aux angles arrondis, conforme à la maquette */}
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        
        {/* ========================================================================= */}
        {/* PANNEAU GAUCHE : PHOTO ARCHITECTURALE + TEXTE & BADGES INSTITUTIONNELS     */}
        {/* ========================================================================= */}
        <div className="relative flex flex-col justify-between p-8 sm:p-12 lg:p-14 min-h-[520px] lg:min-h-[620px] text-white overflow-hidden">
          {/* Photo d'arrière-plan de siège d'entreprise moderne */}
          <img
            src="/brand/activa-headquarters-modern.jpg"
            alt="Siège contemporain du Groupe ACTIVA"
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />

          {/* Dégradé bleu marine / azur semi-transparent laissant apparaître la façade et le ciel */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#06182E]/95 via-[#0A2540]/80 to-[#0A2E5C]/65" />

          {/* Haut : Badge Dispositif d'Alerte Éthique & Déontologie */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1D63D8]/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-sm">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Dispositif d’Alerte Éthique & Déontologie</span>
            </div>
          </div>

          {/* Centre : Titre personnalisé, Sous-titre, Séparateur & Paragraphe explicatif */}
          <div className="relative z-10 space-y-4 my-auto py-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                Bonjour {displayName}
              </h1>
              <p className="text-xl sm:text-2xl font-semibold text-white/95 drop-shadow-sm">
                Bienvenue sur votre espace sécurisé
              </p>
            </div>

            {/* Trait d'accent bleu vif arrondi */}
            <div className="w-12 h-1 bg-[#1E66FF] rounded-full" />

            {/* Paragraphe textuel fidèle à la maquette */}
            <p className="text-sm sm:text-[15px] text-white/90 leading-relaxed max-w-lg font-normal">
              Vous êtes sur la plateforme confidentielle dédiée au signalement des faits sensibles, dans le respect de l’éthique et des valeurs de notre organisation.
            </p>
          </div>

          {/* Bas : Badges de confiance (Confidentialité garantie & Traçabilité des actions) */}
          <div className="relative z-10 pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-white/95">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/25 flex items-center justify-center text-white shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs sm:text-sm font-medium">Confidentialité garantie</span>
            </div>

            <div className="hidden sm:block h-6 w-px bg-white/25" />

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/25 flex items-center justify-center text-white shrink-0">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs sm:text-sm font-medium">Traçabilité des actions</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANNEAU DROIT : SÉLECTION DES ESPACES DE TRAVAIL                          */}
        {/* ========================================================================= */}
        <div className="bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-center space-y-6">
          
          {/* En-tête avec icône profil bleue */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/20">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-1">
              {canAccessOperator ? 'Espaces de travail' : 'Espace de travail'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              {canAccessOperator
                ? 'Sélectionnez votre environnement de travail pour accéder aux dossiers, à la boîte de réception et aux outils dédiés.'
                : 'Accédez à votre espace de travail pour consulter vos dossiers cotés, la boîte de réception et vos outils d’instruction.'}
            </p>
          </div>

          {/* Boutons d'accès aux espaces de travail */}
          <div className="space-y-4 pt-1">
            
            {/* 1. Carte Espace Opérateur (Affichée uniquement pour les profils opérateurs / qualificateurs) */}
            {canAccessOperator && (
              <button
                id="btn-space-operator"
                onClick={() => onSelectSpace('operator', 'op_dashboard')}
                className="w-full p-5 rounded-2xl bg-[#0066FF] hover:bg-[#0055D4] text-white font-semibold flex items-center justify-between transition-all shadow-sm group text-left active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white leading-snug">
                      Espace Opérateur
                    </div>
                    <p className="text-xs text-white/90 font-normal leading-relaxed mt-1">
                      Traitement des signalements, qualification, cotation et attribution des dossiers
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1.5 transition-transform shrink-0 ml-2" />
              </button>
            )}

            {/* 2. Carte Espace Enquêteur (Affichée pour les investigateurs et les profils habilités) */}
            <button
              id="btn-space-investigator"
              onClick={() => onSelectSpace('investigator', 'inv_dashboard')}
              className={`w-full p-5 rounded-2xl font-semibold flex items-center justify-between transition-all group text-left active:scale-[0.99] cursor-pointer ${
                canAccessOperator
                  ? 'border-2 border-[#0066FF] bg-white hover:bg-blue-50/50 text-slate-900 shadow-2xs'
                  : 'bg-[#0066FF] hover:bg-[#0055D4] text-white shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-sm ${
                    canAccessOperator
                      ? 'bg-[#0066FF] text-white'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <div
                    className={`text-base font-bold leading-snug ${
                      canAccessOperator ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    Espace Enquêteur
                  </div>
                  <p
                    className={`text-xs font-normal leading-relaxed mt-1 ${
                      canAccessOperator ? 'text-slate-600' : 'text-white/90'
                    }`}
                  >
                    Boîte de réception des dossiers cotés, auditions et instructions
                  </p>
                </div>
              </div>
              <ArrowRight
                className={`w-5 h-5 group-hover:translate-x-1.5 transition-transform shrink-0 ml-2 ${
                  canAccessOperator ? 'text-[#0066FF]' : 'text-white'
                }`}
              />
            </button>
          </div>

          {/* Encadré d'information session active en bas */}
          <div className="p-4 rounded-2xl bg-[#EFF6FF] border border-[#D8E6FA] flex items-center gap-3.5 text-xs">
            <div className="w-8 h-8 rounded-full border border-blue-400/80 text-[#0066FF] flex items-center justify-center shrink-0 bg-white">
              <Info className="w-4 h-4 text-[#0066FF]" />
            </div>
            <div className="leading-snug">
              <div className="font-bold text-slate-900 text-xs">
                Session active
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                {sessionInfoText}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
