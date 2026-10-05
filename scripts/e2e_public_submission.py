"""
=== AMÉLIORATION AJOUTÉE (diagnostic du dépôt public, sans écriture) ===

Lancé par .github/workflows/e2e-public-submission.yml (manuel). Ouvre le
site public EN LIGNE, dépose un signalement de test comme un déclarant, et
INTERCEPTE l'appel à la Cloud Function `createCaseAsReporter` sans
l'envoyer (aucun dossier n'est créé en production). Affiche :
- si l'appel est bien émis par le navigateur, et son contenu ;
- le verdict de la validation serveur sur ce contenu (même règles que
  functions/src : domain/reporterCaseInput.ts, rejouées ici) ;
- les erreurs JavaScript et messages de console du navigateur.
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

SITE = os.environ.get("SITE_URL", "https://activa-ethicalert-47246.web.app")
# === AMÉLIORATION AJOUTÉE === REAL=1 : l'appel part vraiment vers le serveur
# (crée un dossier de test « à classer sans suite ») et sa réponse est
# affichée. Par défaut, l'appel est intercepté et rien n'est créé.
REAL = os.environ.get("REAL") == "1"
ACCESS_CODE_RE = re.compile(r"^[A-Za-z0-9]{8,64}$")
EXTERNAL_REF_RE = re.compile(r"^[A-Z0-9][A-Z0-9-]{2,39}$")
LIMITS = {"category": 150, "subcategory": 150, "country": 100, "entity": 150, "description": 20000}


def validate(data):
    problems = []
    for f in ("category", "country", "entity", "description"):
        v = data.get(f)
        if not isinstance(v, str) or not v.strip() or len(v.strip()) > LIMITS[f]:
            problems.append(f"{f} invalide : {v!r}")
    sub = data.get("subcategory")
    if sub not in (None, "") and (not isinstance(sub, str) or len(sub.strip()) > LIMITS["subcategory"] or not sub.strip()):
        problems.append(f"subcategory invalide : {sub!r}")
    if data.get("reportingMode", "anonymous") not in ("anonymous", "identified"):
        problems.append(f"reportingMode invalide : {data.get('reportingMode')!r}")
    if data.get("confidentialityLevel", "confidential") not in ("standard", "restricted", "confidential", "highly_confidential"):
        problems.append(f"confidentialityLevel invalide : {data.get('confidentialityLevel')!r}")
    if "accessCode" in data and (not isinstance(data["accessCode"], str) or not ACCESS_CODE_RE.match(data["accessCode"])):
        problems.append("accessCode invalide")
    if "externalReference" in data:
        ref = data["externalReference"].strip().upper() if isinstance(data["externalReference"], str) else ""
        if not EXTERNAL_REF_RE.match(ref):
            problems.append(f"externalReference invalide : {data['externalReference']!r}")
    return problems


def main():
    captured = []
    logs = []
    with sync_playwright() as p:
        exe = os.environ.get("CHROMIUM_PATH")
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: logs.append(f"[console.{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[erreur JS] {e}"))
        page.on("requestfailed", lambda r: logs.append(f"[requête échouée] {r.url} {r.failure}"))

        def intercept(route, request):
            captured.append({"url": request.url, "body": request.post_data})
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"result": {"caseId": "diagnostic", "caseNumber": "DIAGNOSTIC"}}))

        responses = []

        def on_response(res):
            if "createCaseAsReporter" in res.url:
                try:
                    body = res.text()
                except Exception as e:  # noqa: BLE001
                    body = f"(corps illisible : {e})"
                responses.append(f"HTTP {res.status} {body[:600]}")

        page.on("response", on_response)
        if REAL:
            captured_ref = captured

            def observe(route, request):
                captured_ref.append({"url": request.url, "body": request.post_data})
                route.continue_()

            page.route(re.compile(r".*createCaseAsReporter.*"), observe)
        else:
            page.route(re.compile(r".*createCaseAsReporter.*"), intercept)

        page.goto(SITE, wait_until="networkidle")
        page.click("#hero-btn-new-alert")
        page.wait_for_timeout(600)
        page.click("#confidentiality-gate-confirm")
        page.wait_for_timeout(600)
        page.click("#btn-step1-next")
        page.click("#btn-step2-next")
        page.wait_for_timeout(400)
        page.fill("#input-incident-dates", "Octobre 2026")
        page.fill("#input-incident-location", "Diagnostic automatique")
        page.fill(
            "#input-detailed-description",
            "[TEST AUTOMATIQUE] Vérification technique du dépôt — à classer sans suite"
            if REAL
            else "[TEST AUTOMATIQUE DIAGNOSTIC - intercepté, jamais envoyé]",
        )
        page.click("#btn-step3-next")
        page.click("#btn-step4-next")
        page.wait_for_timeout(400)
        page.click("#btn-submit-final")
        page.wait_for_timeout(8000)
        browser.close()

    print("\n=== Appel createCaseAsReporter émis par le navigateur ? ===")
    if not captured:
        print("NON : le navigateur n'a jamais appelé createCaseAsReporter.")
    for c in captured:
        print(f"OUI : {c['url']}")
        try:
            data = json.loads(c["body"] or "{}").get("data", {})
        except json.JSONDecodeError:
            data = {}
        shown = {k: ("***" if k == "accessCode" else v) for k, v in data.items()}
        print("Contenu :", json.dumps(shown, ensure_ascii=False))
        problems = validate(data)
        print("Validation serveur :", "OK" if not problems else "REFUS -> " + " ; ".join(problems))

    if REAL:
        print("\n=== Réponse du serveur à createCaseAsReporter ===")
        for r in responses or ["(aucune réponse reçue)"]:
            print(r)

    print("\n=== Console et erreurs du navigateur ===")
    for line in logs[-40:]:
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
