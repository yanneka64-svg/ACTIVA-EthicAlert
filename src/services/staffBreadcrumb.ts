/**
 * === AMÉLIORATION AJOUTÉE : fil d'Ariane de l'espace staff dans la topbar ===
 *
 * La barre du haut (Navbar.tsx) et le menu latéral (StaffPortalLayout.tsx)
 * sont deux composants indépendants. Le menu latéral connaît l'espace
 * affiché (Opérateur, Enquêteur, Panneau de configuration…) et l'onglet
 * actif ; il les publie ici, et la topbar les affiche sous la forme
 * « Espace › Page », mis à jour à chaque changement d'onglet.
 *
 * Simple magasin en mémoire + abonnement (useSyncExternalStore) : aucune
 * donnée persistée, aucun effet sur la navigation elle-même.
 */
import { useSyncExternalStore } from 'react';

export interface StaffBreadcrumb {
  section: string;
  page: string;
}

let current: StaffBreadcrumb | null = null;
const listeners = new Set<() => void>();

/** Publie le fil d'Ariane courant (ou `null` pour le masquer). */
export function setStaffBreadcrumb(next: StaffBreadcrumb | null): void {
  if (current?.section === next?.section && current?.page === next?.page) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fil d'Ariane courant, re-rendu à chaque changement. */
export function useStaffBreadcrumb(): StaffBreadcrumb | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
