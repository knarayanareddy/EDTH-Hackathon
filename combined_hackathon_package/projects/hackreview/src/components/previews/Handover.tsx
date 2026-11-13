"use client";

import { useState } from "react";
import { Badge, Btn } from "../ui";

type St = "new" | "ack" | "checked" | "follow" | "dismissed";
type Report = {
  id: string;
  text: string;
  source: string;
  observedAt: number; // minutes from shift start
  st: St;
  reason?: string;
  note?: string;
  actedAt?: number;
};

const NOW = 62; // minutes into shift; handover time

const INIT: Report[] = [
  { id: "R-101", text: "Two persons near east fence, moving south", source: "Seismic S-01 + PIR M-03", observedAt: 14, st: "new" },
  { id: "R-102", text: "Vehicle engine noise, gate road", source: "Acoustic A-02", observedAt: 33, st: "new" },
  { id: "R-103", text: "Unidentified heat signature, tree line", source: "UAV-1 thermal", observedAt: 51, st: "new" },
];

const ST_LABEL: Record<St, { l: string; t: "mute" | "info" | "ok" | "warn" | "hold" }> = {
  new: { l: "NEW", t: "mute" },
  ack: { l: "ACKNOWLEDGED (not checked)", t: "info" },
  checked: { l: "CHECKED", t: "ok" },
  follow: { l: "NEEDS FOLLOW-UP", t: "warn" },
  dismissed: { l: "DISMISSED", t: "hold" },
};

function clock(m: number) {
  const h = 6 + Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function Handover() {
  const [view, setView] = useState<"op" | "handover">("op");
  const [reports, setReports] = useState<Report[]>(INIT);
  const [openId, setOpenId] = useState<string>("R-101");
  const [draft, setDraft] = useState("");

  function update(id: string, patch: Partial<Report>) {
    setReports((p) => p.map((r) => (r.id === id ? { ...r, ...patch, actedAt: NOW - 40 + p.findIndex((x) => x.id === id) * 12 } : r)));
  }

  const unresolved = reports.filter((r) => r.st === "new" || r.st === "ack" || r.st === "follow");

  function exportText() {
    const lines = [
      "HANDOVER SUMMARY (simulated scenario)",
      `Generated at ${clock(NOW)}. Source of every line is listed in brackets.`,
      "",
      "UNRESOLVED:",
      ...unresolved.map((r) => `- ${r.id} [${r.source}] ${r.text} (observed ${clock(r.observedAt)}, ${NOW - r.observedAt} min old) status=${ST_LABEL[r.st].l}`),
      "",
      "TIMELINE:",
      ...reports.flatMap((r) => [
        `${clock(r.observedAt)} OBSERVATION [${r.source}] ${r.text}`,
        ...(r.note ? [`${clock(r.observedAt + 5)} HUMAN NOTE [operator] ${r.note}`] : []),
        ...(r.st !== "new" ? [`${clock(r.observedAt + 6)} SYSTEM [state change] ${r.id} → ${ST_LABEL[r.st].l}${r.reason ? ` (reason: ${r.reason})` : ""}`] : []),
      ]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handover-summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const current = reports.find((r) => r.id === openId) ?? reports[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Btn active={view === "op"} onClick={() => setView("op")}>
          Operator view
        </Btn>
        <Btn active={view === "handover"} onClick={() => setView("handover")}>
          Handover view (shift change at {clock(NOW)})
        </Btn>
      </div>

      {view === "op" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className={`cursor-pointer rounded-lg border p-3 ${openId === r.id ? "border-cyan-500/60 bg-slate-800/60" : "border-slate-800 bg-slate-950/60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{r.id}</p>
                  <Badge tone={ST_LABEL[r.st].t}>{ST_LABEL[r.st].l}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-200">{r.text}</p>
                <p className="text-xs text-slate-400">
                  {r.source} · observed {clock(r.observedAt)}
                </p>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Act on {current.id}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn onClick={() => update(current.id, { st: "ack" })}>Acknowledge only</Btn>
              <Btn tone="primary" onClick={() => update(current.id, { st: "checked", note: current.note || draft || "Checked, see note." })}>
                Mark checked
              </Btn>
              <Btn onClick={() => update(current.id, { st: "follow" })}>Needs follow-up</Btn>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Dismiss with a reason (one tap)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {["duplicate", "irrelevant", "uncertain"].map((reason) => (
                <Btn key={reason} onClick={() => update(current.id, { st: "dismissed", reason })}>
                  {reason}
                </Btn>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Free-text note (optional)</p>
            <div className="mt-1 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What did you check?"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
              />
              <Btn
                disabled={!draft.trim()}
                onClick={() => {
                  update(current.id, { note: draft.trim() });
                  setDraft("");
                }}
              >
                Save note
              </Btn>
            </div>
            {current.note && (
              <p className="mt-2 rounded border border-slate-800 p-2 text-sm text-slate-200">
                <Badge tone="info">Human note</Badge> {current.note}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-white">Unresolved: {unresolved.length}</p>
            {unresolved.length === 0 ? (
              <p className="text-xs text-slate-300">Nothing outstanding. Every report was checked or dismissed with a reason.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-slate-100">
                {unresolved.map((r) => (
                  <li key={r.id}>
                    <strong>{r.id}</strong> {ST_LABEL[r.st].l.toLowerCase()} · based on a report <strong>{NOW - r.observedAt} min old</strong>
                    {NOW - r.observedAt > 30 && <span className="text-amber-300"> · possibly stale</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ol className="space-y-2">
            {reports.flatMap((r) => [
              <li key={`${r.id}-o`} className="grid grid-cols-[52px_96px_1fr] items-start gap-2 text-sm">
                <span className="font-mono text-xs text-slate-400">{clock(r.observedAt)}</span>
                <Badge tone="mute">Observation</Badge>
                <span className="text-slate-100">
                  {r.text} <span className="text-xs text-slate-500">[{r.source}]</span>
                </span>
              </li>,
              ...(r.note
                ? [
                    <li key={`${r.id}-n`} className="grid grid-cols-[52px_96px_1fr] items-start gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">{clock(r.observedAt + 5)}</span>
                      <Badge tone="info">Human note</Badge>
                      <span className="text-slate-100">{r.note}</span>
                    </li>,
                  ]
                : []),
              ...(r.st !== "new"
                ? [
                    <li key={`${r.id}-s`} className="grid grid-cols-[52px_96px_1fr] items-start gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">{clock(r.observedAt + 6)}</span>
                      <Badge tone="hold">System</Badge>
                      <span className="text-slate-300">
                        {r.id} → {ST_LABEL[r.st].l}
                        {r.reason ? ` (reason: ${r.reason})` : ""}
                      </span>
                    </li>,
                  ]
                : []),
            ])}
          </ol>
          <Btn tone="primary" onClick={exportText}>
            Export handover summary (.txt)
          </Btn>
        </div>
      )}
    </div>
  );
}
