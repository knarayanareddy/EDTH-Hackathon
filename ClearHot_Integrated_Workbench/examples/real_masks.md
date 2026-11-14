# Optional local real-data masks

The example real-pair manifest demonstrates inputs and targets. Each recording may additionally have:

```json
"masks": {"path": "sessionA_masks.npy", "sha256": "FULL_SHA256", "attested": true, "reviewer": "your-pseudonym"},
"stripe_free_negative": true,
"stripe_free_reviewer": "your-pseudonym",
"stripe_free_statement": "Explanation of why this complete selected sequence is a stripe-free negative."
```

`masks` is an optional NumPy `.npy` array of **uint8**, exactly `[number_of_pairs, height, width]` in the order of `pairs`, spatially aligned to those input/target frames. Each pixel stores bit flags: `1` thin line, `2` small target, `4` surrounding background/ring; `0` means unmarked. Combined feature bits are allowed, but ring cannot overlap either feature. No object-by-object annotation or UI mask drawing is provided. A single combined ring is a crude measurement design; overlapping objects, different backgrounds and ambiguity need human review. Use `shasum -a 256 sessionA_masks.npy` to calculate the exact full-file hash. The recording and mask stay on disk.

Only mark `stripe_free_negative` true when every selected pair in that recording is an appropriate stripe-free hard negative; reviewer and statement are required. This is human attestation, not verification. Omitting masks or negative examples is allowed for import but leaves the corresponding mandatory safety checks **failed**. A test mask or simulated reference must never be represented as real ground truth.

The NPZ format currently requires each selected recording within a split to have the same number of paired frames. Keep train/val/test recordings independent and use different IDs and file content; hash checks do not prove scene independence. The tool requires a trusted aligned reference in the same 14-bit count domain, not ordinary neighboring frames or model output. Real data and annotations have not been tested here.
