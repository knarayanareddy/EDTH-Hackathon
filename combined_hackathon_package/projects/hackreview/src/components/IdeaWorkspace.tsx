"use client";

import { useEffect, useRef, useState } from "react";
import { SCORE_LABELS, type Scores, weighted } from "@/lib/ideas";
import { Panel } from "./ui";

const STATUS: { id: string; label: string; cls: string }[] = [
  { id: "none", label: "Undecided", cls: "border-slate-600 text-slate-300" },
  { id: "shortlist", label: "Shortlist", cls: "border-emerald-500 text-emerald-300 bg-emerald-500/10" },
  { id: "maybe", label: "Maybe", cls: "border-amber-500 text-amber-300 bg-amber-500/10" },
  { id: "drop", label: "Drop", cls: "border-red-500 text-red-300 bg-red-500/10" },
];

export function IdeaWorkspace({ slug, defaults }: { slug: string; defaults: Scores }) {
  const [status, setStatus] = useState("none");
  const [note, setNote] = useState("");
  const [scores, setScores] = useState<Scores>(defaults);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/state")
      .then((r) => r.json())
      .then((d: { rows: { slug: string; status: string; note: string; scores: Record<string, number> | null }[] }) => {
        if (!live) return;
        const row = d.rows.find((r) => r.slug === slug);
        if (row) {
          setStatus(row.status);
          setNote(row.note);
          if (row.scores) setScores({ ...defaults, ...(row.scores as Partial<Scores>) });
        }
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
    return () => {
      live = false;
    };
  }, [slug, defaults]);

  function persist(patch: { status?: string; note?: string; scores?: Scores }, delay = 0) {
    if (!loaded.current) return;
    if (timer.current) clearTimeout(timer.current);
    setSaved("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/state/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaved(res.ok ? "saved" : "error");
      } catch {
        setSaved("error");
      }
    }, delay);
  }

  const total = weighted(scores);

  return (
    <Panel
      title="Your triage"
      right={
        <span className="text-xs text-slate-400">
          {saved === "saving" && "Saving…"}
          {saved === "saved" && "Saved to database"}
          {saved === "error" && "Save failed"}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStatus(s.id);
                  persist({ status: s.id });
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${s.cls} ${
                  status === s.id ? "ring-2 ring-cyan-400/60" : "opacity-70 hover:opacity-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              persist({ note: e.target.value }, 600);
            }}
            rows={5}
            placeholder="Your thoughts, questions for mentors, who might join…"
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </div>

        <div className="lg:col-span-2">
          <div className="mb-2 flex items-end justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your scores (1–5). Defaults are my view
            </p>
            <p className="text-sm text-slate-300">
              Weighted: <span className="text-lg font-bold text-cyan-300">{total.toFixed(2)}</span> / 5
            </p>
          </div>
          <div className="space-y-3">
            {(Object.keys(SCORE_LABELS) as (keyof Scores)[]).map((k) => (
              <div key={k} className="grid grid-cols-[170px_1fr_24px] items-center gap-3 text-sm">
                <span className="text-slate-300">{SCORE_LABELS[k]}</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={scores[k]}
                  onChange={(e) => {
                    const next = { ...scores, [k]: Number(e.target.value) };
                    setScores(next);
                    persist({ scores: next }, 400);
                  }}
                />
                <span className="text-right font-semibold text-white">{scores[k]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Weights: fit 35%, feasibility 25%, demo 20%, edge 20%. Change them in your head, not the code.
          </p>
        </div>
      </div>
    </Panel>
  );
}
