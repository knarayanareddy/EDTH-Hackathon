#!/usr/bin/env bash
# Runs every automated test and stores the REAL output in test_results/. Fails (non-zero) if any suite fails.
set -u -o pipefail
cd "$(dirname "$0")/.."
mkdir -p test_results
status=0
{ echo "date: $(date -u +%FT%TZ)"; echo "node: $(node -v)  npm: $(npm -v)"; echo "python: $(python3 --version)"; python3 -c "import numpy,torch;print('numpy',numpy.__version__,'torch',torch.__version__)"; uname -a; } | tee test_results/environment.txt
echo "== build + typecheck"; (npm run build && npm run typecheck) 2>&1 | tee test_results/build_typecheck.log || status=1
echo "== python tests (creates build/e2e)"; (cd training && PYTHONPATH=. python3 -m unittest discover -s tests -v) 2>&1 | tee test_results/python_tests.log || status=1
echo "== node tests"; CLEARHOT_E2E_DIR="$PWD/build/e2e" npm test 2>&1 | tee test_results/node_tests.log || status=1
echo "overall exit status: $status" | tee test_results/overall.txt
exit $status
