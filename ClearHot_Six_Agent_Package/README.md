# Six-method research package for an independent agent

Read `ClearHot_Independent_Evaluation_and_Agent_Brief.md` first and the independent review before changing anything.

- `thermalimageargos.zip`, `thermalimageclaude.zip`: untouched original archives, provided for source provenance.
- `argos/`, `claude/`: isolated source copies with parent preview navigation and local file/frame messaging added. The Argos copy also resets temporal state on file changes and non-consecutive seeks (and resets per-instance settings on new file). Source algorithms otherwise were not intentionally redesigned. Argos `audit-tests/*.ts` and Claude `tests/audit-*.ts` are independent synthetic probes added during review.
- `ClearHot_Six_Method_Workbench.html`: combined standalone preview at handoff time. Its two workspaces use different input APIs, defaults, synthetic data and metrics; a shared file is not a standardized scientific benchmark.
- `build_combined.py`: regenerates that single HTML after building each source copy. Requires Python 3 and does not download a dataset.
- `ClearHot_Six_Method_Independent_Review.md`: original inspection and synthetic test findings.
- `ClearHot_Independent_Evaluation_and_Agent_Brief.md`: the user's new feedback, evaluation requirements and requested deliverables.

Rebuild on a Mac with compatible Node/npm and Python 3:

```sh
(cd argos && npm ci && npm run build && npx tsc --noEmit)
(cd claude && npm ci && npm run build && npx tsc --noEmit)
python3 build_combined.py
```

`npm ci` downloads software dependencies. Do not download or transmit the user's 180 MB sample without permission. No real challenge data, sensor calibration, trained model, or real-world benchmark is included. The Argos preview-only patch does not apply to the untouched original ZIP. The generated HTML is experimental, not validated for operational use.
