#!/usr/bin/env bash
# === AMÉLIORATION AJOUTÉE (Audit DevOps — actions console automatisées) ===
#
# Durcissement GCP / Firebase du projet activa-ethicalert-47246, étape par
# étape. À lancer dans Google Cloud Shell (gcloud déjà authentifié avec un
# compte Propriétaire du projet) ; `gh` (GitHub CLI authentifié) est
# facultatif : sans lui, les valeurs à saisir dans GitHub sont affichées.
#
# Usage :
#   ./scripts/devops/gcp-hardening.sh wif                # 1. fédération d'identité GitHub → GCP
#   ./scripts/devops/gcp-hardening.sh revoke-json-key    # 2. APRÈS un déploiement réussi via WIF
#   ./scripts/devops/gcp-hardening.sh restrict-api-key   # 3. restreindre la clé API Web
#   ./scripts/devops/gcp-hardening.sh app-check          # 4. App Check (reCAPTCHA Enterprise), mode surveillance
#   ./scripts/devops/gcp-hardening.sh app-check-enforce  # 4b. quelques jours plus tard, après contrôle des métriques
#   BUDGET_AMOUNT=20EUR ./scripts/devops/gcp-hardening.sh budget        # 5. (plan Blaze requis)
#   ALERT_EMAIL=darc@group-activa.com ./scripts/devops/gcp-hardening.sh monitoring   # 6.
#
# Chaque étape demande confirmation avant toute modification et peut être
# relancée sans dommage (les ressources existantes sont réutilisées).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-activa-ethicalert-47246}"
REPO="${GITHUB_REPO:-yanneka64-svg/ACTIVA-EthicAlert}"
SA_NAME="github-deployer"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github"
PROVIDER_ID="github-provider"
DOMAINS=("activa-ethicalert-47246.web.app" "activa-ethicalert-47246.firebaseapp.com" "activa-ethicalert.group-activa.com" "activa-alertes.com")
UPTIME_HOST="activa-ethicalert-47246.web.app"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die()  { printf '\033[31mERREUR : %s\033[0m\n' "$*" >&2; exit 1; }
confirm() { local a; read -r -p "   $1 [o/N] " a; [[ "$a" =~ ^[oOyY]$ ]]; }
has_gh() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }
project_number() { gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)'; }
token() { gcloud auth print-access-token; }

command -v gcloud >/dev/null 2>&1 || die "gcloud introuvable (utiliser Google Cloud Shell)."

# ---------------------------------------------------------------------------
step_wif() {
  local pnum provider
  pnum="$(project_number)"
  provider="projects/${pnum}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER_ID}"
  say "Fédération d'identité (WIF) : GitHub Actions ($REPO, branche main) → $SA"
  confirm "Créer/mettre à jour le compte de service, le pool et le fournisseur ?" || return 0

  gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"

  gcloud iam service-accounts describe "$SA" --project "$PROJECT_ID" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT_ID" --display-name "GitHub Actions — Firebase Hosting deploy"
  for role in roles/firebasehosting.admin roles/serviceusage.apiKeysViewer roles/run.viewer; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role "$role" --condition=None >/dev/null
    info "rôle $role accordé"
  done

  gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT_ID" --location global >/dev/null 2>&1 \
    || gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT_ID" --location global --display-name "GitHub Actions"
  gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --project "$PROJECT_ID" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1 \
    || gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" --project "$PROJECT_ID" \
         --location global --workload-identity-pool "$POOL" \
         --issuer-uri "https://token.actions.githubusercontent.com" \
         --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
         --attribute-condition "assertion.repository=='${REPO}' && assertion.ref=='refs/heads/main'"

  gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" \
    --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/projects/${pnum}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" >/dev/null

  if has_gh; then
    gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$REPO" --body "$provider"
    gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo "$REPO" --body "$SA"
    info "Variables GitHub définies : le prochain déploiement de main utilisera WIF."
  else
    info "Définir dans GitHub → Settings → Secrets and variables → Actions → Variables :"
    info "  GCP_WORKLOAD_IDENTITY_PROVIDER = $provider"
    info "  GCP_DEPLOY_SERVICE_ACCOUNT     = $SA"
  fi
  info "Ensuite : lancer « Deploy to Firebase Hosting » (workflow_dispatch) et vérifier qu'il passe AVANT revoke-json-key."
}

# ---------------------------------------------------------------------------
step_revoke_json_key() {
  say "Révocation de la clé JSON du déploiement historique"
  if has_gh; then
    local last
    last="$(gh run list --repo "$REPO" --workflow firebase-hosting.yml --branch main --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || true)"
    info "Dernier déploiement Hosting sur main : ${last:-inconnu}"
    [[ "$last" == "success" ]] || confirm "Le dernier déploiement n'est pas un succès confirmé. Continuer quand même ?" || return 0
  fi
  confirm "Le déploiement via WIF a-t-il réussi (étape « Authenticate to Google Cloud » verte) ?" || return 0

  # === AMÉLIORATION AJOUTÉE (revue PR #139) === périmètre STRICT : seuls les
  # comptes de service de déploiement GitHub sont examinés — le compte créé
  # par `firebase init hosting:github` (préfixe github-action-) ou celui
  # désigné par LEGACY_DEPLOY_SA. Jamais les autres comptes du projet
  # (intégrations, production), même avec confirmation.
  local email key found=0 accounts
  if [[ -n "${LEGACY_DEPLOY_SA:-}" ]]; then
    accounts="$LEGACY_DEPLOY_SA"
  else
    accounts="$(gcloud iam service-accounts list --project "$PROJECT_ID" --format 'value(email)' | grep -E '^github-action-' || true)"
  fi
  if [[ -z "$accounts" ]]; then
    info "Aucun compte de déploiement historique trouvé (préfixe github-action-)."
    info "Relancer avec LEGACY_DEPLOY_SA=<email du compte> si son nom diffère."
  fi
  # Lectures sur des descripteurs dédiés (3, 4) : `confirm` lit le clavier
  # (entrée standard), jamais la liste des comptes ou des clés.
  while read -r -u 4 email; do
    [[ -z "$email" ]] && continue
    [[ "$email" == "$SA" ]] && continue   # le compte WIF n'a pas de clé et ne doit jamais en avoir
    info "Compte examiné : $email"
    while read -r -u 3 key; do
      [[ -z "$key" ]] && continue
      found=1
      info "Clé JSON : $key ($email)"
      if confirm "Supprimer DÉFINITIVEMENT cette clé du compte $email ?"; then
        gcloud iam service-accounts keys delete "$key" --iam-account "$email" --project "$PROJECT_ID" --quiet
      fi
    done 3< <(gcloud iam service-accounts keys list --iam-account "$email" --project "$PROJECT_ID" --managed-by user --format 'value(name.basename())')
  done 4<<< "$accounts"
  [[ $found -eq 1 ]] || info "Aucune clé JSON gérée par l'utilisateur : rien à révoquer."

  if has_gh && confirm "Supprimer le secret GitHub FIREBASE_SERVICE_ACCOUNT_ACTIVA ?"; then
    gh secret delete FIREBASE_SERVICE_ACCOUNT_ACTIVA --repo "$REPO"
  else
    info "Supprimer à la main le secret GitHub FIREBASE_SERVICE_ACCOUNT_ACTIVA."
  fi
}

# ---------------------------------------------------------------------------
step_restrict_api_key() {
  say "Restriction de la clé API Web Firebase"
  gcloud services enable apikeys.googleapis.com --project "$PROJECT_ID"
  local keys uid
  keys="$(gcloud services api-keys list --project "$PROJECT_ID" --format 'value(uid,displayName)')"
  [[ -n "$keys" ]] || die "Aucune clé API trouvée."
  printf '%s\n' "$keys" | sed 's/^/   /'
  uid="$(printf '%s\n' "$keys" | awk -F'\t' 'tolower($2) ~ /browser key/ {print $1; exit}')"
  [[ -n "$uid" ]] || read -r -p "   UID de la clé Web à restreindre : " uid

  local referrers="" d
  for d in "${DOMAINS[@]}"; do referrers+="https://${d}/*,"; done
  [[ "${ALLOW_LOCALHOST:-0}" == "1" ]] && referrers+="http://localhost:3000/*,"
  referrers="${referrers%,}"
  info "Clé $uid → sites autorisés : $referrers"
  confirm "Appliquer les restrictions (sites + API Firebase uniquement) ?" || return 0
  gcloud services api-keys update "$uid" --project "$PROJECT_ID" \
    --allowed-referrers "$referrers" \
    --api-target service=identitytoolkit.googleapis.com \
    --api-target service=securetoken.googleapis.com \
    --api-target service=firestore.googleapis.com \
    --api-target service=firebaseinstallations.googleapis.com \
    --api-target service=firebaseappcheck.googleapis.com \
    --api-target service=firebasestorage.googleapis.com
  info "Fait. Vérifier la connexion et la soumission d'un signalement sur le site de production."
}

# ---------------------------------------------------------------------------
web_app_id() {
  curl -fsS -H "Authorization: Bearer $(token)" -H "x-goog-user-project: $PROJECT_ID" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
    | python3 -c 'import json,sys; apps=json.load(sys.stdin).get("apps",[]); print(apps[0]["appId"] if apps else "")'
}

step_app_check() {
  say "App Check (reCAPTCHA Enterprise) — mode surveillance"
  local app_id site_key pnum domains
  app_id="${FIREBASE_APP_ID:-$(web_app_id)}"
  [[ -n "$app_id" ]] || die "Application Web Firebase introuvable (définir FIREBASE_APP_ID)."
  pnum="$(project_number)"
  domains="$(IFS=,; echo "${DOMAINS[*]}")"
  info "Application Web : $app_id — domaines : $domains"
  confirm "Créer la clé reCAPTCHA et l'enregistrer dans App Check ?" || return 0

  gcloud services enable recaptchaenterprise.googleapis.com firebaseappcheck.googleapis.com --project "$PROJECT_ID"
  site_key="$(gcloud recaptcha keys list --project "$PROJECT_ID" --filter 'displayName="ACTIVA EthicAlert — App Check"' --format 'value(name.basename())' | head -n1)"
  if [[ -z "$site_key" ]]; then
    site_key="$(gcloud recaptcha keys create --project "$PROJECT_ID" --display-name "ACTIVA EthicAlert — App Check" \
      --web --domains "$domains" --integration-type score --format 'value(name.basename())')"
  fi
  info "Clé de site reCAPTCHA : $site_key"

  curl -fsS -X PATCH -H "Authorization: Bearer $(token)" -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \
    "https://firebaseappcheck.googleapis.com/v1/projects/${pnum}/apps/${app_id}/recaptchaEnterpriseConfig?updateMask=siteKey" \
    -d "{\"siteKey\":\"${site_key}\"}" >/dev/null
  info "Clé enregistrée dans Firebase App Check (aucune application stricte pour l'instant)."

  if has_gh; then
    gh secret set VITE_FIREBASE_APPCHECK_SITE_KEY --repo "$REPO" --body "$site_key"
    info "Secret GitHub VITE_FIREBASE_APPCHECK_SITE_KEY défini : actif au prochain déploiement."
  else
    info "Créer le secret GitHub VITE_FIREBASE_APPCHECK_SITE_KEY = $site_key puis redéployer."
  fi
  info "Observer Firebase Console → App Check → métriques quelques jours, puis : $0 app-check-enforce"
}

step_app_check_enforce() {
  say "App Check — application stricte (Firestore, Authentication)"
  info "À ne faire qu'après avoir vérifié que ~100 % des requêtes sont « vérifiées » dans les métriques App Check."
  confirm "Passer Firestore et Authentication en ENFORCED ?" || return 0
  local pnum svc
  pnum="$(project_number)"
  for svc in firestore.googleapis.com identitytoolkit.googleapis.com; do
    curl -fsS -X PATCH -H "Authorization: Bearer $(token)" -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \
      "https://firebaseappcheck.googleapis.com/v1/projects/${pnum}/services/${svc}?updateMask=enforcementMode" \
      -d '{"enforcementMode":"ENFORCED"}' >/dev/null
    info "$svc : ENFORCED"
  done
  info "Retour arrière possible : même appel avec \"UNENFORCED\" (ou Firebase Console → App Check → APIs)."
}

# ---------------------------------------------------------------------------
step_budget() {
  say "Budget GCP et alertes de dépense"
  local billing amount
  billing="$(gcloud billing projects describe "$PROJECT_ID" --format 'value(billingAccountName)')"
  [[ -n "$billing" ]] || die "Aucun compte de facturation lié : activer d'abord le plan Blaze."
  billing="${billing#billingAccounts/}"
  amount="${BUDGET_AMOUNT:-20EUR}"
  if gcloud billing budgets list --billing-account "$billing" --format 'value(displayName)' | grep -qx "ACTIVA EthicAlert — ${PROJECT_ID}"; then
    info "Budget déjà présent : rien à faire."; return 0
  fi
  info "Compte de facturation $billing — budget mensuel $amount, alertes à 50/90/100 %."
  info "(la devise doit être celle du compte de facturation, ex. 20EUR ou 25USD)"
  confirm "Créer le budget ?" || return 0
  gcloud services enable billingbudgets.googleapis.com --project "$PROJECT_ID"
  gcloud billing budgets create --billing-account "$billing" \
    --display-name "ACTIVA EthicAlert — ${PROJECT_ID}" \
    --budget-amount "$amount" --filter-projects "projects/${PROJECT_ID}" \
    --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0
  info "Rappel : un budget alerte mais ne coupe pas la dépense ; le plafond réel est maxInstances (déjà dans le code)."
}

# ---------------------------------------------------------------------------
create_policy() {
  gcloud monitoring policies create --project "$PROJECT_ID" --policy-from-file "$1" >/dev/null 2>&1 \
    || gcloud alpha monitoring policies create --project "$PROJECT_ID" --policy-from-file "$1" >/dev/null
}
policy_exists() {
  { gcloud monitoring policies list --project "$PROJECT_ID" --format 'value(displayName)' 2>/dev/null \
    || gcloud alpha monitoring policies list --project "$PROJECT_ID" --format 'value(displayName)'; } | grep -qxF "$1"
}

step_monitoring() {
  say "Supervision : disponibilité du site + erreurs des Cloud Functions"
  [[ -n "${ALERT_EMAIL:-}" ]] || die "Définir ALERT_EMAIL (adresse qui recevra les alertes)."
  confirm "Créer le canal e-mail ($ALERT_EMAIL), la vérification de disponibilité et 2 alertes ?" || return 0
  gcloud services enable monitoring.googleapis.com --project "$PROJECT_ID"

  local channel check tmp
  channel="$(gcloud beta monitoring channels list --project "$PROJECT_ID" --filter "labels.email_address=\"${ALERT_EMAIL}\"" --format 'value(name)' | head -n1)"
  [[ -n "$channel" ]] || channel="$(gcloud beta monitoring channels create --project "$PROJECT_ID" \
    --display-name "DARC — alertes ACTIVA EthicAlert" --type email \
    --channel-labels "email_address=${ALERT_EMAIL}" --format 'value(name)')"
  info "Canal : $channel"

  check="$(gcloud monitoring uptime list-configs --project "$PROJECT_ID" --filter 'displayName="activa-web-uptime"' --format 'value(name.basename())' | head -n1)"
  if [[ -z "$check" ]]; then
    gcloud monitoring uptime create activa-web-uptime --project "$PROJECT_ID" \
      --resource-type uptime-url --resource-labels "host=${UPTIME_HOST},project_id=${PROJECT_ID}" \
      --protocol https --path / --period 5 --timeout 10 >/dev/null
    check="$(gcloud monitoring uptime list-configs --project "$PROJECT_ID" --filter 'displayName="activa-web-uptime"' --format 'value(name.basename())' | head -n1)"
  fi
  info "Vérification de disponibilité : $check (toutes les 5 min)"

  tmp="$(mktemp -d)"
  cat > "$tmp/uptime.json" <<JSON
{
  "displayName": "ACTIVA EthicAlert — site indisponible",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Uptime check en échec",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.\"check_id\"=\"${check}\"",
      "aggregations": [{ "alignmentPeriod": "1200s", "perSeriesAligner": "ALIGN_NEXT_OLDER", "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.*"] }],
      "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "60s", "trigger": { "count": 1 }
    }
  }],
  "notificationChannels": ["${channel}"]
}
JSON
  cat > "$tmp/functions-5xx.json" <<JSON
{
  "displayName": "ACTIVA EthicAlert — erreurs Cloud Functions",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Plus de 5 réponses 5xx en 5 minutes",
    "conditionThreshold": {
      "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND metric.label.\"response_code_class\"=\"5xx\"",
      "aggregations": [{ "alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_DELTA", "crossSeriesReducer": "REDUCE_SUM" }],
      "comparison": "COMPARISON_GT", "thresholdValue": 5, "duration": "0s", "trigger": { "count": 1 }
    }
  }],
  "notificationChannels": ["${channel}"]
}
JSON
  policy_exists "ACTIVA EthicAlert — site indisponible" || create_policy "$tmp/uptime.json"
  policy_exists "ACTIVA EthicAlert — erreurs Cloud Functions" || create_policy "$tmp/functions-5xx.json"
  rm -rf "$tmp"
  info "Alertes en place. Error Reporting est automatique pour les Cloud Functions une fois déployées."
}

# ---------------------------------------------------------------------------
case "${1:-}" in
  wif)               step_wif ;;
  revoke-json-key)   step_revoke_json_key ;;
  restrict-api-key)  step_restrict_api_key ;;
  app-check)         step_app_check ;;
  app-check-enforce) step_app_check_enforce ;;
  budget)            step_budget ;;
  monitoring)        step_monitoring ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
