#!/usr/bin/env bash
# === AMÉLIORATION AJOUTÉE (Audit DevOps — vérifications obligatoires sur main) ===
#
# Rend les vérifications CI « web » et « functions » (.github/workflows/ci.yml)
# obligatoires avant toute fusion sur main, et impose de passer par une pull
# request (sans exiger d'approbation, pour ne pas bloquer un mainteneur seul).
# Les administrateurs gardent la possibilité d'intervenir en urgence.
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

command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) introuvable." >&2; exit 1; }

echo "Protection de ${REPO}@${BRANCH} : vérifications requises « web » et « functions »."
gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "web", "app_id": ${GITHUB_ACTIONS_APP_ID} },
      { "context": "functions", "app_id": ${GITHUB_ACTIONS_APP_ID} }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Vérification :"
gh api "repos/${REPO}/branches/${BRANCH}/protection/required_status_checks" --jq '.checks[].context'
