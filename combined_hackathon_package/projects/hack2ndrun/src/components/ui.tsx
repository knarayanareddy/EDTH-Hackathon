import { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Panel({ title, kicker, children, className, right }: { title?: string; kicker?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.03]", className)}>
      {(title || kicker) && (
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            {kicker && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400/80">{kicker}</div>}
            {title && <div className="text-sm font-semibold text-slate-100">{title}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function H({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="mb-3 mt-10">
      {kicker && <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">{kicker}</div>}
      <h3 className="text-lg font-semibold text-white">{children}</h3>
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "green" | "red" | "cyan" | "violet" }) {
  const tones = {
    slate: "bg-white/5 text-slate-300 border-white/10",
    amber: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
    red: "bg-rose-400/10 text-rose-300 border-rose-400/30",
    cyan: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
    violet: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider", tones[tone])}>{children}</span>;
}

export function Callout({ children, tone = "amber", title }: { children: ReactNode; tone?: "amber" | "red" | "cyan" | "green"; title?: string }) {
  const tones = {
    amber: "border-amber-400/30 bg-amber-400/[0.06] text-amber-100",
    red: "border-rose-400/30 bg-rose-400/[0.06] text-rose-100",
    cyan: "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-100",
    green: "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Bullets({ items, tone = "slate" }: { items: ReactNode[]; tone?: "slate" | "green" | "red" | "amber" | "cyan" }) {
  const dot = { slate: "bg-slate-500", green: "bg-emerald-400", red: "bg-rose-400", amber: "bg-amber-400", cyan: "bg-cyan-400" }[tone];
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
          <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, unit = "", hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400" />
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

export function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition hover:bg-white/[0.06]">
      <span className={cn("mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition", on ? "bg-amber-400" : "bg-white/15")}>
        <span className={cn("h-3 w-3 rounded-full bg-slate-950 transition", on ? "translate-x-3" : "")} />
      </span>
      <span>
        <span className="block text-xs font-medium text-slate-200">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}

export function Btn({ children, onClick, tone = "slate", disabled, className }: { children: ReactNode; onClick?: () => void; tone?: "slate" | "amber" | "green" | "red"; disabled?: boolean; className?: string }) {
  const tones = {
    slate: "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
    amber: "border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25",
    green: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25",
    red: "border-rose-400/40 bg-rose-400/15 text-rose-200 hover:bg-rose-400/25",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40", tones[tone], className)}>
      {children}
    </button>
  );
}

export function Stat({ label, value, tone = "slate", sub }: { label: string; value: ReactNode; tone?: "slate" | "amber" | "green" | "red" | "cyan"; sub?: string }) {
  const c = { slate: "text-slate-100", amber: "text-amber-300", green: "text-emerald-300", red: "text-rose-300", cyan: "text-cyan-300" }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", c)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export const CRITERIA = [
  { key: "feas", label: "Finishable in ~24h" },
  { key: "wow", label: "Demo impact" },
  { key: "proof", label: "Provable / testable" },
  { key: "ready", label: "Data & kit ready" },
  { key: "fit", label: "Fit to judged challenges" },
] as const;

export type Scores = Record<(typeof CRITERIA)[number]["key"], number>;

export function ScoreBars({ scores }: { scores: Scores }) {
  return (
    <div className="space-y-2">
      {CRITERIA.map((c) => (
        <div key={c.key} className="flex items-center gap-3">
          <div className="w-40 text-xs text-slate-400">{c.label}</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={cn("h-2 w-6 rounded-sm", n <= scores[c.key] ? "bg-amber-400" : "bg-white/10")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
