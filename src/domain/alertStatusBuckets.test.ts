/**
 * === AMÉLIORATION AJOUTÉE (Repère visuel — Tableau de bord) ===
 * Verrouille le mapping AlertStatus → panier (voir le fichier testé) : les
 * 7 valeurs réelles d'AlertStatus doivent chacune tomber dans exactement le
 * panier documenté, et "rejetes" doit rester structurellement inatteignable
 * aujourd'hui (aucune valeur réelle n'y correspond — brief §32).
 */
import { describe, expect, it } from 'vitest';

import { AlertStatus } from '../types';
import { getAlertStatusBucket, isRejectedBucket, AlertStatusBucket } from './alertStatusBuckets';

describe('getAlertStatusBucket', () => {
  const expected: Record<AlertStatus, AlertStatusBucket> = {
    new: 'a_traiter',
    under_review: 'en_cours',
    investigation: 'en_cours',
    reopened: 'en_cours',
    corrective_action: 'en_attente',
    closed: 'clotures',
    archived: 'clotures',
  };

  for (const [status, bucket] of Object.entries(expected) as [AlertStatus, AlertStatusBucket][]) {
    it(`maps "${status}" to "${bucket}"`, () => {
      expect(getAlertStatusBucket(status)).toBe(bucket);
    });
  }

  it('covers every AlertStatus value with no gaps', () => {
    const allStatuses: AlertStatus[] = ['new', 'under_review', 'investigation', 'corrective_action', 'closed', 'archived', 'reopened'];
    for (const s of allStatuses) {
      expect(() => getAlertStatusBucket(s)).not.toThrow();
      expect(getAlertStatusBucket(s)).toBeDefined();
    }
  });
});

describe('isRejectedBucket', () => {
  it('is always false today — no AlertStatus value represents a rejected report', () => {
    const allStatuses: AlertStatus[] = ['new', 'under_review', 'investigation', 'corrective_action', 'closed', 'archived', 'reopened'];
    for (const s of allStatuses) {
      expect(isRejectedBucket(s)).toBe(false);
    }
  });
});
