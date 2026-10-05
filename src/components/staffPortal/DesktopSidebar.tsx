/**
 * === AMÉLIORATION AJOUTÉE (Refactor StaffPortalLayout — extraction par
 * section) ===
 *
 * Barre latérale desktop (bloc titre Admin / Consultation, menu groupé,
 * carte « Besoin d'aide ? »). Code strictement déplacé depuis
 * StaffPortalLayout.tsx, pas réécrit. `lastGroup` (seul utilisateur) est
 * déplacé ici ; `renderNavButton` reste possédé par StaffPortalLayout.tsx
 * (partagé avec la barre mobile) et est passé en prop tel quel, de même
 * que l'espace sélectionné et la liste de menu calculée.
 */
import React from 'react';
import { Settings, HelpCircle, Eye } from 'lucide-react';
import type { SpaceKey } from '../../domain/staffSpaces';
import type { NavItem } from './navItems';

interface DesktopSidebarProps {
  t: Record<string, string>;
  selectedSpace: SpaceKey;
  navItems: NavItem[];
  renderNavButton: (item: NavItem, mobile?: boolean) => React.ReactNode;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  t,
  selectedSpace,
  navItems,
  renderNavButton,
}) => {
  let lastGroup: string | null = null;

  return (
    // === AMÉLIORATION AJOUTÉE (écrans de travail — design modernisé) ===
    // carte à ombre douce qui apparaît en douceur, tuiles de titre en
    // dégradé, encart d'aide en dégradé.
    <aside className={`activa-enter activa-vt-sidebar hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-0 lg:z-30 ${selectedSpace === 'admin' ? 'lg:self-stretch' : 'lg:self-start'} bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgb(15_23_42/0.04),0_18px_40px_-22px_rgb(15_23_42/0.2)] overflow-hidden mt-6`}>
      {/* === AMÉLIORATION AJOUTÉE (Accueil des espaces — remplace le
          sélecteur en barre latérale) === Le petit bloc "ESPACES" qui
          vivait ici (2-3 boutons empilés en haut de la sidebar) est
          retiré, sur demande explicite de l'utilisateur : le choix
          d'espace se fait désormais une seule fois, sur une vraie page
          d'accueil dédiée (StaffSpaceHome.tsx) juste après connexion,
          pas en permanence dans la barre latérale. `selectedSpace`
          (calculé ci-dessus depuis `currentTab`) continue de déterminer
          la LISTE de menu affichée ci-dessous — rien ne change côté
          contenu du menu lui-même, seul ce bloc de sélection disparaît.
          Pour changer d'espace après coup, voir le lien "Changer
          d'espace" du menu Profil (Navbar.tsx). */}
      {/* === AMÉLIORATION AJOUTÉE (Navigation Admin unifiée — retours
          visuels sur capture de référence) === Bloc titre en tête de la
          barre latérale, propre à l'espace Admin (fidèle à la référence)
          — purement visuel, ne change ni `navItems` ni la navigation
          elle-même.
          === AMÉLIORATION AJOUTÉE (renommages successifs du titre) ===
          "Administration" → "Configuration"/"Paramètres Utilisateur et
          Configuration" → "Panneau de configuration", sur plusieurs
          demandes explicites successives de l'utilisateur (le lien de
          menu "Paramètres système" du même nom, devenu redondant, a été
          retiré juste au-dessus). Le sous-texte ("Paramètres,
          utilisateurs et configuration") reste retiré. */}
      {selectedSpace === 'admin' && (
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-1">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-600/25 flex items-center justify-center text-white shrink-0">
            <Settings className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 text-sm leading-tight truncate">{t.space_home_admin_title}</p>
          </div>
        </div>
      )}
      {/* === AMÉLIORATION AJOUTÉE (Espaces Audit interne/externe) === Même
          motif que le bloc "Administration" ci-dessus, pour l'espace de
          repli général (Consultation, Comité d'Audit, Exécutif, Admin
          Sécurité — aucun n'a de droit d'écriture sur les dossiers) :
          repère visuel honnête indiquant que cet espace n'affiche que du
          contenu réellement consultable, sans aucune action d'attribution
          ou de modification. */}
      {selectedSpace === 'general' && (
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-1">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-600/25 flex items-center justify-center text-white shrink-0">
            <Eye className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 text-sm leading-tight">{t.roles_consultation}</p>
            <p className="text-[10px] text-slate-500 leading-snug">{t.side_readonly_hint}</p>
          </div>
        </div>
      )}
      <nav className="flex-1 py-3 px-2.5">
        {navItems.map((item) => {
          const showGroupHeader = !!item.group && item.group !== lastGroup;
          lastGroup = item.group;
          return (
            <React.Fragment key={`${item.key}-${item.label}`}>
              {showGroupHeader && (
                // === AMÉLIORATION AJOUTÉE (Audit frontend — Phase 3, contraste) ===
                // BUG PRÉEXISTANT CORRIGÉ, mesuré via axe-core :
                // text-slate-400 à cette taille ne passe pas le seuil WCAG
                // AA (2.63:1, minimum 4.5:1) — text-slate-600 y remédie
                // (text-slate-500 seul restait tout juste insuffisant,
                // 4.46:1, sur le fond légèrement teinté de la sidebar).
                <div className="px-3 pt-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  {item.group}
                </div>
              )}
              {renderNavButton(item)}
            </React.Fragment>
          );
        })}
      </nav>

      {/* "Besoin d'aide ?" — exact match with the reference mockup's sidebar footer */}
      <div className="m-2.5 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50/50 border border-blue-100 flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-white ring-1 ring-inset ring-blue-200/70 shadow-sm flex items-center justify-center text-blue-600 shrink-0">
          <HelpCircle className="w-4 h-4" />
        </span>
        <div className="text-[11px] leading-snug">
          <p className="font-bold text-slate-700">{t.sidebar_help_title}</p>
          <p className="text-slate-500 mt-0.5">{t.sidebar_help_body}</p>
        </div>
      </div>
    </aside>
  );
};
