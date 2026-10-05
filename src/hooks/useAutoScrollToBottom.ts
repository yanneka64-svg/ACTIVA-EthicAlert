/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés) ===
 * Fait défiler une zone de conversation jusqu'au dernier message à chaque
 * nouveau message (ou indicateur « en train d'écrire »), comme une
 * messagerie : le message reçu ou envoyé est toujours visible.
 */
import { useEffect, useRef } from 'react';

export function useAutoScrollToBottom<T extends HTMLElement>(trigger: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [trigger]);
  return ref;
}
