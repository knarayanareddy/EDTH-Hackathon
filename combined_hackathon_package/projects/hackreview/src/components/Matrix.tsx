"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IDEAS, TRACKS, weighted, type Scores } from "@/lib/ideas";

type Row = { slug: string; status: string; note: string; scores: Record<string, number> | null };

const REC_CLS: Record<string, string> = {
  Pursue: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Merge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  Component: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Stretch: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  Park: "border-slate-600 bg-slate-800 text-slate-300",
};

const STATUS_LABEL: Record<string, string> = {
  none: "–",
  shortlist: "★ Shortlist",
  maybe: "Maybe",
  drop: "Dropped",
};

export function Matrix() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sortBy, setSortBy] = useState<"score" | "order">("score");

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d: { rows: Row[] }) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
  }, []);

  const data = useMemo(() => {
    const list = IDEAS.map((i) => {
      const row = rows.find((r) => r.slug === i.slug);
      const s: Scores = { ...i.scores, ...((row?.scores ?? {}) as Partial<Scores>) };
      return { idea: i, s, total: weighted(s), status: row?.status ?? "none", hasNote: !!row?.note };
    });
    if (sortBy === "score") list.sort((a, b) => b.total - a.total);
    return list;
  }, [rows, sortBy]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <p className="text-sm font-semibold text-white">Decision matrix (13 ideas)</p>
        <div className="flex gap-1 text-xs">
          {(["score", "order"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={`rounded-md border px-2 py-1 ${
                sortBy === k ? "border-cyan-500 text-cyan-300" : "border-slate-700 text-slate-400"
              }`}
            >
              {k === "score" ? "Sort by score" : "Original order"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Idea</th>
              <th className="px-3 py-2">Track</th>
              <th className="px-2 py-2 text-center">Fit</th>
              <th className="px-2 py-2 text-center">Feasib.</th>
              <th className="px-2 py-2 text-center">Demo</th>
              <th className="px-2 py-2 text-center">Edge</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">My call</th>
              <th className="px-3 py-2">Yours</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ idea, s, total, status, hasNote }) => (
              <tr key={idea.slug} className="border-t border-slate-800 hover:bg-slate-900/60">
                <td className="px-3 py-2">
                  <Link href={`/ideas/${idea.slug}`} className="font-semibold text-white hover:text-cyan-300">
                    <span className="mr-2 text-slate-500">{idea.n}</span>
                    {idea.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${TRACKS[idea.track].chip}`}>
                    {TRACKS[idea.track].label}
                  </span>
                </td>
                {(["fit", "feasibility", "demo", "edge"] as const).map((k) => (
                  <td key={k} className="px-2 py-2 text-center text-slate-200">
                    {s[k]}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${(total / 5) * 100}%` }} />
                    </div>
                    <span className="font-semibold text-white">{total.toFixed(2)}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${REC_CLS[idea.rec]}`}>
                    {idea.rec}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">
                  {STATUS_LABEL[status]} {hasNote && <span title="Has notes">📝</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
