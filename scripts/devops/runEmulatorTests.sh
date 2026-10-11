#!/usr/bin/env bash
# === AMÉLIORATION AJOUTÉE (tests sur émulateurs dans la CI) ===
# Exécute tous les scénarios de bout en bout sur les émulateurs Firebase
# (projet fictif demo-activa : aucune donnée ni aucun e-mail réels).
# Lancé par la CI via :
#   firebase emulators:exec --config firebase.e2e.json --project demo-activa \
#     --only auth,firestore,functions "bash scripts/devops/runEmulatorTests.sh"
# Prérequis : functions/.env.local et functions/.secret.local (créés par la CI,
# voir .github/workflows/ci.yml et docs/TESTS-SECURITE.md).
set -uo pipefail
cd "$(dirname "$0")/../.."

CAPTURE="$(mktemp -d)/sent.jsonl"
node scripts/devops/fakeResend.mjs "$CAPTURE" &
FAKE_PID=$!
trap 'kill $FAKE_PID 2>/dev/null' EXIT
sleep 1

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export CAPTURE_FILE="$CAPTURE"

failed=()
for script in \
  scripts/e2eSecurity.emulator.mts \
  scripts/e2ePortalUpdate.emulator.mts \
  scripts/e2eDocuments.emulator.mts \
  scripts/e2eConfigAudit.emulator.mts \
  scripts/e2eReporterReference.emulator.mts \
  scripts/e2eEmailNotifications.emulator.mts \
  scripts/e2eReporterMessageNotifications.emulator.mts \
  scripts/e2eConcurrency.emulator.mts; do
  echo "::group::$script"
  npx tsx scripts/devops/resetEmulatorData.mts
  if ! npx tsx "$script"; then failed+=("$script"); fi
  echo "::endgroup::"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Scénarios en échec : ${failed[*]}"
  exit 1
fi
echo "Tous les scénarios sur émulateurs ont réussi."
