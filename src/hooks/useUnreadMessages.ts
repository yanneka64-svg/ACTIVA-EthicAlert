/**
 * === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
 * Messages du déclarant non lus, par dossier et au total, pour le compte
 * connecté (dossiers qu'il peut voir). Recalculé à chaque mise à jour des
 * dossiers et à chaque lecture.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AlertRecord, UserProfile } from '../types';
import { READ_STATE_EVENT, readMap, unreadCount } from '../services/messageReadState';

export function useUnreadMessages(alerts: AlertRecord[], user: UserProfile | null | undefined) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(READ_STATE_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(READ_STATE_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);
  return useMemo(() => {
    const byAlert = new Map<string, number>();
    let total = 0;
    if (!user?.id) return { byAlert, total };
    const map = readMap(user.id);
    for (const a of alerts) {
      const n = unreadCount(a, map[a.id]);
      if (n > 0) {
        byAlert.set(a.id, n);
        total += n;
      }
    }
    return { byAlert, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, user?.id, version]);
}
