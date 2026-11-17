#!/bin/bash
# Runs the tests and prints PASS / FAIL.   Usage:  bash tests/run_tests.sh
# Needs node and Playwright (npm i -g playwright && npx playwright install chromium).
cd "$(dirname "$0")/.."
if ! curl -s -o /dev/null http://localhost:8766/index.html; then
  (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 &) </dev/null >/dev/null 2>&1
  sleep 1.5
fi
out=$(cd tests && node test_biology.cjs 2>&1)
if echo "$out" | grep -q "biology ok"; then echo "PASS  app smoke test"; else echo "FAIL  app smoke test"; echo "$out" | tail -8; exit 1; fi
