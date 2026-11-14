#!/usr/bin/env bash
# End-to-end demonstration on GENERATED SYNTHETIC data. Two cycles, a rejected failing candidate, rollback, restart check, cache for the viewer.
# Uses DEMO/TEST-ONLY relaxed gates for promotion (default gates reject these tiny synthetic models; the first command shows that).
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONPATH="$PWD/training"
CH="python3 -m clearhot_cnn"
OUT="${1:-demo_out}"; if [ -e "$OUT" ]; then echo "Refusing to overwrite existing path: $OUT. Choose a new directory." >&2; exit 1; fi; mkdir -p "$OUT"
GATES=examples/gates_demo_relaxed.json
echo "### 0. build the viewer + Node baseline bundle (needed by evaluation)"; npm run build >/dev/null
echo "### 1. generate SYNTHETIC datasets: v1 (3 train scenes/kind) and v2 (12 train scenes/kind); validation & reserved test scenes identical"
$CH make-synth --out $OUT/ds_v1 --version synth-v1 --train-seeds 0,1,2
$CH make-synth --out $OUT/ds_v2 --version synth-v2 --train-seeds 0,1,2,3,4,5,6,7,8,9,10,11
$CH validate-data $OUT/ds_v1
echo "### 2. CYCLE 1: train candidate A (real backprop), evaluate with the PRODUCT default gates"
$CH train --dataset $OUT/ds_v1 --registry $OUT/registry --steps 1500 --seed 1 --simulated-demo
A=$($CH status --registry $OUT/registry | awk '/ckpt-/{print $1}' | tail -1)
$CH evaluate --registry $OUT/registry --dataset $OUT/ds_v1 --id $A || true
echo "### 3. same candidate under DEMO/TEST-ONLY thresholds, then explicit HUMAN approval"
$CH evaluate --registry $OUT/registry --dataset $OUT/ds_v1 --id $A --gates $GATES --test-only-thresholds | tail -4
$CH approve --registry $OUT/registry --id $A --reviewer demo-reviewer --confirm-approve $A --note "DEMO approval under test-only thresholds"
echo "### 4. CYCLE 2: more curated data (v2). Candidate B is compared with the promoted A on the same frozen validation scenes"
$CH train --dataset $OUT/ds_v2 --registry $OUT/registry --steps 3000 --seed 2 --simulated-demo
B=$($CH status --registry $OUT/registry | awk '/ckpt-/{print $1}' | grep -v $A | tail -1)
$CH evaluate --registry $OUT/registry --dataset $OUT/ds_v2 --id $B --gates $GATES --test-only-thresholds | tail -22
$CH approve --registry $OUT/registry --id $B --reviewer demo-reviewer --confirm-approve $B
echo "### 5. a deliberately regressing candidate C (corrupted targets, --demo-fault) must fail and be rejected"
$CH train --dataset $OUT/ds_v2 --registry $OUT/registry --steps 400 --seed 3 --demo-fault bias
C=$($CH status --registry $OUT/registry | awk '/ckpt-/{print $1}' | grep -v -e $A -e $B | tail -1)
$CH evaluate --registry $OUT/registry --dataset $OUT/ds_v2 --id $C --gates $GATES --test-only-thresholds | grep -E "FAIL|=>"
$CH approve --registry $OUT/registry --id $C --reviewer demo-reviewer --confirm-approve $C || echo "(refused as expected: failed candidates cannot be approved)"
$CH reject --registry $OUT/registry --id $C --reviewer demo-reviewer --note "regressed"
echo "### 6. rollback to A and show state after a restart (state lives on disk)"
$CH rollback --registry $OUT/registry --reviewer demo-reviewer --note "demo rollback"
$CH status --registry $OUT/registry
echo "### 7. tiny generated recording + inference cache from the ACTIVE approved model"
$CH make-recording --out $OUT/recording_synthetic.u16 --frames 90 --size 64
$CH infer --registry $OUT/registry --source $OUT/recording_synthetic.u16 --width 64 --height 64 --out $OUT/cache --yes
echo "### 8. separately gated final test (logged in registry/final_test_ledger.jsonl). Do not use it to choose models."
$CH final-test --registry $OUT/registry --dataset $OUT/ds_v2 --id $A --reviewer demo-reviewer --confirm-final-test "RUN FINAL TEST ONCE" | tail -8
echo
echo "DONE. Open ClearHot_Local.html, load $OUT/recording_synthetic.u16 with width=64 height=64, then attach $OUT/cache/manifest.json + frames.u16."
