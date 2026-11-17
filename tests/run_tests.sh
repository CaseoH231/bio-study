#!/bin/bash
# Runs the tests and prints PASS / FAIL.   Usage:  bash tests/run_tests.sh
# Needs node and Playwright (npm i -g playwright && npx playwright install chromium).
cd "$(dirname "$0")/.."
if ! curl -s -o /dev/null http://localhost:8766/index.html; then
  (setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 &) </dev/null >/dev/null 2>&1
  sleep 1.5
fi
fails=0
check() { # name, test file, text that must appear
  out=$(cd tests && node "$2" 2>&1)
  if echo "$out" | grep -q "$3"; then echo "PASS  $1"; else echo "FAIL  $1"; echo "$out" | tail -8 | sed 's/^/      /'; fails=$((fails + 1)); fi
}
check "app smoke test" test_biology.cjs "biology ok"
check "scanning photos of notes" test_scan.cjs "scan ok"
[ $fails = 0 ] && echo "All tests passed." || { echo "$fails test(s) failed."; exit 1; }
