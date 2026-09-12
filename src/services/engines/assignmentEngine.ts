import { AlertRecord, UserProfile } from '../../types';

export interface AssignmentResult {
  suggestedInvestigatorIds: string[];
  suggestedInvestigatorNames: string[];
  rationale: string;
  conflictedUsersExcluded: string[];
}

export class AssignmentEngine {
  /**
   * Determine best suited investigators based on criteria and conflict check (CDC 58 & 59)
   */
  public static recommendAssignment(
    caseData: AlertRecord,
    availableUsers: UserProfile[],
    conflictedUserIds: string[] = []
  ): AssignmentResult {
    const investigators = availableUsers.filter(u => u.role === 'investigator' || u.role === 'functional_admin');

    // Implicated subjects or witnesses cannot investigate their own case
    const implicatedNames = [
      ...caseData.involvedPersons.map(p => p.name.toLowerCase().trim()),
      ...caseData.witnesses.map(w => w.name.toLowerCase().trim())
    ];

    const eligible: UserProfile[] = [];
    const excluded: string[] = [];

    for (const inv of investigators) {
      const isImplicated = implicatedNames.some(name => 
        name && (inv.name.toLowerCase().includes(name) || name.includes(inv.name.toLowerCase()))
      );
      const isConflicted = conflictedUserIds.includes(inv.id);

      if (isImplicated || isConflicted) {
        excluded.push(inv.name + (isConflicted ? ' (Conflit déclaré)' : ' (Personne impliquée)'));
      } else {
        eligible.push(inv);
      }
    }

    // Sort by matching entity & country
    const ranked = [...eligible].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.entity === caseData.concernedEntity) scoreA += 3;
      if (b.entity === caseData.concernedEntity) scoreB += 3;

      if (a.country === caseData.country) scoreA += 2;
      if (b.country === caseData.country) scoreB += 2;

      return scoreB - scoreA;
    });

    const chosen = ranked.slice(0, 2);

    return {
      suggestedInvestigatorIds: chosen.map(c => c.id),
      suggestedInvestigatorNames: chosen.map(c => `${c.name} (${c.entity} - ${c.country})`),
      rationale: chosen.length > 0 
        ? `Sélection basée sur la proximité géographique (${caseData.country}), l'entité (${caseData.concernedEntity}) et l'absence de conflit d'intérêts.`
        : "Aucun enquêteur sans conflit disponible pour cette zone. Escalade requise auprès du Directeur DARC Groupe.",
      conflictedUsersExcluded: excluded
    };
  }
}
