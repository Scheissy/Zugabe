#!/bin/bash
# Führt alle (oder gezielt einzelne) test_*.js aus.
#   ./run-tests.sh                 alle
#   ./run-tests.sh spiel_logik     nur test_spiel_logik.js
cd "$(dirname "$0")"
fail=0
if [ $# -gt 0 ]; then files=(); for n in "$@"; do files+=("test_${n}.js"); done; else files=(test_*.js); fi
for f in "${files[@]}"; do
  if node "$f" > /tmp/bingo_test_out.txt 2>&1; then echo "✅ $f"; else echo "❌ $f"; tail -n 15 /tmp/bingo_test_out.txt; fail=1; fi
done
exit $fail
