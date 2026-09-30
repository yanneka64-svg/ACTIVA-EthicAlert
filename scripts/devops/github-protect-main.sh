#!/usr/bin/env bash
# === AMÉLIORATION AJOUTÉE (Audit DevOps — vérifications obligatoires sur main) ===
#
# Rend les vérifications CI « web » et « functions » (.github/workflows/ci.yml)
# obligatoires avant toute fusion sur main.
#
# === AMÉLIORATION AJOUTÉE (revue PR #139) === les réglages de protection
# DÉJÀ en place sont préservés :
# - si la protection existe, seules les vérifications requises sont
#   fusionnées (les autres contrôles déjà exigés sont conservés) via
#   l'endpoint dédié, sans toucher aux approbations, aux administrateurs ni
#   aux restrictions ;
# - sinon, une protection minimale est créée : pull request obligatoire
#   (sans approbation exigée, pour ne pas bloquer un mainteneur seul),
#   administrateurs non soumis (intervention d'urgence possible).
#
# Prérequis : GitHub CLI authentifié avec un compte administrateur du dépôt
# (`gh auth login`). Sur un dépôt PRIVÉ, la protection de branche exige un
# plan GitHub Pro/Team (sinon l'API répond 403 « Upgrade to GitHub Pro »).
#
# Usage : ./scripts/devops/github-protect-main.sh
set -euo pipefail

REPO="${GITHUB_REPO:-yanneka64-svg/ACTIVA-EthicAlert}"
BRANCH="${BRANCH:-main}"
GITHUB_ACTIONS_APP_ID=15368   # application « GitHub Actions » : seules ses vérifications comptent
REQUIRED=(web functions)

command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) introuvable." >&2; exit 1; }

checks_json() {
  # Vérifications existantes (si fournies en $1) + web/functions, sans doublon.
  local existing="${1:-[]}" out c
  out="$existing"
  for c in "${REQUIRED[@]}"; do
    out="$(jq -c --arg c "$c" --argjson app "$GITHUB_ACTIONS_APP_ID" \
      'if any(.[]; .context == $c) then . else . + [{context: $c, app_id: $app}] end' <<< "$out")"
  done
  printf '%s' "$out"
}

command -v jq >/dev/null 2>&1 || { echo "jq introuvable (requis pour fusionner les réglages existants)." >&2; exit 1; }

if gh api "repos/${REPO}/branches/${BRANCH}/protection" >/dev/null 2>&1; then
  echo "Protection existante détectée sur ${REPO}@${BRANCH} : fusion des vérifications requises."
  if existing="$(gh api "repos/${REPO}/branches/${BRANCH}/protection/required_status_checks" 2>/dev/null)"; then
    strict="$(jq '.strict' <<< "$existing")"
    merged="$(checks_json "$(jq -c '[.checks[] | {context, app_id}]' <<< "$existing")")"
    gh api -X PATCH "repos/${REPO}/branches/${BRANCH}/protection/required_status_checks" \
      -H "Accept: application/vnd.github+json" --input - <<JSON
{ "strict": ${strict}, "checks": ${merged} }
JSON
  else
    # Protection présente mais sans vérifications requises : on les ajoute
    # en réécrivant la protection À PARTIR de ses réglages actuels.
    current="$(gh api "repos/${REPO}/branches/${BRANCH}/protection")"
    jq --argjson checks "$(checks_json)" '{
      required_status_checks: { strict: true, checks: $checks },
      enforce_admins: (.enforce_admins.enabled // false),
      required_pull_request_reviews: (if .required_pull_request_reviews then {
        dismiss_stale_reviews: (.required_pull_request_reviews.dismiss_stale_reviews // false),
        require_code_owner_reviews: (.required_pull_request_reviews.require_code_owner_reviews // false),
        required_approving_review_count: (.required_pull_request_reviews.required_approving_review_count // 0),
        require_last_push_approval: (.required_pull_request_reviews.require_last_push_approval // false)
      } else null end),
      restrictions: (if .restrictions then {
        users: [.restrictions.users[].login],
        teams: [.restrictions.teams[].slug],
        apps: [.restrictions.apps[].slug]
      } else null end),
      required_linear_history: (.required_linear_history.enabled // false),
      allow_force_pushes: (.allow_force_pushes.enabled // false),
      allow_deletions: (.allow_deletions.enabled // false),
      required_conversation_resolution: (.required_conversation_resolution.enabled // false)
    }' <<< "$current" | gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
      -H "Accept: application/vnd.github+json" --input -
  fi
else
  echo "Aucune protection sur ${REPO}@${BRANCH} : création (vérifications « web » et « functions » requises)."
  gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
    -H "Accept: application/vnd.github+json" --input - <<JSON
{
  "required_status_checks": { "strict": true, "checks": $(checks_json) },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
fi

echo "Vérifications requises désormais :"
gh api "repos/${REPO}/branches/${BRANCH}/protection/required_status_checks" --jq '.checks[].context'
